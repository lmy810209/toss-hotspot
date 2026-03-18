"use client";

import { useEffect, useRef, useState } from "react";
import { Hotspot, UserLocation, MapBounds } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { naver: { maps: any }; }
}

interface KakaoMapViewProps {
  hotspots: Hotspot[];
  onSelectHotspot: (hotspot: Hotspot) => void;
  selectedHotspot: Hotspot | null;
  userLocation: UserLocation | null;
  onBoundsChange?: (bounds: MapBounds) => void;
  panToUserTrigger?: number;
}

type SDKStatus = "loading" | "ready" | "error";

// 여유=초록, 보통=노랑, 붐빔=빨강
const LEVEL_COLOR: Record<number, string> = { 1: "#22c55e", 2: "#eab308", 3: "#ef4444" };

function makeMarkerContent(hotspot: Hotspot, isSelected: boolean): string {
  const color = LEVEL_COLOR[hotspot.congestion_level];
  const scale = isSelected ? "scale(1.2)" : "scale(1)";
  const glow  = isSelected ? `filter:drop-shadow(0 0 8px ${color});` : "";
  const ring  = isSelected ? `outline:3px solid #3182F6;outline-offset:2px;` : "";

  const tossBadge = hotspot.is_toss_place
    ? `<div style="display:flex;align-items:center;gap:3px;background:linear-gradient(135deg,#3182F6,#1c6ef3);color:#fff;font-size:10px;font-weight:900;padding:3px 8px;border-radius:99px;margin-bottom:3px;white-space:nowrap;box-shadow:0 2px 8px rgba(49,130,246,0.45);">💳 토스 단말기</div>`
    : "";

  return (
    `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:${scale};transition:transform 0.18s;${glow}">` +
    tossBadge +
    `<div style="background:#fff;border-radius:50%;padding:7px;${ring}box-shadow:0 4px 14px rgba(0,0,0,0.22);">` +
      `<svg width="26" height="26" viewBox="0 0 24 24" fill="${color}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>` +
    `</div>` +
    `<span style="margin-top:3px;font-size:11px;font-weight:700;color:#111;background:rgba(255,255,255,0.95);padding:2px 7px;border-radius:5px;box-shadow:0 1px 4px rgba(0,0,0,0.15);white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;">${hotspot.name}</span>` +
    `</div>`
  );
}

// 클러스터: 파란 원 + 흰색 숫자
function makeClusterContent(count: number): string {
  return (
    `<div style="background:#3182F6;color:#fff;font-size:15px;font-weight:900;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(49,130,246,0.55);border:3px solid #fff;cursor:pointer;">${count}</div>`
  );
}

