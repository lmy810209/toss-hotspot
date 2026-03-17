"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface CoinAnimationProps {
  show: boolean;
  onComplete: () => void;
}

// 파티클 방향 정의 (각도 배열 → tx/ty 변환)
const SPARKLES = [
  { angle: 0,   dist: 60 },
  { angle: 45,  dist: 55 },
  { angle: 90,  dist: 65 },
  { angle: 135, dist: 55 },
  { angle: 180, dist: 60 },
  { angle: 225, dist: 55 },
  { angle: 270, dist: 65 },
  { angle: 315, dist: 55 },
];

function toXY(angle: number, dist: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    tx: `${Math.round(Math.cos(rad) * dist)}px`,
    ty: `${Math.round(Math.sin(rad) * dist)}px`,
  };
}

export default function CoinAnimation({ show, onComplete }: CoinAnimationProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 1800);
    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
      aria-hidden
    >
      {/* 클릭 차단 없이 화면 전체에 오버레이 */}
      <div
        className="absolute"
        style={{
          left: "50%",
          bottom: "35%", // 바텀 시트 위쪽에서 발사
        }}
      >
        {/* 파급 링 */}
        <div
          className="absolute w-16 h-16 rounded-full border-2 border-yellow-400"
          style={{
            top: "50%",
            left: "50%",
            animation: "ring-expand 0.6s ease-out 0.1s forwards",
            opacity: 0,
          }}
        />

        {/* 스파클 파티클 */}
        {SPARKLES.map((s, i) => {
          const { tx, ty } = toXY(s.angle, s.dist);
          const emojis = ["✨", "⭐", "💫", "✨", "⭐", "💫", "✨", "⭐"];
          return (
            <span
              key={i}
              className="absolute text-sm select-none"
              style={
                {
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  "--tx": tx,
                  "--ty": ty,
                  animation: `sparkle-burst 0.7s ease-out ${i * 0.04}s forwards`,
                  opacity: 0,
                } as React.CSSProperties
              }
            >
              {emojis[i]}
            </span>
          );
        })}

        {/* 메인 코인 */}
        <span
          className="absolute text-5xl select-none"
          style={{
            left: "50%",
            bottom: "0",
            animation: "coin-launch 1.6s cubic-bezier(0.2, 0.8, 0.4, 1) forwards, coin-glow 0.6s ease-in-out 0.1s 2 alternate",
            opacity: 0,
          }}
        >
          🪙
        </span>

        {/* "+10원 적립!" 텍스트 */}
        <div
          className="absolute whitespace-nowrap select-none"
          style={{
            left: "50%",
            bottom: "-40px",
            animation: "point-text-rise 1.5s cubic-bezier(0.2, 0.8, 0.4, 1) 0.15s forwards",
            opacity: 0,
          }}
        >
          <span
            className="font-black text-lg tracking-tight"
            style={{
              color: "#3182F6",
              textShadow: "0 2px 8px rgba(49,130,246,0.3)",
              display: "block",
              transform: "translateX(-50%)",
            }}
          >
            +10원 적립!
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
