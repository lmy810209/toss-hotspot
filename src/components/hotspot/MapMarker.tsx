"use client";

import { Hotspot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

interface MapMarkerProps {
  hotspot: Hotspot;
  onClick: (hotspot: Hotspot) => void;
  isSelected: boolean;
}

export default function MapMarker({ hotspot, onClick, isSelected }: MapMarkerProps) {
  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return "bg-[#22c55e]"; // 여유 (Green)
      case 2: return "bg-[#f59e0b]"; // 보통 (Yellow)
      case 3: return "bg-[#ef4444]"; // 붐빔 (Red)
      default: return "bg-gray-400";
    }
  };

  const getLevelText = (level: number) => {
    switch (level) {
      case 1: return "여유";
      case 2: return "보통";
      case 3: return "붐빔";
      default: return "";
    }
  };

  return (
    <button
      onClick={() => onClick(hotspot)}
      className={cn(
        "flex flex-col items-center group marker-transition",
        isSelected ? "scale-110 z-10" : "scale-100 hover:scale-105"
      )}
    >
      <div className={cn(
        "px-2 py-1 rounded-full text-[10px] font-bold text-white mb-1 toss-shadow",
        getLevelColor(hotspot.congestion_level)
      )}>
        {getLevelText(hotspot.congestion_level)}
      </div>
      <div className={cn(
        "p-2 rounded-full bg-white toss-shadow relative",
        isSelected ? "ring-2 ring-primary" : ""
      )}>
        <MapPin className={cn(
          "w-5 h-5",
          hotspot.congestion_level === 1 && "text-[#22c55e]",
          hotspot.congestion_level === 2 && "text-[#f59e0b]",
          hotspot.congestion_level === 3 && "text-[#ef4444]"
        )} />
      </div>
      <span className="mt-1 text-[11px] font-semibold text-gray-800 bg-white/90 px-1.5 rounded shadow-sm whitespace-nowrap max-w-[80px] truncate">
        {hotspot.name}
      </span>
    </button>
  );
}
