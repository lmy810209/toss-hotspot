/**
 * 눅업(nookup) — 네이버 Local Search API 기반 대량 수집 스크립트
 *
 * 실행 방법:
 *   # 광역 수집
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 서울
 *
 *   # 구/동 단위 촘촘한 수집
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 서초구
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 서초구 --keyword 치킨
 *
 *   # 특정 업종만
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 강남구 --keyword 한식,치킨,국밥
 *
 *   # 드라이런
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 서초구 --dry-run
 *
 *   # 기존 해당 지역 삭제 후 재수집
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 서초구 --clear
 *
 * 옵션:
 *   --region    수집 지역 (기본: 서울)
 *   --keyword   특정 키워드만 수집 (쉼표 구분, 생략 시 전체 키워드)
 *   --dry-run   Firestore에 저장하지 않고 결과만 출력
 *   --clear     해당 지역 기존 데이터 삭제 후 재수집
 */

import "dotenv/config";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  writeBatch,
  getDocs,
  query,
  where,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";

// ── 환경변수 ────────────────────────────────────────────────────
const NAVER_CLIENT_ID     = process.env.NAVER_LOCAL_CLIENT_ID     || "6l9WEWTWPAPDgSvf1O5x";
const NAVER_CLIENT_SECRET = process.env.NAVER_LOCAL_CLIENT_SECRET || "9lpLogIryD";

// ── Firebase ────────────────────────────────────────────────────
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
  process.exit(1);
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── CLI 인자 파싱 ────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const REGION  = getArg("--region") || "서울";
const DRY_RUN = args.includes("--dry-run");
const CLEAR   = args.includes("--clear");

// --keyword 옵션: 쉼표 구분으로 특정 키워드만 수집
const kwArg = getArg("--keyword");

// ── 수집 키워드 ──────────────────────────────────────────────────
// 구/동 단위 촘촘한 수집을 위한 세분화된 키워드
const DEFAULT_KEYWORDS = [
  // 맛집 (세분화)
  "맛집", "한식", "치킨", "국밥", "고기집", "분식", "초밥",
  "삼겹살", "냉면", "짬뽕", "돈까스", "곱창", "족발", "찜닭",
  "라멘", "파스타", "버거", "피자", "해산물", "횟집",
  "유명 맛집", "줄서는 맛집",
  // 카페
  "카페", "디저트 카페", "브런치 카페", "루프탑 카페",
  // 쇼핑
  "쇼핑몰", "백화점", "팝업스토어", "시장",
  // 공원
  "공원", "산책로", "벚꽃 명소",
  // 관광
  "핫플레이스", "관광지",
];

const SEARCH_KEYWORDS = kwArg
  ? kwArg.split(",").map((k) => k.trim()).filter(Boolean)
  : DEFAULT_KEYWORDS;

// ── 타입 ─────────────────────────────────────────────────────────
interface RawPlace {
  id: string;
  name: string;
  naverCategory: string; // 네이버 원본 카테고리
  category: string;      // 정규화된 내부 카테고리
  description: string;
  lat: number;
  lng: number;
  source_keyword: string;
}

interface HotspotDoc {
  name: string;
  category: string;
  sourceCategory: string;
  description: string;
  lat: number;
  lng: number;
  congestion_level: 1 | 2 | 3;
  report_count: number;
  popularityScore: number;
  priorityScore: number;
  is_toss_place: boolean;
  isVisible: boolean;
  last_updated: Timestamp;
  region: string;
  source: string;
}

// ── 유틸 ─────────────────────────────────────────────────────────
function stripTags(str: string): string {
  return str.replace(/<[^>]+>/g, "").trim();
}

