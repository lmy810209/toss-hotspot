"use client";

import { useEffect, useRef, useState } from "react";
import { Hotspot, UserLocation } from "@/lib/types";
import { calculateDistance } from "@/lib/toss-sdk";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import {
  MapPin,
  Users,
  Clock,
  AlertCircle,
  X,
  Share2,
  Eye,
  ExternalLink,
  Coins,
} from "lucide-react";
import { useViewerCount } from "@/hooks/use-viewer-count";

interface BottomSheetProps {
  hotspot: Hotspot | null;
  userLocation: UserLocation | null;
  onClose: () => void;
  onReport: (id: string, level: 1 | 2 | 3) => Promise<void>;
}

const CONGESTION_CONFIG = {
  1: {
    label: "여유로워요",
    emoji: "😊",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
    barWidth: "w-1/3",
  },
  2: {
    label: "보통이에요",
    emoji: "😐",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
    barWidth: "w-2/3",
  },
  3: {
    label: "많이 붐벼요",
    emoji: "😵",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
    barWidth: "w-full",
  },
} as const;

export default function BottomSheet({
  hotspot,
  userLocation,
  onClose,
  onReport,
}: BottomSheetProps) {
  const [isVisible, setIsVisible]       = useState(false);
  const [isReporting, setIsReporting]   = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"" | "copied" | "shared">("");
  const sheetRef    = useRef<HTMLDivElement>(null);
  const reportRef   = useRef<HTMLDivElement>(null);

  const viewerCount = useViewerCount(hotspot?.id ?? null);

  useEffect(() => {
    if (hotspot) {
      setIsVisible(true);
      setReportSuccess(false);
    }
  }, [hotspot]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 280);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const distance =
    userLocation && hotspot
      ? calculateDistance(userLocation, { lat: hotspot.lat, lng: hotspot.lng })
      : null;
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
    const url = `https://map.naver.com/v5/search/${encodeURIComponent(hotspot.name)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    if (!hotspot) return;
    const cfg = CONGESTION_CONFIG[hotspot.congestion_level];
    const text = `${hotspot.name} 지금 ${cfg.label}! 나도 Toss Hotspot에서 확인해봐 👉`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: `Toss Hotspot — ${hotspot.name}`, text, url });
        setShareFeedback("shared");
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShareFeedback("copied");
      }
    } catch { /* 공유 취소 — 무시 */ }
    setTimeout(() => setShareFeedback(""), 2000);
  };

  if (!hotspot) return null;

  const cfg = CONGESTION_CONFIG[hotspot.congestion_level];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`relative w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden ${
          isVisible ? "animate-slide-up" : "animate-slide-down"
        }`}
        style={{ maxHeight: "88dvh" }}
      >
        {/* ── 제보 완료 오버레이 ── */}
        {reportSuccess && (
          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-20 gap-3">
            <div className="text-6xl animate-bounce">🎉</div>
            <p className="text-2xl font-black text-toss-gray-900">제보 완료!</p>
            <p className="text-sm text-toss-gray-500">10원이 적립됐어요</p>
          </div>
        )}

        {/* Drag Handle — sticky */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-toss-gray-200 rounded-full" />
        </div>

        {/* 닫기 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-toss-gray-100 text-toss-gray-500 hover:bg-toss-gray-200 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 스크롤 가능한 콘텐츠 */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(88dvh - 32px)" }}>
          <div className="px-6 pt-2 pb-10 space-y-4">

            {/* 헤더 */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-block text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  {hotspot.category}
                </span>
                {hotspot.is_toss_place && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-primary px-2 py-0.5 rounded-full">
                    💳 토스 단말기 매장
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-toss-gray-900 leading-tight">
                {hotspot.name}
              </h2>
              <div className="flex items-start justify-between gap-2 mt-1">
                {hotspot.description && (
                  <p className="text-sm text-toss-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {hotspot.description}
                  </p>
                )}
                {/* 네이버 지도로 보기 */}
                <button
                  onClick={handleNaverMap}
                  className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1.5 rounded-xl transition-colors shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                  네이버 지도
                </button>
              </div>
            </div>

            {/* 실시간 조회자 수 */}
            <div className="flex items-center gap-2.5 bg-toss-gray-50 border border-toss-gray-200 rounded-2xl px-4 py-2.5">
              <Eye className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-toss-gray-700">
                지금 <span className="font-black text-primary">{viewerCount}명</span>이 보고 있어요!
              </span>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-red-500 font-bold">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </span>
            </div>

            {/* 혼잡도 현황 */}
            <div className={`rounded-2xl p-3.5 ${cfg.bg} ${cfg.border} border`}>
              <p className="text-xs font-semibold text-toss-gray-500 mb-1">현재 혼잡도</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{cfg.emoji}</span>
                  <span className={`text-xl font-bold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <div className="w-1/3">
                  <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.bar} ${cfg.barWidth} transition-all duration-700`} />
                  </div>
                </div>
              </div>
            </div>

            {/* 통계 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-toss-gray-50 rounded-2xl p-3 flex flex-col items-center gap-1">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs text-toss-gray-500">실시간 제보</span>
                <span className="text-lg font-bold text-toss-gray-900">{hotspot.report_count}명</span>
              </div>
              <div className="bg-toss-gray-50 rounded-2xl p-3 flex flex-col items-center gap-1">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs text-toss-gray-500">마지막 업데이트</span>
                <span className="text-sm font-bold text-toss-gray-900 text-center">
                  {formatDistanceToNow(hotspot.last_updated, { addSuffix: true, locale: ko })}
                </span>
              </div>
            </div>

            <div className="h-px bg-toss-gray-100" />

            {/* CTA 버튼 2개 나란히 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 제보하고 10원 받기 */}
              <button
                onClick={() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="flex items-center gap-2 bg-primary/5 hover:bg-primary/10 active:scale-95 rounded-2xl px-3 py-3.5 border border-primary/15 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-toss-gray-900">제보하고</p>
                  <p className="text-xs font-black text-primary">10원 받기</p>
                </div>
              </button>

              {/* 친구 공유 +10원 */}
              <button
                onClick={handleShare}
                className="flex items-center gap-2 bg-toss-gray-50 hover:bg-toss-gray-100 active:scale-95 rounded-2xl px-3 py-3.5 border border-toss-gray-200 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-toss-gray-200 flex items-center justify-center shrink-0">
                  <Share2 className="w-4 h-4 text-toss-gray-700" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-toss-gray-900">
                    {shareFeedback === "copied" ? "복사됨!" : shareFeedback === "shared" ? "공유됨!" : "친구 공유"}
                  </p>
                  <p className="text-xs font-black text-toss-gray-500">+10원 더</p>
                </div>
              </button>
            </div>

            {/* 제보 버튼 */}
            <div className="space-y-3" ref={reportRef}>
              <h3 className="font-bold text-toss-gray-900">지금 어때요? <span className="text-xs font-normal text-primary">제보하면 10원 적립!</span></h3>

              {!canReport && distance !== null && (
                <div className="flex items-start gap-2.5 bg-orange-50 border border-orange-100 rounded-2xl p-3.5 text-sm text-orange-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>근처에 있을 때 제보할 수 있어요.</span>
                </div>
              )}

              {distance === null && (
                <div className="flex items-center gap-2 text-sm text-toss-gray-500 bg-toss-gray-50 rounded-2xl p-3.5">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  위치를 확인하는 중이에요...
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map((level) => {
                  const c = CONGESTION_CONFIG[level];
                  return (
                    <button
                      key={level}
                      disabled={!canReport || isReporting}
                      onClick={() => handleReport(level)}
                      className={`
                        flex flex-col items-center gap-2 py-4 rounded-2xl border-2 font-semibold text-sm
                        transition-all duration-200 active:scale-95
                        ${canReport
                          ? `${c.bg} ${c.border} ${c.color} hover:brightness-95 cursor-pointer`
                          : "bg-toss-gray-50 border-toss-gray-200 text-toss-gray-400 cursor-not-allowed opacity-60"
                        }
                      `}
                    >
                      {isReporting
                        ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        : <div className={`w-3 h-3 rounded-full ${c.dot} ${!canReport ? "opacity-40" : ""}`} />
                      }
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