export default function NaverMapView({
  hotspots,
  onSelectHotspot,
  selectedHotspot,
  userLocation,
  onBoundsChange,
  panToUserTrigger = 0,
}: KakaoMapViewProps) {
  const [status, setStatus]     = useState<SDKStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [mapZoom, setMapZoom]   = useState(14);

  const mapDivRef        = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<any>(null);
  const markersRef       = useRef<Map<string, any>>(new Map());
  const userMarker       = useRef<any>(null);
  const lastPanTrigger   = useRef(0);

  // ── 마커 동기화 (클러스터링 포함) ──────────────────────
  function syncMarkers(spots: Hotspot[], selected: Hotspot | null) {
    const N   = window.naver.maps;
    const map = mapRef.current;
    if (!map) return;

    const zoom     = map.getZoom() as number;
    const existing = markersRef.current;

    // 표시할 마커 목록 계산
    const toShow = new Map<string, {
      lat: number; lng: number; content: string;
      anchor: any; zIndex: number; onClick: () => void;
    }>();

    if (zoom >= 14) {
      // 줌 14 이상: 개별 마커
      spots.forEach((h) => {
        const isSelected = selected?.id === h.id;
        toShow.set(`s_${h.id}`, {
          lat: h.lat, lng: h.lng,
          content: makeMarkerContent(h, isSelected),
          anchor: new N.Point(0, 1),
          zIndex: isSelected ? 20 : 10,
          onClick: () => onSelectHotspot(h),
        });
      });
    } else {
      // 줌 13 이하: 그리드 클러스터링
      const gridSize = zoom >= 12 ? 0.03 : zoom >= 10 ? 0.08 : 0.2;
      const cells    = new Map<string, Hotspot[]>();

      for (const spot of spots) {
        const key = `${Math.floor(spot.lat / gridSize)}_${Math.floor(spot.lng / gridSize)}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key)!.push(spot);
      }

      cells.forEach((cellSpots, cellKey) => {
        if (cellSpots.length === 1) {
          const h          = cellSpots[0];
          const isSelected = selected?.id === h.id;
          toShow.set(`s_${h.id}`, {
            lat: h.lat, lng: h.lng,
            content: makeMarkerContent(h, isSelected),
            anchor: new N.Point(0, 1),
            zIndex: isSelected ? 20 : 10,
            onClick: () => onSelectHotspot(h),
          });
        } else {
          const lat      = cellSpots.reduce((s, h) => s + h.lat, 0) / cellSpots.length;
          const lng      = cellSpots.reduce((s, h) => s + h.lng, 0) / cellSpots.length;
          const newZoom  = Math.min(zoom + 3, 16);
          toShow.set(`c_${cellKey}`, {
            lat, lng,
            content: makeClusterContent(cellSpots.length),
            anchor: new N.Point(21, 21),
            zIndex: 15,
            onClick: () => {
              map.setCenter(new N.LatLng(lat, lng));
              map.setZoom(newZoom);
            },
          });
        }
      });
    }

    // 불필요한 마커 제거
    existing.forEach((m, key) => {
      if (!toShow.has(key)) { m.setMap(null); existing.delete(key); }
    });

    // 추가/업데이트
    toShow.forEach(({ lat, lng, content, anchor, zIndex, onClick }, key) => {
      if (existing.has(key)) {
        existing.get(key).setIcon({ content, anchor });
        existing.get(key).setZIndex(zIndex);
      } else {
        const m = new N.Marker({
          position: new N.LatLng(lat, lng),
          map,
          icon: { content, anchor },
          zIndex,
        });
        N.Event.addListener(m, "click", onClick);
        existing.set(key, m);
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

  // ── 지도 초기화 ────────────────────────────────────────
  function initMap() {
    if (!mapDivRef.current) return;
    const N = window.naver.maps;

    const map = new N.Map(mapDivRef.current, {
      center: new N.LatLng(37.553, 126.990),
      zoom: 14,
      mapTypeId: N.MapTypeId.NORMAL,
      mapTypeControl: false,
      zoomControl: false,
      logoControl: true,
      scaleControl: false,
      minZoom: 10,
      maxZoom: 20,
    });

    mapRef.current = map;

    // 줌 변경 → 클러스터 재계산
    N.Event.addListener(map, "zoom_changed", () => {
      setMapZoom(map.getZoom());
    });

    // idle → bounds 콜백
    N.Event.addListener(map, "idle", () => {
      if (onBoundsChange) {
        const bounds = map.getBounds();
        onBoundsChange({
          north: bounds.getNE().lat(),
          south: bounds.getSW().lat(),
          east:  bounds.getNE().lng(),
          west:  bounds.getSW().lng(),
        });
      }
    });

    // 초기 bounds
    setTimeout(() => {
      N.Event.trigger(map, "resize");
      if (onBoundsChange) {
        const bounds = map.getBounds();
        onBoundsChange({
          north: bounds.getNE().lat(),
          south: bounds.getSW().lat(),
          east:  bounds.getNE().lng(),
          west:  bounds.getSW().lng(),
        });
      }
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

    if (window.naver?.maps?.Map) { clearTimeout(timeout); tryInit(); return; }

    const script = document.createElement("script");
    script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}&submodules=panorama`;
    script.async = true;
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

  // ── 데이터 변경 시 마커 갱신 (줌 변경 포함) ───────────
  useEffect(() => {
    if (status !== "ready") return;
    syncMarkers(hotspots, selectedHotspot);
    syncUserMarker(userLocation);
  }, [status, hotspots, selectedHotspot, userLocation, mapZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 내 위치로 이동 ─────────────────────────────────────
  useEffect(() => {
    if (!panToUserTrigger || panToUserTrigger === lastPanTrigger.current) return;
    if (status !== "ready" || !mapRef.current || !userLocation) return;
    lastPanTrigger.current = panToUserTrigger;
    const N = window.naver.maps;
    mapRef.current.panTo(new N.LatLng(userLocation.lat, userLocation.lng));
    mapRef.current.setZoom(15);
  }, [panToUserTrigger, userLocation, status]); // eslint-disable-line react-hooks/exhaustive-deps

  function zoomIn()  { mapRef.current?.setZoom(mapRef.current.getZoom() + 1); }
  function zoomOut() { mapRef.current?.setZoom(mapRef.current.getZoom() - 1); }

  return (
    <div className="absolute inset-0 overflow-hidden">
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
