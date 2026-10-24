import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

/**
 * SmartMatch pilot (backend migration 108): features ETNARA central enables per
 * agency. Off by default; when off the screens and links are not shown at all
 * (the backend also answers 404 FEATURE_NOT_ENABLED).
 */
export type OrgFeature = "SMARTMATCH" | "EN_CAMINO";

export function hasOrgFeature(features: readonly string[] | undefined | null, feature: OrgFeature): boolean {
  return Array.isArray(features) && features.includes(feature);
}

export function useOrgFeature(feature: OrgFeature): boolean {
  const { activeOrganization } = useAuth();
  return hasOrgFeature(activeOrganization?.features, feature);
}

/** Route wrapper: a disabled agency is sent back to its portal home. */
export function FeatureRoute({ feature, fallback, children }: { feature: OrgFeature; fallback: string; children: ReactNode }) {
  return useOrgFeature(feature) ? <>{children}</> : <Navigate to={fallback} replace />;
}
