// Widen active purchase-order references to match date-based order numbers.
// Back up the target database before running: MySQL ALTER TABLE commits implicitly.
require('dotenv').config({ quiet: true });
const sequelize = require('../config/db');

const columns = [
  ['gate_inwards', false], ['gate_inward_details', false],
  ['receipt_details', true], ['bill_entries', true],
  ['bill_entry_details', true], ['cancel_orders', false]
];

(async () => {
  try {
    for (const [table, nullable] of columns) {
      const [rows] = await sequelize.query(
        'SELECT COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column',
        { replacements: { table, column: 'OrderNo' } }
      );
      if (rows.length !== 1 || rows[0].IS_NULLABLE !== (nullable ? 'YES' : 'NO')) throw new Error(`Unexpected schema for ${table}.OrderNo`);
      if (rows[0].COLUMN_TYPE === 'bigint') continue;
      if (rows[0].COLUMN_TYPE !== 'int') throw new Error(`Unexpected type for ${table}.OrderNo: ${rows[0].COLUMN_TYPE}`);
      await sequelize.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`OrderNo\` BIGINT ${nullable ? 'NULL' : 'NOT NULL'}`);
      console.log(`Widened ${table}.OrderNo`);
    }
    console.log('Order reference migration complete.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
