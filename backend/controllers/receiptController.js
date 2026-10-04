const { Op, fn, col } = require('sequelize');
const Receipt = require('../models/Receipt');
const ReceiptDetail = require('../models/ReceiptDetail');
const Supplier = require('../models/Supplier');
const Item = require('../models/Item');
const GateInward = require('../models/GateInward');
const GateInwardDetail = require('../models/GateInwardDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');

const parseDec = (val, defaultVal = 0) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
};

const cleanDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().split('T')[0];
};

const cleanOrderNo = (val) => {
  if (!val) return null;
  const num = parseInt(String(val).replace(/\D/g, ''), 10);
  return isNaN(num) ? null : num;
};

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

const getPurchaseOrderUnitRateMap = async (orderNos = []) => {
  if (orderNos.length === 0) return new Map();

  const poDetails = await PurchaseOrderDetail.findAll({
    where: { OrderNo: { [Op.in]: orderNos } },
    attributes: ['OrderNo', 'ItemCode', 'UnitRate'],
    raw: true
  });

  return new Map(
    poDetails.map((detail) => [
      `${detail.OrderNo}::${detail.ItemCode}`,
      parseFloat(detail.UnitRate) || 0
    ])
  );
};

const resolveUnitRate = (item, itemCode, unitRateMap) => {
  const hasSubmittedRate = item.UnitRate !== undefined && item.UnitRate !== null && item.UnitRate !== '';
  if (hasSubmittedRate) {
    const submittedRate = parseFloat(item.UnitRate);
    return Number.isFinite(submittedRate) ? submittedRate : 0;
  }

  return unitRateMap.get(`${cleanOrderNo(item.OrderNo)}::${itemCode}`) || 0;
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
    const usedReceipts = await Receipt.findAll({
      attributes: ['GateInwardNo'],
      where: { GateInwardNo: { [Op.ne]: null } },
      raw: true
    });
    const usedInwardNos = usedReceipts.map(r => r.GateInwardNo);

    const usedGIs = usedInwardNos.length > 0
      ? await GateInward.findAll({
          where: { InwardNo: { [Op.in]: usedInwardNos } },
          attributes: ['OrderNo'],
          raw: true
        })
      : [];
    const usedOrderNos = [...new Set(usedGIs.map(g => g.OrderNo).filter(Boolean))];

    const completedPOs = await PurchaseOrder.findAll({
      attributes: ['PartyCode'],
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        }
      ],
      where: {
        Status: 'Completed',
        ...(usedOrderNos.length > 0 ? { OrderNo: { [Op.notIn]: usedOrderNos } } : {})
      },
      group: ['PurchaseOrder.PartyCode', 'supplier.PartyCode', 'supplier.AccountName'],
      order: [['PartyCode', 'ASC']]
    });

    res.json({
      success: true,
      data: completedPOs.map(p => ({
        PartyCode: p.PartyCode,
        name: p.supplier?.AccountName || p.PartyCode,
        AccountName: p.supplier?.AccountName || p.PartyCode
      }))
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
    const { partyName, partyCode } = req.query;

    const usedReceipts = await Receipt.findAll({
      attributes: ['GateInwardNo'],
      where: { GateInwardNo: { [Op.ne]: null } },
      raw: true
    });
    const usedInwardNos = usedReceipts.map(r => r.GateInwardNo);

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
    const resolvedPartyCode = await resolvePartyCode(partyCode, partyName);
    if (resolvedPartyCode) whereClause.PartyCode = resolvedPartyCode;
    if (usedOrderNos.length > 0) whereClause.OrderNo = { [Op.notIn]: usedOrderNos };

    const completedPOs = await PurchaseOrder.findAll({
      where: whereClause,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        }
      ],
      attributes: ['OrderNo', 'PartyCode', 'OrderDate', 'Total', 'GrandTotal', 'Status'],
      order: [['OrderNo', 'DESC']]
    });

    const formatted = completedPOs.map(p => {
      const plain = p.toJSON();
      plain.PartyName = plain.supplier?.AccountName || plain.PartyCode;
      return plain;
    });

    res.json({
      success: true,
      data: formatted
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

    const po = await PurchaseOrder.findByPk(orderNo, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        }
      ]
    });
    if (!po) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Order not found'
      });
    }

    const gateInwards = await GateInward.findAll({
      where: { OrderNo: orderNo },
      include: [
        {
          model: GateInwardDetail,
          as: 'details',
          include: [{ model: Item, as: 'item', attributes: ['ItemCode', 'ItemName'] }]
        }
      ],
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

    const poDetails = await PurchaseOrderDetail.findAll({
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

    const giSums = await GateInwardDetail.findAll({
      where: { OrderNo: orderNo },
      attributes: [
        'ItemCode',
        [fn('SUM', col('ReceivedQty')), 'totalReceived']
      ],
      group: ['ItemCode'],
      raw: true
    });
    const receivedMap = {};
    for (const row of giSums) {
      receivedMap[row.ItemCode] = parseFloat(row.totalReceived) || 0;
    }

    const itemsForReceipt = poDetails.map(dInstance => {
      const d = dInstance.toJSON();
      const qtyVal = receivedMap[d.ItemCode] !== undefined ? receivedMap[d.ItemCode] : (parseFloat(d.Qty) || 0);
      const rateVal = parseFloat(d.UnitRate) || 0;
      return {
        ItemCode: d.ItemCode,
        ItemName: d.item?.ItemName || '',
        OrderNo: d.OrderNo,
        PendingQty: 0,
        ReceivedQty: qtyVal,
        Qty: qtyVal,
        UnitRate: rateVal,
        TotalAmount: qtyVal * rateVal
      };
    });

    const primaryGI = gateInwards.find(gi => gi.InvoiceNo && gi.InvoiceNo.trim()) || (gateInwards.length > 0 ? gateInwards[gateInwards.length - 1] : null);

    res.json({
      success: true,
      data: {
        OrderNo: po.OrderNo,
        PartyCode: po.PartyCode,
        PartyName: po.supplier?.AccountName || po.PartyCode,
        GateInwardNo: primaryGI ? primaryGI.InwardNo : (gateInwards[0]?.InwardNo || null),
        InvoiceNo: primaryGI ? primaryGI.InvoiceNo : '',
        InvoiceDate: primaryGI ? primaryGI.InvoiceDate : null,
        InwardDate: primaryGI ? primaryGI.InwardDate : null,
        gateInwards: gateInwards.map(gi => {
          const p = gi.toJSON();
          if (p.details) {
            p.details = p.details.map(d => ({ ...d, ItemName: d.item?.ItemName || '' }));
          }
          return p;
        }),
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

// Get available gate inwards not yet used in receipt (only for 100% completed POs, 1 receipt per PO)
exports.getAvailableGateInwards = async (req, res) => {
  try {
    const { partyName, partyCode } = req.query;

    const usedReceipts = await Receipt.findAll({
      attributes: ['GateInwardNo'],
      where: {
        GateInwardNo: { [Op.ne]: null }
      },
      raw: true
    });
    const usedInwardNos = usedReceipts.map(r => r.GateInwardNo);

    const usedGIs = usedInwardNos.length > 0
      ? await GateInward.findAll({
          where: { InwardNo: { [Op.in]: usedInwardNos } },
          attributes: ['OrderNo'],
          raw: true
        })
      : [];
    const usedOrderNos = [...new Set(usedGIs.map(g => g.OrderNo).filter(Boolean))];

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
    const resolvedPartyCode = await resolvePartyCode(partyCode, partyName);
    if (resolvedPartyCode) whereClause.PartyCode = resolvedPartyCode;
    if (completedOrderNos.length > 0) {
      whereClause.OrderNo = { [Op.in]: completedOrderNos };
    } else {
      whereClause.OrderNo = { [Op.in]: [-1] };
    }

    const gateInwards = await GateInward.findAll({
      where: whereClause,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        }
      ],
      attributes: ['InwardNo', 'OrderNo', 'PartyCode', 'InwardDate', 'InvoiceNo', 'InvoiceDate'],
      order: [['InwardNo', 'DESC']]
    });

    const uniqueByOrder = [];
    const seenOrders = new Set();
    for (const gi of gateInwards) {
      const oKey = gi.OrderNo || gi.InwardNo;
      if (!seenOrders.has(oKey)) {
        seenOrders.add(oKey);
        const p = gi.toJSON();
        p.PartyName = p.supplier?.AccountName || p.PartyCode;
        uniqueByOrder.push(p);
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

// Get gate inward with details, aggregating all received quantities across all batches for this PO
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
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        },
        {
          model: GateInwardDetail,
          as: 'details',
          include: [{ model: Item, as: 'item', attributes: ['ItemCode', 'ItemName'] }]
        }
      ]
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

      const poDetails = await PurchaseOrderDetail.findAll({
        where: { OrderNo: targetOrderNo },
        include: [{ model: Item, as: 'item', attributes: ['ItemCode', 'ItemName'] }],
        order: [['DetailId', 'ASC']]
      });

      const giSums = await GateInwardDetail.findAll({
        where: { OrderNo: targetOrderNo },
        attributes: [
          'ItemCode',
          [fn('SUM', col('ReceivedQty')), 'totalReceived']
        ],
        group: ['ItemCode'],
        raw: true
      });
      const receivedMap = {};
      for (const row of giSums) {
        receivedMap[row.ItemCode] = parseFloat(row.totalReceived) || 0;
      }

      itemsForReceipt = poDetails.map(dInstance => {
        const d = dInstance.toJSON();
        const qtyVal = receivedMap[d.ItemCode] !== undefined ? receivedMap[d.ItemCode] : (parseFloat(d.Qty) || 0);
        const rateVal = parseFloat(d.UnitRate) || 0;
        return {
          ItemCode: d.ItemCode,
          ItemName: d.item?.ItemName || '',
          OrderNo: d.OrderNo,
          PendingQty: 0,
          ReceivedQty: qtyVal,
          Qty: qtyVal,
          UnitRate: rateVal,
          TotalAmount: qtyVal * rateVal
        };
      });
    } else {
      itemsForReceipt = (gateInward.details || []).map(d => {
        const json = d.toJSON();
        return {
          ...json,
          ItemName: json.item?.ItemName || '',
          Qty: json.ReceivedQty || json.Qty || 0,
          TotalAmount: (json.ReceivedQty || json.Qty || 0) * (json.UnitRate || 0)
        };
      });
    }

    const plain = gateInward.toJSON();
    plain.PartyName = plain.supplier?.AccountName || plain.PartyCode;

    res.json({
      success: true,
      data: {
        ...plain,
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

// Existing endpoint: get gate inwards by party
exports.getGateInwardsByParty = async (req, res) => {
  try {
    const { partyName, partyCode } = req.query;

    const resolvedPartyCode = await resolvePartyCode(partyCode, partyName);
    if (!resolvedPartyCode) {
      return res.status(400).json({
        success: false,
        message: 'Party code/name is required'
      });
    }

    const gateInwards = await GateInward.findAll({
      where: { PartyCode: resolvedPartyCode },
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

// Existing endpoint: get gate inward items
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
      include: [{ model: Item, as: 'item', attributes: ['ItemCode', 'ItemName'] }],
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
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName']
        },
        {
          model: ReceiptDetail,
          as: 'details',
          include: [{ model: Item, as: 'item', attributes: ['ItemCode', 'ItemName'] }]
        }
      ],
      order: [['GRNNo', 'DESC']]
    });

    const orderNos = new Set();
    const inwardNos = new Set();
    for (const r of receipts) {
      if (r.GateInwardNo) inwardNos.add(r.GateInwardNo);
      for (const d of r.details || []) {
        if (d.OrderNo) orderNos.add(d.OrderNo);
      }
    }

    const orConditions = [];
    if (orderNos.size > 0) orConditions.push({ OrderNo: { [Op.in]: Array.from(orderNos) } });
    if (inwardNos.size > 0) orConditions.push({ InwardNo: { [Op.in]: Array.from(inwardNos) } });

    const gateInwards = orConditions.length > 0
      ? await GateInward.findAll({
          where: { [Op.or]: orConditions },
          include: [
            {
              model: GateInwardDetail,
              as: 'details',
              include: [{ model: Item, as: 'item', attributes: ['ItemCode', 'ItemName'] }]
            }
          ],
          order: [['InwardNo', 'ASC']]
        })
      : [];

    const giByOrder = new Map();
    const giByInward = new Map();
    for (const gi of gateInwards) {
      const json = gi.toJSON();
      if (json.details) {
        json.details = json.details.map(d => ({ ...d, ItemName: d.item?.ItemName || '' }));
      }
      if (gi.OrderNo) {
        if (!giByOrder.has(gi.OrderNo)) giByOrder.set(gi.OrderNo, []);
        giByOrder.get(gi.OrderNo).push(json);
      }
      giByInward.set(gi.InwardNo, json);
    }

    const result = receipts.map(r => {
      const rJson = r.toJSON();
      rJson.PartyName = rJson.supplier?.AccountName || rJson.PartyCode;
      if (rJson.details) {
        rJson.details = rJson.details.map(d => ({
          ...d,
          ItemName: d.item?.ItemName || ''
        }));
      }

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
      PartyCode, PartyName, GateInwardNo, InwardDate, InvoiceNo, InvoiceDate,
      DCNo, DCDate, FormType, BillAmount, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VatWithPF
    } = req.body;

    const resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName);
    if (!resolvedPartyCode || !GateInwardNo || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Party code/name, gate inward number, and items are required'
      });
    }

    const gateInward = await GateInward.findByPk(GateInwardNo);
    if (!gateInward || gateInward.PartyCode !== resolvedPartyCode) {
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

    const orderNos = [...new Set(items.map(item => cleanOrderNo(item.OrderNo)).filter(Boolean))];
    const unitRateMap = await getPurchaseOrderUnitRateMap(orderNos);

    const newReceipt = await Receipt.create({
      PartyCode: resolvedPartyCode,
      GateInwardNo: GateInwardNo ? parseInt(GateInwardNo, 10) : null,
      InwardDate: cleanDate(InwardDate) || cleanDate(gateInward.InwardDate) || cleanDate(new Date()),
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : (gateInward.InvoiceNo ? gateInward.InvoiceNo.trim() : null),
      InvoiceDate: cleanDate(InvoiceDate) || cleanDate(gateInward.InvoiceDate),
      DCNo: DCNo ? DCNo.trim() : null,
      DCDate: cleanDate(DCDate),
      FormType: FormType ? FormType.trim() : null,
      BillAmount: parseDec(BillAmount, 0),
      Total: parseDec(Total, 0),
      Discount: parseDec(Discount, 0),
      GST: parseDec(GST, 0),
      IGST: parseDec(IGST, 0),
      VAT_CST: parseDec(VAT_CST, 0),
      P_F: parseDec(P_F, 0),
      LorryFreight: parseDec(LorryFreight, 0),
      RoundOff: parseDec(RoundOff, 0),
      GrandTotal: parseDec(GrandTotal, 0),
      DutyWithoutPF: !!DutyWithoutPF,
      VatWithPF: !!VatWithPF,
      Status: 'ReceiptCreated'
    });

    for (const item of items) {
      const itemCode = await resolveItemCode(item.ItemCode, item.ItemName);
      if (!itemCode) continue;

      const qty = parseDec(item.Qty !== undefined ? item.Qty : item.ReceivedQty, 0);
      const unitRate = resolveUnitRate(item, itemCode, unitRateMap);
      await ReceiptDetail.create({
        GRNNo: newReceipt.GRNNo,
        OrderNo: cleanOrderNo(item.OrderNo),
        ItemCode: itemCode,
        Qty: qty,
        UnitRate: unitRate,
        TotalAmount: parseDec(item.TotalAmount, qty * unitRate)
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
    const gNo = parseInt(grnNo, 10);

    if (!gNo || isNaN(gNo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GRN Number'
      });
    }

    const {
      PartyCode, PartyName, GateInwardNo, InwardDate, InvoiceNo, InvoiceDate,
      DCNo, DCDate, FormType, BillAmount, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VatWithPF
    } = req.body;

    const receipt = await Receipt.findByPk(gNo);
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    let resolvedPartyCode = receipt.PartyCode;
    if (PartyCode || PartyName) {
      resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName) || receipt.PartyCode;
    }

    const updateData = {
      PartyCode: resolvedPartyCode,
      GateInwardNo: GateInwardNo !== undefined ? (GateInwardNo ? parseInt(GateInwardNo, 10) : null) : receipt.GateInwardNo,
      InwardDate: cleanDate(InwardDate) || receipt.InwardDate || cleanDate(new Date()),
      InvoiceNo: InvoiceNo !== undefined ? (InvoiceNo ? InvoiceNo.trim() : null) : receipt.InvoiceNo,
      InvoiceDate: cleanDate(InvoiceDate) || (InvoiceDate === null ? null : receipt.InvoiceDate),
      DCNo: DCNo !== undefined ? (DCNo ? DCNo.trim() : null) : receipt.DCNo,
      DCDate: cleanDate(DCDate) || (DCDate === null ? null : receipt.DCDate),
      FormType: FormType !== undefined ? (FormType ? FormType.trim() : null) : receipt.FormType,
      BillAmount: BillAmount !== undefined ? parseDec(BillAmount, 0) : receipt.BillAmount,
      Total: Total !== undefined ? parseDec(Total, 0) : receipt.Total,
      Discount: Discount !== undefined ? parseDec(Discount, 0) : receipt.Discount,
      GST: GST !== undefined ? parseDec(GST, 0) : receipt.GST,
      IGST: IGST !== undefined ? parseDec(IGST, 0) : receipt.IGST,
      VAT_CST: VAT_CST !== undefined ? parseDec(VAT_CST, 0) : receipt.VAT_CST,
      P_F: P_F !== undefined ? parseDec(P_F, 0) : receipt.P_F,
      LorryFreight: LorryFreight !== undefined ? parseDec(LorryFreight, 0) : receipt.LorryFreight,
      RoundOff: RoundOff !== undefined ? parseDec(RoundOff, 0) : receipt.RoundOff,
      GrandTotal: GrandTotal !== undefined ? parseDec(GrandTotal, 0) : receipt.GrandTotal,
      DutyWithoutPF: DutyWithoutPF !== undefined ? !!DutyWithoutPF : receipt.DutyWithoutPF,
      VatWithPF: VatWithPF !== undefined ? !!VatWithPF : receipt.VatWithPF
    };

    await receipt.update(updateData);

    if (items && Array.isArray(items) && items.length > 0) {
      const orderNos = [...new Set(items.map(item => cleanOrderNo(item.OrderNo)).filter(Boolean))];
      const unitRateMap = await getPurchaseOrderUnitRateMap(orderNos);

      await ReceiptDetail.destroy({ where: { GRNNo: gNo } });

      for (const item of items) {
        const itemCode = await resolveItemCode(item.ItemCode, item.ItemName);
        if (!itemCode) continue;

        const qty = parseDec(item.Qty !== undefined ? item.Qty : item.ReceivedQty, 0);
        const unitRate = resolveUnitRate(item, itemCode, unitRateMap);
        await ReceiptDetail.create({
          GRNNo: gNo,
          OrderNo: cleanOrderNo(item.OrderNo),
          ItemCode: itemCode,
          Qty: qty,
          UnitRate: unitRate,
          TotalAmount: parseDec(item.TotalAmount, qty * unitRate)
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
