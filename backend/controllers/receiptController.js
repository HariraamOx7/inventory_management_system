const { Op, fn, col } = require('sequelize');
const Receipt = require('../models/Receipt');
const ReceiptDetail = require('../models/ReceiptDetail');
const Supplier = require('../models/Supplier');
const GateInward = require('../models/GateInward');
const GateInwardDetail = require('../models/GateInwardDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');

const getPurchaseOrderUnitRateMap = async (orderNos = []) => {
  if (orderNos.length === 0) return new Map();

  const poDetails = await PurchaseOrderDetail.findAll({
    where: { OrderNo: { [Op.in]: orderNos } },
    attributes: ['OrderNo', 'ItemName', 'UnitRate'],
    raw: true
  });

  return new Map(
    poDetails.map((detail) => [
      `${detail.OrderNo}::${detail.ItemName}`,
      parseFloat(detail.UnitRate) || 0
    ])
  );
};

const resolveUnitRate = (item, unitRateMap) => {
  const hasSubmittedRate = item.UnitRate !== undefined && item.UnitRate !== null && item.UnitRate !== '';
  if (hasSubmittedRate) {
    const submittedRate = parseFloat(item.UnitRate);
    return Number.isFinite(submittedRate) ? submittedRate : 0;
  }

  return unitRateMap.get(`${item.OrderNo}::${item.ItemName}`) || 0;
};

// Get last GRN number
exports.getLastGRNNo = async (req, res) => {
  try {
    const lastReceipt = await Receipt.findOne({
      order: [['GRNNo', 'DESC']]
    });

    res.json({
      success: true,
      data: { lastGRNNo: lastReceipt ? lastReceipt.GRNNo : 0 }
    });
  } catch (error) {
    console.error('Error fetching last GRN number:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching GRN number',
      error: error.message
    });
  }
};

// Get all parties (suppliers) who have at least one Completed Purchase Order and NO receipt created yet
exports.getParties = async (req, res) => {
  try {
    // Find all Gate Inwards that are already linked in an existing Receipt
    const usedReceipts = await Receipt.findAll({
      attributes: ['GateInwardNo'],
      where: { GateInwardNo: { [Op.ne]: null } },
      raw: true
    });
    const usedInwardNos = usedReceipts.map(r => r.GateInwardNo);

    // Find all POs that already have a Receipt created (via any of their Gate Inwards)
    const usedGIs = usedInwardNos.length > 0
      ? await GateInward.findAll({
          where: { InwardNo: { [Op.in]: usedInwardNos } },
          attributes: ['OrderNo'],
          raw: true
        })
      : [];
    const usedOrderNos = [...new Set(usedGIs.map(g => g.OrderNo).filter(Boolean))];

    // Find distinct PartyNames for POs that are 'Completed' and not yet in usedOrderNos
    const completedPOs = await PurchaseOrder.findAll({
      attributes: ['PartyName'],
      where: {
        Status: 'Completed',
        ...(usedOrderNos.length > 0 ? { OrderNo: { [Op.notIn]: usedOrderNos } } : {})
      },
      group: ['PartyName'],
      order: [['PartyName', 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      data: completedPOs.map(p => ({ name: p.PartyName }))
    });
  } catch (error) {
    console.error('Error fetching parties for receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching parties',
      error: error.message
    });
  }
};

// Get available purchase orders (Completed with Gate Inwards, not yet having a Receipt)
exports.getAvailablePurchaseOrders = async (req, res) => {
  try {
    const { partyName } = req.query;

    // Find all Gate Inwards that are already linked in an existing Receipt
    const usedReceipts = await Receipt.findAll({
      attributes: ['GateInwardNo'],
      where: { GateInwardNo: { [Op.ne]: null } },
      raw: true
    });
    const usedInwardNos = usedReceipts.map(r => r.GateInwardNo);

    // Find all POs that already have a Receipt created (via any of their Gate Inwards)
    const usedGIs = usedInwardNos.length > 0
      ? await GateInward.findAll({
          where: { InwardNo: { [Op.in]: usedInwardNos } },
          attributes: ['OrderNo'],
          raw: true
        })
      : [];
    const usedOrderNos = [...new Set(usedGIs.map(g => g.OrderNo).filter(Boolean))];

    const whereClause = {
      Status: 'Completed'
    };
    if (partyName) whereClause.PartyName = partyName.trim();
    if (usedOrderNos.length > 0) whereClause.OrderNo = { [Op.notIn]: usedOrderNos };

    const completedPOs = await PurchaseOrder.findAll({
      where: whereClause,
      attributes: ['OrderNo', 'PartyName', 'OrderDate', 'Total', 'GrandTotal', 'Status'],
      order: [['OrderNo', 'DESC']]
    });

    res.json({
      success: true,
      data: completedPOs
    });
  } catch (error) {
    console.error('Error fetching available purchase orders for receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase orders',
      error: error.message
    });
  }
};

