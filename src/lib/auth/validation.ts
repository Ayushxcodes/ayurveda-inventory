import { ROLES, type Role } from './roles';
import { passwordPolicyError } from './password';

const USERNAME_RE = /^[a-z0-9._-]{3,50}$/;
const EMPLOYEE_ID_RE = /^[A-Z0-9][A-Z0-9._-]{1,19}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{6,15}$/;

export function normalizeUsername(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const phone = value.trim();
  return phone.length > 0 ? phone : null;
}

export function parseRole(value: unknown): Role | null {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : null;
}

export function parseDeptId(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export interface CreateUserData {
  username: string;
  fullName: string;
  employeeId: string;
  email: string | null;
  phone: string | null;
  password: string;
  role: Role;
  deptId: number | null;
  isActive: boolean;
}

export interface UpdateUserData {
  fullName?: string;
  email?: string | null;
  phone?: string | null;
  role?: Role;
  deptId?: number | null;
  isActive?: boolean;
  newPassword?: string;
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

export function parseCreateUserInput(raw: Record<string, unknown>): ParseResult<CreateUserData> {
  const errors: Record<string, string> = {};

  const username = normalizeUsername(raw.username);
  if (!USERNAME_RE.test(username)) {
    errors.username = 'Username must be 3–50 characters: lowercase letters, numbers, dots, dashes or underscores.';
  }

  const fullName = typeof raw.fullName === 'string' ? raw.fullName.trim() : '';
  if (fullName.length < 2 || fullName.length > 200) {
    errors.fullName = 'Full name must be between 2 and 200 characters.';
  }

  const employeeId = typeof raw.employeeId === 'string' ? raw.employeeId.trim().toUpperCase() : '';
  if (!EMPLOYEE_ID_RE.test(employeeId)) {
    errors.employeeId = 'Employee ID must be 2–20 characters (uppercase letters, numbers, dots, dashes or underscores).';
  }

  const email = normalizeEmail(raw.email);
  if (email && (email.length > 200 || !EMAIL_RE.test(email))) {
    errors.email = 'Enter a valid email address.';
  }

  const phone = normalizePhone(raw.phone);
  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = 'Enter a valid phone number (6–15 digits).';
  }

  const password = typeof raw.password === 'string' ? raw.password : '';
  const policyError = passwordPolicyError(password);
  if (policyError) errors.password = policyError;

  const role = parseRole(raw.role);
  if (!role) errors.role = 'Select a valid role.';

  const deptId = parseDeptId(raw.deptId);
  if (role === 'hod' && deptId === null) {
    errors.deptId = 'A Head of Department must be assigned to a department.';
  }

  if (Object.keys(errors).length > 0 || !role) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      username,
      fullName,
      employeeId,
      email,
      phone,
      password,
      role,
      deptId,
      isActive: raw.isActive === undefined ? true : Boolean(raw.isActive),
    },
  };
}

export function parseUpdateUserInput(raw: Record<string, unknown>): ParseResult<UpdateUserData> {
  const errors: Record<string, string> = {};
  const data: UpdateUserData = {};

  if (raw.fullName !== undefined) {
    const fullName = typeof raw.fullName === 'string' ? raw.fullName.trim() : '';
    if (fullName.length < 2 || fullName.length > 200) {
      errors.fullName = 'Full name must be between 2 and 200 characters.';
    } else {
      data.fullName = fullName;
    }
  }

  if (raw.email !== undefined) {
    const email = normalizeEmail(raw.email);
    if (email && (email.length > 200 || !EMAIL_RE.test(email))) {
      errors.email = 'Enter a valid email address.';
    } else {
      data.email = email;
    }
  }

  if (raw.phone !== undefined) {
    const phone = normalizePhone(raw.phone);
    if (phone && !PHONE_RE.test(phone)) {
      errors.phone = 'Enter a valid phone number (6–15 digits).';
    } else {
      data.phone = phone;
    }
  }

  if (raw.role !== undefined) {
    const role = parseRole(raw.role);
    if (!role) errors.role = 'Select a valid role.';
    else data.role = role;
  }

  if (raw.deptId !== undefined) {
    data.deptId = parseDeptId(raw.deptId);
  }

  if (raw.isActive !== undefined) {
    data.isActive = Boolean(raw.isActive);
  }

  if (raw.newPassword !== undefined && raw.newPassword !== '') {
    const password = typeof raw.newPassword === 'string' ? raw.newPassword : '';
    const policyError = passwordPolicyError(password);
    if (policyError) errors.newPassword = policyError;
    else data.newPassword = password;
  }

  if (Object.keys(data).length === 0 && Object.keys(errors).length === 0) {
    errors.form = 'No changes were provided.';
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data };
}
