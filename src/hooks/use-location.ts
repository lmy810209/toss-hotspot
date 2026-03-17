"use client";

import { useState, useEffect, useCallback } from "react";
import { getTossLocation, calculateDistance } from "@/lib/toss-sdk";
import { UserLocation } from "@/lib/types";

interface UseLocationReturn {
  userLocation: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getDistanceTo: (target: UserLocation) => number | null;
  isWithin100m: (target: UserLocation) => boolean;
}

export function useLocation(): UseLocationReturn {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * toss.getLocation() SDK를 래핑하는 위치 갱신 함수.
   * 실제 토스 앱 환경에서는 window.toss.getLocation()을 호출.
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const location = await getTossLocation();
      setUserLocation(location);
    } catch {
      setError("위치를 가져올 수 없어요. 위치 권한을 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getDistanceTo = useCallback(
    (target: UserLocation): number | null => {
      if (!userLocation) return null;
      return calculateDistance(userLocation, target);
    },
    [userLocation]
  );

  const isWithin100m = useCallback(
    (target: UserLocation): boolean => {
      const dist = getDistanceTo(target);
      return dist !== null && dist <= 100;
    },
    [getDistanceTo]
  );

  return { userLocation, isLoading, error, refresh, getDistanceTo, isWithin100m };
}
