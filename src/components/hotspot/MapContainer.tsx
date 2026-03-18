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
}

export default function MapContainer({
  hotspots,
  onSelectHotspot,
  selectedHotspot,
  userLocation,
  onRefreshLocation,
  onBoundsChange,
}: MapContainerProps) {
  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <LeafletMapView
        hotspots={hotspots}
        onSelectHotspot={onSelectHotspot}
        selectedHotspot={selectedHotspot}
        userLocation={userLocation}
        onBoundsChange={onBoundsChange}
      />

      {/* 내 위치 새로고침 버튼 */}
      <div className="absolute bottom-6 right-6 z-[1000]">
        <button
          onClick={onRefreshLocation}
          className="p-3 bg-white rounded-full toss-shadow hover:bg-toss-gray-50 transition-colors text-primary border border-toss-gray-200"
          title="내 위치로"
        >
          <Navigation className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
