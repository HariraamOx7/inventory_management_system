// Copy local application tables into a temporary schema, then run migration tests.
// The configured source database is read only throughout this script.
const mysql = require('mysql2/promise');
const { spawn } = require('node:child_process');
require('dotenv').config({ quiet: true });
const quote = value => '`' + String(value).replace(/`/g, '``') + '`';
(async () => {
  const source = process.env.DB_NAME;
  if (!source || source.startsWith('stores_rehearsal_')) throw new Error('Expected the configured local application schema as a read-only source');
  const target = 'stores_rehearsal_migration_' + Date.now();
  const admin = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  let created = false;
  try {
    await admin.query('CREATE DATABASE ' + quote(target)); created = true;
    const [tables] = await admin.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE=?', [source, 'BASE TABLE']);
    await admin.query('SET FOREIGN_KEY_CHECKS=0');
    for (const row of tables) {
      const table = row.TABLE_NAME;
      await admin.query(`CREATE TABLE ${quote(target)}.${quote(table)} LIKE ${quote(source)}.${quote(table)}`);
      if (table !== 'users') await admin.query(`INSERT INTO ${quote(target)}.${quote(table)} SELECT * FROM ${quote(source)}.${quote(table)}`);
    }
    await admin.query('SET FOREIGN_KEY_CHECKS=1');
    console.log(`Copied ${tables.length} tables to an isolated rehearsal schema; user accounts excluded.`);
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--test', '--test-concurrency=1', 'scripts/migration-stock-smoke.test.cjs', 'scripts/migration-inward-flow.test.cjs'], { cwd: process.cwd(), env: { ...process.env, DB_NAME: target }, stdio: 'inherit', windowsHide: true });
      child.once('error', reject); child.once('exit', resolve);
    });
    process.exitCode = exitCode;
  } finally {
    if (created) await admin.query('DROP DATABASE ' + quote(target));
    await admin.end();
    console.log('Migration rehearsal copy removed; source data unchanged.');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
