export type CongestionLevel = 1 | 2 | 3; // 1: 한산(😎), 2: 보통(😐), 3: 붐빔(🔥)

/** 개별 유저 제보 (Firestore: hotspots/{id}/reports) */
export interface CongestionReport {
  level: CongestionLevel;
  timestamp: Date;
  sessionId: string;
}

/** 실시간 계산된 혼잡도 */
export interface ComputedCongestion {
  level: CongestionLevel;
  recentCount: number;       // 최근 30분 제보 수
  last5minCount: number;     // 최근 5분 제보 수
  lastReportedAt: Date | null;
  label: string;             // "지금 한산함" 등
  emoji: string;             // 😎 😐 🔥
}

export interface Hotspot {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  congestion_level: CongestionLevel;
  last_updated: Date;
  report_count: number;
  description?: string;
  is_toss_place?: boolean;
  viewer_count?: number;

  // CMS 필드
  address?: string;
  naverLink?: string;
  imageUrl?: string;
  tags?: string[];
  priorityScore?: number;
  popularityScore?: number;
  isVisible?: boolean;
  adminMemo?: string;

  // 수집 메타
  sourceCategory?: string; // 네이버 원본 카테고리
  source?: string;         // "naver_api" | "admin" | "seed"
  region?: string;         // 수집 기준 지역명

  // 실시간 제보 데이터 (클라이언트 계산)
  recentReports?: CongestionReport[];
  computed?: ComputedCongestion;
}

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
