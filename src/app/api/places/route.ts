import { NextRequest, NextResponse } from "next/server";

const NCP_KEY_ID     = process.env.NCP_KEY_ID     || "1w6j8to1o1";
const NCP_KEY_SECRET = process.env.NCP_KEY_SECRET  || "SQ1Ax8aLahy3niZOJHl8H6O5HboxEQQfCQSkvEtF";
const NAVER_CLIENT_ID     = process.env.NAVER_LOCAL_CLIENT_ID     || "6l9WEWTWPAPDgSvf1O5x";
const NAVER_CLIENT_SECRET = process.env.NAVER_LOCAL_CLIENT_SECRET || "9lpLogIryD";

// Naver Local Search mapx/mapy → WGS84 변환
function toWGS84(val: string) {
  return parseInt(val, 10) / 10_000_000;
}

function stripTags(str: string) {
  return str.replace(/<[^>]+>/g, "");
}

function categoryColor(cat: string): string {
  if (/카페|커피|디저트|베이커리/.test(cat)) return "#f59e0b";
  if (/술|바|맥주|막걸리/.test(cat))          return "#8b5cf6";
  if (/쇼핑|마트|편의점/.test(cat))           return "#3182F6";
  return "#f97316"; // 음식점 default
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat   = searchParams.get("lat");
  const lng   = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat, lng required" }, { status: 400 });
  }

  // 1. 역지오코딩으로 현재 위치의 동(洞) 이름 가져오기
  let areaName = "서울";
  try {
    const rgRes = await fetch(
      `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&sourcecrs=epsg:4326&output=json&orders=admcode`,
      {
        headers: {
          "x-ncp-apigw-api-key-id": NCP_KEY_ID,
          "x-ncp-apigw-api-key":    NCP_KEY_SECRET,
        },
      }
    );
    if (rgRes.ok) {
      const rgData = await rgRes.json();
      const region = rgData.results?.[0]?.region;
      if (region) {
        const parts = [region.area2?.name, region.area3?.name].filter(Boolean);
        if (parts.length) areaName = parts.join(" ");
      }
    }
  } catch { /* 역지오코딩 실패 시 기본값 사용 */ }

  // 2. 카테고리별 병렬 검색 (맛집 / 카페 / 술집)
  const queries = ["맛집", "카페", "술집"];
  const headers = {
    "X-Naver-Client-Id":     NAVER_CLIENT_ID,
    "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    "Referer":               "https://nookup.co.kr",
    "User-Agent":            "Mozilla/5.0",
  };

  const results = await Promise.allSettled(
    queries.map((q) =>
      fetch(
        `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(areaName + " " + q)}&display=5&sort=comment`,
        { headers }
      ).then((r) => r.json())
    )
  );

  const places: object[] = [];
  const seen = new Set<string>();

  results.forEach((res) => {
    if (res.status !== "fulfilled") return;
    const items = res.value?.items ?? [];
    items.forEach((item: Record<string, string>) => {
      const name = stripTags(item.title);
      if (seen.has(name)) return;
      seen.add(name);

      const lat  = toWGS84(item.mapy);
      const lng  = toWGS84(item.mapx);
      if (!lat || !lng) return;

      places.push({
        id:       name + item.mapx,
        name,
        category: item.category,
        address:  item.roadAddress || item.address,
        link:     item.link,
        lat,
        lng,
        color:    categoryColor(item.category),
      });
    });
  });

  return NextResponse.json({ places, area: areaName });
}
