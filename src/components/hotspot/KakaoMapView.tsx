"use client";

/**
 * KakaoMapView — 카카오 지도 SDK 직접 로딩
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
    kakao: { maps: any };
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
    if (!map || typeof window === "undefined" || !window.kakao) return;

    const proj = map.getProjection();

    setMarkers(
      hotspots.map((h) => {
        const pt = proj.pointFromCoords(
          new window.kakao.maps.LatLng(h.lat, h.lng)
        );
        return { id: h.id, x: pt.x, y: pt.y };
      })
    );

    if (userLocation) {
      const up = proj.pointFromCoords(
        new window.kakao.maps.LatLng(userLocation.lat, userLocation.lng)
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
    if (!mapDivRef.current) return;

    const K = window.kakao.maps;
    const map = new K.Map(mapDivRef.current, {
      center: new K.LatLng(37.55, 126.95),
      level: 5,
    });
    mapRef.current = map;

    K.event.addListener(map, "bounds_changed", scheduleRecalc);
    K.event.addListener(map, "zoom_changed",   scheduleRecalc);
    K.event.addListener(map, "idle",           recalc);

    recalc();
    setStatus("ready");
  }, [recalc, scheduleRecalc]);

  // ── 카카오 지도 SDK 스크립트 로드 ────────────────────────
  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;
    if (!appKey) {
      setErrorMsg("NEXT_PUBLIC_KAKAO_MAP_APP_KEY 환경변수가 없습니다.");
      setStatus("error");
      return;
    }

    const timeout = setTimeout(() => {
      setErrorMsg(
        `지도 로딩 시간 초과 (15초)\n` +
        `현재 Origin: ${window.location.origin}\n` +
        `카카오 개발자 콘솔 > JavaScript SDK 도메인에 등록됐는지 확인하세요.`
      );
      setStatus("error");
    }, 15_000);

    const tryInitMap = () => {
      if (!mapDivRef.current) {
        requestAnimationFrame(tryInitMap);
        return;
      }
      try {
        initMap();
      } catch (e) {
        console.error("[KakaoMap] initMap() threw:", e);
        setErrorMsg(`지도 초기화 실패: ${String(e)}`);
        setStatus("error");
      }
    };

    // 이미 SDK가 로드된 경우
    if (window.kakao?.maps?.Map) {
      clearTimeout(timeout);
      tryInitMap();
      return;
    }

    const script   = document.createElement("script");
    script.src     = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async   = true;

    script.onload = () => {
      clearTimeout(timeout);
      window.kakao.maps.load(() => {
        tryInitMap();
      });
    };

    script.onerror = () => {
      clearTimeout(timeout);
      setErrorMsg(
        `SDK 스크립트 로드 실패\n` +
        `현재 Origin: ${window.location.origin}\n` +
        `카카오 개발자 콘솔 > JavaScript SDK 도메인에 위 주소를 등록해주세요.`
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

      {/* ── 레이어 1: 카카오 지도 타일 (그레이스케일 필터) ── */}
      <div
        className="absolute inset-0"
        style={{
          filter: "grayscale(100%) brightness(108%) contrast(0.88) sepia(5%)",
        }}
      >
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
