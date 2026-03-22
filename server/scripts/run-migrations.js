#!/usr/bin/env node

/**
 * Auto-migration runner for bemused-node
 * Runs all pending SQL migrations in order
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function runMigrations() {
  // Get database URL from environment
  const databaseUrl = process.env.BEMUSED_DB || process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: BEMUSED_DB environment variable not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('📊 Connected to database');

    // Ensure schema_migrations table exists (run 000_init_migrations.sql first if needed)
    const initMigrationPath = path.join(MIGRATIONS_DIR, '000_init_migrations.sql');
    if (fs.existsSync(initMigrationPath)) {
      const initSql = fs.readFileSync(initMigrationPath, 'utf8');
      await client.query(initSql);
      console.log('✅ Schema migrations table ready');
    }

    // Get list of applied migrations
    const { rows: appliedMigrations } = await client.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const appliedVersions = new Set(appliedMigrations.map(row => row.version));

    // Get all migration files
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let ranCount = 0;
    let skippedCount = 0;

    // Run pending migrations
    for (const file of files) {
      const version = file.replace('.sql', '');

      if (appliedVersions.has(version)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        skippedCount++;
        continue;
      }

      console.log(`🔄 Running ${file}...`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        await client.query('COMMIT');
        console.log(`✅ Applied ${file}`);
        ranCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Failed to apply ${file}:`, error.message);
        throw error;
      }
    }

    console.log('');
    console.log('📈 Migration summary:');
    console.log(`   Applied: ${ranCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${files.length}`);

    if (ranCount > 0) {
      console.log('');
      console.log('✨ Migrations complete!');
    } else {
      console.log('');
      console.log('✨ Database is up to date');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
