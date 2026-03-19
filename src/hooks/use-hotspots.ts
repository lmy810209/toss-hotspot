"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  increment,
  query,
  orderBy,
  where,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MOCK_HOTSPOTS } from "@/lib/mock-data";
import { Hotspot, CongestionLevel, CongestionReport, MapBounds } from "@/lib/types";
import { computeCongestion } from "@/lib/congestion";

function sortByReport(arr: Hotspot[]): Hotspot[] {
  return [...arr].sort((a, b) => b.report_count - a.report_count);
}

interface UseHotspotsReturn {
  hotspots: Hotspot[];
  isFirestoreConnected: boolean;
  reportCongestion: (id: string, level: CongestionLevel) => Promise<void>;
}

const BOUNDS_THRESHOLD = 0.05;
const REPORT_WINDOW_MS = 30 * 60 * 1000; // 30분

export function useHotspots(category: string = "전체", bounds?: MapBounds): UseHotspotsReturn {
  const [hotspots, setHotspots] = useState<Hotspot[]>(MOCK_HOTSPOTS);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const stableBoundsRef = useRef<MapBounds | null>(null);
  const [queryKey, setQueryKey] = useState(0);
  const reportsCache = useRef<Map<string, CongestionReport[]>>(new Map());

  useEffect(() => {
    if (!bounds) return;
    const prev = stableBoundsRef.current;
    if (!prev) {
      stableBoundsRef.current = bounds;
      setQueryKey((k) => k + 1);
      return;
    }
    const latDiff = Math.abs(bounds.south - prev.south) + Math.abs(bounds.north - prev.north);
    if (latDiff >= BOUNDS_THRESHOLD) {
      stableBoundsRef.current = bounds;
      setQueryKey((k) => k + 1);
    }
  }, [bounds]);

  useEffect(() => {
    if (!isFirestoreConnected) {
      const filtered = category === "전체" ? MOCK_HOTSPOTS : MOCK_HOTSPOTS.filter((h) => h.category === category);
      setHotspots(sortByReport(filtered));
    }
  }, [category, isFirestoreConnected]);

  // 특정 핫스팟의 최근 30분 제보를 가져와 혼잡도 계산
  const fetchReports = useCallback(async (hotspotId: string): Promise<CongestionReport[]> => {
    try {
      const cutoff = Timestamp.fromDate(new Date(Date.now() - REPORT_WINDOW_MS));
      const q = query(
        collection(db, "hotspots", hotspotId, "reports"),
        where("timestamp", ">=", cutoff),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocs(q);
      const reports: CongestionReport[] = snap.docs.map((d) => ({
        level: d.data().level as CongestionLevel,
        timestamp: d.data().timestamp?.toDate() ?? new Date(),
        sessionId: d.data().sessionId ?? "",
      }));
      reportsCache.current.set(hotspotId, reports);
      return reports;
    } catch {
      return reportsCache.current.get(hotspotId) ?? [];
    }
  }, []);

  // 핫스팟 리스트에 실시간 혼잡도 붙이기
  const enrichWithCongestion = useCallback(async (spots: Hotspot[]): Promise<Hotspot[]> => {
    // 성능: 상위 30개만 제보 조회
    const toEnrich = spots.slice(0, 30);
    const results = await Promise.all(
      toEnrich.map(async (h) => {
        const reports = await fetchReports(h.id);
        const computed = computeCongestion(reports);
        return {
          ...h,
          recentReports: reports,
          computed,
          congestion_level: computed.recentCount > 0 ? computed.level : h.congestion_level,
        };
      })
    );
    // 나머지는 기본 computed 없이 반환
    const remaining = spots.slice(30).map((h) => ({
      ...h,
      computed: computeCongestion([]),
    }));
    return [...results, ...remaining];
  }, [fetchReports]);

  // Firestore 실시간 구독
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return;
    unsubscribeRef.current?.();

    const currentBounds = stableBoundsRef.current;
    // bounds 내 결과가 적을 수 있으므로 넓게 가져옴 (최소 ±0.05 ≈ 5km)
    const latSpan = currentBounds ? currentBounds.north - currentBounds.south : 0;
    const PAD = Math.max(0.05, latSpan * 0.3); // 최소 5km 확장
    let q;

    if (currentBounds) {
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
        async (snapshot) => {
          if (snapshot.empty) {
            setIsFirestoreConnected(false);
            setHotspots(category === "전체" ? MOCK_HOTSPOTS : MOCK_HOTSPOTS.filter((h) => h.category === category));
            return;
          }

          setIsFirestoreConnected(true);
          let data: Hotspot[] = snapshot.docs
            .map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                name: d.name ?? "",
                category: d.category ?? "",
                lat: d.lat ?? 0,
                lng: d.lng ?? 0,
                congestion_level: (d.congestion_level ?? 2) as CongestionLevel,
                last_updated: d.last_updated?.toDate?.() ?? new Date(),
                report_count: d.report_count ?? 0,
                description: d.description,
                is_toss_place: d.is_toss_place ?? false,
                address: d.address,
                naverLink: d.naverLink,
                imageUrl: d.imageUrl,
                tags: d.tags ?? [],
                priorityScore: d.priorityScore ?? 0,
                popularityScore: d.popularityScore ?? 0,
                isVisible: d.isVisible ?? true,
                adminMemo: d.adminMemo,
                sourceCategory: d.sourceCategory ?? "",
                source: d.source ?? "",
                region: d.region ?? "",
              };
            })
            .filter((h) => h.isVisible !== false);

          if (currentBounds) {
            data = data.filter(
              (h) => h.lng >= currentBounds.west - PAD && h.lng <= currentBounds.east + PAD
            );
            if (category !== "전체") {
              data = data.filter((h) => h.category === category);
            }
          }

          // 실시간 제보 데이터로 혼잡도 계산
          const enriched = await enrichWithCongestion(sortByReport(data));
          setHotspots(enriched);
        },
        (err) => {
          console.warn("[useHotspots] Firestore 오류:", err.message);
          setIsFirestoreConnected(false);
        }
      );
      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      console.warn("[useHotspots] Firebase 초기화 오류:", err);
    }

    return () => { unsubscribeRef.current?.(); };
  }, [category, queryKey, enrichWithCongestion]);

  // 30초마다 혼잡도 갱신 (시간 감쇠 반영)
  useEffect(() => {
    if (!isFirestoreConnected) return;
    const interval = setInterval(async () => {
      const enriched = await enrichWithCongestion(hotspots);
      setHotspots(enriched);
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirestoreConnected, enrichWithCongestion]);

  // 제보: 서브컬렉션에 기록
  const reportCongestion = useCallback(
    async (id: string, level: CongestionLevel) => {
      const sessionId = typeof window !== "undefined"
        ? (sessionStorage.getItem("__nookup_sid__") || (() => {
            const sid = crypto.randomUUID();
            sessionStorage.setItem("__nookup_sid__", sid);
            return sid;
          })())
        : "unknown";

      // 낙관적 업데이트
      const newReport: CongestionReport = { level, timestamp: new Date(), sessionId };
      setHotspots((prev) =>
        prev.map((spot) => {
          if (spot.id !== id) return spot;
          const reports = [...(spot.recentReports ?? []), newReport];
          const computed = computeCongestion(reports);
          return {
            ...spot,
            congestion_level: computed.level,
            report_count: spot.report_count + 1,
            last_updated: new Date(),
            recentReports: reports,
            computed,
          };
        })
      );

      if (isFirestoreConnected) {
        try {
          // 서브컬렉션에 제보 기록
          await addDoc(collection(db, "hotspots", id, "reports"), {
            level,
            timestamp: serverTimestamp(),
            sessionId,
          });
          // 부모 문서 카운터 증가
          await updateDoc(doc(db, "hotspots", id), {
            report_count: increment(1),
            last_updated: serverTimestamp(),
            congestion_level: level, // 마지막 제보 기준 (폴백용)
          });
        } catch (err) {
          console.error("[useHotspots] 제보 저장 실패:", err);
        }
      }
    },
    [isFirestoreConnected]
  );

  return { hotspots, isFirestoreConnected, reportCongestion };
}
