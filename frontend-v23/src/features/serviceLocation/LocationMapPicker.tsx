import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PUERTO_RICO_CENTER } from "./navigation";

/**
 * Tile provider is configurable (OSMF tile policy: switchable without an app
 * update). Default: OpenStreetMap standard tiles with visible attribution. No
 * geocoding: the written address is never sent to any map provider.
 */
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = import.meta.env.VITE_MAP_TILE_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
/** 512 for Mapbox (one request covers 4x the area: lower cost, fewer requests). Default 256. */
const TILE_SIZE = Number(import.meta.env.VITE_MAP_TILE_SIZE) === 512 ? 512 : 256;
const ZOOM_OFFSET = TILE_SIZE === 512 ? -1 : 0;
/** Provider logo required by some providers' terms (Mapbox); an asset we host, never hot-linked. */
const PROVIDER_LOGO_URL = import.meta.env.VITE_MAP_LOGO_URL || "";

/**
 * Privacy of tile requests (Gate 6 + pilot review):
 *  - only {z}/{x}/{y} and the public token travel to the provider: never a name,
 *    an address, a clinical datum or an ETNARA identifier;
 *  - referrerPolicy "strict-origin": the provider sees only https://etnara-care.github.io,
 *    never the page path (it contains ids of the person served);
 *  - keepBuffer 1 + updateWhenIdle: fewer tiles around the point (less cost, less exposure).
 */
export const TILE_OPTIONS: L.TileLayerOptions = {
  maxZoom: 19, attribution: TILE_ATTRIBUTION, tileSize: TILE_SIZE, zoomOffset: ZOOM_OFFSET,
  referrerPolicy: "strict-origin", keepBuffer: 1, updateWhenIdle: true,
};

type Point = { latitude: number; longitude: number };

/**
 * Exact point of the service (Gate 6). Tap to place, drag to correct. A centre
 * request (local search: municipality / pasted link) only moves the view, it
 * never places or confirms the marker by itself.
 */
export function LocationMapPicker({ value, onChange, center, className = "h-56", readOnly = false }: {
  value: Point | null;
  onChange: (next: Point) => void;
  /** View request from the local search; changing it recentres the map. */
  center?: { lat: number; lng: number; zoom: number; key: string } | null;
  className?: string;
  /** Preview only: the marker cannot be dragged nor placed until «Ajustar PIN» turns this off. */
  readOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  const placeMarker = (lat: number, lng: number) => {
    const m = map.current;
    if (!m) return;
    if (!marker.current) {
      marker.current = L.marker([lat, lng], {
        draggable: !readOnlyRef.current, keyboard: true, title: "Ubicación del servicio", autoPan: true,
        icon: L.divIcon({ className: "", iconSize: [32, 32], iconAnchor: [16, 32],
          html: '<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--color-navy-900,#16213e);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>' }),
      }).addTo(m);
      marker.current.on("dragend", () => {
        const p = marker.current!.getLatLng();
        changeRef.current({ latitude: Math.round(p.lat * 1e6) / 1e6, longitude: Math.round(p.lng * 1e6) / 1e6 });
      });
    } else marker.current.setLatLng([lat, lng]);
  };

  useEffect(() => {
    if (!host.current || map.current) return;
    const start: [number, number] = value ? [value.latitude, value.longitude] : [PUERTO_RICO_CENTER.lat, PUERTO_RICO_CENTER.lng];
    const m = L.map(host.current, { center: start, zoom: value ? 18 : 9, scrollWheelZoom: false, tapTolerance: 20 });
    L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(m);
    if (PROVIDER_LOGO_URL) {
      const Logo = L.Control.extend({ onAdd: () => {
        const img = L.DomUtil.create("img") as HTMLImageElement;
        img.src = PROVIDER_LOGO_URL; img.alt = "Proveedor del mapa"; img.style.height = "20px"; img.referrerPolicy = "no-referrer";
        return img;
      } });
      new Logo({ position: "bottomleft" }).addTo(m);
    }
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (readOnlyRef.current) return;
      placeMarker(e.latlng.lat, e.latlng.lng);
      changeRef.current({ latitude: Math.round(e.latlng.lat * 1e6) / 1e6, longitude: Math.round(e.latlng.lng * 1e6) / 1e6 });
    });
    map.current = m;
    if (value) placeMarker(value.latitude, value.longitude);
    // Modals open with an animation / full-screen sheet: recompute the size once visible.
    const t = window.setTimeout(() => m.invalidateSize(), 250);
    return () => { window.clearTimeout(t); m.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A value set from outside (pasted link / coordinates) moves the marker and the view.
  useEffect(() => {
    if (!map.current || !value) return;
    const at = marker.current?.getLatLng();
    if (at && Math.abs(at.lat - value.latitude) < 1e-7 && Math.abs(at.lng - value.longitude) < 1e-7) return;
    placeMarker(value.latitude, value.longitude);
    map.current.setView([value.latitude, value.longitude], Math.max(map.current.getZoom(), 17));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.latitude, value?.longitude]);

  useEffect(() => {
    if (map.current && center) map.current.setView([center.lat, center.lng], center.zoom);
  }, [center?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const d = marker.current?.dragging;
    if (d) { if (readOnly) d.disable(); else d.enable(); }
  }, [readOnly]);

  return (
    <div
      ref={host}
      role="application"
      aria-label={readOnly ? "Vista previa del mapa con el PIN" : "Mapa: toca para colocar el marcador y arrástralo hasta la entrada"}
      data-readonly={readOnly ? "true" : undefined}
      data-testid="location-map"
      // isolate + z-0: Leaflet's own z-index layers (400–1000) stay inside the map
      // and can never paint over the modal's header or buttons (iOS Safari).
      className={`relative isolate z-0 w-full touch-none overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] ${className}`}
    />
  );
}
