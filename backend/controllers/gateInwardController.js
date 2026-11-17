const preventReferencedDeletion = require('../services/preventReferencedDeletion');
const errorStatus = require('../services/errorStatus');
const validateTransactionItems = require('../services/validateTransactionItems');
const { Op, fn, col } = require('sequelize');
const GateInward = require('../models/GateInward');
const GateInwardDetail = require('../models/GateInwardDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');
const Supplier = require('../models/Supplier');
const Item = require('../models/Item');
const sequelize = require('../config/db');
const resolveItemIdentifier = require('../services/resolveItemCode');

const resolvePartyCode = async (partyCode, partyName) => {
  if (partyCode && String(partyCode).trim()) {
    return String(partyCode).trim();
  }
  if (partyName && String(partyName).trim()) {
    const trimmed = String(partyName).trim();
    const sup = await Supplier.findOne({
      where: {
        [Op.or]: [
          { AccountName: trimmed },
          { PartyCode: trimmed }
        ]
      }
    });
    if (sup) return sup.PartyCode;
    return trimmed;
  }
  return null;
};

const resolveItemCode = async (itemCode, itemName) => {
  return resolveItemIdentifier(Item, itemCode, itemName);
};

// Resolve the effective cost for a received PO line. The PO unit rate is the
// entered transaction rate; discounts reduce the cost used for inventory
// valuation, but never overwrite the rate stored on the PO/receipt line.
const getPurchaseOrderNetUnitRate = async (detail, transaction) => {
  if (!detail || !detail.OrderNo || !detail.ItemCode) return null;

  const poLines = await PurchaseOrderDetail.findAll({
    where: {
      OrderNo: detail.OrderNo,
      ItemCode: detail.ItemCode
    },
    attributes: ['Qty', 'UnitRate', 'TotalAmount', 'DiscountPct', 'DiscountAmt'],
    raw: true,
    transaction
  });

  let orderedQty = 0;
  let grossValue = 0;
  let discountValue = 0;

  for (const line of poLines) {
    const qty = parseFloat(line.Qty) || 0;
    const unitRate = parseFloat(line.UnitRate) || 0;
    const gross = parseFloat(line.TotalAmount) || (qty * unitRate);
    const discount = line.DiscountAmt !== null && line.DiscountAmt !== undefined
      ? (parseFloat(line.DiscountAmt) || 0)
      : (gross * (parseFloat(line.DiscountPct) || 0) / 100);

    orderedQty += qty;
    grossValue += gross;
    discountValue += discount;
  }

  if (orderedQty <= 0) return null;
  return Math.max(0, (grossValue - discountValue) / orderedQty);
};

// Stock represents goods physically received. A purchase order is only a
// commitment, so inventory is adjusted exclusively when its gate inward lines
// are created, changed, or removed. Every receipt also updates the moving
// weighted-average rate. This is deliberately reversible for edit/delete:
// the same line cost is added or removed from the current inventory value.
const priceInwardDetails = async (details, previousDetails = [], transaction) => {
  const previous = new Map();
  for (const detail of previousDetails) {
    const key = `${detail.OrderNo}\u0000${detail.ItemCode}`;
    if (!previous.has(key)) previous.set(key, []);
    previous.get(key).push(detail);
  }
  const priced = [];
  for (const detail of details) {
    const key = `${detail.OrderNo}\u0000${detail.ItemCode}`;
    const old = previous.get(key)?.shift();
    if (old && old.StockUnitRate == null) throw new Error(`Missing recorded inward cost for ${detail.ItemCode}`);
    const item = await Item.findByPk(detail.ItemCode, { transaction, lock: transaction?.LOCK.UPDATE });
    if (!item) throw new Error(`Unknown item ${detail.ItemCode}`);
    const orderRate = old ? Number(old.StockUnitRate) : await getPurchaseOrderNetUnitRate(detail, transaction);
    const rate = orderRate === null ? Number(item.UnitRate || 0) : orderRate;
    const qty = Number(detail.ReceivedQty || 0);
    // Preserve exact legacy value for unchanged lines, including source rounding.
    const value = old && Number(old.ReceivedQty) === qty && old.StockValue != null
      ? Number(old.StockValue) : Number((qty * rate).toFixed(6));
    priced.push({ ...detail, StockUnitRate: Number(rate.toFixed(8)), StockValue: value });
  }
  return priced;
};

