/** Physical floor order is independent of backend department display order. */
export const TOWER_FLOOR_ORDER = [
  "support", "marketing", "care", "finance",
  "compliance", "technology", "secretariat", "executive",
] as const;
export type TowerDepartmentId = typeof TOWER_FLOOR_ORDER[number];
export interface TowerDepartmentDTO { id: string; name: string }
export interface TowerAgentDTO { id: string; name: string; displayName?: string; department?: string; responsibilities: readonly string[] }
export interface TowerFloor {
  number: number; departmentId: TowerDepartmentId; name: string;
  agents: readonly TowerAgentDTO[];
}
export function buildTowerFloors(departments: readonly TowerDepartmentDTO[], agents: readonly TowerAgentDTO[]): TowerFloor[] {
  return TOWER_FLOOR_ORDER.map((departmentId, index) => ({
    number: index + 1,
    departmentId,
    name: departments.find(d => d.id === departmentId)?.name ?? departmentId,
    agents: agents.filter(agent => agent.department === departmentId),
  }));
}
