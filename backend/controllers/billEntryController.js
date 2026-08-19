const { Op } = require('sequelize');
const {
  BillEntry,
  BillEntryDetail,
  Receipt,
  ReceiptDetail,
  GateInward,
  GateInwardDetail,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseType
} = require('../models/index');

const parseDec = (val, defaultVal = 0) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
};

// Get parties that have unbilled Receipts (GRNs)
exports.getAvailableParties = async (req, res) => {
  try {
    // 1. Get all GRN numbers that are already billed
    const billedBills = await BillEntry.findAll({
      attributes: ['GRNNo'],
      raw: true
    });
    const billedGRNs = billedBills.map(b => b.GRNNo).filter(Boolean);

    // 2. Find receipts that are not already billed
    const receiptWhere = {};
    if (billedGRNs.length > 0) {
      receiptWhere.GRNNo = { [Op.notIn]: billedGRNs };
    }

    const receipts = await Receipt.findAll({
      where: receiptWhere,
      attributes: ['PartyName'],
      raw: true
    });

    const parties = [...new Set(receipts.map(r => r.PartyName ? r.PartyName.trim() : '').filter(Boolean))].sort();

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

// Get available Gate Inwards for bill entry (kept for backward compatibility)
exports.getAvailableGateInwards = async (req, res) => {
  try {
    const { partyName } = req.query;

    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    // 1. Get already billed GRNNos and GateInwardNos
    const billedBills = await BillEntry.findAll({
      attributes: ['GateInwardNo', 'GRNNo'],
      raw: true
    });
    const usedInwardNos = billedBills.map(v => v.GateInwardNo).filter(Boolean);
    const billedGRNs = billedBills.map(v => v.GRNNo).filter(Boolean);

    // 2. Find receipts for this party that are not billed
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

// Get available GRNs for party (must have a receipt and not already billed)
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
      attributes: ['GRNNo'],
      raw: true
    });
    const billedGRNs = billed.map(b => b.GRNNo).filter(Boolean);

    const receiptWhere = {
      PartyName: partyName.trim()
    };
    if (gateInwardNo) {
      receiptWhere.GateInwardNo = gateInwardNo;
    }
    if (billedGRNs.length > 0) {
      receiptWhere.GRNNo = { [Op.notIn]: billedGRNs };
    }

    const receipts = await Receipt.findAll({
      where: receiptWhere,
      attributes: ['GRNNo', 'InwardDate', 'InvoiceNo', 'BillAmount', 'GrandTotal', 'GateInwardNo'],
      include: [{
        model: ReceiptDetail,
        as: 'details',
        attributes: ['OrderNo']
      }],
      order: [['GRNNo', 'DESC']]
    });

    // Collect all orderNos and gateInwardNos across candidate receipts
    const allOrderNos = new Set();
    const allInwardNos = new Set();
    for (const r of receipts) {
      const rData = r.toJSON ? r.toJSON() : r;
      if (rData.GateInwardNo) allInwardNos.add(rData.GateInwardNo);
      for (const d of rData.details || []) {
        if (d.OrderNo) allOrderNos.add(d.OrderNo);
      }
    }

    const orConditions = [];
    if (allOrderNos.size > 0) orConditions.push({ OrderNo: { [Op.in]: Array.from(allOrderNos) } });
    if (allInwardNos.size > 0) orConditions.push({ InwardNo: { [Op.in]: Array.from(allInwardNos) } });

    const allGIs = orConditions.length > 0
      ? await GateInward.findAll({
          where: { [Op.or]: orConditions },
          include: [{ model: GateInwardDetail, as: 'details' }],
          order: [['InwardNo', 'ASC']]
        })
      : [];

    const giByOrder = new Map();
    const giByInward = new Map();
    for (const gi of allGIs) {
      const json = gi.toJSON ? gi.toJSON() : gi;
      if (gi.OrderNo) {
        if (!giByOrder.has(gi.OrderNo)) giByOrder.set(gi.OrderNo, []);
        giByOrder.get(gi.OrderNo).push(json);
      }
      giByInward.set(gi.InwardNo, json);
    }

    const available = receipts.map(r => {
      const rData = r.toJSON ? r.toJSON() : r;
      const orderNos = [...new Set((rData.details || []).map(d => d.OrderNo).filter(Boolean))];

      let linkedGIs = [];
      const seenGIs = new Set();
      for (const oNo of orderNos) {
        if (giByOrder.has(oNo)) {
          for (const gi of giByOrder.get(oNo)) {
            if (!seenGIs.has(gi.InwardNo)) {
              seenGIs.add(gi.InwardNo);
              linkedGIs.push(gi);
            }
          }
        }
      }
      if (rData.GateInwardNo && giByInward.has(rData.GateInwardNo) && !seenGIs.has(rData.GateInwardNo)) {
        seenGIs.add(rData.GateInwardNo);
        linkedGIs.push(giByInward.get(rData.GateInwardNo));
      }

      const giNos = linkedGIs.map(g => g.InwardNo);

      return {
        GRNNo: rData.GRNNo,
        InwardDate: rData.InwardDate,
        InvoiceNo: rData.InvoiceNo,
        BillAmount: rData.BillAmount,
        GrandTotal: rData.GrandTotal,
        GateInwardNo: rData.GateInwardNo,
        GateInwardNos: giNos,
        GateInwardDisplay: giNos.length > 0 ? giNos.map(n => `GI-${String(n).padStart(3, '0')}`).join(', ') : (rData.GateInwardNo ? `GI-${String(rData.GateInwardNo).padStart(3, '0')}` : ''),
        gateInwards: linkedGIs,
        batchCount: linkedGIs.length || (rData.GateInwardNo ? 1 : 0),
        OrderNos: orderNos,
        OrderNoDisplay: orderNos.length > 0 ? orderNos.map(o => `PO-${o}`).join(', ') : ''
      };
    });

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

    const receiptData = receipt.toJSON();
    const details = receiptData.details || [];

    // Collect all potential OrderNos
    const orderNos = new Set();
    details.forEach(d => { if (d.OrderNo) orderNos.add(d.OrderNo); });
    if (receiptData.GateInwardNo) {
      const gi = await GateInward.findByPk(receiptData.GateInwardNo, { raw: true });
      if (gi && gi.OrderNo) orderNos.add(gi.OrderNo);
    }

    let poDetails = [];
    if (orderNos.size > 0) {
      poDetails = await PurchaseOrderDetail.findAll({
        where: { OrderNo: { [Op.in]: Array.from(orderNos) } },
        raw: true
      });
    }

    const poMap = {};
    poDetails.forEach(poD => {
      poMap[`${poD.OrderNo}_${poD.ItemName}`] = poD;
      if (!poMap[poD.ItemName]) poMap[poD.ItemName] = poD;
    });

    receiptData.details = details.map(d => {
      const poD = poMap[`${d.OrderNo}_${d.ItemName}`] || poMap[d.ItemName] || {};
      const gstPct = parseFloat(poD.GSTPct) ||
        ((parseFloat(poD.SGSTPct) || 0) + (parseFloat(poD.CGSTPct) || 0)) ||
        (parseFloat(poD.IGSTPct) || 0);
      const isIGST = (parseFloat(poD.IGSTPct) || 0) > 0 || (parseFloat(poD.IGST) || 0) > 0;
      return {
        ...d,
        GRNNo: receiptData.GRNNo,
        GSTType: poD.GSTType || (isIGST ? `IGST [${gstPct} %]` : (gstPct > 0 ? `GST [${gstPct} %]` : 'GST [0 %]')),
        GSTPct: gstPct,
        SGSTPct: parseFloat(poD.SGSTPct) || (isIGST ? 0 : (gstPct > 0 ? gstPct / 2 : 0)),
        CGSTPct: parseFloat(poD.CGSTPct) || (isIGST ? 0 : (gstPct > 0 ? gstPct / 2 : 0)),
        IGSTPct: parseFloat(poD.IGSTPct) || (isIGST ? gstPct : 0),
        DiscountAmt: parseFloat(poD.DiscountAmt) || 0,
        DiscountPct: parseFloat(poD.DiscountPct) || 0
      };
    });

    // Fetch all Gate Inward batches linked to these POs or GateInwardNo
    const orConditions = [];
    if (orderNos.size > 0) orConditions.push({ OrderNo: { [Op.in]: Array.from(orderNos) } });
    if (receiptData.GateInwardNo) orConditions.push({ InwardNo: receiptData.GateInwardNo });

    const gateInwards = orConditions.length > 0
      ? await GateInward.findAll({
          where: { [Op.or]: orConditions },
          include: [{ model: GateInwardDetail, as: 'details' }],
          order: [['InwardNo', 'ASC']]
        })
      : [];

    receiptData.gateInwards = gateInwards.map(gi => gi.toJSON ? gi.toJSON() : gi);
    const giNos = receiptData.gateInwards.map(g => g.InwardNo);
    receiptData.GateInwardNos = giNos;
    receiptData.GateInwardDisplay = giNos.length > 0 ? giNos.map(n => `GI-${String(n).padStart(3, '0')}`).join(', ') : (receiptData.GateInwardNo ? `GI-${String(receiptData.GateInwardNo).padStart(3, '0')}` : '');

    res.json({
      success: true,
      data: receiptData
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
      GateInwardNo: (resolvedGateInwardNo === '' || resolvedGateInwardNo === null || resolvedGateInwardNo === undefined) ? null : parseInt(resolvedGateInwardNo, 10),
      GRNNo: parseInt(GRNNo, 10),
      PartyName: PartyName.trim(),
      AccDate: AccDate || new Date(),
      PartyBillNo: PartyBillNo ? PartyBillNo.trim() : null,
      BillDate: BillDate || new Date(),
      PurchaseType: PurchaseType || null,
      BillAmount: parseDec(BillAmount, 0),
      TDS: parseDec(TDS, 0),
      Narration: Narration ? Narration.trim() : null,
      Total: parseDec(Total, 0),
      Discount: parseDec(Discount, 0),
      GST: parseDec(GST, 0),
      IGST: parseDec(IGST, 0),
      VAT_CST: parseDec(VAT_CST, 0),
      P_F: parseDec(P_F, 0),
      LorryFreight: parseDec(LorryFreight, 0),
      RoundOff: parseDec(RoundOff, 0),
      TaxRndOff: parseDec(TaxRndOff, 0),
      GrandTotal: parseDec(GrandTotal, 0),
      Status: 'Billed'
    });

    // Build item-to-order map from receipt details
    const rcptDetails = await ReceiptDetail.findAll({
      where: { GRNNo },
      attributes: ['ItemName', 'OrderNo'],
      raw: true
    });
    const itemOrderMap = {};
    rcptDetails.forEach(rd => {
      if (rd.ItemName && rd.OrderNo) itemOrderMap[rd.ItemName] = rd.OrderNo;
    });
    const defaultOrderNo = rcptDetails[0]?.OrderNo || null;

    const billItems = (items && items.length > 0) ? items : [];
    for (const item of billItems) {
      const qty = parseFloat(item.Qty || item.ReceivedQty) || 0;
      const unitRate = parseFloat(item.UnitRate) || 0;
      const resolvedOrderNo = item.OrderNo || itemOrderMap[item.ItemName] || defaultOrderNo;

      await BillEntryDetail.create({
        VoucherNo: newBill.VoucherNo,
        OrderNo: resolvedOrderNo,
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
    const vNo = parseInt(voucherNo, 10);

    if (!vNo || isNaN(vNo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Voucher Number'
      });
    }

    const {
      PartyName, AccDate, PartyBillNo, BillDate, PurchaseType, BillAmount,
      TDS, Narration, Total, Discount, GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff,
      TaxRndOff, GrandTotal, items
    } = req.body;

    const billEntry = await BillEntry.findByPk(vNo);
    if (!billEntry) {
      return res.status(404).json({
        success: false,
        message: 'Bill Entry not found'
      });
    }

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

    const updateData = {
      PartyName: PartyName ? PartyName.trim() : billEntry.PartyName,
      AccDate: cleanDate(AccDate) || billEntry.AccDate || cleanDate(new Date()),
      PartyBillNo: PartyBillNo !== undefined ? (PartyBillNo ? PartyBillNo.trim() : null) : billEntry.PartyBillNo,
      BillDate: cleanDate(BillDate) || billEntry.BillDate || cleanDate(new Date()),
      PurchaseType: PurchaseType || billEntry.PurchaseType,
      BillAmount: BillAmount !== undefined ? parseDec(BillAmount, 0) : billEntry.BillAmount,
      TDS: TDS !== undefined ? parseDec(TDS, 0) : billEntry.TDS,
      Narration: Narration !== undefined ? (Narration ? Narration.trim() : null) : billEntry.Narration,
      Total: Total !== undefined ? parseDec(Total, 0) : billEntry.Total,
      Discount: Discount !== undefined ? parseDec(Discount, 0) : billEntry.Discount,
      GST: GST !== undefined ? parseDec(GST, 0) : billEntry.GST,
      IGST: IGST !== undefined ? parseDec(IGST, 0) : billEntry.IGST,
      VAT_CST: VAT_CST !== undefined ? parseDec(VAT_CST, 0) : billEntry.VAT_CST,
      P_F: P_F !== undefined ? parseDec(P_F, 0) : billEntry.P_F,
      LorryFreight: LorryFreight !== undefined ? parseDec(LorryFreight, 0) : billEntry.LorryFreight,
      RoundOff: RoundOff !== undefined ? parseDec(RoundOff, 0) : billEntry.RoundOff,
      TaxRndOff: TaxRndOff !== undefined ? parseDec(TaxRndOff, 0) : billEntry.TaxRndOff,
      GrandTotal: GrandTotal !== undefined ? parseDec(GrandTotal, 0) : billEntry.GrandTotal
    };

    await billEntry.update(updateData);

    if (items && Array.isArray(items) && items.length > 0) {
      await BillEntryDetail.destroy({ where: { VoucherNo: vNo } });

      let itemOrderMap = {};
      let defaultOrderNo = null;
      if (billEntry.GRNNo) {
        try {
          const rcptDetails = await ReceiptDetail.findAll({
            where: { GRNNo: billEntry.GRNNo },
            attributes: ['ItemName', 'OrderNo'],
            raw: true
          });
          rcptDetails.forEach(rd => {
            if (rd.ItemName && rd.OrderNo) itemOrderMap[rd.ItemName] = rd.OrderNo;
          });
          defaultOrderNo = rcptDetails[0]?.OrderNo || null;
        } catch (err) {
          console.warn('Could not query receipt details for order mapping:', err.message);
        }
      }

      for (const item of items) {
        if (!item || !item.ItemName) continue;
        const qty = parseDec(item.Qty !== undefined ? item.Qty : item.ReceivedQty, 0);
        const unitRate = parseDec(item.UnitRate, 0);
        const rawOrderNo = item.OrderNo || itemOrderMap[item.ItemName] || defaultOrderNo;
        const resolvedOrderNo = cleanOrderNo(rawOrderNo);

        await BillEntryDetail.create({
          VoucherNo: vNo,
          OrderNo: resolvedOrderNo,
          ItemName: String(item.ItemName).trim(),
          Qty: qty,
          UnitRate: unitRate,
          TotalAmount: parseDec(item.TotalAmount, qty * unitRate)
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

// Get all bill entries (including all linked Gate Inwards for each bill)
exports.getBillEntries = async (req, res) => {
  try {
    const bills = await BillEntry.findAll({
      include: [{ model: BillEntryDetail, as: 'details' }],
      order: [['VoucherNo', 'DESC']]
    });

    // Collect all GRNNos, GateInwardNos, and OrderNos from bills
    const grnNos = new Set();
    const inwardNos = new Set();
    const orderNos = new Set();

    for (const b of bills) {
      if (b.GateInwardNo) inwardNos.add(b.GateInwardNo);
      if (b.GRNNo) grnNos.add(b.GRNNo);
      for (const d of b.details || []) {
        if (d.OrderNo) orderNos.add(d.OrderNo);
      }
    }

    // Map Receipts by GRNNo
    const grnReceiptMap = new Map();
    if (grnNos.size > 0) {
      const receipts = await Receipt.findAll({
        where: { GRNNo: { [Op.in]: Array.from(grnNos) } },
        include: [{ model: ReceiptDetail, as: 'details' }]
      });
      for (const r of receipts) {
        const rJson = r.toJSON ? r.toJSON() : r;
        const rOrderNos = [...new Set((rJson.details || []).map(d => d.OrderNo).filter(Boolean))];
        const itemOrderMap = {};
        (rJson.details || []).forEach(d => {
          if (d.ItemName && d.OrderNo) itemOrderMap[d.ItemName] = d.OrderNo;
        });

        grnReceiptMap.set(rJson.GRNNo, {
          GateInwardNo: rJson.GateInwardNo,
          orderNos: rOrderNos,
          itemOrderMap
        });

        if (rJson.GateInwardNo) inwardNos.add(rJson.GateInwardNo);
        rOrderNos.forEach(o => orderNos.add(o));
      }
    }

    // Also look up GateInwards to see if any have OrderNos that weren't in orderNos
    if (inwardNos.size > 0) {
      const giRecords = await GateInward.findAll({
        where: { InwardNo: { [Op.in]: Array.from(inwardNos) } },
        attributes: ['InwardNo', 'OrderNo'],
        raw: true
      });
      for (const gi of giRecords) {
        if (gi.OrderNo) orderNos.add(gi.OrderNo);
      }
    }

    // Fetch all Gate Inwards matching any of the resolved OrderNos or InwardNos
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

    const giByOrder = new Map();
    const giByInward = new Map();
    for (const gi of gateInwards) {
      const json = gi.toJSON ? gi.toJSON() : gi;
      if (gi.OrderNo) {
        if (!giByOrder.has(gi.OrderNo)) giByOrder.set(gi.OrderNo, []);
        giByOrder.get(gi.OrderNo).push(json);
      }
      giByInward.set(gi.InwardNo, json);
    }

    const result = bills.map(b => {
      const bJson = b.toJSON ? b.toJSON() : b;
      const receiptInfo = bJson.GRNNo ? grnReceiptMap.get(bJson.GRNNo) : null;

      // Resolve all PO Order numbers for this bill
      const billOrderNos = new Set();
      (bJson.details || []).forEach(d => {
        if (d.OrderNo) billOrderNos.add(d.OrderNo);
      });
      if (receiptInfo && receiptInfo.orderNos) {
        receiptInfo.orderNos.forEach(o => billOrderNos.add(o));
      }
      if (bJson.GateInwardNo && giByInward.has(bJson.GateInwardNo)) {
        const oNo = giByInward.get(bJson.GateInwardNo)?.OrderNo;
        if (oNo) billOrderNos.add(oNo);
      }

      // Enrich details with OrderNo if missing
      const primaryOrderNo = Array.from(billOrderNos)[0] || null;
      const enrichedDetails = (bJson.details || []).map(d => {
        const itemOrderNo = d.OrderNo || (receiptInfo?.itemOrderMap && receiptInfo.itemOrderMap[d.ItemName]) || primaryOrderNo;
        return {
          ...d,
          OrderNo: itemOrderNo
        };
      });

      // Gather all linked Gate Inwards across all PO orders for this bill
      let linkedGIs = [];
      const seenGIs = new Set();

      for (const oNo of billOrderNos) {
        if (giByOrder.has(oNo)) {
          for (const gi of giByOrder.get(oNo)) {
            if (!seenGIs.has(gi.InwardNo)) {
              seenGIs.add(gi.InwardNo);
              linkedGIs.push(gi);
            }
          }
        }
      }

      if (bJson.GateInwardNo && giByInward.has(bJson.GateInwardNo) && !seenGIs.has(bJson.GateInwardNo)) {
        seenGIs.add(bJson.GateInwardNo);
        linkedGIs.push(giByInward.get(bJson.GateInwardNo));
      }

      if (receiptInfo?.GateInwardNo && giByInward.has(receiptInfo.GateInwardNo) && !seenGIs.has(receiptInfo.GateInwardNo)) {
        seenGIs.add(receiptInfo.GateInwardNo);
        linkedGIs.push(giByInward.get(receiptInfo.GateInwardNo));
      }

      // Sort linked gate inwards by InwardNo ascending
      linkedGIs.sort((x, y) => (x.InwardNo || 0) - (y.InwardNo || 0));

      return {
        ...bJson,
        details: enrichedDetails,
        OrderNo: primaryOrderNo,
        gateInwards: linkedGIs
      };
    });

    res.json({
      success: true,
      data: result
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

    const bJson = billEntry.toJSON();
    const billOrderNos = new Set((bJson.details || []).map(d => d.OrderNo).filter(Boolean));
    let receiptInfo = null;

    if (bJson.GRNNo) {
      const receipt = await Receipt.findByPk(bJson.GRNNo, {
        include: [{ model: ReceiptDetail, as: 'details' }]
      });
      if (receipt) {
        const rJson = receipt.toJSON ? receipt.toJSON() : receipt;
        (rJson.details || []).forEach(d => {
          if (d.OrderNo) billOrderNos.add(d.OrderNo);
        });
        receiptInfo = rJson;
      }
    }

    if (bJson.GateInwardNo) {
      const gi = await GateInward.findByPk(bJson.GateInwardNo, { raw: true });
      if (gi && gi.OrderNo) billOrderNos.add(gi.OrderNo);
    }

    const orConditions = [];
    if (billOrderNos.size > 0) orConditions.push({ OrderNo: { [Op.in]: Array.from(billOrderNos) } });
    if (bJson.GateInwardNo) orConditions.push({ InwardNo: bJson.GateInwardNo });
    if (receiptInfo?.GateInwardNo) orConditions.push({ InwardNo: receiptInfo.GateInwardNo });

    const gateInwards = orConditions.length > 0
      ? await GateInward.findAll({
          where: { [Op.or]: orConditions },
          include: [{ model: GateInwardDetail, as: 'details' }],
          order: [['InwardNo', 'ASC']]
        })
      : [];

    bJson.gateInwards = gateInwards.map(g => g.toJSON ? g.toJSON() : g);

    res.json({
      success: true,
      data: bJson
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

// Get bill entry print data with grouped SGST/CGST/IGST % from Purchase Order
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

    const billData = billEntry.toJSON();
    const items = billData.details || [];

    // Collect all unique OrderNos (from BillEntryDetail, GateInward, Receipt)
    const orderNos = new Set();
    items.forEach(d => { if (d.OrderNo) orderNos.add(d.OrderNo); });

    if (billData.GateInwardNo) {
      const gi = await GateInward.findByPk(billData.GateInwardNo, { raw: true });
      if (gi && gi.OrderNo) orderNos.add(gi.OrderNo);
    }
    if (billData.GRNNo) {
      const rcptDetails = await ReceiptDetail.findAll({
        where: { GRNNo: billData.GRNNo },
        attributes: ['OrderNo'],
        raw: true
      });
      rcptDetails.forEach(rd => { if (rd.OrderNo) orderNos.add(rd.OrderNo); });
    }

    // Fetch PO details
    let poDetails = [];
    if (orderNos.size > 0) {
      poDetails = await PurchaseOrderDetail.findAll({
        where: { OrderNo: { [Op.in]: Array.from(orderNos) } },
        raw: true
      });
    } else if (billData.PartyName) {
      // Fallback: search by PartyName's POs
      const partyPOs = await PurchaseOrder.findAll({
        where: { PartyName: billData.PartyName.trim() },
        attributes: ['OrderNo'],
        raw: true
      });
      const partyOrderNos = partyPOs.map(p => p.OrderNo);
      if (partyOrderNos.length > 0) {
        poDetails = await PurchaseOrderDetail.findAll({
          where: { OrderNo: { [Op.in]: partyOrderNos } },
          raw: true
        });
      }
    }

    const poMap = {};
    poDetails.forEach(poD => {
      poMap[`${poD.OrderNo}_${poD.ItemName}`] = poD;
      if (!poMap[poD.ItemName]) poMap[poD.ItemName] = poD;
    });

    // Lookup PurchaseType description/ledger
    let purchaseTypeObj = null;
    if (billData.PurchaseType) {
      purchaseTypeObj = await PurchaseType.findOne({
        where: { PurchaseType: billData.PurchaseType.trim() },
        raw: true
      });
    }
    billData.PurchaseAccountName = purchaseTypeObj?.Description || purchaseTypeObj?.PurchaseType || billData.PurchaseType || 'PURCHASE OF MATERIALS';

    const totalAmount = parseFloat(billData.Total) || 0;
    const discountAmount = parseFloat(billData.Discount) || 0;
    const pfAmount = parseFloat(billData.P_F) || 0;
    const lorryFreightAmount = parseFloat(billData.LorryFreight) || 0;
    const taxableBase = totalAmount - discountAmount + pfAmount + lorryFreightAmount;
    const gstAmount = parseFloat(billData.GST) || 0;
    const igstAmount = parseFloat(billData.IGST) || 0;

    // Group items by GST rate
    const gstBuckets = {};

    items.forEach(item => {
      const poD = poMap[`${item.OrderNo}_${item.ItemName}`] || poMap[item.ItemName] || {};
      const qty = parseFloat(item.Qty) || 0;
      const unitRate = parseFloat(item.UnitRate) || 0;
      const lineGross = qty * unitRate;
      const lineDiscount = parseFloat(poD.DiscountAmt) || 0;
      const lineBase = lineGross - lineDiscount;

      const isIGST = (parseFloat(poD.IGSTPct) || 0) > 0 || (parseFloat(poD.IGST) || 0) > 0 || (igstAmount > 0 && gstAmount === 0);

      if (isIGST) {
        let igstPct = parseFloat(poD.IGSTPct) || parseFloat(poD.GSTPct) || 0;
        if (!igstPct && igstAmount > 0 && taxableBase > 0) {
          igstPct = parseFloat(((igstAmount / taxableBase) * 100).toFixed(2));
        }
        const key = `IGST_${igstPct}`;
        if (!gstBuckets[key]) {
          gstBuckets[key] = {
            type: 'IGST',
            rate: igstPct,
            base: 0,
            taxAmt: 0
          };
        }
        gstBuckets[key].base += lineBase;
        gstBuckets[key].taxAmt += parseFloat(poD.IGST) || (lineBase * (igstPct / 100));
      } else {
        let sgstPct = parseFloat(poD.SGSTPct) || 0;
        let cgstPct = parseFloat(poD.CGSTPct) || 0;
        if (!sgstPct && !cgstPct && poD.GSTPct) {
          sgstPct = parseFloat(poD.GSTPct) / 2;
          cgstPct = parseFloat(poD.GSTPct) / 2;
        }
        if (!sgstPct && !cgstPct && gstAmount > 0 && taxableBase > 0) {
          const autoRate = parseFloat(((gstAmount / 2 / taxableBase) * 100).toFixed(2));
          sgstPct = autoRate;
          cgstPct = autoRate;
        }
        const key = `SGST_${sgstPct}`;
        if (!gstBuckets[key]) {
          gstBuckets[key] = {
            type: 'SGST_CGST',
            rate: sgstPct,
            cgstRate: cgstPct || sgstPct,
            base: 0,
            sgstAmt: 0,
            cgstAmt: 0
          };
        }
        gstBuckets[key].base += lineBase;
        gstBuckets[key].sgstAmt += parseFloat(poD.SGST) || (lineBase * (sgstPct / 100));
        gstBuckets[key].cgstAmt += parseFloat(poD.CGST) || (lineBase * (cgstPct / 100));
      }
    });

    // Fallback if no buckets populated from items
    if (Object.keys(gstBuckets).length === 0) {
      if (gstAmount > 0 && taxableBase > 0) {
        const autoRate = parseFloat(((gstAmount / 2 / taxableBase) * 100).toFixed(2));
        gstBuckets[`SGST_${autoRate}`] = {
          type: 'SGST_CGST',
          rate: autoRate,
          cgstRate: autoRate,
          base: taxableBase,
          sgstAmt: gstAmount / 2,
          cgstAmt: gstAmount / 2
        };
      }
      if (igstAmount > 0 && taxableBase > 0) {
        const autoRate = parseFloat(((igstAmount / taxableBase) * 100).toFixed(2));
        gstBuckets[`IGST_${autoRate}`] = {
          type: 'IGST',
          rate: autoRate,
          base: taxableBase,
          taxAmt: igstAmount
        };
      }
    }

    const taxBreakdown = [];
    const sgstKeys = Object.keys(gstBuckets)
      .filter(k => gstBuckets[k].type === 'SGST_CGST' && gstBuckets[k].rate > 0)
      .sort((a, b) => gstBuckets[a].rate - gstBuckets[b].rate);
    const igstKeys = Object.keys(gstBuckets)
      .filter(k => gstBuckets[k].type === 'IGST' && gstBuckets[k].rate > 0)
      .sort((a, b) => gstBuckets[a].rate - gstBuckets[b].rate);

    sgstKeys.forEach(k => {
      const b = gstBuckets[k];
      const rateStr = b.rate % 1 === 0 ? b.rate.toFixed(0) : parseFloat(b.rate.toFixed(2));
      const sgstAmt = parseFloat(b.sgstAmt.toFixed(2));
      const cgstAmt = parseFloat(b.cgstAmt.toFixed(2));
      taxBreakdown.push({
        type: 'SGST',
        rate: b.rate,
        label: `INPUT SGST ${rateStr}%`,
        amount: sgstAmt
      });
      taxBreakdown.push({
        type: 'CGST',
        rate: b.cgstRate || b.rate,
        label: `INPUT CGST ${rateStr}%`,
        amount: cgstAmt
      });
    });

    igstKeys.forEach(k => {
      const b = gstBuckets[k];
      const rateStr = b.rate % 1 === 0 ? b.rate.toFixed(0) : parseFloat(b.rate.toFixed(2));
      const taxAmt = parseFloat(b.taxAmt.toFixed(2));
      taxBreakdown.push({
        type: 'IGST',
        rate: b.rate,
        label: `INPUT IGST ${rateStr}%`,
        amount: taxAmt
      });
    });

    billData.taxBreakdown = taxBreakdown;
    // Set top percentage for backwards compatibility
    const firstSgst = taxBreakdown.find(t => t.type === 'SGST');
    const firstIgst = taxBreakdown.find(t => t.type === 'IGST');
    billData.SGSTPct = firstSgst ? firstSgst.rate : 0;
    billData.CGSTPct = firstSgst ? firstSgst.rate : 0;
    billData.IGSTPct = firstIgst ? firstIgst.rate : 0;
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
