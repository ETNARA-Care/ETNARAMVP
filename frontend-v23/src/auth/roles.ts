/**
 * Roles reales confirmados en migrations/016_seeds.sql del backend:
 * PLATFORM_SUPERADMIN, ORGANIZATION_ADMIN, SUPERVISOR, WORKER, FAMILY.
 * No son nombres inventados -- son los `code` exactos de la tabla `roles`.
 *
 * ESTRATEGIA para cuando una organización trae varios roles a la vez para
 * el mismo usuario (ej. alguien con WORKER y también ORGANIZATION_ADMIN
 * en la misma organización):
 *
 *   1. Si tiene cualquier rol administrativo (PLATFORM_SUPERADMIN,
 *      ORGANIZATION_ADMIN, SUPERVISOR) -> /agency.
 *   2. Si no, pero tiene WORKER -> /caregiver.
 *   3. Si no, pero tiene FAMILY -> /family.
 *   4. Si no tiene ninguno de los anteriores -> null (no hay experiencia
 *      resoluble; RoleGuard lo manda de vuelta a /login).
 *
 * Justificación: un rol administrativo implica supervisión operativa de
 * TODO lo que un cuidador vería en esa organización, así que enviarlo a
 * /agency nunca le oculta capacidad -- lo contrario (mandarlo a /caregiver
 * cuando también es admin) sí lo haría. Esto es una decisión de producto,
 * no algo que el backend indique explícitamente -- documentada aquí para
 * poder ajustarla si Rafa prefiere otro criterio (ej. dejar elegir).
 */
export type ExperienceRoute = "/agency" | "/caregiver" | "/family";

const ADMIN_ROLES = ["PLATFORM_SUPERADMIN", "ORGANIZATION_ADMIN", "SUPERVISOR"];

export function resolveExperienceRoute(roles: string[]): ExperienceRoute | null {
  if (roles.some((r) => ADMIN_ROLES.includes(r))) return "/agency";
  if (roles.includes("WORKER")) return "/caregiver";
  if (roles.includes("FAMILY")) return "/family";
  return null;
}
