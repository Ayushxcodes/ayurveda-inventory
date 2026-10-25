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

const DEFAULT_PASSWORD = process.env.SEED_USERS_PASSWORD || 'Admin@12345'

const ROLE_USERS = [
  {
    username: 'superadmin',
    fullName: 'Super Admin',
    employeeId: 'SA-0002',
    email: 'superadmin@ayurveda.local',
    role: 'super_admin',
    deptCode: null,
  },
  {
    username: 'admin_user',
    fullName: 'Inventory Admin',
    employeeId: 'ADM-0001',
    email: 'admin.inv@ayurveda.local',
    role: 'admin',
    deptCode: null,
  },
  {
    username: 'procurement',
    fullName: 'Procurement Officer',
    employeeId: 'PO-0001',
    email: 'procurement@ayurveda.local',
    role: 'procurement_officer',
    deptCode: null,
  },
  {
    username: 'hod_pharmacy',
    fullName: 'Dr. Ramesh Sharma (HOD Pharmacy)',
    employeeId: 'HOD-0001',
    email: 'hod.pharmacy@ayurveda.local',
    role: 'hod',
    deptCode: 'PHM',
  },
  {
    username: 'requester',
    fullName: 'Clinical Staff Requester',
    employeeId: 'REQ-0001',
    email: 'requester@ayurveda.local',
    role: 'requester',
    deptCode: 'OPD-GEN',
  },
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  const client = new Client({ connectionString: url })
  await client.connect()

  try {
    console.log(`Hashing password for seed users...`)
    const passwordHash = await hashPassword(DEFAULT_PASSWORD)

    // Also ensure existing 'admin' user password is up-to-date with default password
    const adminExists = await client.query('SELECT user_id FROM users WHERE username = $1', ['admin'])
    if (adminExists.rows.length > 0) {
      await client.query(
        'UPDATE users SET password_hash = $1, is_active = true, updated_at = NOW() WHERE username = $2',
        [passwordHash, 'admin']
      )
      console.log('✓ Verified primary "admin" account password.')
    }

    // Fetch department codes mapping
    const deptRes = await client.query('SELECT dept_id, dept_code FROM departments')
    const deptMap = new Map()
    for (const row of deptRes.rows) {
      deptMap.set(row.dept_code, row.dept_id)
    }

    for (const user of ROLE_USERS) {
      const deptId = user.deptCode ? (deptMap.get(user.deptCode) || null) : null

      const res = await client.query('SELECT user_id, role FROM users WHERE username = $1', [user.username])
      if (res.rows.length > 0) {
        await client.query(
          `UPDATE users
           SET full_name = $1,
               password_hash = $2,
               role = $3,
               dept_id = $4,
               is_active = true,
               updated_at = NOW()
           WHERE username = $5`,
          [user.fullName, passwordHash, user.role, deptId, user.username]
        )
        console.log(`✓ Updated role user "${user.username}" (${user.role})`)
      } else {
        await client.query(
          `INSERT INTO users
             (employee_id, full_name, username, password_hash, role, dept_id, email, is_active, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())`,
          [user.employeeId, user.fullName, user.username, passwordHash, user.role, deptId, user.email]
        )
        console.log(`+ Created role user "${user.username}" (${user.role})`)
      }
    }

    console.log('\nSeed complete! All role users ready with password:', DEFAULT_PASSWORD)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Seeding role users failed:', err)
  process.exit(1)
})
