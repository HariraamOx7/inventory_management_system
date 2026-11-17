const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

module.exports = async function startAuditRuntime(label = 'edge') {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const database = `stores_rehearsal_${label}_${Date.now()}`;
  const admin = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  let models, server, created = false;
  const close = async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (models) await models.sequelize.close();
    if (created) await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  };
  try {
    await admin.query(`CREATE DATABASE \`${database}\``); created = true;
    process.env.DB_NAME = database;
    models = require('../models');
    await models.sequelize.sync();
    const sourcePath = path.resolve(__dirname, '../server.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    if (!/startServer\(\);\s*$/.test(source)) throw new Error('Server startup pattern changed; update audit harness');
    const loaded = new Module(sourcePath, module);
    loaded.filename = sourcePath; loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
    loaded._compile(source.replace(/startServer\(\);\s*$/, 'module.exports = app;'), sourcePath);
    server = loaded.exports.listen(Number(process.env.AUDIT_HTTP_PORT) || 0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const password = 'Disposable-audit-123';
    const tokens = {};
    for (const role of ['admin', 'manager', 'operator', 'viewer']) {
      await models.User.create({ username: 'audit_' + role, password: await bcrypt.hash(password, 4), role });
      const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'audit_' + role, password }) });
      const json = await login.json();
      if (!json.token) throw new Error('Audit login failed');
      tokens[role] = json.token;
    }
    const request = async (method, route, body, role = 'admin') => {
      const headers = { 'Content-Type': 'application/json' };
      if (tokens[role]) headers.Authorization = 'Bearer ' + tokens[role];
      const response = await fetch(base + '/api' + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const raw = await response.text();
      let json; try { json = JSON.parse(raw); } catch { json = { raw }; }
      return { status: response.status, body: json };
    };
    return { models, request, base, database, serverSource: source, tokens, password, close };
  } catch (error) { await close(); throw error; }
};
