import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PUERTO_RICO_CENTER } from "./navigation";

/**
 * Confirm the location with a marker (Gate 6). Leaflet + OpenStreetMap tiles,
 * no geocoding: the written address is never sent to a map provider; the tile
 * server only sees which map area is being viewed. Tap/click or drag to place.
 */
export function LocationMapPicker({ value, onChange }: {
  value: { latitude: number; longitude: number } | null;
  onChange: (next: { latitude: number; longitude: number }) => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    if (!host.current || map.current) return;
    const start = value ? [value.latitude, value.longitude] as [number, number] : [PUERTO_RICO_CENTER.lat, PUERTO_RICO_CENTER.lng] as [number, number];
    const m = L.map(host.current, { center: start, zoom: value ? 17 : 9, scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    }).addTo(m);
    const place = (lat: number, lng: number) => {
      const rounded = { latitude: Math.round(lat * 1e6) / 1e6, longitude: Math.round(lng * 1e6) / 1e6 };
      if (!marker.current) {
        marker.current = L.marker([lat, lng], {
          draggable: true, keyboard: true, title: "Ubicación del servicio",
          icon: L.divIcon({ className: "", iconSize: [28, 28], iconAnchor: [14, 28],
            html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--color-navy-900,#16213e);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>' }),
        }).addTo(m);
        marker.current.on("dragend", () => { const p = marker.current!.getLatLng(); place(p.lat, p.lng); });
      } else marker.current.setLatLng([lat, lng]);
      changeRef.current(rounded);
    };
    if (value) {
      marker.current = null;
      place(value.latitude, value.longitude);
    }
    m.on("click", (e: L.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
    map.current = m;
    // Modals open with an animation: recompute the size once visible.
    const t = window.setTimeout(() => m.invalidateSize(), 200);
    return () => { window.clearTimeout(t); m.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={host} role="application" aria-label="Mapa: toca para colocar el marcador de la ubicación"
        data-testid="location-map" className="h-56 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]" />
      <p className="mt-1 text-[var(--text-caption)] text-[var(--color-text-muted)]">
        Toca el mapa o arrastra el marcador hasta la entrada. El mapa es de OpenStreetMap; la dirección escrita no se envía.
      </p>
    </div>
  );
}
