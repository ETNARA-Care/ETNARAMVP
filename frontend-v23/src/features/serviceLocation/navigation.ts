import type { ShiftServiceLocation } from "@/api/serviceLocations";

type Navigable = Pick<ShiftServiceLocation, "addressLine" | "municipality" | "postalCode" | "latitude" | "longitude" | "establishment">;

/** "Calle Luna 12, Caguas 00725, Puerto Rico" (or the establishment address). */
export function serviceAddressText(l: Navigable): string {
  if (l.establishment) return [l.establishment.name, l.establishment.address].filter(Boolean).join(", ");
  const town = [l.municipality, l.postalCode].filter(Boolean).join(" ");
  const parts = [l.addressLine?.trim(), town].filter(Boolean);
  return parts.length ? [...parts, "Puerto Rico"].join(", ") : "";
}

const hasCoordinates = (l: Navigable) => typeof l.latitude === "number" && typeof l.longitude === "number";
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
