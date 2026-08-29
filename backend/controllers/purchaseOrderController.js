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

  // TotalAmount is calculated from the rate entered in the PO form. Preserve
  // that rate if an item master default has overwritten the submitted value.
  if (qty > 0 && totalAmount > 0 && Math.abs(totalAmount - (qty * unitRate)) > 0.005) {
    return totalAmount / qty;
  }

  return unitRate;
};

// Get last order number
exports.getLastOrderNo = async (req, res) => {
  try {
    const lastOrder = await PurchaseOrder.findOne({
      order: [['OrderNo', 'DESC']]
    });
    
    res.json({
      success: true,
      data: { lastOrderNo: lastOrder ? lastOrder.OrderNo : 0 }
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
          model: PurchaseOrderDetail,
          as: 'details'
        }
      ],
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

// Get supplier by name to fetch address and details
exports.getSupplierByName = async (req, res) => {
  try {
    const { partyName } = req.query;
    
    if (!partyName) {
      return res.status(400).json({
        success: false,
        message: 'Party name is required'
      });
    }

    const supplier = await Supplier.findOne({
      where: { AccountName: partyName },
      attributes: ['AccountName', 'Address', 'Place', 'PhNo', 'Email', 'ContactPerson']
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      data: supplier
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
      attributes: ['AccCode', 'AccountName', 'Place', 'PhNo', 'ContactPerson', 'GSTNo', 'Address'],
      order: [['AccountName', 'ASC']]
    });
    
    res.json({
      success: true,
      data: suppliers.map(s => ({
        AccCode: s.AccCode,
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
      OrderDate, PartyName, Address, Place, Remarks, RefNo, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VoltasFormat, VatWithPF
    } = req.body;

    if (!PartyName || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Party name and items are required'
      });
    }

    // Create purchase order
    const newOrder = await PurchaseOrder.create({
      OrderDate: OrderDate || new Date(),
      PartyName: PartyName.trim(),
      Address: Address ? Address.trim() : null,
      Place: Place ? Place.trim() : null,
      Remarks: Remarks ? Remarks.trim() : null,
      RefNo: RefNo ? RefNo.trim() : null,
      Total: parseDec(Total, 0),
      Discount: parseDec(Discount, 0),
      GST: parseDec(GST, 0),
      IGST: parseDec(IGST, 0),
      VAT_CST: parseDec(VAT_CST, 0),
      P_F: parseDec(P_F, 0),
      LorryFreight: parseDec(LorryFreight, 0),
      RoundOff: parseDec(RoundOff, 0),
      GrandTotal: parseDec(GrandTotal, 0),
      DutyWithoutPF: DutyWithoutPF || false,
      VoltasFormat: VoltasFormat || false,
      VatWithPF: VatWithPF || false
    });

    // Create order details
    for (const item of items) {
      const unitRate = resolveLineUnitRate(item);
      await PurchaseOrderDetail.create({
        OrderNo: newOrder.OrderNo,
        ItemName: item.ItemName,
        Qty: parseDec(item.Qty, 0),
        UnitRate: unitRate,
        TotalAmount: parseDec(item.TotalAmount, 0),
        DiscountPct: parseDec(item.DiscountPct, 0),
        DiscountAmt: parseDec(item.DiscountAmt, 0),
        GSTType: item.GSTType || null,
        GSTPct: parseDec(item.GSTPct, 0),
        SGSTPct: parseDec(item.SGSTPct, 0),
        SGST: parseDec(item.SGST, 0),
        CGSTPct: parseDec(item.CGSTPct, 0),
        CGST: parseDec(item.CGST, 0),
        IGSTPct: parseDec(item.IGSTPct, 0),
        IGST: parseDec(item.IGST, 0),
        TaxType: item.TaxType || null,
        TaxPct: parseDec(item.TaxPct, 0),
        TaxAmount: parseDec(item.TaxAmount, 0),
        PF_Pct: parseDec(item.PF_Pct, 0),
        PF_Amount: parseDec(item.PF_Amount, 0),
        LorryFreight: parseDec(item.LorryFreight, 0),
        RoundOff: parseDec(item.RoundOff, 0),
        GrandTotal: parseDec(item.GrandTotal, 0),
        MRS_No: item.MRS_No || null
      });
      // A purchase order does not change on-hand stock. Stock is updated only
      // when the corresponding gate inward records the received quantity.
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

const cleanDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().split('T')[0];
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
      OrderDate, PartyName, Address, Place, Remarks, RefNo, Total, Discount,
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

    await order.update({
      OrderDate: cleanDate(OrderDate) || order.OrderDate || cleanDate(new Date()),
      PartyName: PartyName ? PartyName.trim() : order.PartyName,
      Address: Address !== undefined ? (Address ? Address.trim() : null) : order.Address,
      Place: Place !== undefined ? (Place ? Place.trim() : null) : order.Place,
      Remarks: Remarks !== undefined ? (Remarks ? Remarks.trim() : null) : order.Remarks,
      RefNo: RefNo !== undefined ? (RefNo ? RefNo.trim() : null) : order.RefNo,
      Total: Total !== undefined ? parseDec(Total, 0) : order.Total,
      Discount: Discount !== undefined ? parseDec(Discount, 0) : order.Discount,
      GST: GST !== undefined ? parseDec(GST, 0) : order.GST,
      IGST: IGST !== undefined ? parseDec(IGST, 0) : order.IGST,
      VAT_CST: VAT_CST !== undefined ? parseDec(VAT_CST, 0) : order.VAT_CST,
      P_F: P_F !== undefined ? parseDec(P_F, 0) : order.P_F,
      LorryFreight: LorryFreight !== undefined ? parseDec(LorryFreight, 0) : order.LorryFreight,
      RoundOff: RoundOff !== undefined ? parseDec(RoundOff, 0) : order.RoundOff,
      GrandTotal: GrandTotal !== undefined ? parseDec(GrandTotal, 0) : order.GrandTotal,
      DutyWithoutPF: DutyWithoutPF !== undefined ? !!DutyWithoutPF : order.DutyWithoutPF,
      VoltasFormat: VoltasFormat !== undefined ? !!VoltasFormat : order.VoltasFormat,
      VatWithPF: VatWithPF !== undefined ? !!VatWithPF : order.VatWithPF
    });

    // Update order details if provided
    if (items && Array.isArray(items) && items.length > 0) {
      await PurchaseOrderDetail.destroy({ where: { OrderNo: oNo } });
      
      for (const item of items) {
        if (!item || !item.ItemName) continue;
        const unitRate = resolveLineUnitRate(item);
        const qty = parseDec(item.Qty, 0);
        await PurchaseOrderDetail.create({
          OrderNo: oNo,
          ItemName: String(item.ItemName).trim(),
          Qty: qty,
          UnitRate: unitRate,
          TotalAmount: parseDec(item.TotalAmount, qty * unitRate),
          DiscountPct: parseDec(item.DiscountPct, 0),
          DiscountAmt: parseDec(item.DiscountAmt, 0),
          GSTType: item.GSTType || null,
          GSTPct: parseDec(item.GSTPct, 0),
          SGSTPct: parseDec(item.SGSTPct, 0),
          SGST: parseDec(item.SGST, 0),
          CGSTPct: parseDec(item.CGSTPct, 0),
          CGST: parseDec(item.CGST, 0),
          IGSTPct: parseDec(item.IGSTPct, 0),
          IGST: parseDec(item.IGST, 0),
          TaxType: item.TaxType || null,
          TaxPct: parseDec(item.TaxPct, 0),
          TaxAmount: parseDec(item.TaxAmount, 0),
          PF_Pct: parseDec(item.PF_Pct, 0),
          PF_Amount: parseDec(item.PF_Amount, 0),
          LorryFreight: parseDec(item.LorryFreight, 0),
          RoundOff: parseDec(item.RoundOff, 0),
          GrandTotal: parseDec(item.GrandTotal, 0),
          MRS_No: item.MRS_No || null
        });
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

    const orderDetails = await PurchaseOrderDetail.findAll({
      where: { OrderNo: orderNo },
      raw: true,
      transaction: t
    });

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
          attributes: ['ItemName', 'ReceivedQty'],
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
      // Gate inward is the only event that adds stock, so reversing a
      // purchase-order cascade must remove the quantities actually received.
      for (const detail of inwardDetails) {
        const receivedQty = parseFloat(detail.ReceivedQty) || 0;
        if (!detail.ItemName || receivedQty === 0) continue;

        const itemRecord = await Item.findOne({
          where: { ItemName: detail.ItemName },
          transaction: t
        });
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
          model: PurchaseOrderDetail,
          as: 'details'
        }
      ]
    });

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    res.json({
      success: true,
      data: purchaseOrder
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
