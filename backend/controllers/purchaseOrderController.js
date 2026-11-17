const errorStatus = require('../services/errorStatus');
const validateTransactionItems = require('../services/validateTransactionItems');
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

  // UnitRate is the value explicitly entered for this PO line. Do not let a
  // stale client-side TotalAmount silently change a user-entered rate.
  const hasSubmittedUnitRate = item.UnitRate !== undefined
    && item.UnitRate !== null
    && item.UnitRate !== '';
  if (hasSubmittedUnitRate) return Number.isFinite(unitRate) ? unitRate : 0;

  // Imported/legacy rows may omit UnitRate but still have a line amount.
  if (qty > 0 && totalAmount > 0) {
    return totalAmount / qty;
  }

  return unitRate;
};

const resolvePartyCode = async (partyCode, partyName) => {
  if (partyCode && String(partyCode).trim()) {
    const supplier = await Supplier.findByPk(String(partyCode).trim());
    return supplier ? supplier.PartyCode : null;
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
    return null;
  }
  return null;
};

const resolveItemCode = async (itemCode, itemName) => {
  const code = await require('../services/resolveItemCode')(Item, itemCode, itemName);
  return code && await Item.findByPk(code) ? code : null;
};

const cleanDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().split('T')[0];
};

// Start at 1050 and skip any numbers already in use, including legacy POs.
const getNextPurchaseOrderNo = async (transaction) => {
  const [rows] = await sequelize.query(
    'SELECT `OrderNo` FROM `purchase_orders` WHERE `OrderNo` >= 1050 ORDER BY `OrderNo` ASC',
    { transaction }
  );
  let next = 1050n;
  for (const row of rows) {
    const number = BigInt(String(row.OrderNo));
    if (number > next) break;
    if (number === next) next += 1n;
  }
  return Number(next);
};

