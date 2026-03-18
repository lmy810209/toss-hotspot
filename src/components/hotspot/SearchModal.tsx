"use client";

import { useState, useEffect, useRef } from "react";
import { Hotspot } from "@/lib/types";
import { Search, X, MapPin } from "lucide-react";

const LEVEL_TEXT: Record<number, string>  = { 1: "여유", 2: "보통", 3: "붐빔" };
const LEVEL_COLOR: Record<number, string> = { 1: "text-emerald-600 bg-emerald-50", 2: "text-amber-600 bg-amber-50", 3: "text-red-600 bg-red-50" };

interface SearchModalProps {
  hotspots: Hotspot[];
  onSelect: (hotspot: Hotspot) => void;
  onClose: () => void;
}

export default function SearchModal({ hotspots, onSelect, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = query.trim().length === 0
    ? []
    : hotspots
        .filter((h) =>
          h.name.includes(query) ||
          (h.description ?? "").includes(query) ||
          h.category.includes(query)
        )
        .slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-toss-gray-100">
        <Search className="w-5 h-5 text-toss-gray-400 shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 text-base text-toss-gray-900 placeholder:text-toss-gray-400 focus:outline-none"
          placeholder="장소 이름으로 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-toss-gray-100 text-toss-gray-500 hover:bg-toss-gray-200 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 결과 */}
      <div className="overflow-y-auto flex-1">
        {query.trim().length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-toss-gray-400">
            <Search className="w-10 h-10 opacity-30" />
            <p className="text-sm">장소명, 카테고리, 주소로 검색하세요</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-toss-gray-400">
            <p className="text-sm font-bold">"{query}" 검색 결과 없음</p>
            <p className="text-xs">다른 키워드로 검색해보세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-toss-gray-50">
            {results.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => { onSelect(h); onClose(); }}
                  className="w-full text-left px-5 py-3.5 hover:bg-toss-gray-50 active:bg-toss-gray-100 transition-colors flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-toss-gray-900 truncate">{h.name}</span>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                        {h.category}
                      </span>
                    </div>
                    {h.description && (
                      <p className="text-xs text-toss-gray-400 mt-0.5 flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {h.description}
                      </p>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg shrink-0 ${LEVEL_COLOR[h.congestion_level]}`}>
                    {LEVEL_TEXT[h.congestion_level]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