const adjustInventory = async (details = [], direction, transaction) => {
  for (const detail of details) {
    const receivedQty = parseFloat(detail.ReceivedQty) || 0;
    if (receivedQty === 0 && Number(detail.StockValue || 0) === 0) continue;

    let item = null;
    if (detail.ItemCode) {
      item = await Item.findByPk(detail.ItemCode, { transaction, lock: transaction?.LOCK.UPDATE });
    } else if (detail.ItemName) {
      item = await Item.findOne({ where: { ItemName: detail.ItemName }, transaction, lock: transaction?.LOCK.UPDATE });
    }

    if (!item) throw new Error(`Unknown item ${detail.ItemCode || detail.ItemName}`);

    const currentQty = parseFloat(item.Quantity ?? item.OpeningQty) || 0;
    const currentOpeningQty = parseFloat(item.OpeningQty) || 0;
    const adjustment = receivedQty * direction;
    const currentRate = parseFloat(item.UnitRate) || 0;
    if (detail.StockValue == null) throw new Error(`Missing recorded inward value for ${detail.ItemCode}`);
    const currentValue = currentQty * currentRate;
    const proposedQty = currentQty + adjustment;
    if (proposedQty < -0.000001) {
      const error = new Error(`Cannot remove inward quantity for ${detail.ItemCode}: it would make stock negative. Reverse the related issues first.`);
      error.statusCode = 409;
      throw error;
    }
    const nextQty = Math.max(0, proposedQty);
    const nextValue = currentValue + (direction * Number(detail.StockValue));
    const nextRate = nextQty > 0
      ? Math.max(0, nextValue / nextQty)
      : 0;

    await item.update({
      Quantity: nextQty,
      OpeningQty: currentOpeningQty + adjustment,
      UnitRate: Number(nextRate.toFixed(6))
    }, { transaction });
  }
};

const findInvalidReceivedQtyItem = (items = []) => items.find((item) => {
  const pendingQty = parseFloat(item.PendingQty ?? item.Qty) || 0;
  const receivedQty = parseFloat(item.ReceivedQty) || 0;

  return receivedQty < 0 || receivedQty > pendingQty;
});

const validateInwardBalances = async (details, partyCode, transaction, excludeInwardNo) => {
  const invalid = message => {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  };
  const orderNos = [...new Set(details.map(d => String(d.OrderNo || '')))].sort();
  // Serialize receipts against the PO so concurrent batches cannot over-receive.
  for (const orderNo of orderNos) {
    const order = orderNo ? await PurchaseOrder.findByPk(orderNo, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (!order || order.PartyCode !== partyCode) invalid('Every inward line must belong to a purchase order for the selected party');
  }
  const poLines = await PurchaseOrderDetail.findAll({ where: { OrderNo: { [Op.in]: orderNos } }, raw: true, transaction });
  const where = { OrderNo: { [Op.in]: orderNos } };
  if (excludeInwardNo) where.InwardNo = { [Op.ne]: excludeInwardNo };
  const received = await GateInwardDetail.findAll({ where, raw: true, transaction });
  const remaining = new Map();
  for (const line of poLines) {
    const key = `${line.OrderNo}::${line.ItemCode}`;
    remaining.set(key, (remaining.get(key) || 0) + Number(line.Qty || 0));
  }
  for (const line of received) {
    const key = `${line.OrderNo}::${line.ItemCode}`;
    if (remaining.has(key)) remaining.set(key, remaining.get(key) - Number(line.ReceivedQty || 0));
  }
  for (const line of details) {
    const key = `${line.OrderNo}::${line.ItemCode}`;
    const qty = Number(line.ReceivedQty);
    if (!remaining.has(key)) invalid(`Item ${line.ItemCode} is not on purchase order ${line.OrderNo}`);
    const pending = remaining.get(key);
    if (!Number.isFinite(qty) || qty < 0 || qty > pending + 0.000001) invalid(`Received quantity for ${line.ItemCode} exceeds the actual pending quantity (${pending}) or is invalid`);
    line.PendingQty = pending;
    remaining.set(key, pending - qty);
  }
};

/**
 * Recalculate and update PO status based on total ordered vs total received.
 *   Draft     — no qty received yet
 *   Partial   — some qty received, more pending
 *   Completed — all qty fully received
 */
const recalcPOStatus = async (orderNo, transaction) => {
  if (!orderNo) return;

  const poDetails = await PurchaseOrderDetail.findAll({
    where: { OrderNo: orderNo },
    attributes: ['ItemCode', 'Qty'],
    raw: true,
    transaction
  });

  if (!poDetails || poDetails.length === 0) return;

  const giDetails = await GateInwardDetail.findAll({
    where: { OrderNo: orderNo },
    attributes: ['ItemCode', [fn('SUM', col('ReceivedQty')), 'totalReceived']],
    group: ['ItemCode'],
    raw: true,
    transaction
  });

  const receivedMap = {};
  for (const row of giDetails) {
    receivedMap[row.ItemCode] = parseFloat(row.totalReceived) || 0;
  }

  let totalItemsCount = poDetails.length;
  let fullyReceivedCount = 0;
  let zeroReceivedCount = 0;

  for (const item of poDetails) {
    const ordered = parseFloat(item.Qty) || 0;
    const received = receivedMap[item.ItemCode] || 0;

    if (received >= ordered && ordered > 0) {
      fullyReceivedCount++;
    } else if (received <= 0) {
      zeroReceivedCount++;
    }
  }

  let newStatus;
  if (fullyReceivedCount === totalItemsCount) {
    newStatus = 'Completed';
  } else if (zeroReceivedCount === totalItemsCount) {
    newStatus = 'Draft';
  } else {
    newStatus = 'Partial';
  }

  await PurchaseOrder.update(
    { Status: newStatus },
    { where: { OrderNo: orderNo }, transaction }
  );
};

// Get last inward number
exports.getLastInwardNo = async (req, res) => {
  try {
    const lastInward = await GateInward.findOne({
      order: [['InwardNo', 'DESC']]
    });

    res.json({
      success: true,
      data: { lastInwardNo: lastInward ? lastInward.InwardNo : 0 }
    });
  } catch (error) {
    console.error('Error fetching last inward number:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching inward number',
      error: error.message
    });
  }
};

