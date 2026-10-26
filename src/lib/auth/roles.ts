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
  super_admin: 'Full access including user accounts, access control and demand oversight.',
  admin: 'All inventory operations and demand oversight; no user management.',
  procurement_officer: 'Catalog, stock inward, QR codes, reports and demand fulfilment; no stock issue.',
  hod: 'Department-scoped view; authorises stock issues and reviews demand requests for own department.',
  requester: 'Dashboard counts plus demand requests; no inventory operations.',
};

export type AppTab = 'ALL' | 'CAPEX' | 'OPEX' | 'REG' | 'GRN' | 'ISS' | 'USERS' | 'DEMAND' | 'DEPT_ISSUES';

export const TAB_ACCESS: Record<AppTab, readonly Role[]> = {
  ALL: ROLES,
  CAPEX: ['super_admin', 'admin', 'procurement_officer', 'hod'],
  OPEX: ['super_admin', 'admin', 'procurement_officer', 'hod'],
  REG: ['super_admin', 'admin', 'procurement_officer', 'hod'],
  GRN: ['super_admin', 'admin', 'procurement_officer'],
  ISS: ['super_admin', 'admin', 'hod'],
  USERS: ['super_admin'],
  DEMAND: ROLES,
  DEPT_ISSUES: ROLES,
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

export const DEMAND_ROLES: readonly Role[] = ROLES;
export const DEMAND_CREATE_ROLES: readonly Role[] = ['super_admin', 'admin', 'hod', 'requester'];
export const DEMAND_REVIEW_ROLES: readonly Role[] = ['super_admin', 'admin', 'hod'];
export const DEMAND_FULFIL_ROLES: readonly Role[] = ['super_admin', 'admin', 'procurement_officer'];

export function canCreateDemand(role: Role): boolean {
  return DEMAND_CREATE_ROLES.includes(role);
}

export function canReviewDemand(role: Role): boolean {
  return DEMAND_REVIEW_ROLES.includes(role);
}

export function canFulfilDemand(role: Role): boolean {
  return DEMAND_FULFIL_ROLES.includes(role);
}

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
