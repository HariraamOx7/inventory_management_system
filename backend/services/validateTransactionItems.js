const fail = message => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const validNumber = value => (typeof value === 'number' ||
  (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))) && Number.isFinite(Number(value));

module.exports = function validateTransactionItems(items, { required = false, quantities = ['Qty'], allowZero = false, requireName = false } = {}) {
  if (items === undefined && !required) return;
  if (!Array.isArray(items) || items.length === 0) fail('At least one valid item row is required');
  let positive = false;
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Each item row must be an object');
    if (requireName ? typeof item.ItemName !== 'string' || !item.ItemName.trim()
      : ![item.ItemCode, item.ItemName].some(v => (typeof v === 'string' || typeof v === 'number') && String(v).trim())) {
      fail('Each item row requires an item identity');
    }
    const key = quantities.find(name => item[name] !== undefined);
    const qty = key ? item[key] : undefined;
    if (!validNumber(qty) || Number(qty) < 0 || (!allowZero && Number(qty) === 0) || Number(qty) >= 1e8) {
      fail(`Invalid quantity for ${item.ItemName || item.ItemCode}: enter a ${allowZero ? 'non-negative' : 'positive'} number below 100000000`);
    }
    if (Number(qty) > 0) positive = true;
    for (const field of ['UnitRate', 'TotalAmount']) {
      const value = item[field];
      if (value === undefined || value === null || value === '') continue;
      if (!validNumber(value) || Number(value) < 0 || Number(value) >= (field === 'UnitRate' ? 1e9 : 1e13)) fail(`Invalid ${field} for ${item.ItemName || item.ItemCode}`);
    }
  }
  if (!positive) fail('At least one item must have a quantity greater than zero');
};