// Get all purchase orders with party details (Draft or Partial)
exports.getPurchaseOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrder.findAll({
      attributes: ['OrderNo', 'PartyCode', 'OrderDate'],
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        }
      ],
      where: { Status: { [Op.in]: ['Draft', 'Partial'] } },
      order: [['OrderNo', 'DESC']]
    });

    const formatted = orders.map(o => {
      const plain = o.toJSON();
      plain.PartyName = plain.supplier?.AccountName || plain.PartyCode;
      return plain;
    });

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching purchase orders',
      error: error.message
    });
  }
};

// Get items for a specific purchase order
exports.getPurchaseOrderItems = async (req, res) => {
  try {
    const { orderNo } = req.query;

    if (!orderNo) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required'
      });
    }

    const items = await PurchaseOrderDetail.findAll({
      where: { OrderNo: orderNo },
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['ItemCode', 'ItemName']
        }
      ],
      order: [['DetailId', 'ASC']]
    });

    const formatted = items.map(i => {
      const plain = i.toJSON();
      plain.ItemName = plain.item?.ItemName || '';
      return plain;
    });

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching order items',
      error: error.message
    });
  }
};

// Get all gate inwards
exports.getGateInwards = async (req, res) => {
  try {
    const inwards = await GateInward.findAll({
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        },
        {
          model: GateInwardDetail,
          as: 'details',
          include: [
            {
              model: Item,
              as: 'item',
              attributes: ['ItemCode', 'ItemName']
            }
          ]
        }
      ],
      order: [['InwardNo', 'DESC']]
    });

    const formatted = inwards.map(inw => {
      const plain = inw.toJSON();
      plain.PartyName = plain.supplier?.AccountName || plain.PartyCode;
      if (plain.details) {
        plain.details = plain.details.map(d => ({
          ...d,
          ItemName: d.item?.ItemName || ''
        }));
      }
      return plain;
    });

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching gate inwards:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching gate inwards',
      error: error.message
    });
  }
};

