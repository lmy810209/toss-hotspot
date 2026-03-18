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
import { Search, X } from "lucide-react";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | undefined>(undefined);
  const [panTrigger, setPanTrigger] = useState(0);
  const [panToCoords, setPanToCoords] = useState<{ lat: number; lng: number; key: number } | undefined>();
  const [showSearch, setShowSearch] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(true); // 초기값 true → 깜빡임 방지

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

  const topSpots = useMemo(
    () => [...hotspots].sort((a, b) => b.report_count - a.report_count).slice(0, 3),
    [hotspots]
  );

  return (
    <main className="flex flex-col h-screen w-full bg-background font-body relative overflow-hidden">
      {/* 헤더 + 배너 + 카테고리 탭 */}
      <div className="z-10 bg-white border-b border-toss-gray-200 shadow-sm">
        <header className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2.5">
            <span className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm">
              T
            </span>
            Toss Hotspot
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
        onBoundsChange={setMapBounds}
        panToUserTrigger={panTrigger}
        onPanToUser={() => setPanTrigger((t) => t + 1)}
        panToCoords={panToCoords}
      />

      {/* 인기 급상승 위젯 */}
      {topSpots.length > 0 && (
        <div className="absolute bottom-20 left-4 z-10 pointer-events-none">
          <div className="bg-white/96 backdrop-blur-md rounded-2xl toss-shadow border border-toss-gray-200 pointer-events-auto w-[230px] overflow-hidden">
            <div className="px-4 pt-3 pb-2.5 border-b border-toss-gray-100 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shrink-0" />
              <p className="text-[10px] font-bold text-toss-gray-500 uppercase tracking-wide">
                {activeCategory === "전체" ? "인기 급상승" : `${activeCategory} 인기`}
              </p>
            </div>
            <div className="divide-y divide-toss-gray-50">
              {topSpots.map((spot, i) => {
                const levelColor = ({ 1: "#22c55e", 2: "#f59e0b", 3: "#ef4444" } as Record<number, string>)[spot.congestion_level];
                const levelText  = ({ 1: "여유", 2: "보통", 3: "붐빔" } as Record<number, string>)[spot.congestion_level];
                return (
                  <button
                    key={spot.id}
                    onClick={() => handleSelectFromSearch(spot)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-toss-gray-50 active:bg-toss-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-toss-gray-300 w-3 shrink-0">{i + 1}</span>
                      <span className="flex-1 text-sm font-bold text-toss-gray-900 truncate">{spot.name}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{ background: levelColor }}>
                        {levelText}
                      </span>
                    </div>
                    <p className="text-[10px] text-toss-gray-400 mt-0.5 ml-5">{spot.report_count}명 제보</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