// Get details for a specific Purchase Order for receipt creation (including all linked Gate Inwards)
exports.getPurchaseOrderReceiptDetails = async (req, res) => {
  try {
    const { orderNo } = req.query;

    if (!orderNo) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required'
      });
    }

    const po = await PurchaseOrder.findByPk(orderNo, { raw: true });
    if (!po) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Order not found'
      });
    }

    // Find all Gate Inwards linked to this PO
    const gateInwards = await GateInward.findAll({
      where: { OrderNo: orderNo },
      include: [{ model: GateInwardDetail, as: 'details' }],
      order: [['InwardNo', 'ASC']]
    });

    const poTotals = {
      Discount: parseFloat(po.Discount) || 0,
      GST: parseFloat(po.GST) || 0,
      IGST: parseFloat(po.IGST) || 0,
      VAT_CST: parseFloat(po.VAT_CST) || 0,
      P_F: parseFloat(po.P_F) || 0,
      LorryFreight: parseFloat(po.LorryFreight) || 0,
      RoundOff: parseFloat(po.RoundOff) || 0
    };

    // Fetch all PO item definitions for this order
    const poDetails = await PurchaseOrderDetail.findAll({
      where: { OrderNo: orderNo },
      attributes: ['OrderNo', 'ItemName', 'Qty', 'UnitRate', 'TotalAmount'],
      order: [['DetailId', 'ASC']],
      raw: true
    });

    // Sum total received quantities across ALL Gate Inwards for this OrderNo
    const giSums = await GateInwardDetail.findAll({
      where: { OrderNo: orderNo },
      attributes: [
        'ItemName',
        [fn('SUM', col('ReceivedQty')), 'totalReceived']
      ],
      group: ['ItemName'],
      raw: true
    });
    const receivedMap = {};
    for (const row of giSums) {
      receivedMap[row.ItemName] = parseFloat(row.totalReceived) || 0;
    }

    const itemsForReceipt = poDetails.map(d => {
      const qtyVal = receivedMap[d.ItemName] !== undefined ? receivedMap[d.ItemName] : (parseFloat(d.Qty) || 0);
      const rateVal = parseFloat(d.UnitRate) || 0;
      return {
        ItemName: d.ItemName,
        OrderNo: d.OrderNo,
        PendingQty: 0,
        ReceivedQty: qtyVal,
        Qty: qtyVal,
        UnitRate: rateVal,
        TotalAmount: qtyVal * rateVal
      };
    });

    // Primary Gate Inward (pick the one with an InvoiceNo, or latest)
    const primaryGI = gateInwards.find(gi => gi.InvoiceNo && gi.InvoiceNo.trim()) || (gateInwards.length > 0 ? gateInwards[gateInwards.length - 1] : null);

    res.json({
      success: true,
      data: {
        OrderNo: po.OrderNo,
        PartyName: po.PartyName,
        GateInwardNo: primaryGI ? primaryGI.InwardNo : (gateInwards[0]?.InwardNo || null),
        InvoiceNo: primaryGI ? primaryGI.InvoiceNo : '',
        InvoiceDate: primaryGI ? primaryGI.InvoiceDate : null,
        InwardDate: primaryGI ? primaryGI.InwardDate : null,
        gateInwards: gateInwards.map(gi => gi.toJSON()),
        details: itemsForReceipt,
        POTotals: poTotals
      }
    });
  } catch (error) {
    console.error('Error fetching purchase order details for receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase order receipt details',
      error: error.message
    });
  }
};

