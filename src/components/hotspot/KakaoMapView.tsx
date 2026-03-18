"use client";

import { useEffect, useRef, useState } from "react";
import { Hotspot, UserLocation } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { naver: { maps: any }; }
}

interface KakaoMapViewProps {
  hotspots: Hotspot[];
  onSelectHotspot: (hotspot: Hotspot) => void;
  selectedHotspot: Hotspot | null;
  userLocation: UserLocation | null;
}

type SDKStatus = "loading" | "ready" | "error";

const LEVEL_COLOR: Record<number, string> = { 1: "#22c55e", 2: "#f59e0b", 3: "#ef4444" };
const LEVEL_TEXT: Record<number, string>  = { 1: "여유", 2: "보통", 3: "붐빔" };

function makeMarkerContent(hotspot: Hotspot, isSelected: boolean): string {
  const color  = LEVEL_COLOR[hotspot.congestion_level];
  const label  = LEVEL_TEXT[hotspot.congestion_level];
  const scale  = isSelected ? "scale(1.15)" : "scale(1)";
  const ring   = isSelected ? `outline:3px solid #3182F6;outline-offset:2px;` : "";
  const glow   = isSelected ? `filter:drop-shadow(0 0 6px ${color});` : "";

  const tossBadge = hotspot.is_toss_place
    ? `<div style="display:flex;align-items:center;gap:3px;background:linear-gradient(135deg,#3182F6,#1c6ef3);color:#fff;font-size:10px;font-weight:900;padding:3px 8px;border-radius:99px;margin-bottom:3px;white-space:nowrap;box-shadow:0 2px 8px rgba(49,130,246,0.45);">💳 토스 단말기</div>`
    : "";

  return (
    `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:${scale};transition:transform 0.18s;${glow}">` +
    tossBadge +
    `<div style="background:${color};color:#fff;font-size:12px;font-weight:800;padding:4px 12px;border-radius:99px;margin-bottom:5px;box-shadow:0 3px 10px ${color}88;white-space:nowrap;">${label}</div>` +
    `<div style="background:#fff;border-radius:50%;padding:7px;${ring}box-shadow:0 4px 14px rgba(0,0,0,0.22);">` +
      `<svg width="24" height="24" viewBox="0 0 24 24" fill="${color}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>` +
    `</div>` +
    `<span style="margin-top:4px;font-size:12px;font-weight:700;color:#111;background:rgba(255,255,255,0.96);padding:2px 8px;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.14);white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;">${hotspot.name}</span>` +
    `</div>`
  );
}