// Get last order number
exports.getLastOrderNo = async (req, res) => {
  try {
    const nextOrderNo = await getNextPurchaseOrderNo();
    
    res.json({
      success: true,
      data: { lastOrderNo: nextOrderNo - 1, nextOrderNo }
    });
  } catch (error) {
    console.error('Error fetching last order number:', error);
    res.status(errorStatus(error)).json({
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
    res.status(errorStatus(error)).json({
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
    res.status(errorStatus(error)).json({
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
    res.status(errorStatus(error)).json({
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
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching items',
      error: error.message
    });
  }
};

// Create purchase order with details
exports.createPurchaseOrder = async (req, res) => {
  try {
    validateTransactionItems(req.body?.items, { required: true });
    const {
      OrderDate, PartyCode, PartyName, Address, Place, Remarks, RefNo, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VoltasFormat, VatWithPF
    } = req.body;

    const resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName);
    if (!resolvedPartyCode || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: !resolvedPartyCode ? 'Please select a valid supplier from the list' : 'At least one item is required'
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
      if (!itemCode) return res.status(400).json({ success: false, message: `Item "${item.ItemName || item.ItemCode || ''}" could not be found. Please select it again.` });

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
    const orderDate = cleanDate(OrderDate);
    if (!orderDate || orderDate !== OrderDate) return res.status(400).json({ success: false, message: 'A valid order date is required' });
    let newOrder;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        newOrder = await sequelize.transaction(async transaction => {
          const nextOrderNo = await getNextPurchaseOrderNo(transaction);
          const created = await PurchaseOrder.create({
      OrderNo: nextOrderNo,
      OrderDate: orderDate,
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
      RoundOff: RoundOff !== undefined ? parseDec(RoundOff, 0) : sumRoundOff,
      GrandTotal: GrandTotal !== undefined ? parseDec(GrandTotal, 0) : sumGrandTotal,
      DutyWithoutPF: DutyWithoutPF || false,
      VoltasFormat: VoltasFormat || false,
      VatWithPF: VatWithPF || false
          }, { transaction });

    // Create order details
    for (const detail of preparedItems) {
      await PurchaseOrderDetail.create({
        OrderNo: created.OrderNo,
        ...detail
      }, { transaction });
    }
          return created;
        });
        break;
      } catch (error) {
        if (error.name !== 'SequelizeUniqueConstraintError' || attempt === 4) throw error;
      }
    }

    res.status(201).json({
      success: true,
      message: 'Purchase Order created successfully',
      data: newOrder
    });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error creating purchase order',
      error: error.message
    });
  }
};

// Update purchase order
exports.updatePurchaseOrder = async (req, res) => {
  try {
    validateTransactionItems(req.body?.items, {});
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

    if (OrderDate && cleanDate(OrderDate) !== cleanDate(order.OrderDate) &&
        String(order.OrderNo).length === 11 &&
        String(order.OrderNo).startsWith(String(order.OrderDate).replace(/-/g, ''))) {
      return res.status(400).json({ success: false, message: 'The order date cannot be changed because it forms part of the PO number' });
    }

    let resolvedPartyCode = order.PartyCode;
    if (PartyCode || PartyName) {
      resolvedPartyCode = await resolvePartyCode(PartyCode, PartyName);
      if (!resolvedPartyCode) return res.status(400).json({ success: false, message: 'Please select a valid supplier from the list' });
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
        if (!itemCode) return res.status(400).json({ success: false, message: `Item "${item.ItemName || item.ItemCode || ''}" could not be found. Please select it again.` });

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

    if (items !== undefined && (!Array.isArray(items) || items.length === 0)) {
      return res.status(400).json({ success: false, message: 'Purchase order items cannot be empty' });
    }
    await sequelize.transaction(async transaction => {
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
        RoundOff: RoundOff !== undefined ? parseDec(RoundOff, 0) : (preparedItems ? sumRoundOff : order.RoundOff),
        GrandTotal: GrandTotal !== undefined ? parseDec(GrandTotal, 0) : (preparedItems ? sumGrandTotal : order.GrandTotal),
        DutyWithoutPF: DutyWithoutPF !== undefined ? !!DutyWithoutPF : order.DutyWithoutPF,
        VoltasFormat: VoltasFormat !== undefined ? !!VoltasFormat : order.VoltasFormat,
        VatWithPF: VatWithPF !== undefined ? !!VatWithPF : order.VatWithPF
      }, { transaction });

      // Update order details if provided
      if (preparedItems) {
        await PurchaseOrderDetail.destroy({ where: { OrderNo: oNo }, transaction });
        for (const item of preparedItems) {
          await PurchaseOrderDetail.create(item, { transaction });
        }

        // Recalculate PO status (ordered qty may have changed)
        const { recalcPOStatus } = require('./gateInwardController');
        await recalcPOStatus(oNo, transaction);
      }

    });

    res.json({
      success: true,
      message: 'Purchase Order updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(errorStatus(error)).json({
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

    const referencedInwards = await GateInwardDetail.findAll({
      where: { OrderNo: orderNo }, attributes: ['InwardNo'], raw: true, transaction: t
    });
    const gateInwards = await GateInward.findAll({
      where: { [Op.or]: [
        { OrderNo: orderNo },
        { InwardNo: { [Op.in]: referencedInwards.map(d => d.InwardNo) } }
      ] },
      attributes: ['InwardNo'],
      raw: true,
      transaction: t
    });
    const inwardNos = gateInwards.map(row => row.InwardNo);

    const inwardDetails = inwardNos.length > 0
      ? await GateInwardDetail.findAll({
          where: { InwardNo: { [Op.in]: inwardNos } },
          attributes: ['OrderNo', 'ItemCode', 'ReceivedQty', 'StockUnitRate', 'StockValue'],
          raw: true,
          transaction: t
        })
      : [];

    if (inwardDetails.some(d => d.OrderNo && String(d.OrderNo) !== String(orderNo))) {
      await t.rollback();
      return res.status(409).json({ success: false, message: 'This purchase order shares a gate inward with another PO. Remove its inward lines before deleting the order.' });
    }

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
      await require('../models/BillVerify').destroy({ where: { VoucherNo: { [Op.in]: voucherNos } }, transaction: t });
      await BillEntryDetail.destroy({ where: { VoucherNo: { [Op.in]: voucherNos } }, transaction: t });
      await BillEntry.destroy({ where: { VoucherNo: { [Op.in]: voucherNos } }, transaction: t });
    }

    if (grnNos.length > 0) {
      await ReceiptDetail.destroy({ where: { GRNNo: { [Op.in]: grnNos } }, transaction: t });
      await Receipt.destroy({ where: { GRNNo: { [Op.in]: grnNos } }, transaction: t });
    }

    if (inwardNos.length > 0) {
      const { adjustInwardInventory } = require('./gateInwardController');
      await adjustInwardInventory(inwardDetails, -1, t);

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
    res.status(errorStatus(error)).json({
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
    res.status(errorStatus(error)).json({
      success: false,
      message: 'Error fetching purchase order',
      error: error.message
    });
  }
};