// New: Get available gate inwards not yet used in receipt (only for 100% completed POs, 1 receipt per PO)
exports.getAvailableGateInwards = async (req, res) => {
  try {
    const { partyName } = req.query;

    // Find all Gate Inwards that are already linked in an existing Receipt
    const usedReceipts = await Receipt.findAll({
      attributes: ['GateInwardNo'],
      where: {
        GateInwardNo: { [Op.ne]: null }
      },
      raw: true
    });
    const usedInwardNos = usedReceipts.map(r => r.GateInwardNo);

    // Find all POs that already have a Receipt created (via any of their Gate Inwards)
    const usedGIs = usedInwardNos.length > 0
      ? await GateInward.findAll({
          where: { InwardNo: { [Op.in]: usedInwardNos } },
          attributes: ['OrderNo'],
          raw: true
        })
      : [];
    const usedOrderNos = [...new Set(usedGIs.map(g => g.OrderNo).filter(Boolean))];

    // Only allow Gate Inwards whose Purchase Order is fully received ('Completed') and has no Receipt yet
    const completedOrders = await PurchaseOrder.findAll({
      attributes: ['OrderNo'],
      where: {
        Status: 'Completed',
        ...(usedOrderNos.length > 0 ? { OrderNo: { [Op.notIn]: usedOrderNos } } : {})
      },
      raw: true
    });
    const completedOrderNos = completedOrders.map(o => o.OrderNo);

    const whereClause = {};
    if (partyName) whereClause.PartyName = partyName;
    if (completedOrderNos.length > 0) {
      whereClause.OrderNo = { [Op.in]: completedOrderNos };
    } else {
      whereClause.OrderNo = { [Op.in]: [-1] };
    }

    const gateInwards = await GateInward.findAll({
      where: whereClause,
      attributes: ['InwardNo', 'OrderNo', 'PartyName', 'InwardDate', 'InvoiceNo', 'InvoiceDate'],
      order: [['InwardNo', 'DESC']]
    });

    // Group by OrderNo so each completed PO is represented once (by its latest Gate Inward)
    const uniqueByOrder = [];
    const seenOrders = new Set();
    for (const gi of gateInwards) {
      const oKey = gi.OrderNo || gi.InwardNo;
      if (!seenOrders.has(oKey)) {
        seenOrders.add(oKey);
        uniqueByOrder.push(gi);
      }
    }

    res.json({
      success: true,
      data: uniqueByOrder
    });
  } catch (error) {
    console.error('Error fetching available gate inwards:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available gate inwards',
      error: error.message
    });
  }
};