// Get single gate inward with details by InwardNo
exports.getGateInwardById = async (req, res) => {
  try {
    const { inwardNo } = req.params;

    const inward = await GateInward.findByPk(inwardNo, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        },
        {
          model: GateInwardDetail,
          as: 'details',
          include: [
            {
              model: Item,
              as: 'item',
              attributes: ['ItemCode', 'ItemName']
            }
          ]
        }
      ]
    });

    if (!inward) {
      return res.status(404).json({
        success: false,
        message: 'Gate Inward not found'
      });
    }

    const plain = inward.toJSON();
    plain.PartyName = plain.supplier?.AccountName || plain.PartyCode;
    if (plain.details) {
      plain.details = plain.details.map(d => ({
        ...d,
        ItemName: d.item?.ItemName || ''
      }));
    }

    res.json({
      success: true,
      data: plain
    });
  } catch (error) {
    console.error('Error fetching gate inward:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching gate inward',
      error: error.message
    });
  }
};

// Create gate inward with details
exports.createGateInward = async (req, res) => {
  try {
    validateTransactionItems(req.body?.items, { required: true, quantities: ['ReceivedQty'], allowZero: true });
    const {
      PartyCode, PartyName, InwardDate, InvoiceNo, InvoiceDate, items
    } = req.body;

    const resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName);
    if (!resolvedPartyCode || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Party code/name and items are required'
      });
    }

    const hasReceivedQty = items.some(i => (parseFloat(i.ReceivedQty) || 0) > 0);
    if (!hasReceivedQty) {
      return res.status(400).json({
        success: false,
        message: 'Please enter received quantity for at least one item'
      });
    }

    const invalidQtyItem = findInvalidReceivedQtyItem(items);
    if (invalidQtyItem) {
      return res.status(400).json({
        success: false,
        message: `Received quantity for ${invalidQtyItem.ItemName || invalidQtyItem.ItemCode} must be less than or equal to pending qty`
      });
    }

    const orderNos = [...new Set(items.map(i => i.OrderNo).filter(Boolean))];
    if (orderNos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid purchase order reference is required for all items'
      });
    }

    // Check for duplicate InvoiceNo per party across DIFFERENT purchase orders
    if (InvoiceNo && InvoiceNo.trim()) {
      const duplicateInward = await GateInward.findOne({
        where: {
          PartyCode: resolvedPartyCode,
          InvoiceNo: InvoiceNo.trim(),
          OrderNo: { [Op.ne]: orderNos[0] }
        }
      });
      if (duplicateInward) {
        const dupPO = duplicateInward.OrderNo
          ? await PurchaseOrder.findByPk(duplicateInward.OrderNo, { raw: true })
          : null;
        return res.status(409).json({
          success: false,
          message: `A Gate Inward already exists for party "${resolvedPartyCode}" with invoice number "${InvoiceNo.trim()}" on PO #${duplicateInward.OrderNo}.`,
          duplicate: {
            InwardNo: duplicateInward.InwardNo,
            PartyCode: duplicateInward.PartyCode,
            InvoiceNo: duplicateInward.InvoiceNo,
            OrderNo: duplicateInward.OrderNo,
            hasPurchaseOrder: !!dupPO
          }
        });
      }
    }

    // Validate POs belong to this party and are not Completed
    const poCount = await PurchaseOrder.count({
      where: {
        OrderNo: { [Op.in]: orderNos },
        PartyCode: resolvedPartyCode,
        Status: { [Op.in]: ['Draft', 'Partial'] }
      }
    });
    if (poCount !== orderNos.length) {
      return res.status(400).json({
        success: false,
        message: 'Selected purchase order(s) are invalid for this party or already fully received'
      });
    }

    const preparedItems = [];
    for (const item of items) {
      const itemCode = await resolveItemCode(item.ItemCode, item.ItemName);
      if (!itemCode) continue;

      preparedItems.push({
        OrderNo: item.OrderNo,
        ItemCode: itemCode,
        PendingQty: item.PendingQty || item.Qty || 0,
        ReceivedQty: item.ReceivedQty || 0
      });
    }

    if (preparedItems.length !== items.length) throw new Error('Every inward line requires a valid item code');
    const newInward = await sequelize.transaction(async transaction => {
      await validateInwardBalances(preparedItems, resolvedPartyCode, transaction);
      const priced = await priceInwardDetails(preparedItems, [], transaction);
      const created = await GateInward.create({
        OrderNo: orderNos[0], PartyCode: resolvedPartyCode,
        InwardDate: InwardDate || new Date(),
        InvoiceNo: InvoiceNo ? InvoiceNo.trim() : null, InvoiceDate: InvoiceDate || null
      }, { transaction });
      for (const item of priced) await GateInwardDetail.create({ InwardNo: created.InwardNo, ...item }, { transaction });
      await adjustInventory(priced, 1, transaction);
      for (const oNo of orderNos) await recalcPOStatus(oNo, transaction);
      return created;
    });

    res.status(201).json({
      success: true,
      message: 'Gate Inward created successfully',
      data: newInward
    });
  } catch (error) {
    console.error('Error creating gate inward:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error creating gate inward',
      error: error.message
    });
  }
};

