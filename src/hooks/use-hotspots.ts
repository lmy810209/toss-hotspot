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
import { Hotspot, CongestionLevel, MapBounds } from "@/lib/types";

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

// bounds 변경 시 lat 범위가 이 값 이상 달라질 때만 Firestore 재쿼리
const BOUNDS_THRESHOLD = 0.05; // 약 5km

export function useHotspots(category: string = "전체", bounds?: MapBounds): UseHotspotsReturn {
  const [hotspots, setHotspots] = useState<Hotspot[]>(MOCK_HOTSPOTS);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // 실제 Firestore 쿼리에 쓸 "확정 bounds" — threshold 넘을 때만 갱신
  const stableBoundsRef = useRef<MapBounds | null>(null);
  // 재쿼리 트리거용 카운터 (bounds 객체 참조 대신 숫자로 의존성 관리)
  const [queryKey, setQueryKey] = useState(0);

  // bounds가 바뀔 때마다 threshold 비교 → 유의미한 이동만 재쿼리
  useEffect(() => {
    if (!bounds) return;
    const prev = stableBoundsRef.current;
    if (!prev) {
      stableBoundsRef.current = bounds;
      setQueryKey((k) => k + 1);
      return;
    }
    const latDiff =
      Math.abs(bounds.south - prev.south) + Math.abs(bounds.north - prev.north);
    if (latDiff >= BOUNDS_THRESHOLD) {
      stableBoundsRef.current = bounds;
      setQueryKey((k) => k + 1);
    }
  }, [bounds]);

  // 카테고리 변경 시 mock 데이터 즉시 반영
  useEffect(() => {
    if (!isFirestoreConnected) {
      const filtered =
        category === "전체"
          ? MOCK_HOTSPOTS
          : MOCK_HOTSPOTS.filter((h) => h.category === category);
      setHotspots(sortWithTossPlaceFirst(filtered));
    }
  }, [category, isFirestoreConnected]);

  // Firestore 실시간 구독 — category 또는 queryKey(유의미한 이동) 변경 시만 재구독
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;

    unsubscribeRef.current?.();

    const PAD = 0.02; // 화면 경계 밖 약 2km 여유
    const currentBounds = stableBoundsRef.current;

    let q;
    if (currentBounds) {
      // Geo 범위 쿼리: lat만 Firestore에서, lng는 클라이언트 필터
      q = query(
        collection(db, "hotspots"),
        where("lat", ">=", currentBounds.south - PAD),
        where("lat", "<=", currentBounds.north + PAD),
        orderBy("lat", "asc")
      );
    } else if (category === "전체") {
      q = query(collection(db, "hotspots"), orderBy("report_count", "desc"));
    } else {
      q = query(
        collection(db, "hotspots"),
        where("category", "==", category),
        orderBy("report_count", "desc")
      );
    }

    try {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            setIsFirestoreConnected(false);
            setHotspots(
              category === "전체"
                ? MOCK_HOTSPOTS
                : MOCK_HOTSPOTS.filter((h) => h.category === category)
            );
            return;
          }

          setIsFirestoreConnected(true);
          let data: Hotspot[] = snapshot.docs.map((docSnap) => {
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

          // 클라이언트 필터: lng 범위 + 카테고리
          if (currentBounds) {
            data = data.filter(
              (h) =>
                h.lng >= currentBounds.west - PAD &&
                h.lng <= currentBounds.east + PAD
            );
            if (category !== "전체") {
              data = data.filter((h) => h.category === category);
            }
          }

          setHotspots(sortWithTossPlaceFirst(data));
        },
        (err) => {
          console.warn("[useHotspots] Firestore 오류, mock 사용:", err.message);
          setIsFirestoreConnected(false);
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      console.warn("[useHotspots] Firebase 초기화 오류:", err);
    }

    return () => {
      unsubscribeRef.current?.();
    };
  }, [category, queryKey]); // bounds 객체 대신 queryKey 숫자로 의존성 관리

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
