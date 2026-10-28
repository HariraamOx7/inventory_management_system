// Legacy item codes are identifiers, not numbers (for example 17/25/Ot/10866).
module.exports = async function resolveItemCode(Item, itemCode, itemName) {
  if (itemCode !== undefined && itemCode !== null && String(itemCode).trim()) {
    return String(itemCode).trim();
  }
  if (itemName && String(itemName).trim()) {
    const found = await Item.findOne({ where: { ItemName: String(itemName).trim() } });
    if (found) return found.ItemCode;
  }
  return null;
};
