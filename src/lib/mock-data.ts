import { Hotspot } from "./types";

export const CATEGORIES = ["벚꽃", "맛집", "카페", "쇼핑", "공원"];

export const MOCK_HOTSPOTS: Hotspot[] = [
  {
    id: "1",
    name: "여의도 윤중로",
    category: "벚꽃",
    lat: 37.5265,
    lng: 126.9200,
    congestion_level: 3,
    last_updated: new Date(),
    report_count: 154,
    description: "지금 가장 핫한 벚꽃 명소예요."
  },
  {
    id: "2",
    name: "성수동 카페거리",
    category: "카페",
    lat: 37.5445,
    lng: 127.0560,
    congestion_level: 2,
    last_updated: new Date(),
    report_count: 89,
    description: "트렌디한 카페가 가득해요."
  },
  {
    id: "3",
    name: "남산서울타워",
    category: "벚꽃",
    lat: 37.5512,
    lng: 126.9882,
    congestion_level: 1,
    last_updated: new Date(),
    report_count: 42,
    description: "산책로를 따라 벚꽃이 예뻐요."
  },
  {
    id: "4",
    name: "더현대 서울",
    category: "쇼핑",
    lat: 37.5259,
    lng: 126.9284,
    congestion_level: 3,
    last_updated: new Date(),
    report_count: 320,
    description: "주말에는 매우 붐벼요."
  },
  {
    id: "5",
    name: "망원시장",
    category: "맛집",
    lat: 37.5562,
    lng: 126.9015,
    congestion_level: 2,
    last_updated: new Date(),
    report_count: 112,
    description: "맛있는 먹거리가 많아요."
  },
  {
    id: "6",
    name: "연남동 연트럴파크",
    category: "공원",
    lat: 37.5615,
    lng: 126.9240,
    congestion_level: 1,
    last_updated: new Date(),
    report_count: 67,
    description: "여유로운 산책이 가능해요."
  }
];
