/**
 * Toss Hotspot — Firestore 시드 스크립트
 *
 * 실행 방법:
 *   npx tsx --env-file=.env.local scripts/seed-hotspots.ts
 *
 * 또는 .env.local을 직접 로드하려면:
 *   npx dotenv -e .env.local -- npx tsx scripts/seed-hotspots.ts
 *
 * 주의: 동일 id 문서가 이미 존재하면 덮어씁니다 (setDoc).
 */

import "dotenv/config";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";

// ── Firebase 초기화 ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.projectId) {
  console.error("❌  NEXT_PUBLIC_FIREBASE_PROJECT_ID 환경변수가 없습니다.");
  console.error("   .env.local 파일을 확인하거나 --env-file 플래그를 사용하세요.");
  process.exit(1);
}

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);

// ── 시드 데이터 (2026 벚꽃 시즌) ────────────────────────────────
const hotspots = [
  // ─── 벚꽃 명소 ───────────────────────────────────
  {
    id: "spot_yeouido",
    name: "여의도 윤중로",
    category: "벚꽃",
    lat: 37.5265,
    lng: 126.9200,
    congestion_level: 3,
    report_count: 312,
    description: "서울 최대 규모 벚꽃 거리. 토스 단말기 가맹점.",
    is_toss_place: true,
  },
  {
    id: "spot_seokchon",
    name: "석촌호수 벚꽃길",
    category: "벚꽃",
    lat: 37.5088,
    lng: 127.1041,
    congestion_level: 3,
    report_count: 278,
    description: "롯데월드 옆 호수 벚꽃 산책로.",
    is_toss_place: false,
  },
  {
    id: "spot_namsan",
    name: "남산 북측 순환로",
    category: "벚꽃",
    lat: 37.5512,
    lng: 126.9882,
    congestion_level: 2,
    report_count: 134,
    description: "남산타워를 배경으로 한 벚꽃 명소.",
    is_toss_place: true,
  },
  {
    id: "spot_bulgwang",
    name: "불광천 벚꽃길",
    category: "벚꽃",
    lat: 37.6042,
    lng: 126.9186,
    congestion_level: 1,
    report_count: 87,
    description: "한적하게 즐기는 벚꽃 산책 명소.",
    is_toss_place: false,
  },
  {
    id: "spot_cheonggyecheon",
    name: "청계천 벚꽃축제",
    category: "벚꽃",
    lat: 37.5695,
    lng: 126.9782,
    congestion_level: 2,
    report_count: 198,
    description: "도심 속 청계천 물길 따라 벚꽃.",
    is_toss_place: false,
  },
  // ─── 카페 / 핫플 ─────────────────────────────────
  {
    id: "spot_seongsu",
    name: "성수동 카페거리",
    category: "카페",
    lat: 37.5445,
    lng: 127.0560,
    congestion_level: 2,
    report_count: 203,
    description: "MZ 성지, 팝업 스토어와 카페가 즐비.",
    is_toss_place: true,
  },
  {
    id: "spot_yeonnam",
    name: "연남동 연트럴파크",
    category: "공원",
    lat: 37.5615,
    lng: 126.9240,
    congestion_level: 1,
    report_count: 145,
    description: "경의선숲길 옆 감성 공원.",
    is_toss_place: false,
  },
  // ─── 맛집 ───────────────────────────────────────
  {
    id: "spot_mangwon",
    name: "망원시장",
    category: "맛집",
    lat: 37.5562,
    lng: 126.9015,
    congestion_level: 2,
    report_count: 167,
    description: "떡볶이·생선구이 등 로컬 먹거리.",
    is_toss_place: false,
  },
  {
    id: "spot_hwangnidan",
    name: "경주 황리단길",
    category: "맛집",
    lat: 35.8353,
    lng: 129.2241,
    congestion_level: 3,
    report_count: 421,
    description: "경주 벚꽃 시즌 최대 핫플. 카페·식당 밀집.",
    is_toss_place: true,
  },
  // ─── 쇼핑 ───────────────────────────────────────
  {
    id: "spot_thehyundai",
    name: "더현대 서울",
    category: "쇼핑",
    lat: 37.5259,
    lng: 126.9284,
    congestion_level: 3,
    report_count: 389,
    description: "국내 최대 규모 백화점, 주말 초붐빔.",
    is_toss_place: true,
  },
] as const;

// ── 실행 ────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n🌸  Toss Hotspot 시드 시작 — 총 ${hotspots.length}개 장소\n`);

  for (const spot of hotspots) {
    const { id, ...data } = spot;
    await setDoc(doc(collection(db, "hotspots"), id), {
      ...data,
      last_updated: Timestamp.now(),
    });
    const tossLabel = data.is_toss_place ? " 💳" : "";
    console.log(`  ✅  [${data.category}] ${data.name}${tossLabel}`);
  }

  console.log("\n✨  시드 완료! Firestore hotspots 컬렉션을 확인하세요.");
  console.log(
    "    주의: category + report_count 복합 인덱스를 생성해야 카테고리 필터가 동작합니다.\n"
  );
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌  시드 실패:", err);
  process.exit(1);
});
