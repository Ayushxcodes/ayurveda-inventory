import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

export const DUMMY_PASSWORD_HASH =
  'scrypt$16384$8$1$f_RqJekgC2-N2p9n16RPDw$e7Ox7KYqb-ELAQ3bEGsL44x7rI8hS1Mo9LiqS1YIAkBx9bwRAbxoiQ5t443Nwr-s7ujidWuwRvNPSQFIsOWPiA';

export function normalizePassword(password: string): string {
  return password.normalize('NFKC');
}

export function passwordPolicyError(password: string): string | null {
  const length = Array.from(normalizePassword(password)).length;
  if (length < 8) return 'Password must be at least 8 characters.';
  if (length > 128) return 'Password must be at most 128 characters.';
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scrypt(normalizePassword(password), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEMORY,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltPart, keyPart] = storedHash.split('$');
    if (scheme !== 'scrypt' || !saltPart || !keyPart) return false;

    const N = Number(n);
    const rValue = Number(r);
    const pValue = Number(p);
    if (
      !Number.isInteger(N) ||
      !Number.isInteger(rValue) ||
      !Number.isInteger(pValue) ||
      N < 1024 ||
      rValue < 1 ||
      pValue < 1
    ) {
      return false;
    }

    const salt = Buffer.from(saltPart, 'base64url');
    const expected = Buffer.from(keyPart, 'base64url');
    if (salt.length === 0 || expected.length === 0) return false;

    const actual = await scrypt(normalizePassword(password), salt, expected.length, {
      N,
      r: rValue,
      p: pValue,
      maxmem: Math.max(MAX_MEMORY, 128 * N * rValue * 2),
    });

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
