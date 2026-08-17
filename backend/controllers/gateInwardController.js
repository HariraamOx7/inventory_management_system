const { Op, fn, col } = require('sequelize');
const GateInward = require('../models/GateInward');
const GateInwardDetail = require('../models/GateInwardDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');

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
    attributes: ['ItemName', 'Qty'],
    raw: true
  });

  if (!poDetails || poDetails.length === 0) return;

  const giDetails = await GateInwardDetail.findAll({
    where: { OrderNo: orderNo },
    attributes: ['ItemName', [fn('SUM', col('ReceivedQty')), 'totalReceived']],
    group: ['ItemName'],
    raw: true
  });

  const receivedMap = {};
  for (const row of giDetails) {
    receivedMap[row.ItemName] = parseFloat(row.totalReceived) || 0;
  }

  let totalItemsCount = poDetails.length;
  let fullyReceivedCount = 0;
  let zeroReceivedCount = 0;

  for (const item of poDetails) {
    const ordered = parseFloat(item.Qty) || 0;
    const received = receivedMap[item.ItemName] || 0;

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
      attributes: ['OrderNo', 'PartyName', 'OrderDate'],
      where: { Status: { [Op.in]: ['Draft', 'Partial'] } },
      order: [['OrderNo', 'DESC']]
    });

    res.json({
      success: true,
      data: orders
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
      attributes: ['ItemName', 'Qty', 'UnitRate', 'OrderNo'],
      order: [['DetailId', 'ASC']]
    });

    res.json({
      success: true,
      data: items
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
      include: [{ model: GateInwardDetail, as: 'details' }],
      order: [['InwardNo', 'DESC']]
    });

    res.json({
      success: true,
      data: inwards
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
          model: GateInwardDetail,
          as: 'details'
        }
      ]
    });

    if (!inward) {
      return res.status(404).json({
        success: false,
        message: 'Gate Inward not found'
      });
    }

    res.json({
      success: true,
      data: inward
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
      PartyName, InwardDate, InvoiceNo, InvoiceDate, items
    } = req.body;

    if (!PartyName || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Party name and items are required'
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
        message: `Received quantity for ${invalidQtyItem.ItemName} must be less than or equal to pending qty`
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
          PartyName: PartyName.trim(),
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
          message: `A Gate Inward already exists for party "${PartyName.trim()}" with invoice number "${InvoiceNo.trim()}" on PO #${duplicateInward.OrderNo}.`,
          duplicate: {
            InwardNo: duplicateInward.InwardNo,
            PartyName: duplicateInward.PartyName,
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
        PartyName: PartyName.trim(),
        Status: { [Op.in]: ['Draft', 'Partial'] }
      }
    });
    if (poCount !== orderNos.length) {
      return res.status(400).json({
        success: false,
        message: 'Selected purchase order(s) are invalid for this party or already fully received'
      });
    }

    const newInward = await GateInward.create({
      OrderNo: orderNos[0],
      PartyName: PartyName.trim(),
      InwardDate: InwardDate || new Date(),
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : null,
      InvoiceDate: InvoiceDate || null
    });

    for (const item of items) {
      await GateInwardDetail.create({
        InwardNo: newInward.InwardNo,
        OrderNo: item.OrderNo,
        ItemName: item.ItemName,
        PendingQty: item.PendingQty || item.Qty || 0,
        ReceivedQty: item.ReceivedQty || 0
      });
    }

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
      OrderNo, PartyName, InwardDate, InvoiceNo, InvoiceDate, items
    } = req.body;

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
          message: `Received quantity for ${invalidQtyItem.ItemName} must be less than or equal to pending qty`
        });
      }
    }

    const inward = await GateInward.findByPk(inwardNo);
    if (!inward) {
      return res.status(404).json({
        success: false,
        message: 'Gate Inward not found'
      });
    }

    // Check for duplicate InvoiceNo per party (skip if blank)
    if (InvoiceNo && InvoiceNo.trim()) {
      const duplicateInward = await GateInward.findOne({
        where: {
          PartyName: PartyName.trim(),
          InvoiceNo: InvoiceNo.trim(),
          InwardNo: { [Op.ne]: inwardNo }
        }
      });
      if (duplicateInward) {
        return res.status(409).json({
          success: false,
          message: `A Gate Inward already exists for party "${PartyName.trim()}" with invoice number "${InvoiceNo.trim()}".`
        });
      }
    }

    const firstItemOrderNo = items && items.length > 0 ? items[0].OrderNo : null;
    await inward.update({
      OrderNo: OrderNo || firstItemOrderNo || inward.OrderNo,
      PartyName: PartyName ? PartyName.trim() : inward.PartyName,
      InwardDate: InwardDate || inward.InwardDate,
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : inward.InvoiceNo,
      InvoiceDate: InvoiceDate || inward.InvoiceDate
    });

    if (items && items.length > 0) {
      await GateInwardDetail.destroy({ where: { InwardNo: inwardNo } });

      const affectedOrderNos = new Set();
      for (const item of items) {
        await GateInwardDetail.create({
          InwardNo: inwardNo,
          OrderNo: item.OrderNo,
          ItemName: item.ItemName,
          PendingQty: item.PendingQty || item.Qty || 0,
          ReceivedQty: item.ReceivedQty || 0
        });
        if (item.OrderNo) affectedOrderNos.add(item.OrderNo);
      }

      // Recalculate PO status after updating details
      for (const oNo of affectedOrderNos) {
        await recalcPOStatus(oNo);
      }
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
      attributes: ['OrderNo'],
      raw: true
    });

    const orderNos = [...new Set([inward.OrderNo, ...details.map(d => d.OrderNo)].filter(Boolean))];

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
    const parties = await PurchaseOrder.findAll({
      attributes: ['PartyName'],
      where: { Status: { [Op.in]: ['Draft', 'Partial'] } },
      group: ['PartyName'],
      order: [['PartyName', 'ASC']]
    });

    res.json({
      success: true,
      data: parties.map(p => ({ name: p.PartyName }))
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
    const { partyName } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    const orders = await PurchaseOrder.findAll({
      where: {
        PartyName: partyName,
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
      attributes: ['ItemName', 'Qty', 'OrderNo', 'UnitRate'],
      order: [['DetailId', 'ASC']],
      raw: true
    });

    // Get total received qty per ItemName across all gate inwards for this order
    const receivedRows = await GateInwardDetail.findAll({
      where: { OrderNo: orderNo },
      attributes: [
        'ItemName',
        [fn('SUM', col('ReceivedQty')), 'totalReceived']
      ],
      group: ['ItemName'],
      raw: true
    });

    // Build lookup: "ItemName" -> totalReceived
    const receivedMap = {};
    for (const row of receivedRows) {
      receivedMap[row.ItemName] = parseFloat(row.totalReceived) || 0;
    }

    // Calculate remaining pending qty for each item
    const itemsWithPending = poItems
      .map(item => {
        const orderedQty = parseFloat(item.Qty) || 0;
        const alreadyReceived = receivedMap[item.ItemName] || 0;
        const pendingQty = orderedQty - alreadyReceived;
        return {
          ItemName: item.ItemName,
          Qty: pendingQty,  // Remaining qty to be received
          OrderNo: item.OrderNo,
          UnitRate: item.UnitRate
        };
      })
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
    const { partyName } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    // Get orders that are Draft or Partial for this party
    const orders = await PurchaseOrder.findAll({
      where: {
        PartyName: partyName,
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
      attributes: ['ItemName', 'Qty', 'OrderNo', 'UnitRate'],
      order: [['OrderNo', 'ASC']],
      raw: true
    });

    // Get total received qty per (OrderNo, ItemName) across all gate inwards
    const receivedRows = await GateInwardDetail.findAll({
      where: { OrderNo: { [Op.in]: eligibleOrderNos } },
      attributes: [
        'OrderNo',
        'ItemName',
        [fn('SUM', col('ReceivedQty')), 'totalReceived']
      ],
      group: ['OrderNo', 'ItemName'],
      raw: true
    });

    // Build lookup: "OrderNo-ItemName" -> totalReceived
    const receivedMap = {};
    for (const row of receivedRows) {
      receivedMap[`${row.OrderNo}-${row.ItemName}`] = parseFloat(row.totalReceived) || 0;
    }

    // Calculate remaining pending qty for each item
    const itemsWithPending = poItems
      .map(item => {
        const orderedQty = parseFloat(item.Qty) || 0;
        const alreadyReceived = receivedMap[`${item.OrderNo}-${item.ItemName}`] || 0;
        const pendingQty = orderedQty - alreadyReceived;
        return {
          ItemName: item.ItemName,
          Qty: pendingQty,  // Remaining qty to be received
          OrderNo: item.OrderNo,
          UnitRate: item.UnitRate
        };
      })
      .filter(item => item.Qty > 0);  // Only return items with pending qty

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

// Check for duplicate GateInward by PartyName + InvoiceNo
exports.checkDuplicateInvoice = async (req, res) => {
  try {
    const { partyName, invoiceNo, excludeInwardNo, orderNo } = req.query;

    if (!partyName || !invoiceNo) {
      return res.json({ success: true, duplicate: null });
    }

    const whereClause = {
      PartyName: partyName.trim(),
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
        PartyName: duplicateInward.PartyName,
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
        // Another gate inward uses this PO — skip PO deletion safely
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

// Export recalcPOStatus so other controllers (e.g. PurchaseOrder) can use it
exports.recalcPOStatus = recalcPOStatus;
