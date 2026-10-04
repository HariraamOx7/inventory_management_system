// backend/controllers/purchaseOrderController.js
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');
const GateInward = require('../models/GateInward');
const GateInwardDetail = require('../models/GateInwardDetail');
const Receipt = require('../models/Receipt');
const ReceiptDetail = require('../models/ReceiptDetail');
const BillEntry = require('../models/BillEntry');
const BillEntryDetail = require('../models/BillEntryDetail');
const Supplier = require('../models/Supplier');
const Item = require('../models/Item');

const parseDec = (val, defaultVal = 0) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
};

const resolveLineUnitRate = (item) => {
  const qty = parseFloat(item.Qty) || 0;
  const unitRate = parseFloat(item.UnitRate) || 0;
  const totalAmount = parseFloat(item.TotalAmount) || 0;

  if (qty > 0 && totalAmount > 0 && Math.abs(totalAmount - (qty * unitRate)) > 0.005) {
    return totalAmount / qty;
  }

  return unitRate;
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

const cleanDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().split('T')[0];
};

// Some existing databases define OrderNo as a required key without
// AUTO_INCREMENT. Supplying the next value keeps those installations working
// without changing a parent column that is referenced by detail-table FKs.
// Determine the active PO series from saved records instead of trusting the
// largest value. Imported or exceptional PO numbers can be out of sequence;
// the longest consecutive run is the regular series to continue.
const getPreviousPurchaseOrderNo = async () => {
  const [rows] = await sequelize.query(
    'SELECT `OrderNo` FROM `purchase_orders` WHERE `OrderNo` > 0'
  );

  if (rows.length === 0) return 0;

  const orderNos = [...new Set(rows.map(row => BigInt(String(row.OrderNo))))]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  let currentStart = orderNos[0];
  let currentEnd = orderNos[0];
  let currentLength = 1;
  let best = { start: currentStart, end: currentEnd, length: currentLength };

  for (let index = 1; index < orderNos.length; index += 1) {
    const orderNo = orderNos[index];
    if (orderNo === currentEnd + 1n) {
      currentEnd = orderNo;
      currentLength += 1;
    } else {
      currentStart = orderNo;
      currentEnd = orderNo;
      currentLength = 1;
    }

    if (currentLength > best.length ||
      (currentLength === best.length && currentEnd > best.end)) {
      best = { start: currentStart, end: currentEnd, length: currentLength };
    }
  }

  return Number(best.end);
};

const getNextPurchaseOrderNo = async () => {
  return (await getPreviousPurchaseOrderNo()) + 1;
};

// Get last order number
exports.getLastOrderNo = async (req, res) => {
  try {
    const lastOrderNo = await getPreviousPurchaseOrderNo();
    
    res.json({
      success: true,
      data: { lastOrderNo }
    });
  } catch (error) {
    console.error('Error fetching last order number:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order number',
      error: error.message
    });
  }
};

// Get all purchase orders
exports.getPurchaseOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrder.findAll({
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName', 'Place', 'Address']
        },
        {
          model: PurchaseOrderDetail,
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
      order: [['OrderNo', 'DESC']]
    });

    const formatted = orders.map(o => {
      const plain = o.toJSON();
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
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase orders',
      error: error.message
    });
  }
};

// Get supplier by name or code to fetch address and details
exports.getSupplierByName = async (req, res) => {
  try {
    const { partyName, partyCode } = req.query;
    
    if (!partyName && !partyCode) {
      return res.status(400).json({
        success: false,
        message: 'Party name or party code is required'
      });
    }

    let supplier = null;
    if (partyCode) {
      supplier = await Supplier.findByPk(partyCode, {
        attributes: ['PartyCode', 'AccountName', 'Address', 'Place', 'PhNo', 'Email', 'ContactPerson', 'GSTNo']
      });
    } else {
      supplier = await Supplier.findOne({
        where: {
          [Op.or]: [
            { AccountName: partyName },
            { PartyCode: partyName }
          ]
        },
        attributes: ['PartyCode', 'AccountName', 'Address', 'Place', 'PhNo', 'Email', 'ContactPerson', 'GSTNo']
      });
    }

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    const data = supplier.toJSON();
    data.PartyName = data.AccountName;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier details',
      error: error.message
    });
  }
};

