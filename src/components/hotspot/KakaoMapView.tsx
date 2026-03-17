"use client";

/**
 * NaverMapView — 네이버 지도 SDK 직접 로딩
 *
 * 핵심 구조: 지도 컨테이너 div는 항상 DOM에 존재.
 * 로딩/에러 상태는 그 위에 overlay로 표시.
 *
 * (이전 방식: status === "loading" 일 때 스피너만 렌더 →
 *  mapDivRef.current === null → initMap() 즉시 리턴 → 영원히 loading 상태)
 *
 * 2-레이어 구조:
 *  ┌─ container ──────────────────────────────────────────┐
 *  │  [레이어 1] div — filter: grayscale(지도 타일만)      │
 *  │  [레이어 2] div — 마커 원색 유지, 클릭 이벤트 처리    │
 *  └──────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Hotspot, UserLocation } from "@/lib/types";
import MapMarker from "./MapMarker";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    naver: { maps: any };
  }
}

interface NaverMapViewProps {
  hotspots: Hotspot[];
  onSelectHotspot: (hotspot: Hotspot) => void;
  selectedHotspot: Hotspot | null;
  userLocation: UserLocation | null;
}

type SDKStatus = "loading" | "ready" | "error";

interface PixelPos { id: string; x: number; y: number; }

export default function NaverMapView({
  hotspots,
  onSelectHotspot,
  selectedHotspot,
  userLocation,
}: NaverMapViewProps) {
  const [status, setStatus]     = useState<SDKStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [markers, setMarkers]   = useState<PixelPos[]>([]);
  const [userPos, setUserPos]   = useState<{ x: number; y: number } | null>(null);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef    = useRef<any>(null);
  const rafRef    = useRef<number | null>(null);

  // ── 마커 픽셀 좌표 재계산 ──────────────────────────────────
  const recalc = useCallback(() => {
    const map = mapRef.current;
    if (!map || typeof window === "undefined" || !window.naver) return;

    const proj = map.getProjection();

    setMarkers(
      hotspots.map((h) => {
        const pt = proj.fromCoordToOffset(
          new window.naver.maps.LatLng(h.lat, h.lng)
        );
        return { id: h.id, x: pt.x, y: pt.y };
      })
    );

    if (userLocation) {
      const up = proj.fromCoordToOffset(
        new window.naver.maps.LatLng(userLocation.lat, userLocation.lng)
      );
      setUserPos({ x: up.x, y: up.y });
    } else {
      setUserPos(null);
    }
  }, [hotspots, userLocation]);

  const scheduleRecalc = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(recalc);
  }, [recalc]);

  // ── 지도 초기화 ───────────────────────────────────────────
  const initMap = useCallback(() => {
    if (!mapDivRef.current) {
      console.error("[NaverMap] initMap() — mapDivRef.current is null!");
      return;
    }

    const N = window.naver.maps;
    const map = new N.Map(mapDivRef.current, {
      center: new N.LatLng(37.55, 126.95),
      zoom: 13,
      mapTypeControl: false,
      zoomControl: false,
      scaleControl: false,
      logoControl: false,
      mapDataControl: false,
    });
    mapRef.current = map;
    console.log("[NaverMap] Map Object Created!", map);

    N.Event.addListener(map, "bounds_changed", scheduleRecalc);
    N.Event.addListener(map, "zoom_changed",   scheduleRecalc);
    N.Event.addListener(map, "idle",           recalc);

    recalc();
    setStatus("ready");
  }, [recalc, scheduleRecalc]);

  // ── Naver Maps SDK 스크립트 로드 ─────────────────────────
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      setErrorMsg("NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 환경변수가 없습니다.");
      setStatus("error");
      return;
    }

    // 15초 타임아웃
    const timeout = setTimeout(() => {
      setErrorMsg(
        `지도 로딩 시간 초과 (15초)\n` +
        `현재 Origin: ${window.location.origin}\n` +
        `NCP에 이 URL이 Web 서비스 URL로 등록됐는지 확인하세요.`
      );
      setStatus("error");
    }, 15_000);

    const tryInitMap = () => {
      // mapDivRef가 아직 null이면 한 프레임 뒤에 재시도
      if (!mapDivRef.current) {
        requestAnimationFrame(tryInitMap);
        return;
      }
      try {
        initMap();
      } catch (e) {
        console.error("[NaverMap] initMap() threw:", e);
        setErrorMsg(`지도 초기화 실패: ${String(e)}`);
        setStatus("error");
      }
    };

    // 이미 SDK가 로드된 경우
    if (window.naver?.maps?.Map) {
      clearTimeout(timeout);
      console.log("[NaverMap] SDK already present. origin:", window.location.origin);
      tryInitMap();
      return;
    }

    const script   = document.createElement("script");
    script.src     = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    script.async   = true;

    script.onload = () => {
      clearTimeout(timeout);
      console.log("[NaverMap] SDK loaded. origin:", window.location.origin);

      // 인증 실패 콜백 등록 — 어떤 URI로 인증 시도했는지 정확히 추적
      if (window.naver?.maps?.onJSAuthError !== undefined) {
        (window.naver.maps as any).onJSAuthError = (error: any) => {
          console.error(
            "[NaverMap] onJSAuthError:",
            JSON.stringify(error, null, 2),
            "\n인증 시도 URI:", window.location.href,
            "\norigin:", window.location.origin,
            "\nclientId:", clientId
          );
        };
      }

      tryInitMap();
    };

    script.onerror = () => {
      clearTimeout(timeout);
      console.error(
        "[NaverMap] script.onerror — origin:", window.location.origin,
        "clientId:", clientId
      );
      setErrorMsg(
        `SDK 스크립트 로드 실패 (네트워크 또는 도메인 거부)\n` +
        `현재 Origin: ${window.location.origin}\n` +
        `NCP Application > Web 서비스 URL에 위 주소를 등록해주세요.`
      );
      setStatus("error");
    };

    document.head.appendChild(script);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // hotspots / userLocation 변경 시 재계산
  useEffect(() => {
    if (status === "ready") recalc();
  }, [status, hotspots, userLocation, recalc]);

  // ── 렌더: 지도 div는 항상 DOM에 존재, 상태는 overlay로 표시 ──
  return (
    <div className="absolute inset-0 overflow-hidden">

      {/* ── 레이어 1: 네이버 지도 타일 (그레이스케일 필터) ── */}
      <div
        className="absolute inset-0"
        style={{
          filter: "grayscale(100%) brightness(108%) contrast(0.88) sepia(5%)",
        }}
      >
        {/* mapDivRef는 항상 여기 붙어 있어야 initMap()이 DOM을 잡을 수 있음 */}
        <div
          ref={mapDivRef}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>

      {/* ── 레이어 2: 마커 (필터 없음) ── */}
      {status === "ready" && (
        <div className="absolute inset-0 pointer-events-none">
          {markers.map((pos) => {
            const spot = hotspots.find((h) => h.id === pos.id);
            if (!spot) return null;
            return (
              <div
                key={spot.id}
                className="absolute pointer-events-auto"
                style={{
                  left: pos.x,
                  top: pos.y,
                  transform: "translate(-50%, -100%)",
                  zIndex: selectedHotspot?.id === spot.id ? 20 : 10,
                }}
              >
                <MapMarker
                  hotspot={spot}
                  isSelected={selectedHotspot?.id === spot.id}
                  onClick={onSelectHotspot}
                />
              </div>
            );
          })}

          {userPos && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: userPos.x,
                top: userPos.y,
                transform: "translate(-50%, -50%)",
                zIndex: 30,
              }}
            >
              <div className="relative">
                <div className="absolute -inset-3 bg-primary/20 rounded-full animate-ping" />
                <div className="w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 로딩 overlay ── */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-toss-gray-50/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-toss-gray-500 font-medium">지도 불러오는 중...</span>
          </div>
        </div>
      )}

      {/* ── 에러 overlay ── */}
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
