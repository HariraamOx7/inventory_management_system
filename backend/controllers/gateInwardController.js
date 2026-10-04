const { Op, fn, col } = require('sequelize');
const GateInward = require('../models/GateInward');
const GateInwardDetail = require('../models/GateInwardDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');
const Supplier = require('../models/Supplier');
const Item = require('../models/Item');

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
  if (itemCode && !isNaN(parseInt(itemCode, 10))) {
    return parseInt(itemCode, 10);
  }
  if (itemName && String(itemName).trim()) {
    const found = await Item.findOne({ where: { ItemName: String(itemName).trim() } });
    if (found) return found.ItemCode;
  }
  return null;
};

// Stock represents goods physically received. A purchase order is only a
// commitment, so inventory is adjusted exclusively when its gate inward lines
// are created, changed, or removed.
const adjustInventory = async (details = [], direction) => {
  for (const detail of details) {
    const receivedQty = parseFloat(detail.ReceivedQty) || 0;
    if (receivedQty === 0) continue;

    let item = null;
    if (detail.ItemCode) {
      item = await Item.findByPk(detail.ItemCode);
    } else if (detail.ItemName) {
      item = await Item.findOne({ where: { ItemName: detail.ItemName } });
    }

    if (!item) continue;

    const currentQty = parseFloat(item.Quantity ?? item.OpeningQty) || 0;
    const currentOpeningQty = parseFloat(item.OpeningQty) || 0;
    const adjustment = receivedQty * direction;

    await item.update({
      Quantity: currentQty + adjustment,
      OpeningQty: currentOpeningQty + adjustment
    });
  }
};

const findInvalidReceivedQtyItem = (items = []) => items.find((item) => {
  const pendingQty = parseFloat(item.PendingQty ?? item.Qty) || 0;
  const receivedQty = parseFloat(item.ReceivedQty) || 0;

  return receivedQty < 0 || receivedQty > pendingQty;
});

/**
 * Recalculate and update PO status based on total ordered vs total received.
 *   Draft     — no qty received yet
 *   Partial   — some qty received, more pending
 *   Completed — all qty fully received
 */
const recalcPOStatus = async (orderNo) => {
  if (!orderNo) return;

  const poDetails = await PurchaseOrderDetail.findAll({
    where: { OrderNo: orderNo },
    attributes: ['ItemCode', 'Qty'],
    raw: true
  });

  if (!poDetails || poDetails.length === 0) return;

  const giDetails = await GateInwardDetail.findAll({
    where: { OrderNo: orderNo },
    attributes: ['ItemCode', [fn('SUM', col('ReceivedQty')), 'totalReceived']],
    group: ['ItemCode'],
    raw: true
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
    { where: { OrderNo: orderNo } }
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
      success: false,
      message: 'Error fetching gate inward',
      error: error.message
    });
  }
};

// Create gate inward with details
exports.createGateInward = async (req, res) => {
  try {
    const {
      PartyCode, PartyName, InwardDate, InvoiceNo, InvoiceDate, items
    } = req.body;

    const resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName);
    if (!resolvedPartyCode || !items || items.length === 0) {
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

    const newInward = await GateInward.create({
      OrderNo: orderNos[0],
      PartyCode: resolvedPartyCode,
      InwardDate: InwardDate || new Date(),
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : null,
      InvoiceDate: InvoiceDate || null
    });

    for (const item of preparedItems) {
      await GateInwardDetail.create({
        InwardNo: newInward.InwardNo,
        ...item
      });
    }

    await adjustInventory(preparedItems, 1);

    // Recalculate PO status (Draft / Partial / Completed)
    for (const oNo of orderNos) {
      await recalcPOStatus(oNo);
    }

    res.status(201).json({
      success: true,
      message: 'Gate Inward created successfully',
      data: newInward
    });
  } catch (error) {
    console.error('Error creating gate inward:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating gate inward',
      error: error.message
    });
  }
};