// Update gate inward
exports.updateGateInward = async (req, res) => {
  try {
    validateTransactionItems(req.body?.items, { quantities: ['ReceivedQty'], allowZero: true });
    const { inwardNo } = req.params;
    const {
      OrderNo, PartyCode, PartyName, InwardDate, InvoiceNo, InvoiceDate, items
    } = req.body;

    const inward = await GateInward.findByPk(inwardNo);
    if (!inward) {
      return res.status(404).json({
        success: false,
        message: 'Gate Inward not found'
      });
    }

    let resolvedPartyCode = inward.PartyCode;
    if (PartyCode || PartyName) {
      resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName) || inward.PartyCode;
    }

    if (items !== undefined && (!Array.isArray(items) || items.length === 0)) {
      return res.status(400).json({ success: false, message: 'Gate inward items cannot be empty' });
    }
    if (items && items.length > 0) {
      const hasReceivedQty = items.some(i => (parseFloat(i.ReceivedQty) || 0) > 0);
      if (!hasReceivedQty) {
        return res.status(400).json({
          success: false,
          message: 'Please enter received quantity for at least one item'
        });
      }

      const invalidQtyItem = findInvalidReceivedQtyItem(items);
      if (invalidQtyItem) {
        return res.status(400).json({
          success: false,
          message: `Received quantity for ${invalidQtyItem.ItemName || invalidQtyItem.ItemCode} must be less than or equal to pending qty`
        });
      }
    }

    // Check for duplicate InvoiceNo per party (skip if blank)
    if (InvoiceNo && InvoiceNo.trim()) {
      const duplicateInward = await GateInward.findOne({
        where: {
          PartyCode: resolvedPartyCode,
          InvoiceNo: InvoiceNo.trim(),
          InwardNo: { [Op.ne]: inwardNo },
          OrderNo: { [Op.ne]: OrderNo || items?.[0]?.OrderNo || inward.OrderNo }
        }
      });
      if (duplicateInward) {
        return res.status(409).json({
          success: false,
          message: `A Gate Inward already exists for party "${resolvedPartyCode}" with invoice number "${InvoiceNo.trim()}".`
        });
      }
    }

    const firstItemOrderNo = items && items.length > 0 ? items[0].OrderNo : null;
    await sequelize.transaction(async transaction => {
      await inward.update({
        OrderNo: OrderNo || firstItemOrderNo || inward.OrderNo,
        PartyCode: resolvedPartyCode, InwardDate: InwardDate || inward.InwardDate,
        InvoiceNo: InvoiceNo ? InvoiceNo.trim() : inward.InvoiceNo,
        InvoiceDate: InvoiceDate || inward.InvoiceDate
      }, { transaction });
      if (items && items.length > 0) {
        const previousDetails = await GateInwardDetail.findAll({ where: { InwardNo: inwardNo }, raw: true, transaction, lock: transaction.LOCK.UPDATE });
        const affectedOrderNos = new Set(previousDetails.map(d => d.OrderNo).filter(Boolean));
        const preparedItems = [];
        for (const item of items) {
          const itemCode = await resolveItemCode(item.ItemCode, item.ItemName);
          if (!itemCode) throw new Error('Every inward line requires a valid item code');
          preparedItems.push({ InwardNo: inwardNo, OrderNo: item.OrderNo || inward.OrderNo, ItemCode: itemCode,
            PendingQty: item.PendingQty || item.Qty || 0, ReceivedQty: item.ReceivedQty || 0 });
          if (item.OrderNo) affectedOrderNos.add(item.OrderNo);
        }
        await validateInwardBalances(preparedItems, resolvedPartyCode, transaction, inwardNo);
        const priced = await priceInwardDetails(preparedItems, previousDetails, transaction);
        // Apply the net change once. Reversing the whole inward temporarily
        // loses the remaining stock value when some goods have been issued.
        const changes = new Map();
        for (const [lines, direction] of [[previousDetails, -1], [priced, 1]]) {
          for (const line of lines) {
            if (line.StockValue == null) throw new Error(`Missing recorded inward value for ${line.ItemCode}`);
            const change = changes.get(line.ItemCode) || { ItemCode: line.ItemCode, ReceivedQty: 0, StockValue: 0 };
            change.ReceivedQty += direction * Number(line.ReceivedQty || 0);
            change.StockValue += direction * Number(line.StockValue);
            changes.set(line.ItemCode, change);
          }
        }
        await adjustInventory([...changes.values()], 1, transaction);
        await GateInwardDetail.destroy({ where: { InwardNo: inwardNo }, transaction });
        for (const detail of priced) await GateInwardDetail.create(detail, { transaction });
        for (const oNo of affectedOrderNos) await recalcPOStatus(oNo, transaction);
      }
    });

    res.json({
      success: true,
      message: 'Gate Inward updated successfully',
      data: inward
    });
  } catch (error) {
    console.error('Error updating gate inward:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error updating gate inward',
      error: error.message
    });
  }
};