export default function NaverMapView({
  hotspots,
  onSelectHotspot,
  selectedHotspot,
  userLocation,
}: KakaoMapViewProps) {
  const [status, setStatus]     = useState<SDKStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const mapDivRef       = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<any>(null);
  const markersRef      = useRef<Map<string, any>>(new Map());
  const userMarker      = useRef<any>(null);
  const placeMarkersRef = useRef<any[]>([]);
  const fetchTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 마커 동기화 ────────────────────────────────────────
  function syncMarkers(spots: Hotspot[], selected: Hotspot | null) {
    const N   = window.naver.maps;
    const map = mapRef.current;
    const existing = markersRef.current;

    const ids = new Set(spots.map((h) => h.id));
    existing.forEach((m, id) => {
      if (!ids.has(id)) { m.setMap(null); existing.delete(id); }
    });

    spots.forEach((h) => {
      const isSelected = selected?.id === h.id;
      const content    = makeMarkerContent(h, isSelected);

      if (existing.has(h.id)) {
        const m = existing.get(h.id);
        m.setIcon({ content, anchor: new N.Point(0, 1) });
        m.setZIndex(isSelected ? 20 : 10);
      } else {
        const m = new N.Marker({
          position: new N.LatLng(h.lat, h.lng),
          map,
          icon: { content, anchor: new N.Point(0, 1) },
          zIndex: isSelected ? 20 : 10,
        });
        N.Event.addListener(m, "click", () => onSelectHotspot(h));
        existing.set(h.id, m);
      }
    });
  }

  // ── 사용자 위치 마커 ───────────────────────────────────
  function syncUserMarker(loc: UserLocation | null) {
    const N = window.naver.maps;
    if (!loc) { userMarker.current?.setMap(null); userMarker.current = null; return; }

    const content =
      `<div style="position:relative;width:16px;height:16px;">` +
      `<div style="position:absolute;inset:-10px;background:rgba(49,130,246,0.2);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` +
      `<div style="width:16px;height:16px;background:#3182F6;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>` +
      `</div>`;

    if (userMarker.current) {
      userMarker.current.setPosition(new N.LatLng(loc.lat, loc.lng));
    } else {
      userMarker.current = new N.Marker({
        position: new N.LatLng(loc.lat, loc.lng),
        map: mapRef.current,
        icon: { content, anchor: new N.Point(8, 8) },
        zIndex: 30,
      });
    }
  }

  // ── 주변 장소 마커 ─────────────────────────────────────
  function clearPlaceMarkers() {
    placeMarkersRef.current.forEach((m) => m.setMap(null));
    placeMarkersRef.current = [];
  }

  function fetchPlaces(lat: number, lng: number) {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        if (!data.places || !mapRef.current) return;

        clearPlaceMarkers();
        const N = window.naver.maps;

        data.places.forEach((p: any) => {
          const content =
            `<div onclick="window.open('${p.link || `https://map.naver.com/v5/search/${encodeURIComponent(p.name)}`}','_blank')" ` +
            `style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">` +
            `<div style="background:white;border:2px solid ${p.color};border-radius:8px;padding:2px 7px;font-size:10px;font-weight:700;color:${p.color};white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.15);max-width:80px;overflow:hidden;text-overflow:ellipsis;">${p.name}</div>` +
            `<div style="width:7px;height:7px;background:${p.color};border-radius:50%;margin-top:2px;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>` +
            `</div>`;

          const m = new N.Marker({
            position: new N.LatLng(p.lat, p.lng),
            map: mapRef.current,
            icon: { content, anchor: new N.Point(0, 1) },
            zIndex: 5,
          });
          placeMarkersRef.current.push(m);
        });
      } catch { /* 검색 실패 시 무시 */ }
    }, 1200); // 1.2초 디바운스
  }

  // ── 지도 초기화 ────────────────────────────────────────
  function initMap() {
    if (!mapDivRef.current) return;
    const N = window.naver.maps;

    const map = new N.Map(mapDivRef.current, {
      center: new N.LatLng(37.553, 126.990),
      // zoom 14: 맛집·카페 POI 아이콘이 충분히 표시되는 레벨
      zoom: 14,
      mapTypeId: N.MapTypeId.NORMAL,
      mapTypeControl: false,
      zoomControl: false,
      logoControl: true,
      scaleControl: false,
      // 지도 최소/최대 줌 제한
      minZoom: 10,
      maxZoom: 20,
    });

    mapRef.current = map;

    // 지도 이동/줌 후 주변 장소 자동 검색
    N.Event.addListener(map, "idle", () => {
      const c = map.getCenter();
      fetchPlaces(c.lat(), c.lng());
    });

    // 컨테이너 크기 재계산 + 초기 장소 검색
    setTimeout(() => {
      N.Event.trigger(map, "resize");
      const c = map.getCenter();
      fetchPlaces(c.lat(), c.lng());
    }, 500);
    setStatus("ready");
  }

  // ── 네이버 지도 SDK 로드 ───────────────────────────────
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "1w6j8to1o1";

    const timeout = setTimeout(() => {
      setErrorMsg(
        `지도 로딩 시간 초과 (15초)\n` +
        `현재 Origin: ${window.location.origin}\n` +
        `네이버 클라우드 플랫폼 콘솔 > Application > 등록된 서비스 URL에 위 주소를 추가해주세요.`
      );
      setStatus("error");
    }, 15_000);

    const tryInit = () => {
      if (!mapDivRef.current) { requestAnimationFrame(tryInit); return; }
      try { initMap(); clearTimeout(timeout); }
      catch (e) { clearTimeout(timeout); setErrorMsg(`지도 초기화 실패: ${String(e)}`); setStatus("error"); }
    };

    // 이미 로드된 경우
    if (window.naver?.maps?.Map) { clearTimeout(timeout); tryInit(); return; }

    const script = document.createElement("script");
    // submodules=panorama 로 POI 레이어(맛집·카페 아이콘) 풍부하게 로드
    script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=panorama`;
    script.async = true;
    // Referer 헤더를 명시적으로 origin만 전송 (NCP 도메인 인증 통과)
    script.setAttribute("referrerpolicy", "strict-origin");
    script.onload  = tryInit;
    script.onerror = () => {
      clearTimeout(timeout);
      setErrorMsg(
        `SDK 스크립트 로드 실패\n` +
        `현재 Origin: ${window.location.origin}\n` +
        `네이버 클라우드 플랫폼 콘솔 > Maps > Web Dynamic Map > 서비스 URL에 ${window.location.origin}을 등록해주세요.`
      );
      setStatus("error");
    };
    document.head.appendChild(script);

    return () => { clearTimeout(timeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 데이터 변경 시 마커 갱신 ──────────────────────────
  useEffect(() => {
    if (status !== "ready") return;
    syncMarkers(hotspots, selectedHotspot);
    syncUserMarker(userLocation);
  }, [status, hotspots, selectedHotspot, userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  function zoomIn()  { mapRef.current?.setZoom(mapRef.current.getZoom() + 1); }
  function zoomOut() { mapRef.current?.setZoom(mapRef.current.getZoom() - 1); }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 네이버 지도 */}
      <div ref={mapDivRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

      {/* 줌 컨트롤 */}
      {status === "ready" && (
        <div className="absolute right-4 bottom-24 z-20 flex flex-col rounded-xl overflow-hidden shadow-lg border border-gray-200">
          <button
            onClick={zoomIn}
            className="w-10 h-10 bg-white flex items-center justify-center text-xl font-light text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-200"
            aria-label="확대"
          >+</button>
          <button
            onClick={zoomOut}
            className="w-10 h-10 bg-white flex items-center justify-center text-xl font-light text-gray-700 hover:bg-gray-50 active:bg-gray-100"
            aria-label="축소"
          >−</button>
        </div>
      )}

      {/* 로딩 */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-toss-gray-50/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-toss-gray-500 font-medium">지도 불러오는 중...</span>
          </div>
        </div>
      )}

      {/* 에러 */}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-toss-gray-50 p-6 z-10">
          <div className="bg-white rounded-2xl p-6 toss-shadow max-w-sm w-full space-y-3 text-center">
            <div className="text-3xl">🗺️</div>
            <p className="font-bold text-toss-gray-900">지도를 불러올 수 없어요</p>
            <div className="text-xs text-left bg-orange-50 border border-orange-100 rounded-xl p-3 text-orange-700 space-y-1.5">
              {errorMsg.split("\n").map((line, i) => (
                <p key={i} className={i === 0 ? "font-bold" : ""}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