function toWGS84(val: string): number {
  return parseInt(val, 10) / 10_000_000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 좌표 근접 체크 (약 50m 이내 = 동일 장소) */
function isNearby(lat1: number, lng1: number, lat2: number, lng2: number): boolean {
  return Math.abs(lat1 - lat2) < 0.0005 && Math.abs(lng1 - lng2) < 0.0005;
}

function categoryFromKeyword(keyword: string, naverCategory: string, name: string = ""): string {
  // 1. 네이버 실제 카테고리 우선
  if (/카페|커피|디저트|베이커리|브런치/.test(naverCategory)) return "카페";
  if (/백화점|마트|쇼핑|편의점|아울렛|시장/.test(naverCategory)) return "쇼핑";
  if (/음식점|한식|일식|중식|양식|분식|치킨|피자|패스트푸드|고기|해산물|뷔페|주점|술|식당/.test(naverCategory)) return "맛집";
  if (/공원|자연|산|숲|유원지|생태|수목원/.test(naverCategory)) return "공원";

  // 2. 장소명 판단
  if (/카페|커피|coffee|베이커리|디저트/.test(name)) return "카페";
  if (/마트|백화점|쇼핑|아울렛|편의점/.test(name)) return "쇼핑";
  if (/공원|숲|자연|생태|수목원/.test(name) && !/식당|맛집|음식|갈비|찜|구이|탕|순대|냉면/.test(name)) return "공원";
  if (/갈비|찜|구이|탕|냉면|순대|국밥|삼겹|돼지|소고기|닭|해물|횟집|초밥|라멘|파스타|피자|버거|식당|곱창|족발|찜닭|돈까스|짬뽕/.test(name)) return "맛집";

  // 3. 키워드 fallback
  if (/카페|커피|디저트|브런치/.test(keyword)) return "카페";
  if (/쇼핑|백화점|아울렛|팝업|시장/.test(keyword)) return "쇼핑";
  if (/벚꽃|축제|야경|전시|관광/.test(keyword)) return "관광";
  if (/공원|산책|한강|자연/.test(keyword)) return "공원";
  return "맛집";
}

// ── 네이버 Local Search API 호출 ─────────────────────────────────
async function searchNaver(q: string, start: number = 1): Promise<any[]> {
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5&start=${start}&sort=comment`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id":     NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(`  ⚠️  네이버 API 오류 (${res.status}): ${body.slice(0, 120)}`);
    return [];
  }

  const data = await res.json();
  return data.items ?? [];
}

// ── 단일 키워드 수집 ──────────────────────────────────────────────
async function collectByKeyword(
  region: string,
  keyword: string,
  maxItems: number = 25
): Promise<RawPlace[]> {
  const places: RawPlace[] = [];
  const seen = new Set<string>();
  const fullQuery = `${region} ${keyword}`;

  let start = 1;
  while (places.length < maxItems) {
    const items = await searchNaver(fullQuery, start);
    if (!items.length) break;

    for (const item of items) {
      const name = stripTags(item.title);
      if (seen.has(name)) continue;

      const lat = toWGS84(item.mapy);
      const lng = toWGS84(item.mapx);
      if (!lat || !lng) continue;

      const naverCategory = item.category || "";
      seen.add(name);
      places.push({
        id:             `naver_${item.mapx}_${item.mapy}`,
        name,
        naverCategory,
        category:       categoryFromKeyword(keyword, naverCategory, name),
        description:    item.roadAddress || item.address || "",
        lat,
        lng,
        source_keyword: keyword,
      });
    }

    start += 5;
    if (start > 100) break;
    await sleep(400);
  }

  return places;
}

// ── Firestore 배치 저장 ─────────────────────────────────────────
async function batchInsert(places: RawPlace[], region: string): Promise<number> {
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const chunk = places.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const p of chunk) {
      const docData: HotspotDoc = {
        name:             p.name,
        category:         p.category,
        sourceCategory:   p.naverCategory,
        description:      p.description,
        lat:              p.lat,
        lng:              p.lng,
        congestion_level: 2,
        report_count:     0,
        popularityScore:  0,
        priorityScore:    0,
        is_toss_place:    false,
        isVisible:        true,
        last_updated:     Timestamp.now(),
        region,
        source:           "naver_api",
      };

      const ref = doc(collection(db, "hotspots"), p.id);
      batch.set(ref, docData, { merge: true });
    }

    await batch.commit();
    inserted += chunk.length;
    console.log(`  💾  배치 커밋: ${inserted}/${places.length}개`);
  }

  return inserted;
}

// ── 기존 데이터 삭제 ────────────────────────────────────────────
async function clearRegion(region: string): Promise<void> {
  console.log(`\n🗑️  기존 [${region}] 데이터 삭제 중...`);
  const q = query(collection(db, "hotspots"), where("region", "==", region));
  const snap = await getDocs(q);
  const dels: Promise<void>[] = [];
  snap.forEach((d) => dels.push(deleteDoc(d.ref)));
  await Promise.all(dels);
  console.log(`  삭제 완료: ${dels.length}개`);
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔥  눅업(nookup) 대량 수집 시작`);
  console.log(`   지역: ${REGION}`);
  console.log(`   모드: ${DRY_RUN ? "DRY RUN (저장 안 함)" : "실제 저장"}`);
  console.log(`   키워드: ${SEARCH_KEYWORDS.length}개`);
  console.log(`   키워드 목록: ${SEARCH_KEYWORDS.join(", ")}\n`);

  if (CLEAR && !DRY_RUN) await clearRegion(REGION);

  // 전역 중복 제거 (이름 + 좌표 근접)
  const allPlaces: RawPlace[] = [];
  const seenIds = new Set<string>();
  let totalCollected = 0;
  let totalDuplicate = 0;

  // 카테고리별 수집 통계
  const catStats: Record<string, number> = {};
  const kwStats: { keyword: string; collected: number; saved: number; duplicate: number }[] = [];

  for (let i = 0; i < SEARCH_KEYWORDS.length; i++) {
    const kw = SEARCH_KEYWORDS[i];
    process.stdout.write(`🔍  [${i + 1}/${SEARCH_KEYWORDS.length}] "${REGION} ${kw}" 수집 중...`);

    const items = await collectByKeyword(REGION, kw, 25);
    totalCollected += items.length;

    let added = 0;
    let dup = 0;

    for (const p of items) {
      // 중복 체크: ID 동일 OR (이름 동일 + 좌표 근접)
      if (seenIds.has(p.id)) {
        dup++;
        continue;
      }
      const nameMatch = allPlaces.find(
        (existing) => existing.name === p.name && isNearby(existing.lat, existing.lng, p.lat, p.lng)
      );
      if (nameMatch) {
        dup++;
        continue;
      }

      seenIds.add(p.id);
      allPlaces.push(p);
      added++;
      catStats[p.category] = (catStats[p.category] || 0) + 1;
    }

    totalDuplicate += dup;
    kwStats.push({ keyword: kw, collected: items.length, saved: added, duplicate: dup });
    process.stdout.write(` 수집 ${items.length} → 저장 ${added} (중복 ${dup}) [누적 ${allPlaces.length}]\n`);
    await sleep(700);
  }

  // 수집 통계 출력
  console.log(`\n${"═".repeat(60)}`);
  console.log(`📊  수집 통계`);
  console.log(`${"═".repeat(60)}`);
  console.log(`   지역:       ${REGION}`);
  console.log(`   총 수집:     ${totalCollected}건`);
  console.log(`   중복 제외:   ${totalDuplicate}건`);
  console.log(`   최종 저장:   ${allPlaces.length}건`);
  console.log(`\n   카테고리별:`);
  Object.entries(catStats).sort((a, b) => b[1] - a[1]).forEach(([cat, cnt]) => {
    console.log(`     ${cat}: ${cnt}건`);
  });

  console.log(`\n   키워드별 상세:`);
  console.log(`   ${"키워드".padEnd(20)} ${"수집".padStart(5)} ${"저장".padStart(5)} ${"중복".padStart(5)}`);
  console.log(`   ${"─".repeat(40)}`);
  kwStats.forEach((s) => {
    console.log(`   ${s.keyword.padEnd(20)} ${String(s.collected).padStart(5)} ${String(s.saved).padStart(5)} ${String(s.duplicate).padStart(5)}`);
  });
  console.log(`${"═".repeat(60)}`);

  // Dry run
  if (DRY_RUN) {
    console.log("\n--- DRY RUN 샘플 (상위 30건) ---");
    allPlaces.slice(0, 30).forEach((p, i) => {
      console.log(`  ${i + 1}. [${p.category}] ${p.name} | ${p.naverCategory} | (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`);
    });
    console.log("\n⚡  --dry-run 모드: Firestore 저장 생략");
    process.exit(0);
  }

  // Firestore 저장
  console.log(`\n💾  Firestore 저장 시작 (500개씩 배치)...`);
  const inserted = await batchInsert(allPlaces, REGION);

  console.log(`\n✅  완료! ${inserted}개 hotspot 저장됨.`);
  console.log(`   Firestore: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌  오류 발생:", err);
  process.exit(1);
});
