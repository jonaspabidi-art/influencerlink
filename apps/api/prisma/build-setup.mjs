// Bygger setup.sql: alla migrationer, Prismas bokföring och demodata i en fil.
// Körs om varje gång en migration tillkommer – annars saknas tabeller i den
// databas någon sätter upp genom att klistra in filen i Supabase.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('.', import.meta.url).pathname;
const names = readdirSync(join(dir, 'migrations'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const parts = [
  '-- Pacta: skapar alla tabeller och lägger in demodata.',
  '-- Klistra in allt i Supabase SQL Editor och tryck Run. Körs en gång.',
  '-- Genererad av build-setup.mjs – ändra inte för hand.',
  '',
  '-- CreateSchema',
  'CREATE SCHEMA IF NOT EXISTS "public";',
  '',
];

const checksums = [];
for (const name of names) {
  const sql = readFileSync(join(dir, 'migrations', name, 'migration.sql'), 'utf8');
  checksums.push([name, createHash('sha256').update(sql).digest('hex')]);
  parts.push(`-- === ${name} ===`, '', sql.trim(), '');
}

parts.push(
  '-- Prismas egen bokföring. Utan den försöker servern skapa tabellerna en',
  '-- gång till vid start och kraschar på att de redan finns.',
  'CREATE TABLE IF NOT EXISTS "_prisma_migrations" (',
  '    id                      VARCHAR(36) PRIMARY KEY NOT NULL,',
  '    checksum                VARCHAR(64) NOT NULL,',
  '    finished_at             TIMESTAMPTZ,',
  '    migration_name          VARCHAR(255) NOT NULL,',
  '    logs                    TEXT,',
  '    rolled_back_at          TIMESTAMPTZ,',
  '    started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),',
  '    applied_steps_count     INTEGER NOT NULL DEFAULT 0',
  ');',
  '',
);

for (const [name, checksum] of checksums) {
  parts.push(
    'INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, started_at, applied_steps_count)',
    'VALUES (gen_random_uuid()::text,',
    `        '${checksum}',`,
    `        now(), '${name}', now(), 1);`,
    '',
  );
}

parts.push('-- === Demodata ===', '', readFileSync(join(dir, 'seed.sql'), 'utf8').trim(), '');

writeFileSync(join(dir, 'setup.sql'), parts.join('\n'));
console.log(`setup.sql: ${names.length} migrationer`);
