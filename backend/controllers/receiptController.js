const { Op } = require('sequelize');
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

// Get all parties (suppliers) for dropdown
exports.getParties = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      attributes: ['AccountName'],
      order: [['AccountName', 'ASC']]
    });

    res.json({
      success: true,
      data: suppliers.map(s => ({ name: s.AccountName }))
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

// New: Get available gate inwards not yet used in receipt
exports.getAvailableGateInwards = async (req, res) => {
  try {
    const { partyName } = req.query;

    const usedRows = await Receipt.findAll({
      attributes: ['GateInwardNo'],
      where: {
        GateInwardNo: { [Op.ne]: null }
      },
      group: ['GateInwardNo'],
      raw: true
    });
    const usedInwardNos = usedRows.map(r => r.GateInwardNo);

    const whereClause = {};
    if (partyName) whereClause.PartyName = partyName;
    if (usedInwardNos.length > 0) whereClause.InwardNo = { [Op.notIn]: usedInwardNos };

    const gateInwards = await GateInward.findAll({
      where: whereClause,
      attributes: ['InwardNo', 'OrderNo', 'PartyName', 'InwardDate', 'InvoiceNo', 'InvoiceDate', 'DCNo', 'DCDate'],
      order: [['InwardNo', 'DESC']]
    });

    res.json({
      success: true,
      data: gateInwards
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

// New: Get gate inward with details
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

    const detailRows = (gateInward.details || []).map(d => d.toJSON());
    const orderNos = [...new Set(detailRows.map(d => d.OrderNo).filter(Boolean))];

    let poTotals = { Discount: 0, GST: 0, IGST: 0, VAT_CST: 0, P_F: 0, LorryFreight: 0, RoundOff: 0 };
    let unitRateMap = new Map();

    if (orderNos.length > 0) {
      const poHeads = await PurchaseOrder.findAll({
        where: { OrderNo: { [Op.in]: orderNos } },
        attributes: ['OrderNo', 'Discount', 'GST', 'IGST', 'VAT_CST', 'P_F', 'RoundOff'],
        raw: true
      });

      poTotals = poHeads.reduce(
        (acc, po) => {
          acc.Discount += parseFloat(po.Discount) || 0;
          acc.GST += parseFloat(po.GST) || 0;
          acc.IGST += parseFloat(po.IGST) || 0;
          acc.VAT_CST += parseFloat(po.VAT_CST) || 0;
          acc.P_F += parseFloat(po.P_F) || 0;
          acc.RoundOff += parseFloat(po.RoundOff) || 0;
          return acc;
        },
        { Discount: 0, GST: 0, IGST: 0, VAT_CST: 0, P_F: 0, LorryFreight: 0, RoundOff: 0 }
      );

      const poDetails = await PurchaseOrderDetail.findAll({
        where: { OrderNo: { [Op.in]: orderNos } },
        attributes: ['OrderNo', 'ItemName', 'UnitRate', 'LorryFreight', 'TaxAmount'],
        raw: true
      });

      unitRateMap = new Map(
        poDetails.map(d => [`${d.OrderNo}::${d.ItemName}`, parseFloat(d.UnitRate) || 0])
      );

      // Accumulate item-level LorryFreight and TaxAmount to VAT_CST
      const extraLorryFreight = poDetails.reduce((sum, d) => sum + (parseFloat(d.LorryFreight) || 0), 0);
      const extraTaxAmount = poDetails.reduce((sum, d) => sum + (parseFloat(d.TaxAmount) || 0), 0);

      poTotals.LorryFreight = extraLorryFreight;
      poTotals.VAT_CST += extraTaxAmount;
    }

    const enrichedDetails = detailRows.map(d => ({
      ...d,
      UnitRate: unitRateMap.get(`${d.OrderNo}::${d.ItemName}`) || 0
    }));

    res.json({
      success: true,
      data: {
        ...gateInward.toJSON(),
        details: enrichedDetails,
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

// Get all receipts
exports.getReceipts = async (req, res) => {
  try {
    const receipts = await Receipt.findAll({
      include: [{ model: ReceiptDetail, as: 'details' }],
      order: [['GRNNo', 'DESC']]
    });

    res.json({
      success: true,
      data: receipts
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

    const existingReceiptForInward = await Receipt.findOne({
      where: { GateInwardNo }
    });
    if (existingReceiptForInward) {
      return res.status(400).json({
        success: false,
        message: 'This Gate Inward number is already used in a receipt'
      });
    }

    const orderNos = [...new Set(items.map(item => item.OrderNo).filter(Boolean))];
    const unitRateMap = await getPurchaseOrderUnitRateMap(orderNos);

    const newReceipt = await Receipt.create({
      PartyName: PartyName.trim(),
      GateInwardNo,
      InwardDate: InwardDate || gateInward.InwardDate || new Date(),
      InvoiceNo: InvoiceNo ? InvoiceNo.trim() : gateInward.InvoiceNo,
      InvoiceDate: InvoiceDate || gateInward.InvoiceDate || null,
      DCNo: DCNo ? DCNo.trim() : gateInward.DCNo,
      DCDate: DCDate || gateInward.DCDate || null,
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
