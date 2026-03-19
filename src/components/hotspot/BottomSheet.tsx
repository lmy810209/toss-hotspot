"use client";

import { useEffect, useRef, useState } from "react";
import { Hotspot, UserLocation } from "@/lib/types";
import { calculateDistance } from "@/lib/toss-sdk";
import { formatReportTime, computeCongestion } from "@/lib/congestion";
import {
  MapPin,
  X,
  Share2,
  Eye,
  ExternalLink,
  Coins,
  Tag,
} from "lucide-react";
import { useViewerCount } from "@/hooks/use-viewer-count";

interface BottomSheetProps {
  hotspot: Hotspot | null;
  userLocation: UserLocation | null;
  onClose: () => void;
  onReport: (id: string, level: 1 | 2 | 3) => Promise<void>;
}

const LEVEL_CONFIG = {
  1: { label: "한산해요", emoji: "😎", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500", barW: "w-1/3" },
  2: { label: "보통이에요", emoji: "😐", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500", barW: "w-2/3" },
  3: { label: "붐비고 있어요", emoji: "🔥", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500", barW: "w-full" },
} as const;

export default function BottomSheet({ hotspot, userLocation, onClose, onReport }: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"" | "copied" | "shared">("");
  const sheetRef = useRef<HTMLDivElement>(null);
  const viewerCount = useViewerCount(hotspot?.id ?? null);

  useEffect(() => {
    if (hotspot) { setIsVisible(true); setReportSuccess(false); }
  }, [hotspot]);

  const handleClose = () => { setIsVisible(false); setTimeout(onClose, 280); };
  const handleBackdropClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) handleClose(); };

  const distance = userLocation && hotspot ? calculateDistance(userLocation, { lat: hotspot.lat, lng: hotspot.lng }) : null;
  const canReport = distance !== null && distance <= 100;

  const handleReport = async (level: 1 | 2 | 3) => {
    if (!hotspot || isReporting) return;
    setIsReporting(true);
    await onReport(hotspot.id, level);
    setIsReporting(false);
    setReportSuccess(true);
    setTimeout(handleClose, 1800);
  };

  const handleNaverMap = () => {
    if (!hotspot) return;
    const url = hotspot.naverLink || `https://map.naver.com/v5/search/${encodeURIComponent(hotspot.name)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (!hotspot) return;
    const text = `${hotspot.name} ${computed.emoji} ${computed.label}! 눅업에서 확인해봐 👉`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: `눅업 — ${hotspot.name}`, text, url });
        setShareFeedback("shared");
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareFeedback("copied");
      }
    } catch { /* 취소 */ }
    setTimeout(() => setShareFeedback(""), 2000);
  };

  if (!hotspot) return null;

  const computed = hotspot.computed ?? computeCongestion(hotspot.recentReports ?? []);
  const cfg = LEVEL_CONFIG[computed.level];
  const recentReports = (hotspot.recentReports ?? [])
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={handleBackdropClick}>
      <div className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${isVisible ? "opacity-100" : "opacity-0"}`} />

      <div
        ref={sheetRef}
        className={`relative w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden ${isVisible ? "animate-slide-up" : "animate-slide-down"}`}
        style={{ maxHeight: "88dvh" }}
      >
        {/* 제보 완료 */}
        {reportSuccess && (
          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-20 gap-3">
            <div className="text-6xl animate-bounce">🎉</div>
            <p className="text-2xl font-black text-toss-gray-900">제보 완료!</p>
            <p className="text-sm text-toss-gray-500">10원이 적립됐어요</p>
          </div>
        )}

        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-toss-gray-200 rounded-full" />
        </div>
        <button onClick={handleClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-toss-gray-100 text-toss-gray-500 hover:bg-toss-gray-200 transition-colors z-10">
          <X className="w-4 h-4" />
        </button>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(88dvh - 32px)" }}>
          <div className="px-6 pt-2 pb-10 space-y-4">

            {/* 대표 이미지 */}
            {hotspot.imageUrl && (
              <div className="relative -mx-6 -mt-2">
                <img src={hotspot.imageUrl} alt={hotspot.name} className="w-full h-40 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent" />
              </div>
            )}

            {/* 헤더 */}
            <div>
              <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-1.5">
                {hotspot.category}
              </span>
              <h2 className="text-2xl font-bold text-toss-gray-900 leading-tight">{hotspot.name}</h2>
              {(hotspot.address || hotspot.description) && (
                <p className="text-sm text-toss-gray-500 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {hotspot.address || hotspot.description}
                </p>
              )}
            </div>

            {/* 태그 */}
            {hotspot.tags && hotspot.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {hotspot.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-bold text-toss-gray-500 bg-toss-gray-50 border border-toss-gray-200 px-2.5 py-1 rounded-full">
                    <Tag className="w-2.5 h-2.5" />{tag}
                  </span>
                ))}
              </div>
            )}

            {/* ═══ 실시간 혼잡도 (핵심) ═══ */}
            {computed.recentCount > 0 ? (
              <div className={`rounded-2xl p-4 ${cfg.bg} ${cfg.border} border`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl">{cfg.emoji}</span>
                    <div>
                      <p className={`text-xl font-black ${cfg.color}`}>{computed.label}</p>
                      {computed.last5minCount > 0 ? (
                        <p className="text-xs text-toss-gray-500 mt-0.5">
                          방금 <span className="font-bold text-primary">{computed.last5minCount}명</span> 제보
                        </p>
                      ) : (
                        <p className="text-xs text-toss-gray-400 mt-0.5">
                          {formatReportTime(computed.lastReportedAt!)} 업데이트
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="w-20">
                    <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar} ${cfg.barW} transition-all duration-700`} />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-toss-gray-400 mt-1">
                  최근 30분 {computed.recentCount}명 제보
                </p>
              </div>
            ) : (
              /* 제보 없을 때 — 행동 유도형 카드 */
              <div className="rounded-2xl p-4 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/15">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🕐</span>
                  <div>
                    <p className="text-base font-black text-toss-gray-800">아직 제보 부족</p>
                    <p className="text-xs text-toss-gray-500 mt-0.5">최근 30분 내 업데이트 없음</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2">
                  <Coins className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs text-toss-gray-700">
                    지금 방문 중이라면 <span className="font-black text-primary">첫 제보 남기고 10P 받기</span>
                  </p>
                </div>
              </div>
            )}

            {/* 실시간 조회자 */}
            <div className="flex items-center gap-2.5 bg-toss-gray-50 border border-toss-gray-200 rounded-2xl px-4 py-2.5">
              <Eye className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-toss-gray-700">
                지금 <span className="font-black text-primary">{viewerCount}명</span>이 보고 있어요
              </span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-red-500 font-bold">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />LIVE
              </span>
            </div>

            {/* 최근 제보 타임라인 */}
            {recentReports.length > 0 && (
              <div>
                <p className="text-xs font-bold text-toss-gray-500 mb-2">🕒 최근 제보</p>
                <div className="space-y-1.5">
                  {recentReports.map((r, i) => {
                    const rCfg = LEVEL_CONFIG[r.level];
                    return (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        <span className="text-[11px] text-toss-gray-400 w-14 shrink-0">{formatReportTime(r.timestamp)}</span>
                        <span className={`w-2 h-2 rounded-full ${rCfg.bar} shrink-0`} />
                        <span className={`text-xs font-bold ${rCfg.color}`}>{rCfg.emoji} {rCfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="h-px bg-toss-gray-100" />

            {/* 제보 CTA — 대형 */}
            <div className="space-y-3">
              <h3 className="text-lg font-black text-toss-gray-900">
                지금 어때요? <span className="text-sm font-bold text-primary">제보 = 10원 💰</span>
              </h3>

              {!canReport && distance !== null && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-2xl p-3 text-sm text-orange-700">
                  📍 근처에 있을 때 제보할 수 있어요
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map((level) => {
                  const c = LEVEL_CONFIG[level];
                  return (
                    <button
                      key={level}
                      disabled={!canReport || isReporting}
                      onClick={() => handleReport(level)}
                      className={`
                        flex flex-col items-center gap-2 py-5 rounded-2xl border-2 font-bold text-sm
                        transition-all duration-200 active:scale-95
                        ${canReport
                          ? `${c.bg} ${c.border} ${c.color} hover:brightness-95 cursor-pointer`
                          : "bg-toss-gray-50 border-toss-gray-200 text-toss-gray-400 cursor-not-allowed opacity-60"
                        }
                      `}
                    >
                      <span className="text-2xl">{c.emoji}</span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleNaverMap} className="flex items-center justify-center gap-2 text-sm font-bold text-primary bg-primary/5 hover:bg-primary/10 border border-primary/15 px-3 py-2.5 rounded-2xl transition-colors">
                <ExternalLink className="w-4 h-4" />네이버 지도
              </button>
              <button onClick={handleShare} className="flex items-center justify-center gap-2 text-sm font-bold text-toss-gray-700 bg-toss-gray-50 hover:bg-toss-gray-100 border border-toss-gray-200 px-3 py-2.5 rounded-2xl transition-colors">
                <Share2 className="w-4 h-4" />
                {shareFeedback === "copied" ? "복사됨!" : shareFeedback === "shared" ? "공유됨!" : "공유하기"}
              </button>
            </div>

            {/* 제보 유도 */}
            {computed.recentCount < 3 && (
              <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-2xl p-3.5">
                <span className="text-xl shrink-0">💰</span>
                <div>
                  <p className="text-xs font-bold text-amber-800">
                    {computed.recentCount === 0 ? "첫 제보 시 10P 지급!" : "제보할수록 정확도 UP!"}
                  </p>
                  <p className="text-[10px] text-amber-600 mt-0.5">
                    {computed.recentCount === 0
                      ? "아직 아무도 제보하지 않았어요"
                      : `현재 ${computed.recentCount}명 제보 · 더 정확한 정보가 필요해요`}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
