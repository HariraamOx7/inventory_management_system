const { Op } = require('sequelize');
const GateInward = require('../models/GateInward');
const GateInwardDetail = require('../models/GateInwardDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');

const findInvalidReceivedQtyItem = (items = []) => items.find((item) => {
  const pendingQty = parseFloat(item.PendingQty ?? item.Qty) || 0;
  const receivedQty = parseFloat(item.ReceivedQty) || 0;

  return receivedQty < 0 || receivedQty > pendingQty;
});

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

// Get all purchase orders with party details
exports.getPurchaseOrders = async (req, res) => {
  try {
    const usedOrderRows = await GateInwardDetail.findAll({
      attributes: ['OrderNo'],
      group: ['OrderNo'],
      raw: true
    });
    const usedOrderNos = usedOrderRows.map(r => r.OrderNo);

    const whereClause = { Status: 'Draft' };
    if (usedOrderNos.length > 0) {
      whereClause.OrderNo = { [Op.notIn]: usedOrderNos };
    }

    const orders = await PurchaseOrder.findAll({
      attributes: ['OrderNo', 'PartyName', 'OrderDate'],
      where: whereClause,
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
      PartyName, InwardDate, InvoiceNo, InvoiceDate,
      DCNo, DCDate, LRCNo, items
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

    const alreadyUsed = await GateInwardDetail.findOne({
      where: { OrderNo: { [Op.in]: orderNos } }
    });
    if (alreadyUsed) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected purchase orders are already used in Gate Inward'
      });
    }

    // Check for duplicate InvoiceNo per party (skip if blank)
    if (InvoiceNo && InvoiceNo.trim()) {
      const duplicateInward = await GateInward.findOne({
        where: { PartyName: PartyName.trim(), InvoiceNo: InvoiceNo.trim() }
      });
      if (duplicateInward) {
        const dupPO = duplicateInward.OrderNo
          ? await PurchaseOrder.findByPk(duplicateInward.OrderNo, { raw: true })
          : null;
        return res.status(409).json({
          success: false,
          message: `A Gate Inward already exists for party "${PartyName.trim()}" with invoice number "${InvoiceNo.trim()}".`,
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

    const poCount = await PurchaseOrder.count({
      where: {
        OrderNo: { [Op.in]: orderNos },
        PartyName: PartyName.trim(),
        Status: 'Draft'
      }
    });
    if (poCount !== orderNos.length) {
      return res.status(400).json({
        success: false,
        message: 'Selected purchase order(s) are invalid for this party or already processed'
      });
    }

    const newInward = await GateInward.create({
      OrderNo: orderNos[0],
      PartyName: PartyName.trim(),
      InwardDate: InwardDate || new Date(),
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : null,
      InvoiceDate: InvoiceDate || null,
      DCNo: DCNo ? DCNo.trim() : null,
      DCDate: DCDate || null,
      LRCNo: LRCNo ? LRCNo.trim() : null
    });

    for (const item of items) {
      await GateInwardDetail.create({
        InwardNo: newInward.InwardNo,
        OrderNo: item.OrderNo,
        ItemName: item.ItemName,
        PendingQty: item.Qty || item.PendingQty || 0,
        ReceivedQty: item.ReceivedQty || 0
      });
    }

    await PurchaseOrder.update(
      { Status: 'InwardCreated' },
      { where: { OrderNo: { [Op.in]: orderNos } } }
    );

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
      PartyName, InwardDate, InvoiceNo, InvoiceDate,
      DCNo, DCDate, LRCNo, items
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

    await inward.update({
      PartyName: PartyName ? PartyName.trim() : inward.PartyName,
      InwardDate: InwardDate || inward.InwardDate,
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : inward.InvoiceNo,
      InvoiceDate: InvoiceDate || inward.InvoiceDate,
      DCNo: DCNo ? DCNo.trim() : inward.DCNo,
      DCDate: DCDate || inward.DCDate,
      LRCNo: LRCNo ? LRCNo.trim() : inward.LRCNo
    });

    if (items && items.length > 0) {
      await GateInwardDetail.destroy({ where: { InwardNo: inwardNo } });

      for (const item of items) {
        await GateInwardDetail.create({
          InwardNo: inwardNo,
          OrderNo: item.OrderNo,
          ItemName: item.ItemName,
          PendingQty: item.Qty || item.PendingQty || 0,
          ReceivedQty: item.ReceivedQty || 0
        });
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

    if (orderNos.length > 0) {
      await PurchaseOrder.update(
        { Status: 'Draft' },
        { where: { OrderNo: { [Op.in]: orderNos } } }
      );
    }

    await GateInwardDetail.destroy({ where: { InwardNo: inwardNo } });
    await inward.destroy();

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

// Get all parties from not-yet-used purchase orders
exports.getParties = async (req, res) => {
  try {
    const usedOrderRows = await GateInwardDetail.findAll({
      attributes: ['OrderNo'],
      group: ['OrderNo'],
      raw: true
    });
    const usedOrderNos = usedOrderRows.map(r => r.OrderNo);

    const whereClause = { Status: 'Draft' };
    if (usedOrderNos.length > 0) {
      whereClause.OrderNo = { [Op.notIn]: usedOrderNos };
    }

    const parties = await PurchaseOrder.findAll({
      attributes: ['PartyName'],
      where: whereClause,
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

// Get all items from all unused purchase orders of a specific party
exports.getItemsByParty = async (req, res) => {
  try {
    const { partyName } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    const usedOrderRows = await GateInwardDetail.findAll({
      attributes: ['OrderNo'],
      group: ['OrderNo'],
      raw: true
    });
    const usedOrderNos = usedOrderRows.map(r => r.OrderNo);

    const orderWhere = { PartyName: partyName, Status: 'Draft' };
    if (usedOrderNos.length > 0) {
      orderWhere.OrderNo = { [Op.notIn]: usedOrderNos };
    }

    const orders = await PurchaseOrder.findAll({
      where: orderWhere,
      attributes: ['OrderNo'],
      raw: true
    });

    const eligibleOrderNos = orders.map(o => o.OrderNo);
    if (eligibleOrderNos.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const items = await PurchaseOrderDetail.findAll({
      where: { OrderNo: { [Op.in]: eligibleOrderNos } },
      attributes: ['ItemName', 'Qty', 'OrderNo', 'UnitRate'],
      order: [['OrderNo', 'ASC']]
    });

    res.json({
      success: true,
      data: items
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
    const { partyName, invoiceNo, excludeInwardNo } = req.query;

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

      // Restore PurchaseOrder status to Draft if deleting inward
      if (orderNo) {
        await PurchaseOrder.update(
          { Status: 'Draft' },
          { where: { OrderNo: orderNo } }
        );
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
