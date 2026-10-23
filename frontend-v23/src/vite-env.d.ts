/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** Optional map tile provider (Gate 6): URL template and attribution HTML. */
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_TILE_ATTRIBUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
