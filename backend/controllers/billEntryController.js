const { Op } = require('sequelize');
const BillEntry = require('../models/BillEntry');
const BillEntryDetail = require('../models/BillEntryDetail');
const Receipt = require('../models/Receipt');
const ReceiptDetail = require('../models/ReceiptDetail');
const GateInward = require('../models/GateInward');
const GateInwardDetail = require('../models/GateInwardDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');

// Get parties that have created entry at Gate Inward AND Receipt, and not created Bill Entry
exports.getAvailableParties = async (req, res) => {
  try {
    // 1. Get all GRN numbers and Gate Inward numbers that are already billed
    const billedBills = await BillEntry.findAll({
      attributes: ['GRNNo', 'GateInwardNo'],
      raw: true
    });
    const billedGRNs = billedBills.map(b => b.GRNNo).filter(Boolean);
    const billedInwards = billedBills.map(b => b.GateInwardNo).filter(Boolean);

    // 2. Find receipts that have a valid GateInwardNo and are not already billed
    const receiptWhere = {
      GateInwardNo: { [Op.ne]: null }
    };
    if (billedGRNs.length > 0) {
      receiptWhere.GRNNo = { [Op.notIn]: billedGRNs };
    }
    if (billedInwards.length > 0) {
      receiptWhere.GateInwardNo = { [Op.and]: [{ [Op.ne]: null }, { [Op.notIn]: billedInwards }] };
    }

    const receipts = await Receipt.findAll({
      where: receiptWhere,
      attributes: ['PartyName', 'GateInwardNo'],
      raw: true
    });

    const inwardNos = [...new Set(receipts.map(r => r.GateInwardNo).filter(Boolean))];

    // 3. Verify that the Gate Inward record actually exists in GateInward
    let validInwardSet = new Set();
    if (inwardNos.length > 0) {
      const validInwards = await GateInward.findAll({
        where: { InwardNo: { [Op.in]: inwardNos } },
        attributes: ['InwardNo'],
        raw: true
      });
      validInwardSet = new Set(validInwards.map(gi => gi.InwardNo));
    }

    // Filter receipts to only those with valid Gate Inwards
    const validReceipts = receipts.filter(r => validInwardSet.has(r.GateInwardNo));

    const parties = [...new Set(validReceipts.map(r => r.PartyName ? r.PartyName.trim() : '').filter(Boolean))].sort();

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

// Get available Gate Inwards for bill entry (must have a receipt and not already billed)
exports.getAvailableGateInwards = async (req, res) => {
  try {
    const { partyName } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    // 1. Get already billed GateInwardNos and GRNNos
    const billedBills = await BillEntry.findAll({
      attributes: ['GateInwardNo', 'GRNNo'],
      raw: true
    });
    const usedInwardNos = billedBills.map(v => v.GateInwardNo).filter(Boolean);
    const billedGRNs = billedBills.map(v => v.GRNNo).filter(Boolean);

    // 2. Find receipts for this party that have a GateInwardNo and are not billed
    const receiptWhere = {
      PartyName: partyName.trim(),
      GateInwardNo: { [Op.ne]: null }
    };
    if (billedGRNs.length > 0) {
      receiptWhere.GRNNo = { [Op.notIn]: billedGRNs };
    }
    if (usedInwardNos.length > 0) {
      receiptWhere.GateInwardNo = { [Op.and]: [{ [Op.ne]: null }, { [Op.notIn]: usedInwardNos }] };
    }

    const receipts = await Receipt.findAll({
      where: receiptWhere,
      attributes: ['GateInwardNo'],
      raw: true
    });
    const candidateInwardNos = [...new Set(receipts.map(r => r.GateInwardNo).filter(Boolean))];

    if (candidateInwardNos.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 3. Find matching GateInward records
    const gateInwards = await GateInward.findAll({
      where: {
        InwardNo: { [Op.in]: candidateInwardNos },
        PartyName: partyName.trim()
      },
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

// Get available GRNs for party and selected gate inward (must be linked to GateInward and not billed)
exports.getAvailableGRNs = async (req, res) => {
  try {
    const { partyName, gateInwardNo } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    const billed = await BillEntry.findAll({
      attributes: ['GRNNo', 'GateInwardNo'],
      raw: true
    });
    const billedGRNs = billed.map(b => b.GRNNo).filter(Boolean);
    const billedInwards = billed.map(b => b.GateInwardNo).filter(Boolean);

    const receiptWhere = {
      PartyName: partyName.trim(),
      GateInwardNo: { [Op.ne]: null }
    };
    if (gateInwardNo) {
      receiptWhere.GateInwardNo = gateInwardNo;
    } else if (billedInwards.length > 0) {
      receiptWhere.GateInwardNo = { [Op.and]: [{ [Op.ne]: null }, { [Op.notIn]: billedInwards }] };
    }

    if (billedGRNs.length > 0) {
      receiptWhere.GRNNo = { [Op.notIn]: billedGRNs };
    }

    const receipts = await Receipt.findAll({
      where: receiptWhere,
      attributes: ['GRNNo', 'InwardDate', 'InvoiceNo', 'BillAmount', 'GrandTotal', 'GateInwardNo'],
      order: [['GRNNo', 'DESC']],
      raw: true
    });

    // Verify GateInward exists for each receipt
    const inwardNos = receipts.map(r => r.GateInwardNo).filter(Boolean);
    const existingInwards = inwardNos.length > 0
      ? await GateInward.findAll({
          where: { InwardNo: { [Op.in]: inwardNos } },
          attributes: ['InwardNo'],
          raw: true
        })
      : [];
    const validInwardSet = new Set(existingInwards.map(g => g.InwardNo));

    const available = receipts.filter(r => validInwardSet.has(r.GateInwardNo));

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

    // Check for duplicate PartyBillNo per party (skip if blank)
    if (PartyBillNo && PartyBillNo.trim()) {
      const duplicateBill = await BillEntry.findOne({
        where: { PartyName: PartyName.trim(), PartyBillNo: PartyBillNo.trim() }
      });
      if (duplicateBill) {
        // Build chain info for frontend confirmation flow
        const dupReceipt = duplicateBill.GRNNo
          ? await Receipt.findByPk(duplicateBill.GRNNo, { raw: true })
          : null;
        const dupGateInward = duplicateBill.GateInwardNo
          ? await GateInward.findByPk(duplicateBill.GateInwardNo, { raw: true })
          : null;
        const dupPO = dupGateInward
          ? await PurchaseOrder.findByPk(dupGateInward.OrderNo, { raw: true })
          : null;

        return res.status(409).json({
          success: false,
          message: `A bill entry already exists for party "${PartyName.trim()}" with bill number "${PartyBillNo.trim()}".`,
          duplicate: {
            VoucherNo: duplicateBill.VoucherNo,
            PartyName: duplicateBill.PartyName,
            PartyBillNo: duplicateBill.PartyBillNo,
            GRNNo: duplicateBill.GRNNo,
            GateInwardNo: duplicateBill.GateInwardNo,
            OrderNo: dupGateInward ? dupGateInward.OrderNo : null,
            hasReceipt: !!dupReceipt,
            hasGateInward: !!dupGateInward,
            hasPurchaseOrder: !!dupPO
          }
        });
      }
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

// Check for duplicate bill entry by PartyName + PartyBillNo
exports.checkDuplicateBillEntry = async (req, res) => {
  try {
    const { partyName, partyBillNo } = req.query;

    if (!partyName || !partyBillNo) {
      return res.json({ success: true, duplicate: null });
    }

    const duplicateBill = await BillEntry.findOne({
      where: { PartyName: partyName.trim(), PartyBillNo: partyBillNo.trim() }
    });

    if (!duplicateBill) {
      return res.json({ success: true, duplicate: null });
    }

    const dupGateInward = duplicateBill.GateInwardNo
      ? await GateInward.findByPk(duplicateBill.GateInwardNo, { raw: true })
      : null;

    res.json({
      success: true,
      duplicate: {
        VoucherNo: duplicateBill.VoucherNo,
        PartyName: duplicateBill.PartyName,
        PartyBillNo: duplicateBill.PartyBillNo,
        GRNNo: duplicateBill.GRNNo,
        GateInwardNo: duplicateBill.GateInwardNo,
        OrderNo: dupGateInward ? dupGateInward.OrderNo : null
      }
    });
  } catch (error) {
    console.error('Error checking duplicate bill:', error);
    res.status(500).json({ success: false, message: 'Error checking duplicate', error: error.message });
  }
};

// Cascade-delete a duplicate bill entry chain
// Body: { layers: { bill: true, receipt: true, gateInward: true, purchaseOrder: true } }
exports.deleteBillChain = async (req, res) => {
  try {
    const { voucherNo } = req.params;
    const layers = req.body?.layers || {};

    const billEntry = await BillEntry.findByPk(voucherNo);
    if (!billEntry) {
      return res.status(404).json({ success: false, message: 'Bill Entry not found' });
    }

    const deletedLayers = [];

    // Layer 1: Delete BillEntry + Details
    if (layers.bill) {
      await BillEntryDetail.destroy({ where: { VoucherNo: voucherNo } });
      await billEntry.destroy();
      deletedLayers.push('BillEntry');
    }

    // Layer 2: Delete Receipt (GRN) + Details
    if (layers.receipt && billEntry.GRNNo) {
      await ReceiptDetail.destroy({ where: { GRNNo: billEntry.GRNNo } });
      await Receipt.destroy({ where: { GRNNo: billEntry.GRNNo } });
      deletedLayers.push('Receipt');
    }

    // Layer 3: Delete GateInward + Details
    if (layers.gateInward && billEntry.GateInwardNo) {
      await GateInwardDetail.destroy({ where: { InwardNo: billEntry.GateInwardNo } });
      const gateInward = await GateInward.findByPk(billEntry.GateInwardNo);
      if (gateInward) {
        await gateInward.destroy();
        deletedLayers.push('GateInward');
      }
    }

    // Layer 4: Delete PurchaseOrder + Details (only if not used by any other GateInward)
    if (layers.purchaseOrder && billEntry.GateInwardNo) {
      const gi = await GateInward.findByPk(billEntry.GateInwardNo);
      const orderNo = gi ? gi.OrderNo : null;
      if (orderNo) {
        // Check no other gate inwards reference this PO
        const otherGI = await GateInwardDetail.findOne({
          where: { OrderNo: orderNo, InwardNo: { [Op.ne]: billEntry.GateInwardNo } }
        });
        if (!otherGI) {
          await PurchaseOrderDetail.destroy({ where: { OrderNo: orderNo } });
          await PurchaseOrder.destroy({ where: { OrderNo: orderNo } });
          deletedLayers.push('PurchaseOrder');
        }
      }
    }

    res.json({
      success: true,
      message: `Deleted: ${deletedLayers.join(', ')}`,
      deletedLayers
    });
  } catch (error) {
    console.error('Error deleting bill chain:', error);
    res.status(500).json({ success: false, message: 'Error deleting bill chain', error: error.message });
  }
};