// Delete gate inward
exports.deleteGateInward = async (req, res) => {
  try {
    const { inwardNo } = req.params;

    const inward = await GateInward.findByPk(inwardNo);
    if (!inward) {
      return res.status(404).json({
        success: false,
        message: 'Gate Inward not found'
      });
    }

        await preventReferencedDeletion('GateInward', inward);

    await sequelize.transaction(async transaction => {
      const details = await GateInwardDetail.findAll({ where: { InwardNo: inwardNo }, raw: true, transaction, lock: transaction.LOCK.UPDATE });
      const orderNos = [...new Set([inward.OrderNo, ...details.map(d => d.OrderNo)].filter(Boolean))];
      await adjustInventory(details, -1, transaction);
      await GateInwardDetail.destroy({ where: { InwardNo: inwardNo }, transaction });
      await inward.destroy({ transaction });
      for (const oNo of orderNos) await recalcPOStatus(oNo, transaction);
    });

    res.json({
      success: true,
      message: 'Gate Inward deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting gate inward:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error deleting gate inward',
      error: error.message
    });
  }
};

// Get all parties from purchase orders that are not fully received
exports.getParties = async (req, res) => {
  try {
    const pos = await PurchaseOrder.findAll({
      attributes: ['PartyCode'],
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        }
      ],
      where: { Status: { [Op.in]: ['Draft', 'Partial'] } },
      group: ['PurchaseOrder.PartyCode', 'supplier.PartyCode', 'supplier.AccountName'],
      order: [['PartyCode', 'ASC']]
    });

    res.json({
      success: true,
      data: pos.map(p => ({
        PartyCode: p.PartyCode,
        name: p.supplier ? p.supplier.AccountName : p.PartyCode,
        AccountName: p.supplier ? p.supplier.AccountName : p.PartyCode
      }))
    });
  } catch (error) {
    console.error('Error fetching parties:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching parties',
      error: error.message
    });
  }
};

// Get purchase orders (Draft/Partial) for a specific party
exports.getPurchaseOrdersByParty = async (req, res) => {
  try {
    const { partyName, partyCode } = req.query;

    const resolvedPartyCode = await resolvePartyCode(partyCode, partyName);
    if (!resolvedPartyCode) {
      return res.status(400).json({
        success: false,
        message: 'Party code/name is required'
      });
    }

    const orders = await PurchaseOrder.findAll({
      where: {
        PartyCode: resolvedPartyCode,
        Status: { [Op.in]: ['Draft', 'Partial'] }
      },
      attributes: ['OrderNo', 'OrderDate', 'Total', 'GrandTotal', 'Status'],
      order: [['OrderNo', 'DESC']]
    });

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching purchase orders by party:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching purchase orders',
      error: error.message
    });
  }
};

