import type { RecipientLocation } from "@/api/recipientLocation";

type LocationLike = Pick<RecipientLocation, "address_line" | "municipality" | "latitude" | "longitude">;

/** "Carr. 156 km 12.3, Barranquitas, Puerto Rico" — lo que se copia y se busca. */
export function addressText(location: LocationLike): string {
  const parts = [location.address_line, location.municipality].map((part) => part?.trim()).filter(Boolean);
  return parts.length ? [...parts, "Puerto Rico"].join(", ") : "";
}

function hasCoordinates(location: LocationLike): boolean {
  return typeof location.latitude === "number" && typeof location.longitude === "number";
}

/** Hay algo con qué navegar: coordenadas o una dirección escrita. */
export function canNavigate(location: LocationLike | null | undefined): boolean {
  return Boolean(location && (hasCoordinates(location) || addressText(location)));
}

/** Las coordenadas mandan: en el campo encuentran la casa aunque no haya número. */
export function googleMapsUrl(location: LocationLike): string {
  const destination = hasCoordinates(location) ? `${location.latitude},${location.longitude}` : addressText(location);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function wazeUrl(location: LocationLike): string {
  return hasCoordinates(location)
    ? `https://waze.com/ul?ll=${encodeURIComponent(`${location.latitude},${location.longitude}`)}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(addressText(location))}&navigate=yes`;
}

/**
 * Acepta lo que se copia de Google Maps: "18.186123, -66.306456".
 * Devuelve null si está vacío, o "invalid" si no son coordenadas válidas.
 */
export function parseCoordinates(value: string): { latitude: number; longitude: number } | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return "invalid";
  const latitude = Math.round(Number(match[1]) * 1e6) / 1e6;
  const longitude = Math.round(Number(match[2]) * 1e6) / 1e6;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return "invalid";
  return { latitude, longitude };
}

export function formatCoordinates(location: LocationLike | null | undefined): string {
  return location && hasCoordinates(location) ? `${location.latitude}, ${location.longitude}` : "";
}
