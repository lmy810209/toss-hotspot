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

// bounds 변경 시 lat 범위가 0.01° 이상 달라질 때만 재쿼리
const BOUNDS_THRESHOLD = 0.01;

export function useHotspots(category: string = "전체", bounds?: MapBounds): UseHotspotsReturn {
  const [hotspots, setHotspots] = useState<Hotspot[]>(MOCK_HOTSPOTS);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // 이전 bounds 저장 — 미세한 이동 시 재쿼리 방지
  const prevBoundsRef = useRef<MapBounds | null>(null);

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

  // Firestore 실시간 구독 — 카테고리 또는 지도 bounds 변경 시 재구독
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;

    // bounds 미세 변경(< BOUNDS_THRESHOLD°) 시 재쿼리 생략
    if (bounds && prevBoundsRef.current) {
      const prev = prevBoundsRef.current;
      const latDiff = Math.abs(bounds.south - prev.south) + Math.abs(bounds.north - prev.north);
      if (latDiff < BOUNDS_THRESHOLD) return;
    }
    if (bounds) prevBoundsRef.current = bounds;

    // 이전 구독 해제
    unsubscribeRef.current?.();

    try {
      /**
       * Geo 필터링: bounds 있으면 lat 범위 쿼리 (Firestore 단일 필드 range)
       * → lng는 Firestore 쿼리 제한으로 클라이언트에서 필터
       * → lat 인덱스 자동 생성됨 (단일 필드)
       *
       * bounds 없을 때: 기존 카테고리 쿼리 유지
       */
      const PAD = 0.02; // 화면 경계에서 약 2km 여유
      let q;

      if (bounds) {
        // Geo 범위 쿼리: lat만 Firestore에서, lng는 클라이언트 필터
        const conditions = [
          where("lat", ">=", bounds.south - PAD),
          where("lat", "<=", bounds.north + PAD),
        ];
        if (category !== "전체") {
          // lat range + category 동시 사용 불가 → lat만 쿼리 후 클라이언트 필터
        }
        q = query(collection(db, "hotspots"), ...conditions, orderBy("lat", "asc"));
      } else if (category === "전체") {
        q = query(collection(db, "hotspots"), orderBy("report_count", "desc"));
      } else {
        q = query(
          collection(db, "hotspots"),
          where("category", "==", category),
          orderBy("report_count", "desc")
        );
      }

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

          // 클라이언트 필터: lng 범위 + 카테고리(bounds 쿼리 시)
          if (bounds) {
            data = data.filter(
              (h) => h.lng >= bounds.west - PAD && h.lng <= bounds.east + PAD
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
  }, [category, bounds]);

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
