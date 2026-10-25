/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config()

const { Client } = require('pg')

const DEPARTMENTS = [
  { code: 'OPD-GEN', name: 'OPD — General', category: 'clinical', floor: 'Ground floor' },
  { code: 'PHM', name: 'Pharmacy', category: 'pharmacy', floor: 'Ground floor' },
  { code: 'IPD-A', name: 'IPD Ward A', category: 'clinical', floor: 'First floor' },
  { code: 'IPD-B', name: 'IPD Ward B', category: 'clinical', floor: 'First floor' },
  { code: 'PKM', name: 'Panchakarma', category: 'clinical', floor: 'Second floor' },
  { code: 'SHA', name: 'Shalakya (ENT & Eye)', category: 'clinical', floor: 'Second floor' },
  { code: 'KAU', name: 'Kaumarabhritya', category: 'clinical', floor: 'Second floor' },
  { code: 'STR', name: 'Striroga (OB-GYN)', category: 'clinical', floor: 'Third floor' },
  { code: 'SHY', name: 'Shalya (Surgery)', category: 'clinical', floor: 'Third floor' },
  { code: 'LAB', name: 'Laboratory', category: 'lab', floor: 'Ground floor' },
  { code: 'SWA', name: 'Swastha Vritta', category: 'clinical', floor: 'First floor' },
  { code: 'RES', name: 'Research', category: 'other', floor: 'Third floor' },
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set.')
    process.exit(1)
  }

  const client = new Client({ connectionString: url })
  await client.connect()

  let created = 0
  let existing = 0

  try {
    for (const dept of DEPARTMENTS) {
      const result = await client.query(
        `INSERT INTO departments (dept_code, dept_name, category, floor_location, is_active, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW())
         ON CONFLICT (dept_code) DO NOTHING`,
        [dept.code, dept.name, dept.category, dept.floor]
      )
      if (result.rowCount > 0) created += 1
      else existing += 1
    }

    console.log(`Departments ready: ${created} created, ${existing} already present.`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
