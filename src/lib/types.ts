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
}

export interface UserLocation {
  lat: number;
  lng: number;
}
