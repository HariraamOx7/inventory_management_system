const { Op } = require('sequelize');
const BillEntry = require('../models/BillEntry');
const BillEntryDetail = require('../models/BillEntryDetail');
const Receipt = require('../models/Receipt');
const ReceiptDetail = require('../models/ReceiptDetail');
const GateInward = require('../models/GateInward');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');

// Get parties that have at least one un-billed GRN
exports.getAvailableParties = async (req, res) => {
  try {
    // Get all GRN numbers that are already billed
    const billed = await BillEntry.findAll({
      attributes: ['GRNNo'],
      group: ['GRNNo'],
      raw: true
    });
    const billedGRNs = billed.map(b => b.GRNNo).filter(Boolean);

    // Get distinct PartyNames from Receipts that have at least one unbilled GRN
    const whereClause = billedGRNs.length > 0
      ? { GRNNo: { [Op.notIn]: billedGRNs } }
      : {};

    const receipts = await Receipt.findAll({
      where: whereClause,
      attributes: ['PartyName'],
      group: ['PartyName'],
      raw: true
    });

    const parties = receipts
      .map(r => r.PartyName)
      .filter(Boolean)
      .sort();

    res.json({ success: true, data: parties });
  } catch (error) {
    console.error('Error fetching available parties:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available parties',
      error: error.message
    });
  }
};

// Get available Gate Inwards for bill entry
exports.getAvailableGateInwards = async (req, res) => {
  try {
    const { partyName } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    const usedVouchers = await BillEntry.findAll({
      attributes: ['GateInwardNo'],
      group: ['GateInwardNo'],
      raw: true
    });
    const usedInwardNos = usedVouchers.map(v => v.GateInwardNo).filter(Boolean);

    const whereClause = { PartyName: partyName.trim() };
    if (usedInwardNos.length > 0) {
      whereClause.InwardNo = { [Op.notIn]: usedInwardNos };
    }

    const gateInwards = await GateInward.findAll({
      where: whereClause,
      attributes: ['InwardNo', 'InwardDate'],
      order: [['InwardNo', 'DESC']],
      raw: true
    });

    res.json({
      success: true,
      data: gateInwards
    });
  } catch (error) {
    console.error('Error fetching available gate inwards:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching gate inwards',
      error: error.message
    });
  }
};

// Get available GRNs for party and selected gate inward
exports.getAvailableGRNs = async (req, res) => {
  try {
    const { partyName, gateInwardNo } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    const receiptWhere = { PartyName: partyName };
    if (gateInwardNo) receiptWhere.GateInwardNo = gateInwardNo;

    const receipts = await Receipt.findAll({
      where: receiptWhere,
      attributes: ['GRNNo', 'InwardDate', 'InvoiceNo', 'BillAmount', 'GateInwardNo'],
      order: [['GRNNo', 'DESC']],
      raw: true
    });

    const billed = await BillEntry.findAll({
      attributes: ['GRNNo'],
      group: ['GRNNo'],
      raw: true
    });
    const billedGRNs = billed.map(b => b.GRNNo);

    const available = receipts.filter(r => !billedGRNs.includes(r.GRNNo));

    res.json({
      success: true,
      data: available
    });
  } catch (error) {
    console.error('Error fetching available GRNs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching GRNs',
      error: error.message
    });
  }
};

// Get receipt details by GRN number
exports.getGRNDetails = async (req, res) => {
  try {
    const { grnNo } = req.query;

    if (!grnNo) {
      return res.status(400).json({
        success: false,
        message: 'GRN number is required'
      });
    }

    const receipt = await Receipt.findByPk(grnNo, {
      include: [{ model: ReceiptDetail, as: 'details' }]
    });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    res.json({
      success: true,
      data: receipt
    });
  } catch (error) {
    console.error('Error fetching GRN details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching GRN details',
      error: error.message
    });
  }
};

// Get last voucher number
exports.getLastVoucherNo = async (req, res) => {
  try {
    const lastBill = await BillEntry.findOne({
      order: [['VoucherNo', 'DESC']]
    });

    res.json({
      success: true,
      data: { lastVoucherNo: lastBill ? lastBill.VoucherNo : 0 }
    });
  } catch (error) {
    console.error('Error fetching last voucher number:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching voucher number',
      error: error.message
    });
  }
};