// Get all suppliers for dropdown
exports.getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.findAll({
      attributes: ['PartyCode', 'AccountName', 'Place', 'PhNo', 'ContactPerson', 'GSTNo', 'Address'],
      order: [['AccountName', 'ASC']]
    });
    
    res.json({
      success: true,
      data: suppliers.map(s => ({
        PartyCode: s.PartyCode,
        AccCode: s.PartyCode, // For backward compatibility
        name: (s.AccountName || '').trim(),
        AccountName: (s.AccountName || '').trim(),
        Place: (s.Place || '').trim(),
        PhNo: (s.PhNo || '').trim(),
        ContactPerson: (s.ContactPerson || '').trim(),
        GSTNo: (s.GSTNo || '').trim(),
        Address: (s.Address || '').trim()
      }))
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching suppliers',
      error: error.message
    });
  }
};

// Get all items for dropdown
exports.getItems = async (req, res) => {
  try {
    const items = await Item.findAll({
      attributes: ['ItemCode', 'ItemName', 'UnitRate'],
      order: [['ItemName', 'ASC']]
    });
    
    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching items',
      error: error.message
    });
  }
};

// Create purchase order with details
exports.createPurchaseOrder = async (req, res) => {
  try {
    const {
      OrderDate, PartyCode, PartyName, Address, Place, Remarks, RefNo, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VoltasFormat, VatWithPF
    } = req.body;

    const resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName);
    if (!resolvedPartyCode || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Party Code/Name and items are required'
      });
    }

    // Auto-compute PO summary fields from details if available
    let sumGST = 0;
    let sumDiscount = 0;
    let sumIGST = 0;
    let sumPF = 0;
    let sumRoundOff = 0;
    let sumGrandTotal = 0;
    let sumTotal = 0;

    const preparedItems = [];
    for (const item of items) {
      const itemCode = await resolveItemCode(item.ItemCode, item.ItemName);
      if (!itemCode) continue;

      const unitRate = resolveLineUnitRate(item);
      const qty = parseDec(item.Qty, 0);
      const totalAmount = parseDec(item.TotalAmount, qty * unitRate);
      const discountAmt = parseDec(item.DiscountAmt, 0);
      const sgst = parseDec(item.SGST, 0);
      const cgst = parseDec(item.CGST, 0);
      const igst = parseDec(item.IGST, 0);
      const pfAmount = parseDec(item.PF_Amount, 0);
      const roundOff = parseDec(item.RoundOff, 0);
      const grandTotal = parseDec(item.GrandTotal, 0);

      sumTotal += totalAmount;
      sumDiscount += discountAmt;
      sumGST += (sgst + cgst);
      sumIGST += igst;
      sumPF += pfAmount;
      sumRoundOff += roundOff;
      sumGrandTotal += grandTotal;

      preparedItems.push({
        ItemCode: itemCode,
        Qty: qty,
        UnitRate: unitRate,
        TotalAmount: totalAmount,
        DiscountPct: parseDec(item.DiscountPct, 0),
        DiscountAmt: discountAmt,
        GSTType: item.GSTType || null,
        GSTPct: parseDec(item.GSTPct, 0),
        SGSTPct: parseDec(item.SGSTPct, 0),
        SGST: sgst,
        CGSTPct: parseDec(item.CGSTPct, 0),
        CGST: cgst,
        IGSTPct: parseDec(item.IGSTPct, 0),
        IGST: igst,
        TaxType: item.TaxType || null,
        TaxPct: parseDec(item.TaxPct, 0),
        TaxAmount: parseDec(item.TaxAmount, 0),
        PF_Pct: parseDec(item.PF_Pct, 0),
        PF_Amount: pfAmount,
        LorryFreight: parseDec(item.LorryFreight, 0),
        RoundOff: roundOff,
        GrandTotal: grandTotal,
        MRS_No: item.MRS_No || null
      });
    }

    if (preparedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid items with valid ItemCode or ItemName are required'
      });
    }

    // Supply OrderNo explicitly for databases where the legacy schema does
    // not have AUTO_INCREMENT on this foreign-key-referenced column.
    const nextOrderNo = await getNextPurchaseOrderNo();
    const newOrder = await PurchaseOrder.create({
      OrderNo: nextOrderNo,
      OrderDate: cleanDate(OrderDate) || cleanDate(new Date()),
      PartyCode: resolvedPartyCode,
      Address: Address ? Address.trim() : null,
      Place: Place ? Place.trim() : null,
      Remarks: Remarks ? Remarks.trim() : null,
      RefNo: RefNo ? RefNo.trim() : null,
      Total: sumTotal > 0 ? sumTotal : parseDec(Total, 0),
      Discount: sumDiscount > 0 || Discount === undefined ? sumDiscount : parseDec(Discount, 0),
      GST: sumGST > 0 || GST === undefined ? sumGST : parseDec(GST, 0),
      IGST: sumIGST > 0 || IGST === undefined ? sumIGST : parseDec(IGST, 0),
      VAT_CST: parseDec(VAT_CST, 0),
      P_F: sumPF > 0 || P_F === undefined ? sumPF : parseDec(P_F, 0),
      LorryFreight: parseDec(LorryFreight, 0),
      RoundOff: sumRoundOff !== 0 || RoundOff === undefined ? sumRoundOff : parseDec(RoundOff, 0),
      GrandTotal: sumGrandTotal > 0 || GrandTotal === undefined ? sumGrandTotal : parseDec(GrandTotal, 0),
      DutyWithoutPF: DutyWithoutPF || false,
      VoltasFormat: VoltasFormat || false,
      VatWithPF: VatWithPF || false
    });

    // Create order details
    for (const detail of preparedItems) {
      await PurchaseOrderDetail.create({
        OrderNo: newOrder.OrderNo,
        ...detail
      });
    }

    res.status(201).json({
      success: true,
      message: 'Purchase Order created successfully',
      data: newOrder
    });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating purchase order',
      error: error.message
    });
  }
};

