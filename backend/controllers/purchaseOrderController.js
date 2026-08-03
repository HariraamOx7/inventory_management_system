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
        name: s.AccountName || '',
        Place: s.Place || '',
        PhNo: s.PhNo || '',
        ContactPerson: s.ContactPerson || '',
        GSTNo: s.GSTNo || '',
        Address: s.Address || ''
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
      VoltasFormat: VoltasFormat || false,
      VatWithPF: VatWithPF || false
    });

    // Create order details
    for (const item of items) {
      await PurchaseOrderDetail.create({
        OrderNo: newOrder.OrderNo,
        ItemName: item.ItemName,
        Qty: item.Qty || 0,
        UnitRate: item.UnitRate || 0,
        TotalAmount: item.TotalAmount || 0,
        DiscountPct: item.DiscountPct || 0,
        DiscountAmt: item.DiscountAmt || 0,
        GSTType: item.GSTType || null,
        GSTPct: item.GSTPct || 0,
        SGSTPct: item.SGSTPct || 0,
        SGST: item.SGST || 0,
        CGSTPct: item.CGSTPct || 0,
        CGST: item.CGST || 0,
        IGSTPct: item.IGSTPct || 0,
        IGST: item.IGST || 0,
        TaxType: item.TaxType || null,
        TaxPct: item.TaxPct || 0,
        TaxAmount: item.TaxAmount || 0,
        PF_Pct: item.PF_Pct || 0,
        PF_Amount: item.PF_Amount || 0,
        LorryFreight: item.LorryFreight || 0,
        RoundOff: item.RoundOff || 0,
        GrandTotal: item.GrandTotal || 0,
        MRS_No: item.MRS_No || null
      });
      // Update item stock by adding the quantity
      const itemRecord = await Item.findOne({
        where: { ItemName: item.ItemName }
      });

      if (itemRecord) {
        // Add the quantity to existing stock
        // Add PO quantity to OpeningQty instead of Stock
        await itemRecord.update({
          OpeningQty: parseFloat(itemRecord.OpeningQty || 0) + parseFloat(item.Qty || 0),
          Quantity: parseFloat(itemRecord.Quantity || itemRecord.OpeningQty || 0) + parseFloat(item.Qty || 0)
        });
      }
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
    const {
      OrderDate, PartyName, Address, Place, Remarks, RefNo, Total, Discount,
      GST, IGST, VAT_CST, P_F, LorryFreight, RoundOff, GrandTotal, items,
      DutyWithoutPF, VoltasFormat, VatWithPF
    } = req.body;

    const order = await PurchaseOrder.findByPk(orderNo);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Purchase Order not found'
      });
    }

    await order.update({
      OrderDate: OrderDate || order.OrderDate,
      PartyName: PartyName ? PartyName.trim() : order.PartyName,
      Address: Address ? Address.trim() : order.Address,
      Place: Place ? Place.trim() : order.Place,
      Remarks: Remarks ? Remarks.trim() : order.Remarks,
      RefNo: RefNo ? RefNo.trim() : order.RefNo,
      Total: Total !== undefined ? Total : order.Total,
      Discount: Discount !== undefined ? Discount : order.Discount,
      GST: GST !== undefined ? GST : order.GST,
      IGST: IGST !== undefined ? IGST : order.IGST,
      VAT_CST: VAT_CST !== undefined ? VAT_CST : order.VAT_CST,
      P_F: P_F !== undefined ? P_F : order.P_F,
      LorryFreight: LorryFreight !== undefined ? LorryFreight : order.LorryFreight,
      RoundOff: RoundOff !== undefined ? RoundOff : order.RoundOff,
      GrandTotal: GrandTotal !== undefined ? GrandTotal : order.GrandTotal,
      DutyWithoutPF: DutyWithoutPF !== undefined ? DutyWithoutPF : order.DutyWithoutPF,
      VoltasFormat: VoltasFormat !== undefined ? VoltasFormat : order.VoltasFormat,
      VatWithPF: VatWithPF !== undefined ? VatWithPF : order.VatWithPF
    });

    // Update order details if provided
    if (items && items.length > 0) {
      await PurchaseOrderDetail.destroy({ where: { OrderNo: orderNo } });
      
      for (const item of items) {
        await PurchaseOrderDetail.create({
          OrderNo: orderNo,
          ItemName: item.ItemName,
          Qty: item.Qty || 0,
          UnitRate: item.UnitRate || 0,
          TotalAmount: item.TotalAmount || 0,
          DiscountPct: item.DiscountPct || 0,
          DiscountAmt: item.DiscountAmt || 0,
          GSTType: item.GSTType || null,
          GSTPct: item.GSTPct || 0,
          SGSTPct: item.SGSTPct || 0,
          SGST: item.SGST || 0,
          CGSTPct: item.CGSTPct || 0,
          CGST: item.CGST || 0,
          IGSTPct: item.IGSTPct || 0,
          IGST: item.IGST || 0,
          TaxType: item.TaxType || null,
          TaxPct: item.TaxPct || 0,
          TaxAmount: item.TaxAmount || 0,
          PF_Pct: item.PF_Pct || 0,
          PF_Amount: item.PF_Amount || 0,
          LorryFreight: item.LorryFreight || 0,
          RoundOff: item.RoundOff || 0,
          GrandTotal: item.GrandTotal || 0,
          MRS_No: item.MRS_No || null
        });
      }
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
      await GateInwardDetail.destroy({ where: { InwardNo: { [Op.in]: inwardNos } }, transaction: t });
      await GateInward.destroy({ where: { InwardNo: { [Op.in]: inwardNos } }, transaction: t });
    }

    // Roll back the stock increase applied when the purchase order was created
    for (const detail of orderDetails) {
      const itemRecord = await Item.findOne({
        where: { ItemName: detail.ItemName },
        transaction: t
      });

      if (itemRecord) {
        await itemRecord.update({
          OpeningQty: parseFloat(itemRecord.OpeningQty || 0) - parseFloat(detail.Qty || 0),
          Quantity: parseFloat(itemRecord.Quantity || itemRecord.OpeningQty || 0) - parseFloat(detail.Qty || 0)
        }, { transaction: t });
      }
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