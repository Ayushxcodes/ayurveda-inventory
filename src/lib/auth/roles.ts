export const ROLES = [
  'super_admin',
  'admin',
  'procurement_officer',
  'hod',
  'requester',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  procurement_officer: 'Procurement Officer',
  hod: 'Head of Department',
  requester: 'Requester',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: 'Full access including user accounts and access control.',
  admin: 'All inventory operations; no user management.',
  procurement_officer: 'Catalog, stock inward, QR codes and reports; no stock issue.',
  hod: 'Department-scoped view; can authorise stock issues for own department.',
  requester: 'Dashboard counts only; can raise demand requests in a later module.',
};

export type AppTab = 'ALL' | 'CAPEX' | 'OPEX' | 'REG' | 'GRN' | 'ISS' | 'USERS';

export const TAB_ACCESS: Record<AppTab, readonly Role[]> = {
  ALL: ROLES,
  CAPEX: ['super_admin', 'admin', 'procurement_officer', 'hod'],
  OPEX: ['super_admin', 'admin', 'procurement_officer', 'hod'],
  REG: ['super_admin', 'admin', 'procurement_officer', 'hod'],
  GRN: ['super_admin', 'admin', 'procurement_officer'],
  ISS: ['super_admin', 'admin', 'hod'],
  USERS: ['super_admin'],
};

export function canAccessTab(role: Role, tab: AppTab): boolean {
  return TAB_ACCESS[tab].includes(role);
}

export function allowedTabs(role: Role): AppTab[] {
  return (Object.keys(TAB_ACCESS) as AppTab[]).filter((tab) => canAccessTab(role, tab));
}

export function canIssueStock(role: Role): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'hod';
}

export function canReceiveStock(role: Role): boolean {
  return role === 'super_admin' || role === 'admin' || role === 'procurement_officer';
}

export function canManageUsers(role: Role): boolean {
  return role === 'super_admin';
}

export const CATALOG_ROLES: readonly Role[] = ['super_admin', 'admin', 'procurement_officer', 'hod'];
export const INWARD_ROLES: readonly Role[] = ['super_admin', 'admin', 'procurement_officer'];
export const ISSUE_ROLES: readonly Role[] = ['super_admin', 'admin', 'hod'];
export const REPORT_ROLES: readonly Role[] = ['super_admin', 'admin', 'procurement_officer', 'hod'];
export const USER_ADMIN_ROLES: readonly Role[] = ['super_admin'];
export const DEPARTMENT_ROLES: readonly Role[] = ['super_admin', 'admin', 'hod'];

export interface SessionUser {
  userId: number;
  fullName: string;
  username: string;
  role: Role;
  deptId: number | null;
  deptCode: string | null;
  deptName: string | null;
}

export function userInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