// Update purchase order
exports.updatePurchaseOrder = async (req, res) => {
  try {
    const { orderNo } = req.params;
    const oNo = parseInt(orderNo, 10);

    if (!oNo || isNaN(oNo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Order Number'
      });
    }

    const {
      OrderDate, PartyCode, PartyName, Address, Place, Remarks, RefNo, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VoltasFormat, VatWithPF
    } = req.body;

    const order = await PurchaseOrder.findByPk(oNo);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Order not found'
      });
    }

    let resolvedPartyCode = order.PartyCode;
    if (PartyCode || PartyName) {
      resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName) || order.PartyCode;
    }

    let sumGST = 0;
    let sumDiscount = 0;
    let sumIGST = 0;
    let sumPF = 0;
    let sumRoundOff = 0;
    let sumGrandTotal = 0;
    let sumTotal = 0;

    let preparedItems = null;
    if (items && Array.isArray(items) && items.length > 0) {
      preparedItems = [];
      for (const item of items) {
        const itemCode = await resolveItemCode(item.ItemCode, item.ItemName);
        if (!itemCode) continue;

        const unitRate = resolveLineUnitRate(item);
        const qty = parseDec(item.Qty, 0);
        const totalAmount = parseDec(item.TotalAmount, qty * unitRate);
        const discountAmt = parseDec(item.DiscountAmt, 0);
        const sgst = parseDec(item.SGST, 0);
        const cgst = parseDec(item.CGST, 0);
        const igst = parseDec(item.IGST, 0);
        const pfAmount = parseDec(item.PF_Amount, 0);
        const roundOff = parseDec(item.RoundOff, 0);
        const grandTotal = parseDec(item.GrandTotal, 0);

        sumTotal += totalAmount;
        sumDiscount += discountAmt;
        sumGST += (sgst + cgst);
        sumIGST += igst;
        sumPF += pfAmount;
        sumRoundOff += roundOff;
        sumGrandTotal += grandTotal;

        preparedItems.push({
          OrderNo: oNo,
          ItemCode: itemCode,
          Qty: qty,
          UnitRate: unitRate,
          TotalAmount: totalAmount,
          DiscountPct: parseDec(item.DiscountPct, 0),
          DiscountAmt: discountAmt,
          GSTType: item.GSTType || null,
          GSTPct: parseDec(item.GSTPct, 0),
          SGSTPct: parseDec(item.SGSTPct, 0),
          SGST: sgst,
          CGSTPct: parseDec(item.CGSTPct, 0),
          CGST: cgst,
          IGSTPct: parseDec(item.IGSTPct, 0),
          IGST: igst,
          TaxType: item.TaxType || null,
          TaxPct: parseDec(item.TaxPct, 0),
          TaxAmount: parseDec(item.TaxAmount, 0),
          PF_Pct: parseDec(item.PF_Pct, 0),
          PF_Amount: pfAmount,
          LorryFreight: parseDec(item.LorryFreight, 0),
          RoundOff: roundOff,
          GrandTotal: grandTotal,
          MRS_No: item.MRS_No || null
        });
      }
    }

    await order.update({
      OrderDate: cleanDate(OrderDate) || order.OrderDate || cleanDate(new Date()),
      PartyCode: resolvedPartyCode,
      Address: Address !== undefined ? (Address ? Address.trim() : null) : order.Address,
      Place: Place !== undefined ? (Place ? Place.trim() : null) : order.Place,
      Remarks: Remarks !== undefined ? (Remarks ? Remarks.trim() : null) : order.Remarks,
      RefNo: RefNo !== undefined ? (RefNo ? RefNo.trim() : null) : order.RefNo,
      Total: preparedItems ? sumTotal : (Total !== undefined ? parseDec(Total, 0) : order.Total),
      Discount: preparedItems ? sumDiscount : (Discount !== undefined ? parseDec(Discount, 0) : order.Discount),
      GST: preparedItems ? sumGST : (GST !== undefined ? parseDec(GST, 0) : order.GST),
      IGST: preparedItems ? sumIGST : (IGST !== undefined ? parseDec(IGST, 0) : order.IGST),
      VAT_CST: VAT_CST !== undefined ? parseDec(VAT_CST, 0) : order.VAT_CST,
      P_F: preparedItems ? sumPF : (P_F !== undefined ? parseDec(P_F, 0) : order.P_F),
      LorryFreight: LorryFreight !== undefined ? parseDec(LorryFreight, 0) : order.LorryFreight,
      RoundOff: preparedItems ? sumRoundOff : (RoundOff !== undefined ? parseDec(RoundOff, 0) : order.RoundOff),
      GrandTotal: preparedItems ? sumGrandTotal : (GrandTotal !== undefined ? parseDec(GrandTotal, 0) : order.GrandTotal),
      DutyWithoutPF: DutyWithoutPF !== undefined ? !!DutyWithoutPF : order.DutyWithoutPF,
      VoltasFormat: VoltasFormat !== undefined ? !!VoltasFormat : order.VoltasFormat,
      VatWithPF: VatWithPF !== undefined ? !!VatWithPF : order.VatWithPF
    });

    // Update order details if provided
    if (preparedItems) {
      await PurchaseOrderDetail.destroy({ where: { OrderNo: oNo } });
      for (const item of preparedItems) {
        await PurchaseOrderDetail.create(item);
      }

      // Recalculate PO status (ordered qty may have changed)
      const { recalcPOStatus } = require('./gateInwardController');
      await recalcPOStatus(oNo);
    }

    res.json({
      success: true,
      message: 'Purchase Order updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating purchase order',
      error: error.message
    });
  }
};