// Get items for a single purchase order with remaining pending qty
exports.getItemsByOrder = async (req, res) => {
  try {
    const { orderNo } = req.query;

    if (!orderNo) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required'
      });
    }

    // Get all PO items for this specific order
    const poItems = await PurchaseOrderDetail.findAll({
      where: { OrderNo: orderNo },
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['ItemCode', 'ItemName']
        }
      ],
      order: [['DetailId', 'ASC']]
    });

    // Get total received qty per ItemCode across all gate inwards for this order
    const receivedRows = await GateInwardDetail.findAll({
      where: { OrderNo: orderNo },
      attributes: [
        'ItemCode',
        [fn('SUM', col('ReceivedQty')), 'totalReceived']
      ],
      group: ['ItemCode'],
      raw: true
    });

    // Build lookup: "ItemCode" -> totalReceived
    const receivedMap = {};
    for (const row of receivedRows) {
      receivedMap[row.ItemCode] = parseFloat(row.totalReceived) || 0;
    }

    // Calculate remaining pending qty for each item
    const itemsWithPending = poItems.map(itemInstance => {
      const item = itemInstance.toJSON();
      const orderedQty = parseFloat(item.Qty) || 0;
      const alreadyReceived = receivedMap[item.ItemCode] || 0;
      const pendingQty = orderedQty - alreadyReceived;
      return {
        ItemCode: item.ItemCode,
        ItemName: item.item?.ItemName || '',
        Qty: pendingQty, // Remaining qty to be received
        OrderNo: item.OrderNo,
        UnitRate: item.UnitRate
      };
    });

    // Check if any previous Gate Inward for this order has an InvoiceNo and InvoiceDate
    const existingGI = await GateInward.findOne({
      where: {
        OrderNo: orderNo,
        InvoiceNo: { [Op.ne]: null }
      },
      attributes: ['InvoiceNo', 'InvoiceDate'],
      order: [['InwardNo', 'ASC']]
    });

    res.json({
      success: true,
      data: itemsWithPending,
      existingInvoiceNo: existingGI && existingGI.InvoiceNo ? existingGI.InvoiceNo : '',
      existingInvoiceDate: existingGI && existingGI.InvoiceDate ? existingGI.InvoiceDate : null
    });
  } catch (error) {
    console.error('Error fetching items by order:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching items by order',
      error: error.message
    });
  }
};

// Get all items from purchase orders of a specific party (with remaining pending qty)
exports.getItemsByParty = async (req, res) => {
  try {
    const { partyName, partyCode } = req.query;

    const resolvedPartyCode = await resolvePartyCode(partyCode, partyName);
    if (!resolvedPartyCode) {
      return res.status(400).json({
        success: false,
        message: 'Party code/name is required'
      });
    }

    // Get orders that are Draft or Partial for this party
    const orders = await PurchaseOrder.findAll({
      where: {
        PartyCode: resolvedPartyCode,
        Status: { [Op.in]: ['Draft', 'Partial'] }
      },
      attributes: ['OrderNo'],
      raw: true
    });

    const eligibleOrderNos = orders.map(o => o.OrderNo);
    if (eligibleOrderNos.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get all PO items
    const poItems = await PurchaseOrderDetail.findAll({
      where: { OrderNo: { [Op.in]: eligibleOrderNos } },
      include: [
        {
          model: Item,
          as: 'item',
          attributes: ['ItemCode', 'ItemName']
        }
      ],
      order: [['OrderNo', 'ASC']]
    });

    // Get total received qty per (OrderNo, ItemCode) across all gate inwards
    const receivedRows = await GateInwardDetail.findAll({
      where: { OrderNo: { [Op.in]: eligibleOrderNos } },
      attributes: [
        'OrderNo',
        'ItemCode',
        [fn('SUM', col('ReceivedQty')), 'totalReceived']
      ],
      group: ['OrderNo', 'ItemCode'],
      raw: true
    });

    // Build lookup: "OrderNo-ItemCode" -> totalReceived
    const receivedMap = {};
    for (const row of receivedRows) {
      receivedMap[`${row.OrderNo}-${row.ItemCode}`] = parseFloat(row.totalReceived) || 0;
    }

    // Calculate remaining pending qty for each item
    const itemsWithPending = poItems
      .map(itemInstance => {
        const item = itemInstance.toJSON();
        const orderedQty = parseFloat(item.Qty) || 0;
        const alreadyReceived = receivedMap[`${item.OrderNo}-${item.ItemCode}`] || 0;
        const pendingQty = orderedQty - alreadyReceived;
        return {
          ItemCode: item.ItemCode,
          ItemName: item.item?.ItemName || '',
          Qty: pendingQty, // Remaining qty to be received
          OrderNo: item.OrderNo,
          UnitRate: item.UnitRate
        };
      })
      .filter(item => item.Qty > 0); // Only return items with pending qty

    res.json({
      success: true,
      data: itemsWithPending
    });
  } catch (error) {
    console.error('Error fetching items by party:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching items',
      error: error.message
    });
  }
};

