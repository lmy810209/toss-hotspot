export type CongestionLevel = 1 | 2 | 3; // 1: 여유(Green), 2: 보통(Yellow), 3: 붐빔(Red)

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
  /** 토스플레이스(단말기) 가맹점 여부 */
  is_toss_place?: boolean;
  /** 실시간 조회자 수 */
  viewer_count?: number;

  // ── CMS 확장 필드 ──
  /** 주소 */
  address?: string;
  /** 네이버 지도 링크 */
  naverLink?: string;
  /** 대표 이미지 URL */
  imageUrl?: string;
  /** 태그 (예: 벚꽃명소, 오픈런, 데이트) */
  tags?: string[];
  /** 운영자 기준 기본 혼잡도 */
  baseCongestion?: CongestionLevel;
  /** 추천 우선순위 점수 */
  priorityScore?: number;
  /** 노출 여부 (false면 지도에 안 보임) */
  isVisible?: boolean;
  /** 운영자 메모 */
  adminMemo?: string;
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
