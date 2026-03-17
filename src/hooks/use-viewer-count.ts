"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** 세션 고유 ID — 탭 열려있는 동안 유지 */
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "__toss_hotspot_sid__";
  let sid = sessionStorage.getItem(KEY);
  if (!sid) {
    sid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(KEY, sid);
  }
  return sid;
}

/**
 * Firestore presence 패턴으로 실시간 조회자 수를 추적.
 *
 * - hotspotId가 null이면 이전 presence 즉시 해제
 * - Firestore 미연결 시 mock 랜덤 값 사용 (데모용)
 */
export function useViewerCount(hotspotId: string | null): number {
  const [count, setCount] = useState(0);
  const prevHotspotId = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const sessionId = useRef<string>("");

  useEffect(() => {
    sessionId.current = getSessionId();
  }, []);

  useEffect(() => {
    const hasFirestore = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const sid = sessionId.current;

    // 이전 장소 presence 해제
    if (prevHotspotId.current && prevHotspotId.current !== hotspotId) {
      if (hasFirestore && sid) {
        deleteDoc(
          doc(db, "hotspots", prevHotspotId.current, "viewers", sid)
        ).catch(() => {});
      }
      unsubRef.current?.();
      unsubRef.current = null;
    }

    if (!hotspotId) {
      prevHotspotId.current = null;
      setCount(0);
      return;
    }

    prevHotspotId.current = hotspotId;

    if (!hasFirestore) {
      // Mock 모드: 랜덤 조회자 수 (5~25명, 느리게 변동)
      const base = Math.floor(Math.random() * 18) + 5;
      setCount(base);
      const timer = setInterval(() => {
        setCount((prev) => Math.max(1, prev + Math.floor(Math.random() * 5) - 2));
      }, 4000);
      return () => clearInterval(timer);
    }

    // Firestore presence 등록
    if (sid) {
      setDoc(doc(db, "hotspots", hotspotId, "viewers", sid), {
        session_id: sid,
        joined_at: serverTimestamp(),
      }).catch(() => {});
    }

    // 실시간 조회자 수 구독
    const unsub = onSnapshot(
      collection(db, "hotspots", hotspotId, "viewers"),
      (snap) => setCount(snap.size),
      () => setCount(0)
    );
    unsubRef.current = unsub;

    return () => {
      unsub();
      // 페이지 이탈 / 컴포넌트 언마운트 시 presence 해제
      if (sid && hotspotId) {
        deleteDoc(doc(db, "hotspots", hotspotId, "viewers", sid)).catch(() => {});
      }
    };
  }, [hotspotId]);

  return count;
}
