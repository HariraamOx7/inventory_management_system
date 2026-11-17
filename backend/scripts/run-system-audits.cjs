// Full local regression entry point. All database writes use disposable schemas.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const backend = path.resolve(__dirname, '..');
const frontend = path.resolve(backend, '../frontend');
const suites = [
  ['crud', backend, ['scripts/operation-audit.cjs']],
  ['system', backend, ['scripts/system-audit.cjs']],
  ['edges', backend, ['scripts/edge-audit.cjs']],
  ['http-workflows', backend, ['scripts/http-workflow-audit.cjs']],
  ['receipts', backend, ['scripts/receipt-roundtrip.test.cjs']],
  ['item-identities', backend, ['--test', 'scripts/migration-item-code.test.cjs']],
  ['migration-copy', backend, ['scripts/migration-copy-audit.cjs']],
  ['rounding', frontend, ['scripts/round-total.test.mjs']],
  ['frontend-lint', frontend, null, 'lint'],
  ['frontend-build', frontend, null, 'build']
];
const results = [];
async function run([name, cwd, args, npmScript]) {
  const logfile = path.join(__dirname, `full-audit-${name}.log`);
  const output = fs.createWriteStream(logfile);
  const started = Date.now();
  const code = await new Promise((resolve, reject) => {
    const command = npmScript ? (process.platform === 'win32' ? 'cmd.exe' : 'npm') : process.execPath;
    const commandArgs = npmScript ? (process.platform === 'win32' ? ['/d', '/s', '/c', `npm run ${npmScript}`] : ['run', npmScript]) : args;
    const child = spawn(command, commandArgs, { cwd, env: process.env, windowsHide: true });
    child.stdout.pipe(output, { end: false }); child.stderr.pipe(output, { end: false });
    child.once('error', reject); child.once('close', resolve);
  });
  await new Promise(resolve => output.end(resolve));
  const result = { name, status: code === 0 ? 'PASS' : 'FAIL', exitCode: code, elapsedSeconds: Number(((Date.now() - started) / 1000).toFixed(1)), logfile };
  results.push(result); console.log(`${result.status} ${name} (${result.elapsedSeconds}s)`);
}
(async () => {
  // Independent suites use independent schemas. Limit concurrency for local DB load.
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (cursor < suites.length) { const suite = suites[cursor++]; await run(suite); }
  }));
  const failed = results.filter(r => r.status !== 'PASS').length;
  fs.writeFileSync(path.join(__dirname, 'full-system-audit-results.json'), JSON.stringify({ scope: 'Local automated checks; disposable schema writes; source database read only for migration copy; browser checks recorded separately', completedAt: new Date().toISOString(), results }, null, 2));
  console.log(`${results.length - failed}/${results.length} suites passed`);
  if (failed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