// New: Get gate inward with details, aggregating all received quantities across all batches for this PO
exports.getGateInwardDetails = async (req, res) => {
  try {
    const { inwardNo } = req.query;

    if (!inwardNo) {
      return res.status(400).json({
        success: false,
        message: 'Inward number is required'
      });
    }

    const gateInward = await GateInward.findByPk(inwardNo, {
      include: [{ model: GateInwardDetail, as: 'details' }]
    });

    if (!gateInward) {
      return res.status(404).json({
        success: false,
        message: 'Gate Inward not found'
      });
    }

    const targetOrderNo = gateInward.OrderNo || (gateInward.details && gateInward.details[0]?.OrderNo);

    let poTotals = { Discount: 0, GST: 0, IGST: 0, VAT_CST: 0, P_F: 0, LorryFreight: 0, RoundOff: 0 };
    let itemsForReceipt = [];

    if (targetOrderNo) {
      const po = await PurchaseOrder.findByPk(targetOrderNo, { raw: true });
      if (po) {
        poTotals = {
          Discount: parseFloat(po.Discount) || 0,
          GST: parseFloat(po.GST) || 0,
          IGST: parseFloat(po.IGST) || 0,
          VAT_CST: parseFloat(po.VAT_CST) || 0,
          P_F: parseFloat(po.P_F) || 0,
          LorryFreight: parseFloat(po.LorryFreight) || 0,
          RoundOff: parseFloat(po.RoundOff) || 0
        };
      }

      // Fetch all PO item definitions for this order
      const poDetails = await PurchaseOrderDetail.findAll({
        where: { OrderNo: targetOrderNo },
        attributes: ['OrderNo', 'ItemName', 'Qty', 'UnitRate', 'TotalAmount'],
        order: [['DetailId', 'ASC']],
        raw: true
      });

      // Sum total received quantities across ALL Gate Inwards for this OrderNo (all batches)
      const giSums = await GateInwardDetail.findAll({
        where: { OrderNo: targetOrderNo },
        attributes: [
          'ItemName',
          [fn('SUM', col('ReceivedQty')), 'totalReceived']
        ],
        group: ['ItemName'],
        raw: true
      });
      const receivedMap = {};
      for (const row of giSums) {
        receivedMap[row.ItemName] = parseFloat(row.totalReceived) || 0;
      }

      // Build complete item list for receipt: total received quantity across all batches
      itemsForReceipt = poDetails.map(d => {
        const qtyVal = receivedMap[d.ItemName] !== undefined ? receivedMap[d.ItemName] : (parseFloat(d.Qty) || 0);
        const rateVal = parseFloat(d.UnitRate) || 0;
        return {
          ItemName: d.ItemName,
          OrderNo: d.OrderNo,
          PendingQty: 0,
          ReceivedQty: qtyVal,
          Qty: qtyVal,
          UnitRate: rateVal,
          TotalAmount: qtyVal * rateVal
        };
      });
    } else {
      itemsForReceipt = (gateInward.details || []).map(d => ({
        ...d.toJSON(),
        Qty: d.ReceivedQty || d.Qty || 0,
        TotalAmount: (d.ReceivedQty || d.Qty || 0) * (d.UnitRate || 0)
      }));
    }

    res.json({
      success: true,
      data: {
        ...gateInward.toJSON(),
        details: itemsForReceipt,
        POTotals: poTotals
      }
    });
  } catch (error) {
    console.error('Error fetching gate inward details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gate inward details',
      error: error.message
    });
  }
};

