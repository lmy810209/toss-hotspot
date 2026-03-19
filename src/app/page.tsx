"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Hotspot, MapBounds } from "@/lib/types";
import CategoryTabs from "@/components/hotspot/CategoryTabs";
import MapContainer from "@/components/hotspot/MapContainer";
import BottomSheet from "@/components/hotspot/BottomSheet";
import SearchModal from "@/components/hotspot/SearchModal";
import CoinAnimation from "@/components/ui/CoinAnimation";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "@/hooks/use-location";
import { useHotspots } from "@/hooks/use-hotspots";
import { Search, X, RotateCw, MapPin, Crosshair } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { computeCongestion, formatReportTime, getWalkTime } from "@/lib/congestion";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | undefined>(undefined);
  const [panTrigger, setPanTrigger] = useState(0);
  const [panToCoords, setPanToCoords] = useState<{ lat: number; lng: number; key: number } | undefined>();
  const [showSearch, setShowSearch] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(true); // 초기값 true → 깜빡임 방지
  const [radius, setRadius] = useState<1 | 3 | 5>(3); // km
  const [recommendBase, setRecommendBase] = useState<
    { type: "user" } | { type: "map"; lat: number; lng: number } | { type: "auto" }
  >({ type: "auto" });
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [showAreaButton, setShowAreaButton] = useState(false);

  const { toast } = useToast();
  const { userLocation, isLoading: locationLoading, refresh: refreshLocation } = useLocation();
  const { hotspots, isFirestoreConnected, reportCongestion } = useHotspots(activeCategory, mapBounds);

  // localStorage에서 배너 닫힘 여부 로드
  useEffect(() => {
    setBannerDismissed(localStorage.getItem("cherry_banner_dismissed") === "1");
  }, []);

  const dismissBanner = () => {
    localStorage.setItem("cherry_banner_dismissed", "1");
    setBannerDismissed(true);
  };

  // 거리 계산 (m)
  const getDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // 지도 이동 시 중심 좌표 추적 + "이 지역에서 다시 찾기" 표시
  const handleBoundsChange = useCallback(
    (bounds: MapBounds) => {
      setMapBounds(bounds);
      const center = { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 };
      setMapCenter(center);

      // auto 모드: 지도 이동하면 자동으로 따라가므로 버튼 불필요
      if (recommendBase.type === "auto") {
        setShowAreaButton(false);
        return;
      }
      // user/map 모드: 기준 좌표와 비교
      const baseLat = recommendBase.type === "user" ? userLocation?.lat : recommendBase.lat;
      const baseLng = recommendBase.type === "user" ? userLocation?.lng : recommendBase.lng;
      if (baseLat != null && baseLng != null) {
        const moved = getDistance(baseLat, baseLng, center.lat, center.lng);
        setShowAreaButton(moved > 500);
      }
    },
    [recommendBase, userLocation, getDistance]
  );

  const handleReport = useCallback(
    async (id: string, level: 1 | 2 | 3) => {
      await reportCongestion(id, level);
      setShowCoinAnimation(true);
      toast({
        title: "제보 완료! 10원 적립됐어요 🎉",
        description: "덕분에 더 정확한 혼잡도 정보가 됐어요. 감사해요!",
      });
    },
    [reportCongestion, toast]
  );

  // 검색 결과 선택 → 바텀시트 + 지도 이동
  const handleSelectFromSearch = useCallback((spot: Hotspot) => {
    setSelectedHotspot(spot);
    setPanToCoords({ lat: spot.lat, lng: spot.lng, key: Date.now() });
  }, []);

  // 추천 기준 좌표: auto/map=지도 중심, user=GPS
  const recBase = useMemo(() => {
    if (recommendBase.type === "user" && userLocation) {
      return { lat: userLocation.lat, lng: userLocation.lng };
    }
    if (recommendBase.type === "map") {
      return { lat: recommendBase.lat, lng: recommendBase.lng };
    }
    // auto: 지도 중심 기준
    if (mapCenter) return { lat: mapCenter.lat, lng: mapCenter.lng };
    return null;
  }, [recommendBase, userLocation, mapCenter]);


  // 반경 내 TOP 3 추천 (1순위 한산 → 2순위 가까움 → 3순위 최근 제보)
  const topSpots = useMemo(() => {
    if (!recBase) return [];
    const radiusM = radius * 1000;
    const scored = hotspots
      .map((h) => {
        const dist = getDistance(recBase.lat, recBase.lng, h.lat, h.lng);
        if (dist > radiusM) return null;
        const c = h.computed ?? computeCongestion(h.recentReports ?? []);
        // 한산함 우선 (1순위)
        const hansanScore = (4 - c.level) * 25; // 한산=75, 보통=50, 붐빔=25
        // 가까움 (2순위)
        const distScore = Math.max(0, 1 - dist / radiusM) * 30;
        // 최근 제보 있음 (3순위) - 데이터 신뢰도
        const freshness = c.lastReportedAt
          ? Math.max(0, 1 - (Date.now() - c.lastReportedAt.getTime()) / (30 * 60 * 1000)) * 20
          : 0;
        const priorityBonus = Math.min(h.priorityScore ?? 0, 15);
        return { ...h, dist, computed: c, score: hansanScore + distScore + freshness + priorityBonus };
      })
      .filter(Boolean) as (Hotspot & { dist: number; score: number })[];
    return scored.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [hotspots, recBase, radius, getDistance]);

  return (
    <main className="flex flex-col h-screen w-full bg-background font-body relative overflow-hidden">
      {/* 헤더 + 배너 + 카테고리 탭 */}
      <div className="z-10 bg-white border-b border-toss-gray-200 shadow-sm">
        <header className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2.5">
            <span className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm">
              N
            </span>
            {APP_NAME}
          </h1>

          <div className="flex items-center gap-2">
            {/* 검색 버튼 */}
            <button
              onClick={() => setShowSearch(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-toss-gray-100 text-toss-gray-600 hover:bg-toss-gray-200 transition-colors"
              aria-label="검색"
            >
              <Search className="w-4 h-4" />
            </button>
            {isFirestoreConnected && (
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-full">
                실시간 연동
              </span>
            )}
            <span className="text-[10px] font-bold bg-red-50 text-red-500 border border-red-200 px-2 py-1 rounded-full animate-pulse">
              LIVE
            </span>
          </div>
        </header>

        {/* 🌸 벚꽃 시즌 배너 */}
        {!bannerDismissed && (
          <div className="mx-3 mb-2 flex items-center gap-2 bg-pink-50 border border-pink-200 rounded-xl px-3 py-2">
            <span className="text-base shrink-0">🌸</span>
            <button
              className="flex-1 text-left text-xs font-bold text-pink-700"
              onClick={() => {
                setActiveCategory("벚꽃");
                setBannerDismissed(true);
              }}
            >
              지금 벚꽃 명소 실시간 혼잡도 확인하세요
            </button>
            <button
              onClick={dismissBanner}
              className="text-pink-400 hover:text-pink-600 shrink-0 p-0.5"
              aria-label="배너 닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 카테고리 탭 */}
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={(cat) => {
            setActiveCategory(cat);
            setSelectedHotspot(null);
          }}
        />
      </div>

      {/* 지도 */}
      <MapContainer
        hotspots={hotspots}
        onSelectHotspot={setSelectedHotspot}
        selectedHotspot={selectedHotspot}
        userLocation={userLocation}
        onRefreshLocation={refreshLocation}
        onBoundsChange={handleBoundsChange}
        panToUserTrigger={panTrigger}
        onPanToUser={() => setPanTrigger((t) => t + 1)}
        panToCoords={panToCoords}
      />

      {/* "이 지역에서 다시 찾기" 플로팅 버튼 — 지도 상단 중앙 */}
      {showAreaButton && mapCenter && (
        <div className="absolute top-[140px] left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
          <button
            onClick={() => {
              setRecommendBase({ type: "map", lat: mapCenter.lat, lng: mapCenter.lng });
              setShowAreaButton(false);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-primary text-xs font-bold rounded-full shadow-xl border border-primary/20 hover:bg-primary hover:text-white active:scale-95 transition-all"
          >
            <MapPin className="w-3.5 h-3.5" />
            이 지역에서 다시 찾기
          </button>
        </div>
      )}

      {/* 지금 갈만한 곳 TOP 3 */}
      <div className="absolute bottom-20 left-4 z-10 pointer-events-none">
        <div className="bg-white backdrop-blur-md rounded-2xl border border-toss-gray-200 pointer-events-auto w-[265px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
          {/* 헤더 */}
          <div className="px-4 pt-3.5 pb-3 border-b border-toss-gray-100 bg-gradient-to-r from-primary/5 to-transparent">
            <p className="text-[13px] font-black text-toss-gray-900 mb-2.5">지금 갈만한 곳</p>

            {/* 첫 줄: 내 위치 / 이 지역 */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => {
                  setRecommendBase({ type: "user" });
                  setShowAreaButton(false);
                  setPanTrigger((t) => t + 1);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  recommendBase.type === "user"
                    ? "bg-primary text-white shadow-sm"
                    : "bg-toss-gray-100 text-toss-gray-400 hover:bg-toss-gray-200"
                }`}
              >
                <Crosshair className="w-3 h-3" />
                내 위치
              </button>
              <button
                onClick={() => {
                  if (mapCenter) {
                    setRecommendBase({ type: "map", lat: mapCenter.lat, lng: mapCenter.lng });
                    setShowAreaButton(false);
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  recommendBase.type !== "user"
                    ? "bg-primary text-white shadow-sm"
                    : "bg-toss-gray-100 text-toss-gray-400 hover:bg-toss-gray-200"
                }`}
              >
                <MapPin className="w-3 h-3" />
                이 지역
              </button>
            </div>

            {/* 둘째 줄: 반경 선택 */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-toss-gray-400 shrink-0">반경</span>
              <div className="flex gap-1.5 flex-1">
                {([1, 3, 5] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      radius === r
                        ? "bg-toss-gray-900 text-white shadow-sm"
                        : "bg-toss-gray-100 text-toss-gray-400 hover:bg-toss-gray-200"
                    }`}
                  >
                    {r}km
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 추천 목록 */}
          {!recBase ? (
            <div className="px-4 py-5 text-center">
              <p className="text-[11px] text-toss-gray-400">위치 정보가 필요해요</p>
              <p className="text-[10px] text-toss-gray-300 mt-0.5">&apos;내 위치&apos; 버튼을 눌러주세요</p>
            </div>
          ) : topSpots.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-[11px] text-toss-gray-400 font-bold">근처 데이터가 부족해요</p>
              <p className="text-[10px] text-toss-gray-300 mt-0.5">반경을 넓혀보세요</p>
            </div>
          ) : (
            <div className="divide-y divide-toss-gray-50">
              {topSpots.map((spot, i) => {
                const c = spot.computed ?? computeCongestion(spot.recentReports ?? []);
                const levelColor = ({ 1: "#22c55e", 2: "#f59e0b", 3: "#ef4444" } as Record<number, string>)[c.level];
                const walkTime = getWalkTime(spot.dist);
                const lastReport = c.lastReportedAt ? formatReportTime(c.lastReportedAt) + " 제보" : "제보 없음";
                return (
                  <button
                    key={spot.id}
                    onClick={() => handleSelectFromSearch(spot)}
                    className="w-full text-left px-3.5 py-3 hover:bg-toss-gray-50 active:bg-toss-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base shrink-0">{c.emoji}</span>
                      <span className="flex-1 text-[13px] font-bold text-toss-gray-900 truncate">{spot.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: levelColor }}>
                        {c.level === 1 ? "한산" : c.level === 2 ? "보통" : "붐빔"}
                      </span>
                    </div>
                    <p className="text-[11px] text-toss-gray-500 mt-1 ml-7">
                      {c.label} · {walkTime} · {lastReport}
                    </p>
                    {c.level === 1 && c.recentCount > 0 && (
                      <p className="text-[10px] font-bold text-emerald-600 mt-0.5 ml-7">👉 지금 가면 좋음</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 바텀 시트 */}
      {selectedHotspot && (
        <BottomSheet
          hotspot={selectedHotspot}
          userLocation={userLocation}
          onClose={() => setSelectedHotspot(null)}
          onReport={handleReport}
        />
      )}

      {/* 검색 모달 */}
      {showSearch && (
        <SearchModal
          hotspots={hotspots}
          onSelect={handleSelectFromSearch}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* 코인 애니메이션 */}
      <CoinAnimation
        show={showCoinAnimation}
        onComplete={() => setShowCoinAnimation(false)}
      />

      <Toaster />
    </main>
  );
}
