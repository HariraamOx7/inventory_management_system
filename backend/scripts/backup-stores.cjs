const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const backupDirectory = path.resolve(__dirname, '../../../../doc_work/backups');
fs.mkdirSync(backupDirectory, { recursive: true });
const backupPath = path.join(backupDirectory, `stores-before-august-repair-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
execFileSync('C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe', [
  '--protocol=TCP', '--host=127.0.0.1', '--port=3306',
  `--user=${process.env.DB_USER}`, '--single-transaction', '--routines',
  '--triggers', '--events', '--no-tablespaces', '--set-gtid-purged=OFF',
  `--result-file=${backupPath}`, process.env.DB_NAME
], { env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' }, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
const stat = fs.statSync(backupPath);
if (stat.size < 1000) throw new Error('Backup unexpectedly small; do not proceed with repair.');
console.log(JSON.stringify({ backupPath, bytes: stat.size }));
