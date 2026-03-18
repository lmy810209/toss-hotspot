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
  /** 실시간 조회자 수 (Firestore viewers 서브컬렉션 count, 클라이언트 계산) */
  viewer_count?: number;
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
