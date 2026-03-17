"use client";

import { useEffect, useRef, useState } from "react";
import { Hotspot, UserLocation } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { kakao: { maps: any }; }
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

function makeMarkerEl(hotspot: Hotspot, isSelected: boolean): HTMLElement {
  const color = LEVEL_COLOR[hotspot.congestion_level];
  const label = LEVEL_TEXT[hotspot.congestion_level];
  const scale = isSelected ? 1.12 : 1;
  const ring  = isSelected ? "box-shadow:0 0 0 3px #3182F6;" : "";

  const tossBadge = hotspot.is_toss_place
    ? `<div style="display:flex;align-items:center;gap:2px;background:#3182F6;color:#fff;font-size:9px;font-weight:900;padding:2px 6px;border-radius:99px;margin-bottom:2px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.15);">💳 토스 단말기</div>`
    : "";

  const html =
    `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:scale(${scale});transition:transform 0.15s;">` +
    tossBadge +
    `<div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;margin-bottom:4px;box-shadow:0 2px 6px rgba(0,0,0,0.18);white-space:nowrap;">${label}</div>` +
    `<div style="background:#fff;border-radius:50%;padding:6px;${ring}box-shadow:0 2px 8px rgba(0,0,0,0.18);">` +
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="${color}"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>` +
    `</div>` +
    `<span style="margin-top:3px;font-size:11px;font-weight:600;color:#1a1a1a;background:rgba(255,255,255,0.92);padding:1px 6px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.1);white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;">${hotspot.name}</span>` +
    `</div>`;

  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  return wrap.firstElementChild as HTMLElement;
}

export default function KakaoMapView({
  hotspots,
  onSelectHotspot,
  selectedHotspot,
  userLocation,
}: KakaoMapViewProps) {
  const [status, setStatus]     = useState<SDKStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const mapDivRef      = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<any>(null);
  const overlaysRef    = useRef<Map<string, any>>(new Map());
  const userOverlayRef = useRef<any>(null);

  // ── CustomOverlay 동기화 ───────────────────────────────
  function syncOverlays(spots: Hotspot[], selected: Hotspot | null) {
    const K   = window.kakao.maps;
    const map = mapRef.current;
    const existing = overlaysRef.current;

    // 사라진 핫스팟 제거
    const ids = new Set(spots.map((h) => h.id));
    existing.forEach((ov, id) => {
      if (!ids.has(id)) { ov.setMap(null); existing.delete(id); }
    });

    spots.forEach((h) => {
      const isSelected = selected?.id === h.id;

      if (existing.has(h.id)) {
        // 기존 overlay 내용 교체 (선택 상태 변경 반영)
        const ov = existing.get(h.id);
        ov.setContent(makeMarkerEl(h, isSelected));
        ov.setZIndex(isSelected ? 20 : 10);
      } else {
        // 신규 생성
        const el = makeMarkerEl(h, isSelected);
        el.addEventListener("click", () => onSelectHotspot(h));

        const ov = new K.CustomOverlay({
          position: new K.LatLng(h.lat, h.lng),
          content: el,
          yAnchor: 1.0,
          zIndex: isSelected ? 20 : 10,
        });
        ov.setMap(map);
        existing.set(h.id, ov);
      }
    });
  }

  // ── 사용자 위치 overlay ────────────────────────────────
  function syncUserOverlay(loc: UserLocation | null) {
    const K = window.kakao.maps;
    if (!loc) { userOverlayRef.current?.setMap(null); userOverlayRef.current = null; return; }

    const el = document.createElement("div");
    el.style.cssText = "position:relative;width:16px;height:16px;";
    el.innerHTML =
      `<div style="position:absolute;inset:-10px;background:rgba(49,130,246,0.2);border-radius:50%;animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` +
      `<div style="width:16px;height:16px;background:#3182F6;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;

    if (userOverlayRef.current) {
      userOverlayRef.current.setPosition(new K.LatLng(loc.lat, loc.lng));
    } else {
      const ov = new K.CustomOverlay({
        position: new K.LatLng(loc.lat, loc.lng),
        content: el,
        yAnchor: 0.5,
        zIndex: 30,
      });
      ov.setMap(mapRef.current);
      userOverlayRef.current = ov;
    }
  }

  // ── 지도 초기화 ────────────────────────────────────────
  function initMap() {
    if (!mapDivRef.current) return;
    const K = window.kakao.maps;
    const map = new K.Map(mapDivRef.current, {
      center: new K.LatLng(37.553, 126.990), // 성수동↔연남동 중간
      level: 5,
    });
    mapRef.current = map;
    setStatus("ready");
  }

  // ── SDK 로드 ───────────────────────────────────────────
  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY || "bd83824564c77b233b4ce3f5a2d6af6c";

    const timeout = setTimeout(() => {
      setErrorMsg(`지도 로딩 시간 초과 (15초)\n현재 Origin: ${window.location.origin}\n카카오 개발자 콘솔 > JavaScript SDK 도메인에 등록됐는지 확인하세요.`);
      setStatus("error");
    }, 15_000);

    const tryInit = () => {
      if (!mapDivRef.current) { requestAnimationFrame(tryInit); return; }
      try { initMap(); clearTimeout(timeout); }
      catch (e) { clearTimeout(timeout); setErrorMsg(`지도 초기화 실패: ${String(e)}`); setStatus("error"); }
    };

    if (window.kakao?.maps?.Map) { clearTimeout(timeout); tryInit(); return; }

    const script = document.createElement("script");
    script.src   = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload  = () => window.kakao.maps.load(tryInit);
    script.onerror = () => {
      clearTimeout(timeout);
      setErrorMsg(`SDK 스크립트 로드 실패\n현재 Origin: ${window.location.origin}\n카카오 개발자 콘솔 > JavaScript SDK 도메인에 위 주소를 등록해주세요.`);
      setStatus("error");
    };
    document.head.appendChild(script);
    return () => { clearTimeout(timeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── hotspots / selected / userLocation 변경 → overlay 갱신 ──
  useEffect(() => {
    if (status !== "ready") return;
    syncOverlays(hotspots, selectedHotspot);
    syncUserOverlay(userLocation);
  }, [status, hotspots, selectedHotspot, userLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 그레이스케일 지도 타일 */}
      <div
        className="absolute inset-0"
        style={{ filter: "grayscale(100%) brightness(108%) contrast(0.88) sepia(5%)" }}
      >
        <div ref={mapDivRef} style={{ width: "100%", height: "100%" }} />
      </div>

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
