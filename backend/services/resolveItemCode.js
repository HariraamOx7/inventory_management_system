//backend/services/resolveItemCode.js
module.exports = async function resolveItemCode(Item, itemCode, itemName) {
  if (itemCode !== undefined && itemCode !== null && String(itemCode).trim()) {
    return String(itemCode).trim();
  }
  if (itemName && String(itemName).trim()) {
    const matches = await Item.findAll({ where: { ItemName: String(itemName).trim() }, limit: 2 });
    if (matches.length > 1) {
      const error = new Error(`Multiple items use the name "${String(itemName).trim()}". Select the item by its code.`);
      error.statusCode = 400;
      throw error;
    }
    if (matches[0]) return matches[0].ItemCode;
  }
  return null;
};
