const models = require('../models');
const byRoute = {
  departments: 'Department', 'sub-heads': 'SubHead', suppliers: 'Supplier', stores: 'StoreMaster',
  'product-heads': 'ProductHead', parties: 'PartyMaster', items: 'Item', 'item-masters': 'ItemMaster',
  states: 'State', uoms: 'UOM', 'purchase-types': 'PurchaseType', 'purchase-orders': 'PurchaseOrder',
  'gate-inwards': 'GateInward', receipts: 'Receipt', 'bill-entries': 'BillEntry', 'item-issues': 'ItemIssue',
  'gate-pass-outs': 'GatePassOut', 'gate-pass-ins': 'GatePassIn', 'cancel-orders': 'CancelOrder', 'bill-verify': 'BillVerify'
};
const numeric = value => (typeof value === 'number' || typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) && Number.isFinite(Number(value));
module.exports = (req, res, next) => {
  const reject = message => res.status(400).json({ success: false, message });
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string') return reject(`${key} must have a single text value`);
  }
  for (const key of ['page', 'limit']) {
    const value = req.query[key];
    if (value !== undefined && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > (key === 'limit' ? 500 : 1e9))) return reject(`Invalid ${key}`);
  }
  for (const key of ['fromDate', 'toDate']) {
    const value = req.query[key];
    if (!value) continue;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return reject(`Invalid ${key}`);
  }
  if (req.query.fromDate && req.query.toDate && req.query.fromDate > req.query.toDate) return reject('From date cannot be later than to date');
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.body === undefined) return next();
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return reject('Request body must be an object');
  const model = models[byRoute[req.baseUrl.split('/').at(-1)]];
  if (!model) return next();
  for (const [field, attribute] of Object.entries(model.rawAttributes)) {
    const value = req.body[field];
    if (value === undefined || value === null) continue;
    const type = attribute.type.key;
    if (['STRING', 'TEXT', 'CHAR', 'ENUM'].includes(type)) {
      const numericIdentifier = attribute.primaryKey || field.endsWith('Code') || field === 'PurchaseType';
      if (typeof value !== 'string' && !(numericIdentifier && typeof value === 'number' && Number.isSafeInteger(value))) return reject(`${field} must be text`);
      const text = String(value);
      if ((attribute.allowNull === false || ['AccountName', 'ItemName', 'StoreName', 'ProdHeadDesc', 'StateName', 'sub_group_name', 'dept_name', 'uom'].includes(field)) && !text.trim()) return reject(`${field} cannot be blank`);
      const limit = attribute.type.options?.length;
      if (limit && [...text].length > limit) return reject(`${field} exceeds the maximum length of ${limit}`);
      if (type === 'ENUM' && !attribute.values.includes(value)) return reject(`Invalid ${field}`);
    } else if (/INT|DECIMAL|FLOAT|DOUBLE|REAL/.test(type)) {
      if (value === '') continue;
      if (!numeric(value)) return reject(`${field} must be a finite number`);
      if (/INT/.test(type) && !Number.isSafeInteger(Number(value))) return reject(`${field} must be a whole number`);
      if (['Quantity', 'OpeningQty', 'UnitRate', 'MinStockLevel', 'MaxStockLevel', 'OpenValue'].includes(field) && Number(value) < 0) return reject(`${field} cannot be negative`);
    } else if (type === 'DATEONLY' && value !== '') {
      const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value) : null;
      if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return reject(`${field} must be a valid date in YYYY-MM-DD format`);
    }
  }
  return next();
};