// Update gate inward
exports.updateGateInward = async (req, res) => {
  try {
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
          InwardNo: { [Op.ne]: inwardNo }
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
    await inward.update({
      OrderNo: OrderNo || firstItemOrderNo || inward.OrderNo,
      PartyCode: resolvedPartyCode,
      InwardDate: InwardDate || inward.InwardDate,
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : inward.InvoiceNo,
      InvoiceDate: InvoiceDate || inward.InvoiceDate
    });

    if (items && items.length > 0) {
      const previousDetails = await GateInwardDetail.findAll({
        where: { InwardNo: inwardNo },
        raw: true
      });
      await GateInwardDetail.destroy({ where: { InwardNo: inwardNo } });

      const affectedOrderNos = new Set();
      const preparedItems = [];
      for (const item of items) {
        const itemCode = await resolveItemCode(item.ItemCode, item.ItemName);
        if (!itemCode) continue;

        preparedItems.push({
          InwardNo: inwardNo,
          OrderNo: item.OrderNo,
          ItemCode: itemCode,
          PendingQty: item.PendingQty || item.Qty || 0,
          ReceivedQty: item.ReceivedQty || 0
        });
        if (item.OrderNo) affectedOrderNos.add(item.OrderNo);
      }

      for (const pItem of preparedItems) {
        await GateInwardDetail.create(pItem);
      }

      // Recalculate PO status after updating details
      for (const oNo of affectedOrderNos) {
        await recalcPOStatus(oNo);
      }

      await adjustInventory(previousDetails, -1);
      await adjustInventory(preparedItems, 1);
    }

    res.json({
      success: true,
      message: 'Gate Inward updated successfully',
      data: inward
    });
  } catch (error) {
    console.error('Error updating gate inward:', error);
    res.status(500).json({
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

    const details = await GateInwardDetail.findAll({
      where: { InwardNo: inwardNo },
      attributes: ['OrderNo', 'ItemCode', 'ReceivedQty'],
      raw: true
    });

    const orderNos = [...new Set([inward.OrderNo, ...details.map(d => d.OrderNo)].filter(Boolean))];

    await adjustInventory(details, -1);
    await GateInwardDetail.destroy({ where: { InwardNo: inwardNo } });
    await inward.destroy();

    // Recalculate PO status after deletion
    for (const oNo of orderNos) {
      await recalcPOStatus(oNo);
    }

    res.json({
      success: true,
      message: 'Gate Inward deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting gate inward:', error);
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({
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
    res.status(500).json({ success: false, message: 'Error checking duplicate', error: error.message });
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

    // Layer 1: Delete GateInward + Details
    if (layers.gateInward) {
      const details = await GateInwardDetail.findAll({
        where: { InwardNo: inwardNo },
        raw: true
      });
      await adjustInventory(details, -1);
      await GateInwardDetail.destroy({ where: { InwardNo: inwardNo } });
      await inward.destroy();
      deletedLayers.push('GateInward');

      // Recalculate PO status after deletion
      if (orderNo) {
        await recalcPOStatus(orderNo);
      }
    }

    // Layer 2: Delete PurchaseOrder + Details (only if not used by another GateInward)
    if (layers.purchaseOrder && orderNo) {
      const otherGI = await GateInwardDetail.findOne({
        where: { OrderNo: orderNo }
      });
      if (!otherGI) {
        await PurchaseOrderDetail.destroy({ where: { OrderNo: orderNo } });
        await PurchaseOrder.destroy({ where: { OrderNo: orderNo } });
        deletedLayers.push('PurchaseOrder');
      } else {
        deletedLayers.push('PurchaseOrder (skipped — used by another GateInward)');
      }
    }

    res.json({
      success: true,
      message: `Deleted: ${deletedLayers.join(', ')}`,
      deletedLayers
    });
  } catch (error) {
    console.error('Error deleting gate inward chain:', error);
    res.status(500).json({ success: false, message: 'Error deleting gate inward chain', error: error.message });
  }
};

exports.recalcPOStatus = recalcPOStatus;
