// Isolated first-stage migration. Never writes to the application database.
const { execFileSync } = require('node:child_process');
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true });

const stage = process.env.MIGRATION_STAGE;
if (!/^stores_stage_[a-z0-9_]+$/.test(stage || '')) throw new Error('Set MIGRATION_STAGE to a new stores_stage_... database name');
function source(sql) {
  const result = execFileSync('sqlcmd', ['-S', '.\\SQLEXPRESS', '-E', '-d', 'KR_2026-2027', '-y', '0', '-w', '65535', '-b', '-Q', `SET NOCOUNT ON; ${sql} FOR JSON PATH, INCLUDE_NULL_VALUES`], { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
  const start = result.indexOf('[');
  if (start < 0) throw new Error('SQL Server did not return JSON');
  return JSON.parse(result.slice(start).trim().replace(/\r?\n/g, ''));
}
async function main() {
  const connection = await mysql.createConnection({ host: '127.0.0.1', user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: false });
  try {
    const [existing] = await connection.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [stage]);
    if (existing.length) throw new Error('Stage already exists; choose a new name');
    const [tables] = await connection.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='stores' AND TABLE_TYPE='BASE TABLE'");
    await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4', [stage]);
    for (const { TABLE_NAME: name } of tables) await connection.query('CREATE TABLE ??.?? LIKE stores.??', [stage, name, name]);
    const maps = [
      ['departments', "SELECT Code AS dept_id, DeptName AS dept_name FROM dbo.DepartmentMaster"],
      ['suppliers', "SELECT AccCode AS PartyCode, AccDesc AS Description, PartyName AS AccountName, Place, Address, DelAddress AS DeliveryAddress, Credit AS OpeningCredit, Debit AS OpeningDebit, TINNo, CSTNo, Phoneno AS PhNo, Fax, Cellno AS CellNo, Email, Website AS WebSite, AccountNo, ContactName AS ContactPerson, CONVERT(varchar(50),Pincode) AS Pincode, PANNo AS PanNumber, Department, GSTNO AS GSTNo FROM dbo.AccountsMaster"],
      ['items', "SELECT ItemCode, ItemName, Rate AS UnitRate, minlevel AS MinStockLevel, Opening AS OpeningQty, Opening AS Quantity, maxlevel AS MaxStockLevel, OpenValue, Location, Deptcode AS DepartmentId, HSNCode, CONVERT(varchar(50),SubHeadmascode) AS SubHeadCode, uom AS UOM, Catagory AS Category, CommodityCode AS Commodity FROM dbo.ItemMas"]
    ];
    for (const [table, sql] of maps) {
      const rows = source(sql);
      const [columns] = await connection.query('SELECT COLUMN_NAME,CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [stage, table]);
      const allowed = new Map(columns.map(c => [c.COLUMN_NAME.toLowerCase(), c]));
      await connection.beginTransaction();
      try {
        for (const row of rows) {
          const values = {};
          for (const [key, value] of Object.entries(row)) {
            const col = allowed.get(key.toLowerCase());
            if (!col) throw new Error(`Unknown column ${table}.${key}`);
            if (typeof value === 'string' && col.CHARACTER_MAXIMUM_LENGTH && value.length > col.CHARACTER_MAXIMUM_LENGTH) throw new Error(`Value too long: ${table}.${key} (${value.length})`);
            values[col.COLUMN_NAME] = value;
          }
          // These source tables do not provide consistent audit timestamps.
          values.createdAt = new Date();
          values.updatedAt = values.createdAt;
          await connection.query('INSERT INTO ??.?? SET ?', [stage, table, values]);
        }
        await connection.commit();
        console.log(`${table}: ${rows.length} rows`);
      } catch (error) { await connection.rollback(); throw error; }
    }
  } finally { await connection.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
