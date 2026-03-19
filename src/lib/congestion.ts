import { CongestionLevel, CongestionReport, ComputedCongestion } from "./types";

/**
 * 실시간 혼잡도 계산 (시간 감쇠 가중 평균)
 */
export function computeCongestion(reports: CongestionReport[]): ComputedCongestion {
  const now = Date.now();
  const MIN_30 = 30 * 60 * 1000;
  const MIN_15 = 15 * 60 * 1000;
  const MIN_5 = 5 * 60 * 1000;

  const recent = reports
    .filter((r) => now - r.timestamp.getTime() < MIN_30)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const last5min = recent.filter((r) => now - r.timestamp.getTime() < MIN_5);

  if (recent.length === 0) {
    return {
      level: 1,
      recentCount: 0,
      last5minCount: 0,
      lastReportedAt: null,
      label: "최근 제보 없음",
      emoji: "🕐",
    };
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const r of recent) {
    const age = now - r.timestamp.getTime();
    let weight: number;
    if (age < MIN_5) weight = 3;
    else if (age < MIN_15) weight = 1.5;
    else weight = 0.5;

    weightedSum += r.level * weight;
    totalWeight += weight;
  }

  const avg = weightedSum / totalWeight;
  const level: CongestionLevel = avg <= 1.5 ? 1 : avg <= 2.4 ? 2 : 3;

  return {
    level,
    recentCount: recent.length,
    last5minCount: last5min.length,
    lastReportedAt: recent[0]?.timestamp ?? null,
    label: LEVEL_LABEL[level],
    emoji: LEVEL_EMOJI[level],
  };
}

const LEVEL_LABEL: Record<CongestionLevel, string> = {
  1: "지금 한산함",
  2: "지금 보통",
  3: "지금 붐빔",
};

const LEVEL_EMOJI: Record<CongestionLevel, string> = {
  1: "😎",
  2: "😐",
  3: "🔥",
};

/** 결론형 한 줄 추천 문구 */
export function getVerdict(computed: ComputedCongestion): { text: string; color: string } {
  if (computed.recentCount === 0) {
    return { text: "제보 대기 중 · 방문하면 첫 제보 남겨주세요", color: "text-toss-gray-400" };
  }
  if (computed.level === 1) {
    return { text: "👉 지금 가기 좋음", color: "text-emerald-600" };
  }
  if (computed.level === 2) {
    return { text: "무난함", color: "text-amber-600" };
  }
  return { text: "⚠️ 지금은 피하는 게 좋음", color: "text-red-600" };
}

/** 상대 시간 포맷 ("방금", "2분 전", "15분 전") */
export function formatReportTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}

/** 도보 시간 계산 (4km/h 기준) */
export function getWalkTime(distM: number): string {
  const min = Math.ceil(distM / 67);
  if (min <= 1) return "도보 1분";
  if (min <= 30) return `도보 ${min}분`;
  return `${(distM / 1000).toFixed(1)}km`;
}
