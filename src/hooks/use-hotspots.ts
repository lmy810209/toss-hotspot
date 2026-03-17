"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  increment,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MOCK_HOTSPOTS } from "@/lib/mock-data";
import { Hotspot, CongestionLevel } from "@/lib/types";

/** 토스플레이스 가맹점을 최상단으로, 나머지는 report_count 내림차순 */
function sortWithTossPlaceFirst(arr: Hotspot[]): Hotspot[] {
  return [...arr].sort((a, b) => {
    if (a.is_toss_place && !b.is_toss_place) return -1;
    if (!a.is_toss_place && b.is_toss_place) return 1;
    return b.report_count - a.report_count;
  });
}

interface UseHotspotsReturn {
  hotspots: Hotspot[];
  isFirestoreConnected: boolean;
  reportCongestion: (id: string, level: CongestionLevel) => Promise<void>;
}

export function useHotspots(category: string = "전체"): UseHotspotsReturn {
  const [hotspots, setHotspots] = useState<Hotspot[]>(MOCK_HOTSPOTS);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 카테고리 변경 시 mock 데이터 즉시 반영 (TossPlace 우선 정렬)
  useEffect(() => {
    if (!isFirestoreConnected) {
      const filtered =
        category === "전체"
          ? MOCK_HOTSPOTS
          : MOCK_HOTSPOTS.filter((h) => h.category === category);
      setHotspots(sortWithTossPlaceFirst(filtered));
    }
  }, [category, isFirestoreConnected]);

  // Firestore 실시간 구독 — 카테고리가 바뀌면 쿼리 재구독
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;

    // 이전 구독 해제
    unsubscribeRef.current?.();

    try {
      /**
       * 카테고리별 Firestore 쿼리.
       * '전체': report_count 내림차순 전체 조회
       * 특정 카테고리: where('category', '==', ...) + orderBy 조합
       *   → Firestore 복합 인덱스 필요: category ASC + report_count DESC
       *   → Firebase Console > Firestore > 인덱스에서 자동 생성 링크 제공
       */
      const q =
        category === "전체"
          ? query(collection(db, "hotspots"), orderBy("report_count", "desc"))
          : query(
              collection(db, "hotspots"),
              where("category", "==", category),
              orderBy("report_count", "desc")
            );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            setIsFirestoreConnected(false);
            // mock 데이터로 fallback
            setHotspots(
              category === "전체"
                ? MOCK_HOTSPOTS
                : MOCK_HOTSPOTS.filter((h) => h.category === category)
            );
            return;
          }

          setIsFirestoreConnected(true);
          const data: Hotspot[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              name: d.name ?? "",
              category: d.category ?? "",
              lat: d.lat ?? 0,
              lng: d.lng ?? 0,
              congestion_level: (d.congestion_level ?? 1) as CongestionLevel,
              last_updated: d.last_updated?.toDate?.() ?? new Date(),
              report_count: d.report_count ?? 0,
              description: d.description,
              is_toss_place: d.is_toss_place ?? false,
            };
          });
          // 토스플레이스 가맹점 최상단 노출
          setHotspots(sortWithTossPlaceFirst(data));
        },
        (err) => {
          // 복합 인덱스 미생성 시 → where만 사용해 재시도
          if (err.code === "failed-precondition" && category !== "전체") {
            console.warn("[useHotspots] 복합 인덱스 없음, 클라이언트 정렬로 fallback");
            const fallbackQ = query(
              collection(db, "hotspots"),
              where("category", "==", category)
            );
            onSnapshot(fallbackQ, (snap) => {
              if (!snap.empty) {
                setIsFirestoreConnected(true);
                const data: Hotspot[] = snap.docs
                  .map((d) => ({
                    id: d.id,
                    name: d.data().name ?? "",
                    category: d.data().category ?? "",
                    lat: d.data().lat ?? 0,
                    lng: d.data().lng ?? 0,
                    congestion_level: (d.data().congestion_level ?? 1) as CongestionLevel,
                    last_updated: d.data().last_updated?.toDate?.() ?? new Date(),
                    report_count: d.data().report_count ?? 0,
                    description: d.data().description,
                  }))
                  .sort((a, b) => b.report_count - a.report_count);
                setHotspots(sortWithTossPlaceFirst(data));
              }
            });
          } else {
            console.warn("[useHotspots] Firestore 오류, mock 사용:", err.message);
            setIsFirestoreConnected(false);
          }
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      console.warn("[useHotspots] Firebase 초기화 오류:", err);
    }

    return () => {
      unsubscribeRef.current?.();
    };
  }, [category]);

  /**
   * 혼잡도 제보: Firestore 낙관적 업데이트 + serverTimestamp
   */
  const reportCongestion = useCallback(
    async (id: string, level: CongestionLevel) => {
      // 낙관적 UI 반영
      setHotspots((prev) =>
        prev.map((spot) =>
          spot.id === id
            ? {
                ...spot,
                congestion_level: level,
                report_count: spot.report_count + 1,
                last_updated: new Date(),
              }
            : spot
        )
      );

      if (isFirestoreConnected) {
        try {
          await updateDoc(doc(db, "hotspots", id), {
            congestion_level: level,
            last_updated: serverTimestamp(),
            report_count: increment(1),
          });
        } catch (err) {
          console.error("[useHotspots] Firestore 업데이트 실패:", err);
        }
      }
    },
    [isFirestoreConnected]
  );

  return { hotspots, isFirestoreConnected, reportCongestion };
}