// Existing legacy endpoint
exports.getGateInwardsByParty = async (req, res) => {
  try {
    const { partyName } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    const gateInwards = await GateInward.findAll({
      where: { PartyName: partyName },
      attributes: ['InwardNo', 'OrderNo', 'InwardDate'],
      order: [['InwardNo', 'DESC']]
    });

    res.json({
      success: true,
      data: gateInwards
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

// Existing legacy endpoint
exports.getGateInwardItems = async (req, res) => {
  try {
    const { inwardNo } = req.query;

    if (!inwardNo) {
      return res.status(400).json({
        success: false,
        message: 'Inward number is required'
      });
    }

    const items = await GateInwardDetail.findAll({
      where: { InwardNo: inwardNo },
      attributes: ['ItemName', 'PendingQty', 'ReceivedQty', 'OrderNo'],
      order: [['DetailId', 'ASC']]
    });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching inward items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching inward items',
      error: error.message
    });
  }
};

// Get all receipts (attaching all linked Gate Inwards for each PO)
exports.getReceipts = async (req, res) => {
  try {
    const receipts = await Receipt.findAll({
      include: [{ model: ReceiptDetail, as: 'details' }],
      order: [['GRNNo', 'DESC']]
    });

    // Collect all OrderNos and GateInwardNos
    const orderNos = new Set();
    const inwardNos = new Set();
    for (const r of receipts) {
      if (r.GateInwardNo) inwardNos.add(r.GateInwardNo);
      for (const d of r.details || []) {
        if (d.OrderNo) orderNos.add(d.OrderNo);
      }
    }

    // Fetch gate inwards for these POs and InwardNos
    const orConditions = [];
    if (orderNos.size > 0) orConditions.push({ OrderNo: { [Op.in]: Array.from(orderNos) } });
    if (inwardNos.size > 0) orConditions.push({ InwardNo: { [Op.in]: Array.from(inwardNos) } });

    const gateInwards = orConditions.length > 0
      ? await GateInward.findAll({
          where: { [Op.or]: orConditions },
          include: [{ model: GateInwardDetail, as: 'details' }],
          order: [['InwardNo', 'ASC']]
        })
      : [];

    // Map gate inwards by OrderNo and by InwardNo
    const giByOrder = new Map();
    const giByInward = new Map();
    for (const gi of gateInwards) {
      const json = gi.toJSON();
      if (gi.OrderNo) {
        if (!giByOrder.has(gi.OrderNo)) giByOrder.set(gi.OrderNo, []);
        giByOrder.get(gi.OrderNo).push(json);
      }
      giByInward.set(gi.InwardNo, json);
    }

    const result = receipts.map(r => {
      const rJson = r.toJSON();
      const rOrderNo = (rJson.details && rJson.details[0]?.OrderNo) || null;
      let linkedGIs = [];
      if (rOrderNo && giByOrder.has(rOrderNo)) {
        linkedGIs = giByOrder.get(rOrderNo);
      } else if (rJson.GateInwardNo && giByInward.has(rJson.GateInwardNo)) {
        linkedGIs = [giByInward.get(rJson.GateInwardNo)];
      }
      return {
        ...rJson,
        gateInwards: linkedGIs
      };
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching receipts',
      error: error.message
    });
  }
};

// Create receipt with details
exports.createReceipt = async (req, res) => {
  try {
    const {
      PartyName, GateInwardNo, InwardDate, InvoiceNo, InvoiceDate,
      DCNo, DCDate, FormType, BillAmount, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VatWithPF
    } = req.body;

    if (!PartyName || !GateInwardNo || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Party name, gate inward number, and items are required'
      });
    }

    const gateInward = await GateInward.findByPk(GateInwardNo);
    if (!gateInward || gateInward.PartyName !== PartyName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gate inward selected for party'
      });
    }

    if (gateInward.OrderNo) {
      const allGIsInPO = await GateInward.findAll({
        where: { OrderNo: gateInward.OrderNo },
        attributes: ['InwardNo'],
        raw: true
      });
      const poInwardNos = allGIsInPO.map(g => g.InwardNo);

      const existingReceiptForPO = await Receipt.findOne({
        where: { GateInwardNo: { [Op.in]: poInwardNos } }
      });
      if (existingReceiptForPO) {
        return res.status(400).json({
          success: false,
          message: `A Receipt (GRN-${String(existingReceiptForPO.GRNNo).padStart(3, '0')}) has already been created for Purchase Order #PO-${gateInward.OrderNo}. Only one receipt is allowed per purchase order.`
        });
      }
    } else {
      const existingReceiptForInward = await Receipt.findOne({
        where: { GateInwardNo }
      });
      if (existingReceiptForInward) {
        return res.status(400).json({
          success: false,
          message: 'This Gate Inward number is already used in a receipt'
        });
      }
    }

    // Validation: Only allow receipt if the Purchase Order is fully received (Status = 'Completed')
    if (gateInward.OrderNo) {
      const po = await PurchaseOrder.findByPk(gateInward.OrderNo, { raw: true });
      if (po && po.Status !== 'Completed') {
        return res.status(400).json({
          success: false,
          message: `Cannot create receipt for PO #${gateInward.OrderNo}. All ordered quantities must be fully received before entering a receipt.`
        });
      }
    }

    const orderNos = [...new Set(items.map(item => item.OrderNo).filter(Boolean))];
    const unitRateMap = await getPurchaseOrderUnitRateMap(orderNos);

    const newReceipt = await Receipt.create({
      PartyName: PartyName.trim(),
      GateInwardNo,
      InwardDate: InwardDate || gateInward.InwardDate || new Date(),
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : gateInward.InvoiceNo,
      InvoiceDate: InvoiceDate || gateInward.InvoiceDate || null,
      DCNo: DCNo ? DCNo.trim() : null,
      DCDate: DCDate || null,
      FormType: FormType ? FormType.trim() : null,
      BillAmount: BillAmount || 0,
      Total: Total || 0,
      Discount: Discount || 0,
      GST: GST || 0,
      IGST: IGST || 0,
      VAT_CST: VAT_CST || 0,
      P_F: P_F || 0,
      LorryFreight: LorryFreight || 0,
      RoundOff: RoundOff || 0,
      GrandTotal: GrandTotal || 0,
      DutyWithoutPF: DutyWithoutPF || false,
      VatWithPF: VatWithPF || false,
      Status: 'ReceiptCreated'
    });

    for (const item of items) {
      const qty = item.Qty ?? item.ReceivedQty ?? 0;
      const unitRate = resolveUnitRate(item, unitRateMap);
      await ReceiptDetail.create({
        GRNNo: newReceipt.GRNNo,
        OrderNo: item.OrderNo || null,
        ItemName: item.ItemName,
        Qty: qty,
        UnitRate: unitRate,
        TotalAmount: item.TotalAmount || (qty * unitRate)
      });
    }

    res.status(201).json({
      success: true,
      message: 'Receipt created successfully',
      data: newReceipt
    });
  } catch (error) {
    console.error('Error creating receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating receipt',
      error: error.message
    });
  }
};