// Create bill entry with voucher = gate inward number
exports.createBillEntry = async (req, res) => {
  try {
    const {
      GateInwardNo: rawGateInwardNo, GRNNo, PartyName, AccDate, PartyBillNo, BillDate,
      PurchaseType, BillAmount, TDS, Narration, Total, Discount, GST,
      IGST, VAT_CST, P_F, LorryFreight, RoundOff, TaxRndOff, GrandTotal, items
    } = req.body;

    if (!GRNNo || !PartyName) {
      return res.status(400).json({
        success: false,
        message: 'GRN number and party name are required'
      });
    }

    // Resolve GRN and auto-fill GateInwardNo if not provided
    const receipt = await Receipt.findOne({
      where: { GRNNo, PartyName: PartyName.trim() }
    });
    if (!receipt) {
      return res.status(400).json({
        success: false,
        message: 'Selected GRN does not exist for this party'
      });
    }

    const resolvedGateInwardNo = rawGateInwardNo || receipt.GateInwardNo;

    // Check GRN not already billed
    const existingByGRN = await BillEntry.findOne({ where: { GRNNo } });
    if (existingByGRN) {
      return res.status(400).json({
        success: false,
        message: 'This GRN is already billed'
      });
    }

    // Generate next VoucherNo
    const lastBill = await BillEntry.findOne({ order: [['VoucherNo', 'DESC']] });
    const nextVoucherNo = lastBill ? lastBill.VoucherNo + 1 : 1;

    const newBill = await BillEntry.create({
      VoucherNo: nextVoucherNo,
      GateInwardNo: resolvedGateInwardNo || null,
      GRNNo,
      PartyName: PartyName.trim(),
      AccDate: AccDate || new Date(),
      PartyBillNo: PartyBillNo ? PartyBillNo.trim() : null,
      BillDate: BillDate || new Date(),
      PurchaseType: PurchaseType || null,
      BillAmount: BillAmount || 0,
      TDS: TDS || 0,
      Narration: Narration || null,
      Total: Total || 0,
      Discount: Discount || 0,
      GST: GST || 0,
      IGST: IGST || 0,
      VAT_CST: VAT_CST || 0,
      P_F: P_F || 0,
      LorryFreight: LorryFreight || 0,
      RoundOff: RoundOff || 0,
      TaxRndOff: TaxRndOff || 0,
      GrandTotal: GrandTotal || 0,
      Status: 'Billed'
    });

    const billItems = (items && items.length > 0) ? items : [];
    for (const item of billItems) {
      const qty = parseFloat(item.Qty || item.ReceivedQty) || 0;
      const unitRate = parseFloat(item.UnitRate) || 0;
      await BillEntryDetail.create({
        VoucherNo: newBill.VoucherNo,
        OrderNo: item.OrderNo || null,
        ItemName: item.ItemName,
        Qty: qty,
        UnitRate: unitRate,
        TotalAmount: item.TotalAmount || (qty * unitRate)
      });
    }

    res.status(201).json({
      success: true,
      message: 'Bill Entry created successfully',
      data: newBill
    });
  } catch (error) {
    console.error('Error creating bill entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bill entry',
      error: error.message
    });
  }
};

// Update bill entry
exports.updateBillEntry = async (req, res) => {
  try {
    const { voucherNo } = req.params;
    const {
      PartyName, AccDate, PartyBillNo, BillDate, PurchaseType, BillAmount,
      TDS, Narration, Total, Discount, GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff,
      TaxRndOff, GrandTotal, items
    } = req.body;

    const billEntry = await BillEntry.findByPk(voucherNo);
    if (!billEntry) {
      return res.status(404).json({
        success: false,
        message: 'Bill Entry not found'
      });
    }

    await billEntry.update({
      PartyName: PartyName ? PartyName.trim() : billEntry.PartyName,
      AccDate: AccDate || billEntry.AccDate,
      PartyBillNo: PartyBillNo ? PartyBillNo.trim() : billEntry.PartyBillNo,
      BillDate: BillDate || billEntry.BillDate,
      PurchaseType: PurchaseType || billEntry.PurchaseType,
      BillAmount: BillAmount !== undefined ? BillAmount : billEntry.BillAmount,
      TDS: TDS !== undefined ? TDS : billEntry.TDS,
      Narration: Narration !== undefined ? Narration : billEntry.Narration,
      Total: Total !== undefined ? Total : billEntry.Total,
      Discount: Discount !== undefined ? Discount : billEntry.Discount,
      GST: GST !== undefined ? GST : billEntry.GST,
      IGST: IGST !== undefined ? IGST : billEntry.IGST,
      VAT_CST: VAT_CST !== undefined ? VAT_CST : billEntry.VAT_CST,
      P_F: P_F !== undefined ? P_F : billEntry.P_F,
      LorryFreight: LorryFreight !== undefined ? LorryFreight : billEntry.LorryFreight,
      RoundOff: RoundOff !== undefined ? RoundOff : billEntry.RoundOff,
      TaxRndOff: TaxRndOff !== undefined ? TaxRndOff : billEntry.TaxRndOff,
      GrandTotal: GrandTotal !== undefined ? GrandTotal : billEntry.GrandTotal
    });

    if (items && items.length > 0) {
      await BillEntryDetail.destroy({ where: { VoucherNo: voucherNo } });

      for (const item of items) {
        const qty = item.Qty || 0;
        const unitRate = item.UnitRate || 0;
        await BillEntryDetail.create({
          VoucherNo: voucherNo,
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
      message: 'Bill Entry updated successfully',
      data: billEntry
    });
  } catch (error) {
    console.error('Error updating bill entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating bill entry',
      error: error.message
    });
  }
};

// Delete bill entry
exports.deleteBillEntry = async (req, res) => {
  try {
    const { voucherNo } = req.params;

    const billEntry = await BillEntry.findByPk(voucherNo);
    if (!billEntry) {
      return res.status(404).json({
        success: false,
        message: 'Bill Entry not found'
      });
    }

    await BillEntryDetail.destroy({ where: { VoucherNo: voucherNo } });
    await billEntry.destroy();

    res.json({
      success: true,
      message: 'Bill Entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bill entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting bill entry',
      error: error.message
    });
  }
};

// Get all bill entries
exports.getBillEntries = async (req, res) => {
  try {
    const bills = await BillEntry.findAll({
      include: [{ model: BillEntryDetail, as: 'details' }],
      order: [['VoucherNo', 'DESC']]
    });

    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching bill entries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bill entries',
      error: error.message
    });
  }
};