// Delete purchase order
exports.deletePurchaseOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { orderNo } = req.params;
    
    const order = await PurchaseOrder.findByPk(orderNo, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Purchase Order not found'
      });
    }

    const gateInwards = await GateInward.findAll({
      where: { OrderNo: orderNo },
      attributes: ['InwardNo'],
      raw: true,
      transaction: t
    });
    const inwardNos = gateInwards.map(row => row.InwardNo);

    const inwardDetails = inwardNos.length > 0
      ? await GateInwardDetail.findAll({
          where: { InwardNo: { [Op.in]: inwardNos } },
          attributes: ['ItemCode', 'ReceivedQty'],
          raw: true,
          transaction: t
        })
      : [];

    const receipts = inwardNos.length > 0
      ? await Receipt.findAll({
          where: { GateInwardNo: { [Op.in]: inwardNos } },
          attributes: ['GRNNo'],
          raw: true,
          transaction: t
        })
      : [];
    const grnNos = receipts.map(row => row.GRNNo);

    const billEntries = grnNos.length > 0
      ? await BillEntry.findAll({
          where: { GRNNo: { [Op.in]: grnNos } },
          attributes: ['VoucherNo'],
          raw: true,
          transaction: t
        })
      : [];
    const voucherNos = billEntries.map(row => row.VoucherNo);

    if (voucherNos.length > 0) {
      await BillEntryDetail.destroy({ where: { VoucherNo: { [Op.in]: voucherNos } }, transaction: t });
      await BillEntry.destroy({ where: { VoucherNo: { [Op.in]: voucherNos } }, transaction: t });
    }

    if (grnNos.length > 0) {
      await ReceiptDetail.destroy({ where: { GRNNo: { [Op.in]: grnNos } }, transaction: t });
      await Receipt.destroy({ where: { GRNNo: { [Op.in]: grnNos } }, transaction: t });
    }

    if (inwardNos.length > 0) {
      for (const detail of inwardDetails) {
        const receivedQty = parseFloat(detail.ReceivedQty) || 0;
        if (!detail.ItemCode || receivedQty === 0) continue;

        const itemRecord = await Item.findByPk(detail.ItemCode, { transaction: t });
        if (!itemRecord) continue;

        const currentQty = parseFloat(itemRecord.Quantity ?? itemRecord.OpeningQty) || 0;
        const currentOpeningQty = parseFloat(itemRecord.OpeningQty) || 0;
        await itemRecord.update({
          Quantity: currentQty - receivedQty,
          OpeningQty: currentOpeningQty - receivedQty
        }, { transaction: t });
      }

      await GateInwardDetail.destroy({ where: { InwardNo: { [Op.in]: inwardNos } }, transaction: t });
      await GateInward.destroy({ where: { InwardNo: { [Op.in]: inwardNos } }, transaction: t });
    }

    await PurchaseOrderDetail.destroy({ where: { OrderNo: orderNo }, transaction: t });
    await order.destroy({ transaction: t });

    await t.commit();

    res.json({
      success: true,
      message: 'Purchase Order deleted successfully'
    });
  } catch (error) {
    try {
      await t.rollback();
    } catch (rollbackError) {
      console.error('Error rolling back purchase order delete transaction:', rollbackError);
    }
    console.error('Error deleting purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting purchase order',
      error: error.message
    });
  }
};

// Get single purchase order with details by OrderNo
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const { orderNo } = req.params;

    const purchaseOrder = await PurchaseOrder.findByPk(orderNo, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['PartyCode', 'AccountName', 'Address', 'Place', 'PhNo', 'Email', 'ContactPerson', 'GSTNo']
        },
        {
          model: PurchaseOrderDetail,
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

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    const plain = purchaseOrder.toJSON();
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
    console.error('Error fetching purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase order',
      error: error.message
    });
  }
};
