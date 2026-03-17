"use client";

import { useState, useMemo } from "react";
import { MOCK_HOTSPOTS } from "@/lib/mock-data";
import { Hotspot } from "@/lib/types";
import CategoryTabs from "@/components/hotspot/CategoryTabs";
import MapContainer from "@/components/hotspot/MapContainer";
import ReportModal from "@/components/hotspot/ReportModal";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [hotspots, setHotspots] = useState<Hotspot[]>(MOCK_HOTSPOTS);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const { toast } = useToast();

  const filteredHotspots = useMemo(() => {
    if (activeCategory === "전체") return hotspots;
    return hotspots.filter((h) => h.category === activeCategory);
  }, [hotspots, activeCategory]);

  const handleReport = (id: string, level: 1 | 2 | 3) => {
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
    
    toast({
      title: "제보가 완료되었습니다",
      description: "실시간 정보 업데이트에 기여해주셔서 감사합니다.",
    });
    
    setSelectedHotspot(null);
  };

  return (
    <main className="flex flex-col h-screen w-full bg-white font-body relative overflow-hidden">
      {/* Top Header & Tabs */}
      <div className="z-10 bg-white">
        <header className="px-6 py-4 border-b flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-xs">T</span>
            Toss Hotspot
          </h1>
          <div className="text-[10px] font-bold bg-secondary px-2 py-1 rounded text-primary">LIVE</div>
        </header>
        <CategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </div>

      {/* Map Content */}
      <MapContainer
        hotspots={filteredHotspots}
        onSelectHotspot={setSelectedHotspot}
        selectedHotspot={selectedHotspot}
      />

      {/* Report Sheet */}
      <ReportModal
        hotspot={selectedHotspot}
        onClose={() => setSelectedHotspot(null)}
        onReport={handleReport}
      />

      {/* Summary Footer Widget (Optional) */}
      <div className="absolute bottom-6 left-6 right-16 z-10 pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl toss-shadow pointer-events-auto border inline-block max-w-[240px]">
          <p className="text-xs font-bold text-gray-400 mb-1">인기 급상승 장소</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-gray-800">여의도 윤중로 🌸</span>
          </div>
        </div>
      </div>

      <Toaster />
    </main>
  );
}