// Update receipt
exports.updateReceipt = async (req, res) => {
  try {
    const { grnNo } = req.params;
    const {
      PartyName, GateInwardNo, InwardDate, InvoiceNo, InvoiceDate,
      DCNo, DCDate, FormType, BillAmount, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VatWithPF
    } = req.body;

    const receipt = await Receipt.findByPk(grnNo);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    await receipt.update({
      PartyName: PartyName ? PartyName.trim() : receipt.PartyName,
      GateInwardNo: GateInwardNo !== undefined ? GateInwardNo : receipt.GateInwardNo,
      InwardDate: InwardDate || receipt.InwardDate,
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : receipt.InvoiceNo,
      InvoiceDate: InvoiceDate || receipt.InvoiceDate,
      DCNo: DCNo ? DCNo.trim() : receipt.DCNo,
      DCDate: DCDate || receipt.DCDate,
      FormType: FormType ? FormType.trim() : receipt.FormType,
      BillAmount: BillAmount !== undefined ? BillAmount : receipt.BillAmount,
      Total: Total !== undefined ? Total : receipt.Total,
      Discount: Discount !== undefined ? Discount : receipt.Discount,
      GST: GST !== undefined ? GST : receipt.GST,
      IGST: IGST !== undefined ? IGST : receipt.IGST,
      VAT_CST: VAT_CST !== undefined ? VAT_CST : receipt.VAT_CST,
      P_F: P_F !== undefined ? P_F : receipt.P_F,
      LorryFreight: LorryFreight !== undefined ? LorryFreight : receipt.LorryFreight,
      RoundOff: RoundOff !== undefined ? RoundOff : receipt.RoundOff,
      GrandTotal: GrandTotal !== undefined ? GrandTotal : receipt.GrandTotal,
      DutyWithoutPF: DutyWithoutPF !== undefined ? DutyWithoutPF : receipt.DutyWithoutPF,
      VatWithPF: VatWithPF !== undefined ? VatWithPF : receipt.VatWithPF
    });

    if (items && items.length > 0) {
      const orderNos = [...new Set(items.map(item => item.OrderNo).filter(Boolean))];
      const unitRateMap = await getPurchaseOrderUnitRateMap(orderNos);

      await ReceiptDetail.destroy({ where: { GRNNo: grnNo } });

      for (const item of items) {
        const qty = item.Qty ?? item.ReceivedQty ?? 0;
        const unitRate = resolveUnitRate(item, unitRateMap);
        await ReceiptDetail.create({
          GRNNo: grnNo,
          OrderNo: item.OrderNo || null,
          ItemName: item.ItemName,
          Qty: qty,
          UnitRate: unitRate,
          TotalAmount: item.TotalAmount || (qty * unitRate)
        });
      }
    }

    res.json({
      success: true,
      message: 'Receipt updated successfully',
      data: receipt
    });
  } catch (error) {
    console.error('Error updating receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating receipt',
      error: error.message
    });
  }
};

// Delete receipt
exports.deleteReceipt = async (req, res) => {
  try {
    const { grnNo } = req.params;

    const receipt = await Receipt.findByPk(grnNo);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    await ReceiptDetail.destroy({ where: { GRNNo: grnNo } });
    await receipt.destroy();

    res.json({
      success: true,
      message: 'Receipt deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting receipt',
      error: error.message
    });
  }
};
