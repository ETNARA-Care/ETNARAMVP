/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Optional map tile provider (Gate 6): URL template and attribution HTML. */
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_TILE_ATTRIBUTION?: string;
  /** "512" for 512-px tiles (Mapbox), default 256. */
  readonly VITE_MAP_TILE_SIZE?: string;
  /** Provider logo asset we host (required by Mapbox's attribution terms). */
  readonly VITE_MAP_LOGO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
