import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../../..");
const migrationsDir = path.join(root, "database/migrations");
const rollbacksDir = path.join(root, "database/rollbacks");

async function ensureMigrationTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function listSqlFiles(dir: string): Promise<string[]> {
  return (await readdir(dir)).filter((file) => file.endsWith(".sql")).sort();
}

async function up(): Promise<void> {
  await ensureMigrationTable();
  const applied = new Set((await pool.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map((row) => row.id));

  for (const file of await listSqlFiles(migrationsDir)) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

async function down(): Promise<void> {
  await ensureMigrationTable();
  const latest = (await pool.query<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1")).rows[0];
  if (!latest) {
    console.log("No migrations to roll back");
    return;
  }

  const rollbackPath = path.join(rollbacksDir, latest.id);
  const sql = await readFile(rollbackPath, "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("DELETE FROM schema_migrations WHERE id = $1", [latest.id]);
    await client.query("COMMIT");
    console.log(`Rolled back ${latest.id}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const direction = process.argv[2] ?? "up";

try {
  if (direction === "down") {
    await down();
  } else {
    await up();
  }
} finally {
  await pool.end();
}
