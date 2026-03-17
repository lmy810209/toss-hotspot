import { UserLocation } from "./types";

/**
 * Mocking the Toss SDK location behavior.
 * In a real app, this would use window.toss.getLocation().
 */
export async function getTossLocation(): Promise<UserLocation> {
  // Simulate an async SDK call
  return new Promise((resolve) => {
    // Check if real geolocation is available as a fallback
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          // Default to a central Seoul location if permission denied
          resolve({ lat: 37.5665, lng: 126.9780 });
        }
      );
    } else {
      resolve({ lat: 37.5665, lng: 126.9780 });
    }
  });
}

/**
 * Calculates distance between two coordinates in meters.
 */
export function calculateDistance(loc1: UserLocation, loc2: UserLocation): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (loc1.lat * Math.PI) / 180;
  const φ2 = (loc2.lat * Math.PI) / 180;
  const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Proximity check for the 100m reporting requirement.
 */
export async function checkProximity(hotspotLoc: UserLocation): Promise<boolean> {
  const userLoc = await getTossLocation();
  const distance = calculateDistance(userLoc, hotspotLoc);
  return distance <= 100;
}