// Get bill entry by voucher number
exports.getBillEntry = async (req, res) => {
  try {
    const { voucherNo } = req.params;

    const billEntry = await BillEntry.findByPk(voucherNo, {
      include: [{ model: BillEntryDetail, as: 'details' }]
    });

    if (!billEntry) {
      return res.status(404).json({
        success: false,
        message: 'Bill Entry not found'
      });
    }

    res.json({
      success: true,
      data: billEntry
    });
  } catch (error) {
    console.error('Error fetching bill entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bill entry',
      error: error.message
    });
  }
};

// Get bill entries by party
exports.getBillEntriesByParty = async (req, res) => {
  try {
    const { partyName } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    const bills = await BillEntry.findAll({
      where: { PartyName: partyName },
      include: [{ model: BillEntryDetail, as: 'details' }],
      order: [['VoucherNo', 'DESC']]
    });

    res.json({
      success: true,
      data: bills
    });
  } catch (error) {
    console.error('Error fetching bill entries by party:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bill entries',
      error: error.message
    });
  }
};

// Get bill entry print data with SGST/CGST % from Purchase Order
exports.getPrintData = async (req, res) => {
  try {
    const { voucherNo } = req.params;

    const billEntry = await BillEntry.findByPk(voucherNo, {
      include: [{ model: BillEntryDetail, as: 'details' }]
    });

    if (!billEntry) {
      return res.status(404).json({
        success: false,
        message: 'Bill Entry not found'
      });
    }

    // Collect unique OrderNos from bill details
    const orderNos = [...new Set(
      (billEntry.details || [])
        .map(d => d.OrderNo)
        .filter(Boolean)
    )];

    // Fetch SGST/CGST/IGST percentages from PurchaseOrderDetail
    let sgstPct = 0, cgstPct = 0, igstPct = 0;
    if (orderNos.length > 0) {
      const poDetails = await PurchaseOrderDetail.findAll({
        where: { OrderNo: { [Op.in]: orderNos } },
        attributes: ['SGSTPct', 'CGSTPct', 'IGSTPct'],
        raw: true
      });

      if (poDetails.length > 0) {
        // Use the first non-zero percentage found
        const detail = poDetails.find(d =>
          (parseFloat(d.SGSTPct) || 0) > 0 ||
          (parseFloat(d.CGSTPct) || 0) > 0 ||
          (parseFloat(d.IGSTPct) || 0) > 0
        ) || poDetails[0];
        sgstPct = parseFloat(detail.SGSTPct) || 0;
        cgstPct = parseFloat(detail.CGSTPct) || 0;
        igstPct = parseFloat(detail.IGSTPct) || 0;
      }
    }

    const billData = billEntry.toJSON();

    const totalAmount = parseFloat(billData.Total) || 0;
    const discountAmount = parseFloat(billData.Discount) || 0;
    const pfAmount = parseFloat(billData.P_F) || 0;
    const lorryFreightAmount = parseFloat(billData.LorryFreight) || 0;
    const taxableBase = totalAmount - discountAmount + pfAmount + lorryFreightAmount;

    const gstAmount = parseFloat(billData.GST) || 0;
    const igstAmount = parseFloat(billData.IGST) || 0;

    // Fallback: Calculate percentages from amounts if missing
    if (gstAmount > 0 && taxableBase > 0) {
      if (!sgstPct) sgstPct = parseFloat(((gstAmount / 2 / taxableBase) * 100).toFixed(2));
      if (!cgstPct) cgstPct = parseFloat(((gstAmount / 2 / taxableBase) * 100).toFixed(2));
    }

    if (igstAmount > 0 && taxableBase > 0) {
      if (!igstPct) igstPct = parseFloat(((igstAmount / taxableBase) * 100).toFixed(2));
    }

    billData.SGSTPct = sgstPct;
    billData.CGSTPct = cgstPct;
    billData.IGSTPct = igstPct;
    // Calculate SGST and CGST amounts (split GST 50/50)
    billData.SGSTAmount = parseFloat((gstAmount / 2).toFixed(2));
    billData.CGSTAmount = parseFloat((gstAmount / 2).toFixed(2));

    res.json({
      success: true,
      data: billData
    });
  } catch (error) {
    console.error('Error fetching print data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching print data',
      error: error.message
    });
  }
};
