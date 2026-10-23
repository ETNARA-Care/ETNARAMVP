import type { ShiftServiceLocation } from "@/api/serviceLocations";

type Navigable = Pick<ShiftServiceLocation, "addressLine" | "municipality" | "postalCode" | "latitude" | "longitude" | "establishment"> & { gpsConfirmed?: boolean };

/** "Calle Luna 12, Caguas 00725, Puerto Rico" (or the establishment address). */
export function serviceAddressText(l: Navigable): string {
  if (l.establishment) return [l.establishment.name, l.establishment.address].filter(Boolean).join(", ");
  const town = [l.municipality, l.postalCode].filter(Boolean).join(" ");
  const parts = [l.addressLine?.trim(), town].filter(Boolean);
  return parts.length ? [...parts, "Puerto Rico"].join(", ") : "";
}

/** Only an agency-confirmed point counts as an exact destination. */
const hasCoordinates = (l: Navigable) => l.gpsConfirmed !== false && typeof l.latitude === "number" && typeof l.longitude === "number";
/** True when the maps app will receive the written address (approximate street point). */
export const isApproximate = (l: Navigable) => !hasCoordinates(l);
export const canNavigateTo = (l: Navigable | null | undefined) => Boolean(l && (hasCoordinates(l) || serviceAddressText(l)));
const destination = (l: Navigable) => (hasCoordinates(l) ? `${l.latitude},${l.longitude}` : serviceAddressText(l));

/**
 * Links to the maps apps themselves. Built on the phone at the moment of use
 * from the shift's confirmed location: ETNARA never publishes a shareable URL
 * with a private address. The marker (coordinates) wins over the written text.
 */
export const appleMapsUrl = (l: Navigable) => `https://maps.apple.com/?daddr=${encodeURIComponent(destination(l))}&dirflg=d`;
export const googleMapsUrl = (l: Navigable) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination(l))}`;
export const wazeUrl = (l: Navigable) => hasCoordinates(l)
  ? `https://waze.com/ul?ll=${encodeURIComponent(destination(l))}&navigate=yes`
  : `https://waze.com/ul?q=${encodeURIComponent(destination(l))}&navigate=yes`;

/** Puerto Rico view for the map picker. */
export const PUERTO_RICO_CENTER = { lat: 18.22, lng: -66.43 };

/**
 * Local "search": accepts what an administrator copies from Apple Maps or Google
 * Maps (a link or "18.234100, -66.048500"). Parsed on the device; nothing is
 * sent anywhere. Returns null when no coordinates are recognised.
 */
export function parseMapPoint(input: string): { latitude: number; longitude: number } | null {
  const text = decodeURIComponent(input.trim());
  const patterns = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,                 // google.com/maps/@lat,lng,zoom
    /[?&](?:q|ll|daddr|destination|query|sll)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, // ?q=lat,lng (Google/Apple)
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,                  // google place data
    /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,              // plain "lat, lng"
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const latitude = Math.round(Number(m[1]) * 1e6) / 1e6;
    const longitude = Math.round(Number(m[2]) * 1e6) / 1e6;
    // Puerto Rico and its islands (Mona to Culebra/Vieques).
    if (latitude >= 17.5 && latitude <= 18.7 && longitude >= -68 && longitude <= -65.1) return { latitude, longitude };
    return null;
  }
  return null;
}
