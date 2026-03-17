"use client";

import { useEffect, useState } from "react";
import { Hotspot, UserLocation } from "@/lib/types";
import MapMarker from "./MapMarker";
import { getTossLocation } from "@/lib/toss-sdk";
import { Navigation } from "lucide-react";

interface MapContainerProps {
  hotspots: Hotspot[];
  onSelectHotspot: (hotspot: Hotspot) => void;
  selectedHotspot: Hotspot | null;
}

export default function MapContainer({ hotspots, onSelectHotspot, selectedHotspot }: MapContainerProps) {
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);

  useEffect(() => {
    getTossLocation().then(setUserLoc);
  }, []);

  // Mock map bounds for visualization purposes in the demo
  const mapCenter = { lat: 37.55, lng: 126.95 };
  const zoom = 1000; // Fake zoom factor

  const getPosition = (lat: number, lng: number) => {
    const x = (lng - mapCenter.lng) * zoom + 50;
    const y = (mapCenter.lat - lat) * zoom + 50;
    return { left: `${x}%`, top: `${y}%` };
  };

  return (
    <div className="relative flex-1 w-full bg-[#f8fafc] overflow-hidden">
      {/* Simulation of Map Background (SVG Grid) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Placeholder Map Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-slate-200/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Hotspot Markers */}
      <div className="relative w-full h-full">
        {hotspots.map((spot) => (
          <div
            key={spot.id}
            className="absolute transition-all duration-500 ease-out"
            style={getPosition(spot.lat, spot.lng)}
          >
            <MapMarker
              hotspot={spot}
              isSelected={selectedHotspot?.id === spot.id}
              onClick={onSelectHotspot}
            />
          </div>
        ))}

        {/* User Location Marker */}
        {userLoc && (
          <div
            className="absolute z-30 pointer-events-none"
            style={getPosition(userLoc.lat, userLoc.lng)}
          >
            <div className="relative">
              <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping" />
              <div className="w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg" />
            </div>
          </div>
        )}
      </div>

      {/* Map Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2">
        <button
          onClick={() => getTossLocation().then(setUserLoc)}
          className="p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors text-primary"
        >
          <Navigation className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
