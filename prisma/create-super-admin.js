/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config()

const { Client } = require('pg')
const { randomBytes, scrypt: scryptCallback } = require('node:crypto')
const { promisify } = require('node:util')

const scrypt = promisify(scryptCallback)

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16
const MAX_MEMORY = 64 * 1024 * 1024

async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH)
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEMORY,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

function fail(message) {
  throw new Error(message)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) fail('DATABASE_URL is not set.')

  const username = (process.env.BOOTSTRAP_SUPERADMIN_USERNAME || '').trim().toLowerCase()
  const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || ''
  const fullName = (process.env.BOOTSTRAP_SUPERADMIN_FULL_NAME || 'Super Admin').trim()
  const employeeId = (process.env.BOOTSTRAP_SUPERADMIN_EMPLOYEE_ID || 'SA-0001').trim().toUpperCase()
  const email = (process.env.BOOTSTRAP_SUPERADMIN_EMAIL || '').trim().toLowerCase() || null

  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    fail(
      'Set BOOTSTRAP_SUPERADMIN_USERNAME to 3–50 lowercase letters, numbers, dots, dashes or underscores.'
    )
  }
  if (Array.from(password.normalize('NFKC')).length < 8) {
    fail('Set BOOTSTRAP_SUPERADMIN_PASSWORD to at least 8 characters.')
  }
  if (fullName.length < 2 || fullName.length > 200) {
    fail('BOOTSTRAP_SUPERADMIN_FULL_NAME must be between 2 and 200 characters.')
  }
  if (!/^[A-Z0-9][A-Z0-9._-]{1,19}$/.test(employeeId)) {
    fail('BOOTSTRAP_SUPERADMIN_EMPLOYEE_ID must be 2–20 uppercase letters, numbers, dots, dashes or underscores.')
  }

  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    const existing = await client.query('SELECT user_id, role FROM users WHERE username = $1', [
      username,
    ])
    if (existing.rows.length > 0) {
      if (existing.rows[0].role === 'super_admin') {
        console.log(`Super admin "${username}" already exists. No changes made.`)
        return
      }
      fail(
        `Username "${username}" is already used by an account with role "${existing.rows[0].role}". Choose another username.`
      )
    }

    const employee = await client.query('SELECT user_id FROM users WHERE employee_id = $1', [
      employeeId,
    ])
    if (employee.rows.length > 0) {
      fail(
        `Employee ID "${employeeId}" is already in use. Set BOOTSTRAP_SUPERADMIN_EMPLOYEE_ID to a unique value.`
      )
    }

    if (email) {
      const emailRow = await client.query('SELECT user_id FROM users WHERE email = $1', [email])
      if (emailRow.rows.length > 0) {
        fail(`Email "${email}" is already in use. Set BOOTSTRAP_SUPERADMIN_EMAIL to a unique value.`)
      }
    }

    const passwordHash = await hashPassword(password)

    await client.query(
      `INSERT INTO users
         (employee_id, full_name, username, password_hash, role, email, is_active, updated_at)
       VALUES ($1, $2, $3, $4, 'super_admin', $5, true, NOW())`,
      [employeeId, fullName, username, passwordHash, email]
    )

    console.log(`Created Super Admin "${username}" (employee ID ${employeeId}).`)
    console.log('Sign in at /login and change the password from the account menu.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(`Bootstrap failed: ${err.message}`)
  process.exit(1)
})