// Check for duplicate GateInward by Party + InvoiceNo
exports.checkDuplicateInvoice = async (req, res) => {
  try {
    const { partyName, partyCode, invoiceNo, excludeInwardNo, orderNo } = req.query;

    const resolvedPartyCode = await resolvePartyCode(partyCode, partyName);
    if (!resolvedPartyCode || !invoiceNo) {
      return res.json({ success: true, duplicate: null });
    }

    const whereClause = {
      PartyCode: resolvedPartyCode,
      InvoiceNo: invoiceNo.trim()
    };
    if (excludeInwardNo) {
      whereClause.InwardNo = { [Op.ne]: excludeInwardNo };
    }
    if (orderNo) {
      whereClause.OrderNo = { [Op.ne]: orderNo };
    }

    const duplicateInward = await GateInward.findOne({ where: whereClause });

    if (!duplicateInward) {
      return res.json({ success: true, duplicate: null });
    }

    res.json({
      success: true,
      duplicate: {
        InwardNo: duplicateInward.InwardNo,
        PartyCode: duplicateInward.PartyCode,
        InvoiceNo: duplicateInward.InvoiceNo,
        InwardDate: duplicateInward.InwardDate,
        OrderNo: duplicateInward.OrderNo
      }
    });
  } catch (error) {
    console.error('Error checking duplicate invoice:', error);
    res.status(errorStatus(error)).json({ success: false, message: 'Error checking duplicate', error: error.message });
  }
};

// Cascade-delete a GateInward chain
// Body: { layers: { gateInward: true, purchaseOrder: true } }
exports.deleteGateInwardChain = async (req, res) => {
  try {
    const { inwardNo } = req.params;
    const layers = req.body?.layers || {};

    const inward = await GateInward.findByPk(inwardNo);
    if (!inward) {
      return res.status(404).json({ success: false, message: 'Gate Inward not found' });
    }

    const deletedLayers = [];
    const orderNo = inward.OrderNo;

    await sequelize.transaction(async transaction => {
    // Layer 1: Delete GateInward + Details
    if (layers.gateInward) {
      await preventReferencedDeletion('GateInward', inward, transaction);
      const details = await GateInwardDetail.findAll({
        where: { InwardNo: inwardNo },
        raw: true, transaction, lock: transaction.LOCK.UPDATE
      });
      await adjustInventory(details, -1, transaction);
      await GateInwardDetail.destroy({ where: { InwardNo: inwardNo }, transaction });
      await inward.destroy({ transaction });
      deletedLayers.push('GateInward');

      // Recalculate PO status after deletion
      if (orderNo) {
        await recalcPOStatus(orderNo, transaction);
      }
    }

    // Layer 2: Delete PurchaseOrder + Details (only if not used by another GateInward)
    if (layers.purchaseOrder && orderNo) {
      const otherGI = await GateInwardDetail.findOne({
        where: { OrderNo: orderNo }, transaction
      });
      if (!otherGI) {
        await PurchaseOrderDetail.destroy({ where: { OrderNo: orderNo }, transaction });
        await PurchaseOrder.destroy({ where: { OrderNo: orderNo }, transaction });
        deletedLayers.push('PurchaseOrder');
      } else {
        deletedLayers.push('PurchaseOrder (skipped — used by another GateInward)');
      }
    }
    });

    res.json({
      success: true,
      message: `Deleted: ${deletedLayers.join(', ')}`,
      deletedLayers
    });
  } catch (error) {
    console.error('Error deleting gate inward chain:', error);
    res.status(errorStatus(error)).json({ success: false, message: 'Error deleting gate inward chain', error: error.message });
  }
};

exports.recalcPOStatus = recalcPOStatus;
exports.adjustInwardInventory = adjustInventory;
