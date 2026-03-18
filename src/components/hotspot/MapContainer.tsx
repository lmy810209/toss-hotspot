"use client";

import { Hotspot, UserLocation, MapBounds } from "@/lib/types";
import { Navigation } from "lucide-react";
import dynamic from "next/dynamic";

// Leaflet 기반 지도 — SSR 비활성화 (브라우저 전용 API)
const LeafletMapView = dynamic(() => import("./KakaoMapView"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-toss-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm text-toss-gray-500 font-medium">지도 불러오는 중...</span>
      </div>
    </div>
  ),
});

interface MapContainerProps {
  hotspots: Hotspot[];
  onSelectHotspot: (hotspot: Hotspot) => void;
  selectedHotspot: Hotspot | null;
  userLocation: UserLocation | null;
  onRefreshLocation: () => Promise<void>;
  onBoundsChange: (bounds: MapBounds) => void;
  panToUserTrigger?: number;
  onPanToUser: () => void;
}

export default function MapContainer({
  hotspots,
  onSelectHotspot,
  selectedHotspot,
  userLocation,
  onRefreshLocation,
  onBoundsChange,
  panToUserTrigger,
  onPanToUser,
}: MapContainerProps) {
  const handleLocate = async () => {
    onPanToUser();
    await onRefreshLocation();
  };

  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <LeafletMapView
        hotspots={hotspots}
        onSelectHotspot={onSelectHotspot}
        selectedHotspot={selectedHotspot}
        userLocation={userLocation}
        onBoundsChange={onBoundsChange}
        panToUserTrigger={panToUserTrigger}
      />

      {/* 내 위치 버튼 */}
      <div className="absolute bottom-6 right-6 z-[1000]">
        <button
          onClick={handleLocate}
          className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-full toss-shadow hover:bg-toss-gray-50 active:scale-95 transition-all text-primary border border-toss-gray-200 text-sm font-bold"
          title="내 위치로"
        >
          <Navigation className="w-4 h-4" />
          내 위치
        </button>
      </div>
    </div>
  );
}
