"use client";

import { useState, useMemo, useCallback } from "react";
import { Hotspot } from "@/lib/types";
import CategoryTabs from "@/components/hotspot/CategoryTabs";
import MapContainer from "@/components/hotspot/MapContainer";
import BottomSheet from "@/components/hotspot/BottomSheet";
import CoinAnimation from "@/components/ui/CoinAnimation";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "@/hooks/use-location";
import { useHotspots } from "@/hooks/use-hotspots";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [showCoinAnimation, setShowCoinAnimation] = useState(false);

  const { toast } = useToast();
  const { userLocation, isLoading: locationLoading, refresh: refreshLocation } = useLocation();

  // 카테고리를 Firestore 쿼리에 직접 전달 — 탭 클릭 시 서버 쿼리 변경
  const { hotspots, isFirestoreConnected, reportCongestion } = useHotspots(activeCategory);

  const handleReport = useCallback(
    async (id: string, level: 1 | 2 | 3) => {
      await reportCongestion(id, level);

      // 코인 애니메이션 트리거
      setShowCoinAnimation(true);

      toast({
        title: "10원이 적립됐어요 🎉",
        description: "제보 덕분에 더 정확한 정보가 됐어요. 감사합니다!",
      });
    },
    [reportCongestion, toast]
  );

  // 인기 급상승 (제보 수 1위)
  const trendingSpot = useMemo(
    () => [...hotspots].sort((a, b) => b.report_count - a.report_count)[0],
    [hotspots]
  );

  return (
    <main className="flex flex-col h-screen w-full bg-background font-body relative overflow-hidden">
      {/* 헤더 + 카테고리 탭 */}
      <div className="z-10 bg-white border-b border-toss-gray-200 shadow-sm">
        <header className="px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2.5">
            <span className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm">
              T
            </span>
            Toss Hotspot
          </h1>

          <div className="flex items-center gap-2">
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

        {/* 카테고리 탭 — 클릭 시 Firestore 쿼리 변경 */}
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={(cat) => {
            setActiveCategory(cat);
            setSelectedHotspot(null); // 탭 변경 시 바텀 시트 닫기
          }}
        />
      </div>

      {/* 카카오맵 / Mock 지도 */}
      <MapContainer
        hotspots={hotspots}
        onSelectHotspot={setSelectedHotspot}
        selectedHotspot={selectedHotspot}
        userLocation={userLocation}
        onRefreshLocation={refreshLocation}
      />

      {/* 인기 급상승 위젯 */}
      {trendingSpot && (
        <div className="absolute bottom-6 left-6 z-10 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl toss-shadow border border-toss-gray-200 pointer-events-auto max-w-[220px]">
            <p className="text-[10px] font-bold text-toss-gray-400 uppercase tracking-wide mb-1.5">
              {activeCategory === "전체" ? "인기 급상승" : `${activeCategory} 인기`}
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
              <span className="text-sm font-bold text-toss-gray-900 truncate">
                {trendingSpot.name}
              </span>
            </div>
            <p className="text-[11px] text-toss-gray-400 mt-0.5">
              {trendingSpot.report_count}명 제보
            </p>
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

      {/* 토스 포인트 코인 애니메이션 */}
      <CoinAnimation
        show={showCoinAnimation}
        onComplete={() => setShowCoinAnimation(false)}
      />

      <Toaster />
    </main>
  );
}
