/**
 * Quién revisa fotos y gestiona consentimientos en el portal (decisión D5-B):
 * administración y supervisión de la agencia. La plataforma (ETNARA central) no,
 * aunque entre al portal. El backend lo vuelve a comprobar en cada petición
 * (app_photo_is_manager, 115); esto solo decide qué se muestra.
 */
export const PHOTO_REVIEW_ROLES = ["ORGANIZATION_ADMIN", "SUPERVISOR"] as const;

export function canReviewPhotos(roles: readonly string[] | undefined | null): boolean {
  return Array.isArray(roles) && roles.some((role) => (PHOTO_REVIEW_ROLES as readonly string[]).includes(role));
}

/**
 * Retención legal (backend 143): solo la ADMINISTRACIÓN de la agencia (no la supervisión).
 * El backend lo exige igualmente (app_is_org_admin).
 */
export function canManageLegalHolds(roles: readonly string[] | undefined | null): boolean {
  return Array.isArray(roles) && roles.includes("ORGANIZATION_ADMIN");
}
