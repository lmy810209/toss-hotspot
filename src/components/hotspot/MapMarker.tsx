"use client";

import { Hotspot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

interface MapMarkerProps {
  hotspot: Hotspot;
  onClick: (hotspot: Hotspot) => void;
  isSelected: boolean;
}

const LEVEL_COLOR = {
  1: "bg-[#22c55e]",
  2: "bg-[#f59e0b]",
  3: "bg-[#ef4444]",
} as const;

const LEVEL_PIN_COLOR = {
  1: "text-[#22c55e]",
  2: "text-[#f59e0b]",
  3: "text-[#ef4444]",
} as const;

const LEVEL_TEXT = { 1: "여유", 2: "보통", 3: "붐빔" } as const;

export default function MapMarker({ hotspot, onClick, isSelected }: MapMarkerProps) {
  return (
    <button
      onClick={() => onClick(hotspot)}
      className={cn(
        "flex flex-col items-center group marker-transition relative",
        isSelected ? "scale-110 z-10" : "scale-100 hover:scale-105"
      )}
    >
      {/* 토스플레이스 배지 — 마커 최상단 */}
      {hotspot.is_toss_place && (
        <div className="mb-0.5 flex items-center gap-0.5 bg-primary text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap">
          <span className="text-[8px]">💳</span>
          토스 단말기
        </div>
      )}

      {/* 혼잡도 칩 */}
      <div
        className={cn(
          "px-2 py-1 rounded-full text-[10px] font-bold text-white mb-1 toss-shadow",
          LEVEL_COLOR[hotspot.congestion_level]
        )}
      >
        {LEVEL_TEXT[hotspot.congestion_level]}
      </div>

      {/* 핀 아이콘 */}
      <div
        className={cn(
          "p-2 rounded-full bg-white toss-shadow relative",
          isSelected && "ring-2 ring-primary"
        )}
      >
        <MapPin className={cn("w-5 h-5", LEVEL_PIN_COLOR[hotspot.congestion_level])} />

        {/* 선택 시 pulse 링 */}
        {isSelected && (
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
        )}
      </div>

      {/* 장소명 */}
      <span className="mt-1 text-[11px] font-semibold text-gray-800 bg-white/90 px-1.5 rounded shadow-sm whitespace-nowrap max-w-[90px] truncate">
        {hotspot.name}
      </span>
    </button>
  );
}
