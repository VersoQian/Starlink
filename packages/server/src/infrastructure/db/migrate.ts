import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

type MigrationFile = {
  id: string
  filePath: string
}

async function main() {
  const migrations = await listMigrationFiles()
  if (migrations.length === 0) {
    console.log('[db:migrate] no migration files found')
    return
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)

  const appliedResult = await pool.query('SELECT id FROM schema_migrations')
  const appliedRows = appliedResult.rows as Array<{ id: string }>
  const applied = new Set(appliedRows.map((row) => row.id))

  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      console.log(`[db:migrate] skip ${migration.id}`)
      continue
    }

    const sql = await readFile(migration.filePath, 'utf8')
    console.log(`[db:migrate] apply ${migration.id}`)
    await pool.query('BEGIN')
    try {
      await pool.query(sql)
      await pool.query(
        'INSERT INTO schema_migrations (id) VALUES ($1)',
        [migration.id]
      )
      await pool.query('COMMIT')
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  }

  console.log('[db:migrate] complete')
}

async function listMigrationFiles(): Promise<MigrationFile[]> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const migrationsDir = path.resolve(currentDir, '../../../migrations')
  const entries = await readdir(migrationsDir, { withFileTypes: true })
  const files: MigrationFile[] = []

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push({
        id: entry.name,
        filePath: path.join(migrationsDir, entry.name)
      })
      continue
    }

    if (!entry.isDirectory()) continue

    const nestedPath = path.join(migrationsDir, entry.name, 'migration.sql')
    try {
      await readFile(nestedPath, 'utf8')
      files.push({
        id: `${entry.name}/migration.sql`,
        filePath: nestedPath
      })
    } catch {
      // Ignore migration directories without migration.sql.
    }
  }

  return files.sort((left, right) => left.id.localeCompare(right.id))
}

main()
  .catch((error) => {
    console.error('[db:migrate] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
