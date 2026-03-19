/**
 * 눅업(nookup) — 네이버 Local Search API 기반 대량 수집 스크립트
 *
 * 실행 방법:
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 서울
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 부산
 *   npx tsx --env-file=.env.local scripts/collect-hotspots.ts --region 서울 --dry-run
 *
 * 옵션:
 *   --region   수집할 지역명 (기본값: 서울)
 *   --dry-run  Firestore에 저장하지 않고 수집 결과만 출력
 *   --clear    해당 지역 기존 데이터 삭제 후 재수집
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

const NCP_KEY_ID     = process.env.NCP_KEY_ID     || "wo2yd54c9d";
const NCP_KEY_SECRET = process.env.NCP_KEY_SECRET || "SQ1Ax8aLahy3niZOJHl8H6O5HboxEQQfCQSkvEtF";

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
const regionIdx = args.indexOf("--region");
const REGION    = regionIdx !== -1 ? args[regionIdx + 1] : "서울";
const DRY_RUN   = args.includes("--dry-run");
const CLEAR     = args.includes("--clear");

// ── 수집 대상 카테고리 / 키워드 ──────────────────────────────────
// 지역 + 키워드 조합으로 네이버 Local Search 호출
const SEARCH_KEYWORDS = [
  // 맛집
  "맛집", "유명 맛집", "핫플레이스 식당", "인스타 맛집", "줄서는 맛집",
  // 카페
  "카페", "디저트 카페", "브런치 카페", "루프탑 카페", "감성 카페",
  // 쇼핑
  "쇼핑몰", "백화점", "아울렛", "팝업스토어", "시장",
  // 공원 / 자연
  "공원", "산책로", "벚꽃 명소", "한강 공원",
  // 문화 / 관광
  "핫플레이스", "관광지", "야경 명소", "전시회",
];

// ── 타입 ─────────────────────────────────────────────────────────
interface RawPlace {
  id: string;
  name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  source_keyword: string;
}

interface HotspotDoc {
  name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  congestion_level: 1 | 2 | 3;
  report_count: number;
  is_toss_place: boolean;
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

function categoryFromKeyword(keyword: string, naverCategory: string, name: string = ""): string {
  // 1. 네이버 실제 카테고리 우선 체크
  if (/카페|커피|디저트|베이커리|브런치/.test(naverCategory)) return "카페";
  if (/백화점|마트|쇼핑|편의점|아울렛|시장/.test(naverCategory)) return "쇼핑";
  if (/음식점|한식|일식|중식|양식|분식|치킨|피자|패스트푸드|고기|해산물|뷔페|주점|술/.test(naverCategory)) return "맛집";
  if (/공원|자연|산|숲|유원지|생태|수목원/.test(naverCategory)) return "공원";

  // 2. 장소 이름으로 판단 (네이버 카테고리 없을 때 안전망)
  if (/카페|커피|coffee|베이커리|디저트/.test(name)) return "카페";
  if (/마트|백화점|쇼핑|아울렛|편의점/.test(name)) return "쇼핑";
  if (/공원|숲|자연|생태|수목원/.test(name) && !/식당|맛집|음식|갈비|찜|구이|탕|순대|냉면/.test(name)) return "공원";
  if (/갈비|찜|구이|탕|냉면|순대|국밥|삼겹|돼지|소고기|닭|해물|횟집|초밥|라멘|파스타|피자|버거|식당/.test(name)) return "맛집";

  // 3. 검색 키워드 fallback (단, 음식 이름이 포함된 장소는 맛집으로)
  if (/카페|커피|디저트|브런치/.test(keyword)) return "카페";
  if (/쇼핑|백화점|아울렛|팝업|시장/.test(keyword)) return "쇼핑";
  if (/벚꽃|축제|야경|전시|관광/.test(keyword)) return "관광";
  if (/공원|산책|한강|자연/.test(keyword)) return "공원";
  return "맛집";
}

// ── 역지오코딩으로 주소 → 서브 지역명 ────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&sourcecrs=epsg:4326&output=json&orders=admcode`,
      {
        headers: {
          "x-ncp-apigw-api-key-id": NCP_KEY_ID,
          "x-ncp-apigw-api-key":    NCP_KEY_SECRET,
        },
      }
    );
    if (!res.ok) return "";
    const data = await res.json();
    const region = data.results?.[0]?.region;
    if (!region) return "";
    const parts = [region.area2?.name, region.area3?.name].filter(Boolean);
    return parts.join(" ");
  } catch {
    return "";
  }
}

// ── 네이버 Local Search API 호출 ─────────────────────────────────
// display 최대 5, start 1~1000 (5씩 최대 200페이지 = 1000개)
async function searchNaver(query: string, start: number = 1): Promise<any[]> {
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=${start}&sort=comment`;
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

// ── 단일 키워드로 최대 N개 수집 ──────────────────────────────────
async function collectByKeyword(
  region: string,
  keyword: string,
  maxItems: number = 25 // 키워드당 최대 25개 (5페이지 × 5개)
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

      seen.add(name);
      places.push({
        id:             `naver_${item.mapx}_${item.mapy}`,
        name,
        category:       item.category || "",
        description:    item.roadAddress || item.address || "",
        lat,
        lng,
        source_keyword: keyword,
      });
    }

    start += 5;
    if (start > 100) break; // 네이버 start 최대 100
    await sleep(400); // rate-limit 방지 (네이버 초당 10회 제한)
  }

  return places;
}

// ── 500개씩 Firestore writeBatch ─────────────────────────────────
async function batchInsert(places: RawPlace[], region: string): Promise<number> {
  const BATCH_SIZE = 500; // Firestore writeBatch 최대 500 ops
  let inserted = 0;

  for (let i = 0; i < places.length; i += BATCH_SIZE) {
    const chunk = places.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const p of chunk) {
      const category = categoryFromKeyword(p.source_keyword, p.category, p.name);
      const docData: HotspotDoc = {
        name:             p.name,
        category,
        description:      p.description,
        lat:              p.lat,
        lng:              p.lng,
        congestion_level: 2,   // 기본값: 보통
        report_count:     0,   // 기본값: 0
        is_toss_place:    false,
        last_updated:     Timestamp.now(),
        region,
        source:           "naver_local_search",
      };

      const ref = doc(collection(db, "hotspots"), p.id);
      batch.set(ref, docData, { merge: true }); // 기존 데이터 있으면 병합
    }

    await batch.commit();
    inserted += chunk.length;
    console.log(`  💾  배치 커밋 완료: ${inserted}/${places.length}개`);
  }

  return inserted;
}

// ── 기존 데이터 삭제 (--clear 옵션) ─────────────────────────────
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
  console.log(`   키워드: ${SEARCH_KEYWORDS.length}개\n`);

  if (CLEAR && !DRY_RUN) await clearRegion(REGION);

  // 1. 전체 키워드 병렬 수집 (API rate-limit 고려해 4개씩 묶음)
  const allPlaces: RawPlace[] = [];
  const seen = new Set<string>(); // 전역 중복 제거

  // 네이버 API rate-limit(초당 10회) 고려해 키워드별 순차 처리
  for (let i = 0; i < SEARCH_KEYWORDS.length; i++) {
    const kw = SEARCH_KEYWORDS[i];
    process.stdout.write(`🔍  [${i + 1}/${SEARCH_KEYWORDS.length}] "${REGION} ${kw}" 수집 중...`);

    const items = await collectByKeyword(REGION, kw, 25);
    let added = 0;
    for (const p of items) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      allPlaces.push(p);
      added++;
    }

    process.stdout.write(` +${added}개 (누적: ${allPlaces.length}개)\n`);
    await sleep(700); // 키워드 간 딜레이 700ms
  }

  console.log(`\n📊  수집 완료: 총 ${allPlaces.length}개`);

  // 2. Dry run: 샘플 출력 후 종료
  if (DRY_RUN) {
    console.log("\n--- DRY RUN 전체 목록 ---");
    allPlaces.forEach((p, i) => {
      console.log(
        `  ${i + 1}. [${categoryFromKeyword(p.source_keyword, p.category, p.name)}] ${p.name} (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`
      );
    });
    console.log("\n⚡  --dry-run 모드: Firestore 저장 생략");
    process.exit(0);
  }

  // 3. 500개씩 Firestore 저장
  console.log(`\n💾  Firestore 저장 시작 (500개씩 배치)...`);
  const inserted = await batchInsert(allPlaces, REGION);

  console.log(`\n✅  완료! ${inserted}개 hotspot 저장됨.`);
  console.log(`   Firestore 콘솔: https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌  오류 발생:", err);
  process.exit(1);
});
