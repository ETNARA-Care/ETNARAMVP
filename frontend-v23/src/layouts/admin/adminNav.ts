import type { LucideIcon } from "lucide-react";

export interface AdminNavItem { to: string; icon: LucideIcon; label: string; end?: boolean; }
export interface AdminNavGroup { label: string; items: AdminNavItem[]; }
