const ExcelJS = require('exceljs');
const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/db');
const Item = require('../models/Item');
const Department = require('../models/Department');
const SubHead = require('../models/SubHead');
const PurchaseType = require('../models/PurchaseType');
const Receipt = require('../models/Receipt');
const ReceiptDetail = require('../models/ReceiptDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');
const ItemIssue = require('../models/ItemIssue');
const ItemIssueDetail = require('../models/ItemIssueDetail');
const BillEntry = require('../models/BillEntry');
const BillEntryDetail = require('../models/BillEntryDetail');
const GatePassOut = require('../models/GatePassOut');
const GatePassOutDetail = require('../models/GatePassOutDetail');
const GatePassIn = require('../models/GatePassIn');
const GatePassInDetail = require('../models/GatePassInDetail');

// ── helpers ──────────────────────────────────────────────────────────

const parseDec = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dd}-${months[dt.getMonth()]}-${String(dt.getFullYear()).slice(2)}`;
};

const fmtDateFull = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dd}-${months[dt.getMonth()]}-${dt.getFullYear()}`;
};

const dateRange = (req) => {
  const from = req.query.fromDate || new Date().toISOString().split('T')[0];
  const to = req.query.toDate || from;
  return { from, to };
};

const parseFilterParam = (param) => {
  if (!param) return null;
  const list = param.split(',').map(v => decodeURIComponent(v.trim())).filter(Boolean);
  return list.length > 0 ? list : null;
};

// ── Filter Options API ───────────────────────────────────────────────

exports.getFilterOptions = async (req, res) => {
  try {
    const { type } = req.params;
    const { fromDate, toDate } = req.query;
    const from = fromDate || '1970-01-01';
    const to = toDate || '2099-12-31';

    let data = [];

    switch (type) {
      case 'departments': {
        const rows = await Department.findAll({
          attributes: ['dept_id', 'dept_name'],
          order: [['dept_name', 'ASC']],
          raw: true
        });
        data = rows.map(r => ({ id: String(r.dept_id), name: r.dept_name }));
        break;
      }

      case 'parties': {
        const rows = await sequelize.query(
          `SELECT DISTINCT PartyName FROM (
            SELECT PartyName FROM purchase_orders WHERE PartyName IS NOT NULL AND PartyName != ''
            UNION
            SELECT PartyName FROM receipts WHERE PartyName IS NOT NULL AND PartyName != ''
            UNION
            SELECT PartyName FROM bill_entries WHERE PartyName IS NOT NULL AND PartyName != ''
            UNION
            SELECT PartyName FROM gate_pass_outs WHERE PartyName IS NOT NULL AND PartyName != ''
            UNION
            SELECT PartyName FROM gate_pass_ins WHERE PartyName IS NOT NULL AND PartyName != ''
          ) AS all_parties ORDER BY PartyName ASC`,
          { type: sequelize.QueryTypes.SELECT }
        );
        data = rows.map(r => ({ id: r.PartyName, name: r.PartyName }));
        break;
      }

      case 'items': {
        const rows = await Item.findAll({
          attributes: ['ItemCode', 'ItemName'],
          order: [['ItemName', 'ASC']],
          raw: true
        });
        data = rows.map(r => ({ id: r.ItemName, name: `${r.ItemName} (${r.ItemCode})` }));
        break;
      }

      case 'orders': {
        const rows = await sequelize.query(
          `SELECT OrderNo, PartyName, OrderDate 
           FROM purchase_orders 
           WHERE OrderDate BETWEEN :from AND :to 
           ORDER BY OrderNo DESC`,
          { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
        );
        data = rows.map(r => ({ id: String(r.OrderNo), name: `Order #${r.OrderNo} - ${r.PartyName} (${fmtDate(r.OrderDate)})` }));
        break;
      }

      case 'subheads': {
        const rows = await SubHead.findAll({
          attributes: ['code', 'sub_group_name'],
          order: [['sub_group_name', 'ASC']],
          raw: true
        });
        data = rows.map(r => ({ id: r.code, name: `${r.sub_group_name} (${r.code})` }));
        break;
      }

      case 'purchasetypes': {
        const rows = await PurchaseType.findAll({
          attributes: ['Code', 'PurchaseType'],
          order: [['PurchaseType', 'ASC']],
          raw: true
        });
        data = rows.map(r => ({ id: r.PurchaseType, name: r.PurchaseType }));
        break;
      }

      default:
        return res.status(400).json({ success: false, message: `Invalid filter type: ${type}` });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error(`Error fetching filter options for ${req.params.type}:`, error);
    res.status(500).json({ success: false, message: 'Error fetching filter options', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  1. PURCHASE REPORTS
// ══════════════════════════════════════════════════════════════════════

// 1.1 Order No Wise Order Details
exports.getOrderNoWiseOrderDetails = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const orderNos = parseFilterParam(req.query.orders);

    let whereClause = `po.OrderDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (orderNos) {
      whereClause += ` AND po.OrderNo IN (:orderNos)`;
      replacements.orderNos = orderNos.map(v => parseInt(v)).filter(Boolean);
    }

    const rows = await sequelize.query(`
      SELECT
        po.OrderNo,
        po.OrderDate,
        po.PartyName,
        pod.ItemName,
        pod.Qty,
        pod.UnitRate,
        pod.TotalAmount,
        pod.DiscountPct,
        pod.TaxPct,
        pod.PF_Pct,
        pod.GrandTotal
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      WHERE ${whereClause}
      ORDER BY po.OrderNo ASC, pod.DetailId ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const orderMap = {};
    rows.forEach(row => {
      const orderNo = row.OrderNo;
      if (!orderMap[orderNo]) {
        orderMap[orderNo] = {
          orderNo,
          orderDate: fmtDate(row.OrderDate),
          partyName: row.PartyName || 'Unknown',
          items: []
        };
      }
      orderMap[orderNo].items.push({
        itemName: row.ItemName,
        qty: parseDec(row.Qty),
        unitRate: parseDec(row.UnitRate),
        totalAmount: parseDec(row.TotalAmount),
        discountPct: parseDec(row.DiscountPct),
        dutyPct: parseDec(row.TaxPct),
        pfPct: parseDec(row.PF_Pct),
        grandTotal: parseDec(row.GrandTotal)
      });
    });

    const groups = [];
    let reportGrandTotal = 0;
    let reportTotalQty = 0;

    Object.keys(orderMap).sort((a,b) => Number(a)-Number(b)).forEach(orderNo => {
      const ord = orderMap[orderNo];
      let orderGrandTotal = 0;
      let orderTotalQty = 0;
      let slNo = 0;

      const items = ord.items.map(it => {
        slNo++;
        orderGrandTotal += it.grandTotal;
        orderTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportGrandTotal += orderGrandTotal;
      reportTotalQty += orderTotalQty;

      groups.push({
        orderNo: ord.orderNo,
        orderDate: ord.orderDate,
        partyName: ord.partyName,
        items,
        orderGrandTotal,
        orderTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Order No Wise Order Details',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating Order No Wise Order Details:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 1.2 Supplier Wise Order Details
exports.getSupplierWiseOrderDetails = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const parties = parseFilterParam(req.query.parties);

    let whereClause = `po.OrderDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (parties) {
      whereClause += ` AND po.PartyName IN (:parties)`;
      replacements.parties = parties;
    }

    const rows = await sequelize.query(`
      SELECT
        po.OrderNo,
        po.OrderDate,
        po.PartyName,
        pod.ItemName,
        pod.Qty,
        pod.UnitRate,
        pod.TotalAmount,
        pod.DiscountPct,
        pod.TaxPct,
        pod.PF_Pct,
        pod.GrandTotal
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      WHERE ${whereClause}
      ORDER BY po.PartyName ASC, po.OrderNo ASC, pod.DetailId ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const supplierMap = {};

    rows.forEach(row => {
      const supplier = row.PartyName || 'Unknown';
      if (!supplierMap[supplier]) supplierMap[supplier] = {};
      const orderNo = row.OrderNo;
      if (!supplierMap[supplier][orderNo]) {
        supplierMap[supplier][orderNo] = { orderDate: row.OrderDate, items: [] };
      }
      supplierMap[supplier][orderNo].items.push({
        itemName: row.ItemName,
        qty: parseDec(row.Qty),
        perQty: 1,
        unitRate: parseDec(row.UnitRate),
        totalAmount: parseDec(row.TotalAmount),
        discountPct: parseDec(row.DiscountPct),
        dutyPct: parseDec(row.TaxPct),
        educessPct: 0,
        hsCessPct: 0,
        vatPct: 0,
        pfPct: parseDec(row.PF_Pct),
        grandTotal: parseDec(row.GrandTotal)
      });
    });

    const result = [];
    let reportGrandTotal = 0;

    Object.keys(supplierMap).sort().forEach(supplierName => {
      const orders = supplierMap[supplierName];
      let supplierGrandTotal = 0;
      const orderGroups = [];

      Object.keys(orders).sort((a,b) => Number(a)-Number(b)).forEach(orderNo => {
        const order = orders[orderNo];
        let slNo = 0;
        let orderGrandTotal = 0;

        const orderItems = order.items.map(item => {
          slNo++;
          orderGrandTotal += item.grandTotal;
          return { slNo, orderDate: fmtDate(order.orderDate), ...item };
        });

        supplierGrandTotal += orderGrandTotal;

        orderGroups.push({
          orderNo: parseInt(orderNo),
          items: orderItems,
          orderGrandTotal
        });
      });

      reportGrandTotal += supplierGrandTotal;

      result.push({
        supplierName,
        orders: orderGroups,
        supplierGrandTotal
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Supplier Wise Order Details',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating supplier wise order details:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 1.3 Department Wise Order Details
exports.getDepartmentWiseOrderDetails = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const departments = parseFilterParam(req.query.departments);

    let whereClause = `po.OrderDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (departments) {
      whereClause += ` AND (d.dept_id IN (:departments) OR d.dept_name IN (:departments))`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        po.OrderDate,
        pod.ItemName,
        pod.Qty,
        pod.UnitRate,
        pod.TotalAmount,
        pod.DiscountPct,
        pod.TaxPct,
        pod.PF_Pct,
        pod.GrandTotal
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      LEFT JOIN items i ON i.ItemName = pod.ItemName
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      ORDER BY departmentName ASC, po.OrderDate ASC, pod.DetailId ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};

    rows.forEach(row => {
      const dept = row.departmentName;
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push({
        orderDate: fmtDate(row.OrderDate),
        itemName: row.ItemName,
        qty: parseDec(row.Qty),
        pQty: 1,
        unitRate: parseDec(row.UnitRate),
        totalAmount: parseDec(row.TotalAmount),
        discountPct: parseDec(row.DiscountPct),
        dutyPct: parseDec(row.TaxPct),
        eduPct: 0,
        hsCesPct: 0,
        vatPer: 0,
        pfPer: parseDec(row.PF_Pct),
        grandTotal: parseDec(row.GrandTotal)
      });
    });

    const result = [];
    let reportGrandTotal = 0;

    Object.keys(grouped).sort().forEach(deptName => {
      const items = grouped[deptName];
      let deptGrandTotal = 0;

      items.forEach(item => { deptGrandTotal += item.grandTotal; });
      reportGrandTotal += deptGrandTotal;

      result.push({
        departmentName: deptName,
        items,
        deptGrandTotal
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Department Wise Order Details',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating department wise order details:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 1.4 Purchase Order Pending Wise Details
exports.getPurchaseOrderPendingWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        po.OrderNo,
        po.OrderDate,
        po.PartyName,
        pod.ItemName,
        pod.Qty AS OrderQty,
        COALESCE(recv.ReceivedQty, 0) AS ReceivedQty,
        (pod.Qty - COALESCE(recv.ReceivedQty, 0)) AS PendingQty,
        pod.UnitRate,
        pod.GrandTotal
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      LEFT JOIN (
        SELECT rd.OrderNo, rd.ItemName, SUM(rd.Qty) AS ReceivedQty
        FROM receipt_details rd
        GROUP BY rd.OrderNo, rd.ItemName
      ) recv ON recv.OrderNo = po.OrderNo AND recv.ItemName = pod.ItemName
      WHERE po.OrderDate BETWEEN :from AND :to
        AND (pod.Qty - COALESCE(recv.ReceivedQty, 0)) > 0
      ORDER BY po.OrderNo ASC, pod.DetailId ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    let reportTotalOrderQty = 0;
    let reportTotalRecQty = 0;
    let reportTotalPendingQty = 0;

    const items = rows.map((r, idx) => {
      const orderQty = parseDec(r.OrderQty);
      const receivedQty = parseDec(r.ReceivedQty);
      const pendingQty = parseDec(r.PendingQty);
      reportTotalOrderQty += orderQty;
      reportTotalRecQty += receivedQty;
      reportTotalPendingQty += pendingQty;

      return {
        slNo: idx + 1,
        orderNo: r.OrderNo,
        orderDate: fmtDate(r.OrderDate),
        partyName: r.PartyName,
        itemName: r.ItemName,
        orderQty,
        receivedQty,
        pendingQty,
        unitRate: parseDec(r.UnitRate),
        grandTotal: parseDec(r.GrandTotal)
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Purchase Order Pending Wise Details',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportTotalOrderQty,
        reportTotalRecQty,
        reportTotalPendingQty
      }
    });
  } catch (error) {
    console.error('Error generating PO Pending Wise Details:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 1.5 Purchase Order Pending Date Wise Details
exports.getPurchaseOrderPendingDateWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        po.OrderNo,
        po.OrderDate,
        po.PartyName,
        pod.ItemName,
        pod.Qty AS OrderQty,
        COALESCE(recv.ReceivedQty, 0) AS ReceivedQty,
        (pod.Qty - COALESCE(recv.ReceivedQty, 0)) AS PendingQty,
        pod.UnitRate,
        pod.GrandTotal
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      LEFT JOIN (
        SELECT rd.OrderNo, rd.ItemName, SUM(rd.Qty) AS ReceivedQty
        FROM receipt_details rd
        GROUP BY rd.OrderNo, rd.ItemName
      ) recv ON recv.OrderNo = po.OrderNo AND recv.ItemName = pod.ItemName
      WHERE po.OrderDate BETWEEN :from AND :to
        AND (pod.Qty - COALESCE(recv.ReceivedQty, 0)) > 0
      ORDER BY po.OrderDate ASC, po.OrderNo ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const dateKey = r.OrderDate;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        orderNo: r.OrderNo,
        partyName: r.PartyName,
        itemName: r.ItemName,
        orderQty: parseDec(r.OrderQty),
        receivedQty: parseDec(r.ReceivedQty),
        pendingQty: parseDec(r.PendingQty),
        unitRate: parseDec(r.UnitRate),
        grandTotal: parseDec(r.GrandTotal)
      });
    });

    const groups = [];
    let reportTotalOrderQty = 0;
    let reportTotalRecQty = 0;
    let reportTotalPendingQty = 0;

    Object.keys(grouped).sort().forEach(dateKey => {
      const items = grouped[dateKey];
      let dateTotalOrderQty = 0;
      let dateTotalRecQty = 0;
      let dateTotalPendingQty = 0;
      let slNo = 0;

      const dateItems = items.map(it => {
        slNo++;
        dateTotalOrderQty += it.orderQty;
        dateTotalRecQty += it.receivedQty;
        dateTotalPendingQty += it.pendingQty;
        return { slNo, ...it };
      });

      reportTotalOrderQty += dateTotalOrderQty;
      reportTotalRecQty += dateTotalRecQty;
      reportTotalPendingQty += dateTotalPendingQty;

      groups.push({
        date: dateKey,
        dateFormatted: fmtDateFull(dateKey),
        items: dateItems,
        dateTotalOrderQty,
        dateTotalRecQty,
        dateTotalPendingQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Purchase Order Pending Date Wise Details',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalOrderQty,
        reportTotalRecQty,
        reportTotalPendingQty
      }
    });
  } catch (error) {
    console.error('Error generating PO Pending Date Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 1.6 Purchase Order Price Comparison With ItemName
exports.getPurchaseOrderPriceComparison = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const items = parseFilterParam(req.query.items);

    let whereClause = `po.OrderDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (items) {
      whereClause += ` AND pod.ItemName IN (:items)`;
      replacements.items = items;
    }

    const rows = await sequelize.query(`
      SELECT
        pod.ItemName,
        po.OrderNo,
        po.OrderDate,
        po.PartyName,
        pod.Qty,
        pod.UnitRate,
        pod.TotalAmount,
        pod.GrandTotal
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      WHERE ${whereClause}
      ORDER BY pod.ItemName ASC, pod.UnitRate ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const key = r.ItemName;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        orderNo: r.OrderNo,
        orderDate: fmtDate(r.OrderDate),
        partyName: r.PartyName,
        qty: parseDec(r.Qty),
        unitRate: parseDec(r.UnitRate),
        totalAmount: parseDec(r.TotalAmount),
        grandTotal: parseDec(r.GrandTotal)
      });
    });

    const groups = [];
    Object.keys(grouped).sort().forEach(itemName => {
      const list = grouped[itemName];
      let minRate = Infinity;
      let maxRate = -Infinity;

      list.forEach(i => {
        if (i.unitRate < minRate) minRate = i.unitRate;
        if (i.unitRate > maxRate) maxRate = i.unitRate;
      });

      let slNo = 0;
      const itemsFormatted = list.map(it => {
        slNo++;
        return { slNo, ...it };
      });

      groups.push({
        itemName,
        minRate: minRate === Infinity ? 0 : minRate,
        maxRate: maxRate === -Infinity ? 0 : maxRate,
        items: itemsFormatted
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Purchase Order Price Comparison With ItemName',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups
      }
    });
  } catch (error) {
    console.error('Error generating PO Price Comparison:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 1.7 Purchase Order Party Wise Pending Details
exports.getPurchaseOrderPartyWisePending = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const parties = parseFilterParam(req.query.parties);

    let whereClause = `po.OrderDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (parties) {
      whereClause += ` AND po.PartyName IN (:parties)`;
      replacements.parties = parties;
    }

    const rows = await sequelize.query(`
      SELECT
        po.PartyName,
        po.OrderNo,
        po.OrderDate,
        pod.ItemName,
        pod.Qty AS OrderQty,
        COALESCE(recv.ReceivedQty, 0) AS ReceivedQty,
        (pod.Qty - COALESCE(recv.ReceivedQty, 0)) AS PendingQty,
        pod.UnitRate,
        pod.GrandTotal
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      LEFT JOIN (
        SELECT rd.OrderNo, rd.ItemName, SUM(rd.Qty) AS ReceivedQty
        FROM receipt_details rd
        GROUP BY rd.OrderNo, rd.ItemName
      ) recv ON recv.OrderNo = po.OrderNo AND recv.ItemName = pod.ItemName
      WHERE ${whereClause}
        AND (pod.Qty - COALESCE(recv.ReceivedQty, 0)) > 0
      ORDER BY po.PartyName ASC, po.OrderNo ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const party = r.PartyName || 'Unknown';
      if (!grouped[party]) grouped[party] = [];
      grouped[party].push({
        orderNo: r.OrderNo,
        orderDate: fmtDate(r.OrderDate),
        itemName: r.ItemName,
        orderQty: parseDec(r.OrderQty),
        receivedQty: parseDec(r.ReceivedQty),
        pendingQty: parseDec(r.PendingQty),
        unitRate: parseDec(r.UnitRate),
        grandTotal: parseDec(r.GrandTotal)
      });
    });

    const groups = [];
    let reportTotalOrderQty = 0;
    let reportTotalRecQty = 0;
    let reportTotalPendingQty = 0;

    Object.keys(grouped).sort().forEach(partyName => {
      const items = grouped[partyName];
      let partyTotalOrderQty = 0;
      let partyTotalRecQty = 0;
      let partyTotalPendingQty = 0;
      let slNo = 0;

      const partyItems = items.map(it => {
        slNo++;
        partyTotalOrderQty += it.orderQty;
        partyTotalRecQty += it.receivedQty;
        partyTotalPendingQty += it.pendingQty;
        return { slNo, ...it };
      });

      reportTotalOrderQty += partyTotalOrderQty;
      reportTotalRecQty += partyTotalRecQty;
      reportTotalPendingQty += partyTotalPendingQty;

      groups.push({
        partyName,
        items: partyItems,
        partyTotalOrderQty,
        partyTotalRecQty,
        partyTotalPendingQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Purchase Order Party Wise Pending Details',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalOrderQty,
        reportTotalRecQty,
        reportTotalPendingQty
      }
    });
  } catch (error) {
    console.error('Error generating PO Party Wise Pending:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  2. BILLING REPORTS
// ══════════════════════════════════════════════════════════════════════

// 2.1 Day Book
exports.getDayBook = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        be.VoucherNo,
        be.AccDate,
        be.PartyName,
        be.PartyBillNo,
        be.BillDate,
        be.PurchaseType,
        be.BillAmount,
        be.GST,
        be.IGST,
        be.Discount,
        be.P_F,
        be.LorryFreight,
        be.RoundOff,
        be.GrandTotal,
        be.TDS,
        be.TCS
      FROM bill_entries be
      WHERE be.AccDate BETWEEN :from AND :to
      ORDER BY be.AccDate ASC, be.VoucherNo ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    let reportBillAmount = 0;
    let reportGST = 0;
    let reportDiscount = 0;
    let reportGrandTotal = 0;

    rows.forEach(r => {
      const dateKey = r.AccDate;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      const billAmount = parseDec(r.BillAmount);
      const gst = parseDec(r.GST) + parseDec(r.IGST);
      const discount = parseDec(r.Discount);
      const grandTotal = parseDec(r.GrandTotal);

      reportBillAmount += billAmount;
      reportGST += gst;
      reportDiscount += discount;
      reportGrandTotal += grandTotal;

      grouped[dateKey].push({
        voucherNo: r.VoucherNo,
        partyName: r.PartyName,
        partyBillNo: r.PartyBillNo || '',
        billDate: fmtDate(r.BillDate),
        purchaseType: r.PurchaseType || '',
        billAmount,
        gst,
        discount,
        pf: parseDec(r.P_F),
        freight: parseDec(r.LorryFreight),
        roundOff: parseDec(r.RoundOff),
        grandTotal,
        tds: parseDec(r.TDS),
        tcs: parseDec(r.TCS)
      });
    });

    const groups = [];
    Object.keys(grouped).sort().forEach(dateKey => {
      const items = grouped[dateKey];
      let dateBillAmount = 0;
      let dateGST = 0;
      let dateDiscount = 0;
      let dateGrandTotal = 0;
      let slNo = 0;

      const dateItems = items.map(it => {
        slNo++;
        dateBillAmount += it.billAmount;
        dateGST += it.gst;
        dateDiscount += it.discount;
        dateGrandTotal += it.grandTotal;
        return { slNo, ...it };
      });

      groups.push({
        date: dateKey,
        dateFormatted: fmtDateFull(dateKey),
        items: dateItems,
        dateBillAmount,
        dateGST,
        dateDiscount,
        dateGrandTotal
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Day Book',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportBillAmount,
        reportGST,
        reportDiscount,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating Day Book:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.2 Bill Report [Purchase Type Wise]
exports.getBillReportPurchaseTypeWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const purchasetypes = parseFilterParam(req.query.purchasetypes);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (purchasetypes) {
      whereClause += ` AND be.PurchaseType IN (:purchasetypes)`;
      replacements.purchasetypes = purchasetypes;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(be.PurchaseType, 'Unspecified') AS PurchaseType,
        be.VoucherNo,
        be.AccDate,
        be.PartyName,
        be.PartyBillNo,
        be.BillDate,
        bed.ItemName,
        bed.Qty,
        bed.UnitRate,
        bed.TotalAmount,
        be.GrandTotal
      FROM bill_entries be
      JOIN bill_entry_details bed ON bed.VoucherNo = be.VoucherNo
      WHERE ${whereClause}
      ORDER BY be.PurchaseType ASC, be.VoucherNo ASC, bed.DetailId ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const type = r.PurchaseType;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        voucherNo: r.VoucherNo,
        accDate: fmtDate(r.AccDate),
        partyName: r.PartyName,
        partyBillNo: r.PartyBillNo || '',
        billDate: fmtDate(r.BillDate),
        itemName: r.ItemName,
        qty: parseDec(r.Qty),
        unitRate: parseDec(r.UnitRate),
        totalAmount: parseDec(r.TotalAmount),
        grandTotal: parseDec(r.GrandTotal)
      });
    });

    const groups = [];
    let reportTotalAmount = 0;
    let reportTotalQty = 0;

    Object.keys(grouped).sort().forEach(type => {
      const items = grouped[type];
      let typeTotalAmount = 0;
      let typeTotalQty = 0;
      let slNo = 0;

      const typeItems = items.map(it => {
        slNo++;
        typeTotalAmount += it.totalAmount;
        typeTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportTotalAmount += typeTotalAmount;
      reportTotalQty += typeTotalQty;

      groups.push({
        purchaseType: type,
        items: typeItems,
        typeTotalAmount,
        typeTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report [ Purchase Type wise ]',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty,
        reportTotalAmount
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Purchase Type Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.3 Bill Report (Abstract) - [Purchase Type Wise]
exports.getBillReportAbstractPurchaseTypeWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const purchasetypes = parseFilterParam(req.query.purchasetypes);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (purchasetypes) {
      whereClause += ` AND be.PurchaseType IN (:purchasetypes)`;
      replacements.purchasetypes = purchasetypes;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(be.PurchaseType, 'Unspecified') AS purchaseType,
        COUNT(DISTINCT be.VoucherNo) AS voucherCount,
        SUM(COALESCE(be.BillAmount, 0)) AS totalBillAmount,
        SUM(COALESCE(be.GST, 0) + COALESCE(be.IGST, 0)) AS totalGST,
        SUM(COALESCE(be.Discount, 0)) AS totalDiscount,
        SUM(COALESCE(be.GrandTotal, 0)) AS totalGrandTotal
      FROM bill_entries be
      WHERE ${whereClause}
      GROUP BY COALESCE(be.PurchaseType, 'Unspecified')
      ORDER BY purchaseType ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportBillAmount = 0;
    let reportGST = 0;
    let reportDiscount = 0;
    let reportGrandTotal = 0;

    const items = rows.map((r, idx) => {
      const billAmount = parseDec(r.totalBillAmount);
      const gst = parseDec(r.totalGST);
      const discount = parseDec(r.totalDiscount);
      const grandTotal = parseDec(r.totalGrandTotal);

      reportBillAmount += billAmount;
      reportGST += gst;
      reportDiscount += discount;
      reportGrandTotal += grandTotal;

      return {
        slNo: idx + 1,
        purchaseType: r.purchaseType,
        voucherCount: parseInt(r.voucherCount) || 0,
        billAmount,
        gst,
        discount,
        grandTotal
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report(Abstract) - [ Purchase Type wise ]',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportBillAmount,
        reportGST,
        reportDiscount,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Abstract Purchase Type Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.4 Purchase Register [Purchase Type Wise]
exports.getPurchaseRegisterPurchaseTypeWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const purchasetypes = parseFilterParam(req.query.purchasetypes);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (purchasetypes) {
      whereClause += ` AND be.PurchaseType IN (:purchasetypes)`;
      replacements.purchasetypes = purchasetypes;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(be.PurchaseType, 'Unspecified') AS purchaseType,
        be.VoucherNo,
        be.AccDate,
        be.PartyName,
        be.PartyBillNo,
        be.BillDate,
        be.BillAmount,
        be.Discount,
        be.GST,
        be.IGST,
        be.VAT_CST,
        be.P_F,
        be.LorryFreight,
        be.RoundOff,
        be.GrandTotal,
        be.TDS,
        be.TCS
      FROM bill_entries be
      WHERE ${whereClause}
      ORDER BY purchaseType ASC, be.AccDate ASC, be.VoucherNo ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const type = r.purchaseType;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        voucherNo: r.VoucherNo,
        accDate: fmtDate(r.AccDate),
        partyName: r.PartyName,
        partyBillNo: r.PartyBillNo || '',
        billDate: fmtDate(r.BillDate),
        billAmount: parseDec(r.BillAmount),
        discount: parseDec(r.Discount),
        gst: parseDec(r.GST),
        igst: parseDec(r.IGST),
        vat: parseDec(r.VAT_CST),
        pf: parseDec(r.P_F),
        freight: parseDec(r.LorryFreight),
        roundOff: parseDec(r.RoundOff),
        grandTotal: parseDec(r.GrandTotal),
        tds: parseDec(r.TDS),
        tcs: parseDec(r.TCS)
      });
    });

    const groups = [];
    let reportGrandTotal = 0;
    let reportBillAmount = 0;

    Object.keys(grouped).sort().forEach(type => {
      const items = grouped[type];
      let typeGrandTotal = 0;
      let typeBillAmount = 0;
      let slNo = 0;

      const typeItems = items.map(it => {
        slNo++;
        typeGrandTotal += it.grandTotal;
        typeBillAmount += it.billAmount;
        return { slNo, ...it };
      });

      reportGrandTotal += typeGrandTotal;
      reportBillAmount += typeBillAmount;

      groups.push({
        purchaseType: type,
        items: typeItems,
        typeGrandTotal,
        typeBillAmount
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Purchase Register [ Purchase Type wise ]',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportBillAmount,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating Purchase Register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.5 Bill Report - Date Wise
exports.getBillReportDateWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        be.AccDate,
        be.VoucherNo,
        be.PartyName,
        be.PartyBillNo,
        be.BillDate,
        bed.ItemName,
        bed.Qty,
        bed.UnitRate,
        bed.TotalAmount,
        be.GrandTotal
      FROM bill_entries be
      JOIN bill_entry_details bed ON bed.VoucherNo = be.VoucherNo
      WHERE be.AccDate BETWEEN :from AND :to
      ORDER BY be.AccDate ASC, be.VoucherNo ASC, bed.DetailId ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const dateKey = r.AccDate;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        voucherNo: r.VoucherNo,
        partyName: r.PartyName,
        partyBillNo: r.PartyBillNo || '',
        billDate: fmtDate(r.BillDate),
        itemName: r.ItemName,
        qty: parseDec(r.Qty),
        unitRate: parseDec(r.UnitRate),
        totalAmount: parseDec(r.TotalAmount),
        grandTotal: parseDec(r.GrandTotal)
      });
    });

    const groups = [];
    let reportTotalAmount = 0;
    let reportTotalQty = 0;

    Object.keys(grouped).sort().forEach(dateKey => {
      const items = grouped[dateKey];
      let dateTotalAmount = 0;
      let dateTotalQty = 0;
      let slNo = 0;

      const dateItems = items.map(it => {
        slNo++;
        dateTotalAmount += it.totalAmount;
        dateTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportTotalAmount += dateTotalAmount;
      reportTotalQty += dateTotalQty;

      groups.push({
        date: dateKey,
        dateFormatted: fmtDateFull(dateKey),
        items: dateItems,
        dateTotalAmount,
        dateTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report - Date wise',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty,
        reportTotalAmount
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Date Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.6 Bill Report - Party Wise
exports.getBillReportPartyWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const parties = parseFilterParam(req.query.parties);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (parties) {
      whereClause += ` AND be.PartyName IN (:parties)`;
      replacements.parties = parties;
    }

    const rows = await sequelize.query(`
      SELECT
        be.PartyName,
        be.VoucherNo,
        be.AccDate,
        be.PartyBillNo,
        be.BillDate,
        bed.ItemName,
        bed.Qty,
        bed.UnitRate,
        bed.TotalAmount,
        be.GrandTotal
      FROM bill_entries be
      JOIN bill_entry_details bed ON bed.VoucherNo = be.VoucherNo
      WHERE ${whereClause}
      ORDER BY be.PartyName ASC, be.VoucherNo ASC, bed.DetailId ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const party = r.PartyName || 'Unknown';
      if (!grouped[party]) grouped[party] = [];
      grouped[party].push({
        voucherNo: r.VoucherNo,
        accDate: fmtDate(r.AccDate),
        partyBillNo: r.PartyBillNo || '',
        billDate: fmtDate(r.BillDate),
        itemName: r.ItemName,
        qty: parseDec(r.Qty),
        unitRate: parseDec(r.UnitRate),
        totalAmount: parseDec(r.TotalAmount),
        grandTotal: parseDec(r.GrandTotal)
      });
    });

    const groups = [];
    let reportTotalAmount = 0;
    let reportTotalQty = 0;

    Object.keys(grouped).sort().forEach(partyName => {
      const items = grouped[partyName];
      let partyTotalAmount = 0;
      let partyTotalQty = 0;
      let slNo = 0;

      const partyItems = items.map(it => {
        slNo++;
        partyTotalAmount += it.totalAmount;
        partyTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportTotalAmount += partyTotalAmount;
      reportTotalQty += partyTotalQty;

      groups.push({
        partyName,
        items: partyItems,
        partyTotalAmount,
        partyTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report - Party wise',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty,
        reportTotalAmount
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Party Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.7 Bill Report (Abstract) - Party Wise
exports.getBillReportAbstractPartyWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const parties = parseFilterParam(req.query.parties);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (parties) {
      whereClause += ` AND be.PartyName IN (:parties)`;
      replacements.parties = parties;
    }

    const rows = await sequelize.query(`
      SELECT
        be.PartyName AS partyName,
        COUNT(DISTINCT be.VoucherNo) AS voucherCount,
        SUM(COALESCE(be.BillAmount, 0)) AS totalBillAmount,
        SUM(COALESCE(be.GrandTotal, 0)) AS totalGrandTotal
      FROM bill_entries be
      WHERE ${whereClause}
      GROUP BY be.PartyName
      ORDER BY partyName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportBillAmount = 0;
    let reportGrandTotal = 0;

    const items = rows.map((r, idx) => {
      const billAmount = parseDec(r.totalBillAmount);
      const grandTotal = parseDec(r.totalGrandTotal);
      reportBillAmount += billAmount;
      reportGrandTotal += grandTotal;

      return {
        slNo: idx + 1,
        partyName: r.partyName,
        voucherCount: parseInt(r.voucherCount) || 0,
        billAmount,
        grandTotal
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report(Abstract) - Party wise',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportBillAmount,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Abstract Party Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.8 Bill Report - Department Wise
exports.getBillReportDepartmentWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const departments = parseFilterParam(req.query.departments);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (departments) {
      whereClause += ` AND (d.dept_id IN (:departments) OR d.dept_name IN (:departments))`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        be.VoucherNo,
        be.AccDate,
        be.PartyName,
        bed.ItemName,
        bed.Qty,
        bed.UnitRate,
        bed.TotalAmount
      FROM bill_entries be
      JOIN bill_entry_details bed ON bed.VoucherNo = be.VoucherNo
      LEFT JOIN items i ON i.ItemName = bed.ItemName
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      ORDER BY departmentName ASC, be.VoucherNo ASC, bed.DetailId ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const dept = r.departmentName;
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push({
        voucherNo: r.VoucherNo,
        accDate: fmtDate(r.AccDate),
        partyName: r.PartyName,
        itemName: r.ItemName,
        qty: parseDec(r.Qty),
        unitRate: parseDec(r.UnitRate),
        totalAmount: parseDec(r.TotalAmount)
      });
    });

    const groups = [];
    let reportTotalAmount = 0;
    let reportTotalQty = 0;

    Object.keys(grouped).sort().forEach(deptName => {
      const items = grouped[deptName];
      let deptTotalAmount = 0;
      let deptTotalQty = 0;
      let slNo = 0;

      const deptItems = items.map(it => {
        slNo++;
        deptTotalAmount += it.totalAmount;
        deptTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportTotalAmount += deptTotalAmount;
      reportTotalQty += deptTotalQty;

      groups.push({
        departmentName: deptName,
        items: deptItems,
        deptTotalAmount,
        deptTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report [ Department wise ]',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty,
        reportTotalAmount
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Department Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.9 Bill Report (Abstract) - Department Wise
exports.getBillReportAbstractDepartmentWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const departments = parseFilterParam(req.query.departments);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (departments) {
      whereClause += ` AND (d.dept_id IN (:departments) OR d.dept_name IN (:departments))`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        COUNT(DISTINCT be.VoucherNo) AS voucherCount,
        SUM(COALESCE(bed.TotalAmount, 0)) AS totalAmount,
        SUM(COALESCE(bed.Qty, 0)) AS totalQty
      FROM bill_entries be
      JOIN bill_entry_details bed ON bed.VoucherNo = be.VoucherNo
      LEFT JOIN items i ON i.ItemName = bed.ItemName
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      GROUP BY COALESCE(d.dept_name, 'Unassigned')
      ORDER BY departmentName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportTotalAmount = 0;
    let reportTotalQty = 0;

    const items = rows.map((r, idx) => {
      const totalAmount = parseDec(r.totalAmount);
      const totalQty = parseDec(r.totalQty);
      reportTotalAmount += totalAmount;
      reportTotalQty += totalQty;

      return {
        slNo: idx + 1,
        departmentName: r.departmentName,
        voucherCount: parseInt(r.voucherCount) || 0,
        totalQty,
        totalAmount
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report(Abstract)- Department wise',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportTotalQty,
        reportTotalAmount
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Abstract Department Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.10 Bill Report - Sub Head Wise
exports.getBillReportSubHeadWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const subheads = parseFilterParam(req.query.subheads);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (subheads) {
      whereClause += ` AND (sh.code IN (:subheads) OR sh.sub_group_name IN (:subheads))`;
      replacements.subheads = subheads;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(sh.sub_group_name, 'Unassigned') AS subHeadName,
        be.VoucherNo,
        be.AccDate,
        be.PartyName,
        bed.ItemName,
        bed.Qty,
        bed.UnitRate,
        bed.TotalAmount
      FROM bill_entries be
      JOIN bill_entry_details bed ON bed.VoucherNo = be.VoucherNo
      LEFT JOIN items i ON i.ItemName = bed.ItemName
      LEFT JOIN sub_heads sh ON sh.code = i.SubHeadCode
      WHERE ${whereClause}
      ORDER BY subHeadName ASC, be.VoucherNo ASC, bed.DetailId ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const sh = r.subHeadName;
      if (!grouped[sh]) grouped[sh] = [];
      grouped[sh].push({
        voucherNo: r.VoucherNo,
        accDate: fmtDate(r.AccDate),
        partyName: r.PartyName,
        itemName: r.ItemName,
        qty: parseDec(r.Qty),
        unitRate: parseDec(r.UnitRate),
        totalAmount: parseDec(r.TotalAmount)
      });
    });

    const groups = [];
    let reportTotalAmount = 0;
    let reportTotalQty = 0;

    Object.keys(grouped).sort().forEach(shName => {
      const items = grouped[shName];
      let shTotalAmount = 0;
      let shTotalQty = 0;
      let slNo = 0;

      const shItems = items.map(it => {
        slNo++;
        shTotalAmount += it.totalAmount;
        shTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportTotalAmount += shTotalAmount;
      reportTotalQty += shTotalQty;

      groups.push({
        subHeadName: shName,
        items: shItems,
        shTotalAmount,
        shTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report - Sub Head wise',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty,
        reportTotalAmount
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Sub Head Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 2.11 Bill Report - Item Wise
exports.getBillReportItemWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const items = parseFilterParam(req.query.items);

    let whereClause = `be.AccDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (items) {
      whereClause += ` AND bed.ItemName IN (:items)`;
      replacements.items = items;
    }

    const rows = await sequelize.query(`
      SELECT
        bed.ItemName,
        be.VoucherNo,
        be.AccDate,
        be.PartyName,
        be.PartyBillNo,
        bed.Qty,
        bed.UnitRate,
        bed.TotalAmount
      FROM bill_entries be
      JOIN bill_entry_details bed ON bed.VoucherNo = be.VoucherNo
      WHERE ${whereClause}
      ORDER BY bed.ItemName ASC, be.AccDate ASC, be.VoucherNo ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const item = r.ItemName;
      if (!grouped[item]) grouped[item] = [];
      grouped[item].push({
        voucherNo: r.VoucherNo,
        accDate: fmtDate(r.AccDate),
        partyName: r.PartyName,
        partyBillNo: r.PartyBillNo || '',
        qty: parseDec(r.Qty),
        unitRate: parseDec(r.UnitRate),
        totalAmount: parseDec(r.TotalAmount)
      });
    });

    const groups = [];
    let reportTotalAmount = 0;
    let reportTotalQty = 0;

    Object.keys(grouped).sort().forEach(itemName => {
      const list = grouped[itemName];
      let itemTotalAmount = 0;
      let itemTotalQty = 0;
      let slNo = 0;

      const lineItems = list.map(it => {
        slNo++;
        itemTotalAmount += it.totalAmount;
        itemTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportTotalAmount += itemTotalAmount;
      reportTotalQty += itemTotalQty;

      groups.push({
        itemName,
        items: lineItems,
        itemTotalAmount,
        itemTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Bill Report - Item wise',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty,
        reportTotalAmount
      }
    });
  } catch (error) {
    console.error('Error generating Bill Report Item Wise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  3. RECEIPT REPORTS
// ══════════════════════════════════════════════════════════════════════

// 3.1 Date Wise Receipt Register
exports.getDateWiseReceiptRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        r.GRNNo,
        r.PartyName,
        r.InwardDate,
        r.InvoiceNo,
        r.InvoiceDate,
        r.GrandTotal   AS ReceiptGrandTotal,
        rd.ItemName,
        rd.Qty,
        rd.UnitRate,
        rd.TotalAmount,
        COALESCE(i.UOM, '') AS UOM
      FROM receipts r
      JOIN receipt_details rd ON rd.GRNNo = r.GRNNo
      LEFT JOIN items i ON i.ItemName = rd.ItemName
      WHERE r.InwardDate BETWEEN :from AND :to
      ORDER BY r.InwardDate ASC, r.GRNNo ASC, rd.DetailId ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

    const grouped = {};
    let reportTotalAmount = 0;
    let reportGrandTotal = 0;

    rows.forEach(row => {
      const dateKey = row.InwardDate;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push({
        itemName: row.ItemName,
        partyName: row.PartyName,
        billNo: row.InvoiceNo || '',
        billDate: fmtDate(row.InvoiceDate),
        qty: parseDec(row.Qty),
        uom: row.UOM,
        unitRate: parseDec(row.UnitRate),
        totalAmount: parseDec(row.TotalAmount),
        grandTotal: parseDec(row.TotalAmount)
      });
    });

    const result = [];
    let slNo = 0;

    Object.keys(grouped).sort().forEach(dateKey => {
      const items = grouped[dateKey];
      let dateTotalAmount = 0;
      let dateGrandTotal = 0;

      const dateItems = items.map(item => {
        slNo++;
        dateTotalAmount += item.totalAmount;
        dateGrandTotal += item.grandTotal;
        return { slNo, ...item };
      });

      reportTotalAmount += dateTotalAmount;
      reportGrandTotal += dateGrandTotal;

      result.push({
        date: dateKey,
        dateFormatted: fmtDateFull(dateKey),
        items: dateItems,
        dateTotalQty: dateItems.reduce((s, i) => s + i.qty, 0),
        dateTotalAmount,
        dateGrandTotal
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Date wise receipt register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportTotalQty: result.reduce((s, g) => s + g.dateTotalQty, 0),
        reportTotalAmount,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating date wise receipt register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 3.2 Party Wise Receipt Register
exports.getPartyWiseReceiptRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const parties = parseFilterParam(req.query.parties);

    let whereClause = `r.InwardDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (parties) {
      whereClause += ` AND r.PartyName IN (:parties)`;
      replacements.parties = parties;
    }

    const rows = await sequelize.query(`
      SELECT
        r.GRNNo,
        r.PartyName,
        r.InwardDate,
        r.InvoiceNo,
        r.InvoiceDate,
        rd.ItemName,
        rd.Qty,
        rd.UnitRate,
        rd.TotalAmount,
        COALESCE(i.UOM, '') AS UOM
      FROM receipts r
      JOIN receipt_details rd ON rd.GRNNo = r.GRNNo
      LEFT JOIN items i ON i.ItemName = rd.ItemName
      WHERE ${whereClause}
      ORDER BY r.PartyName ASC, r.GRNNo ASC, rd.DetailId ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};

    rows.forEach(row => {
      const key = row.PartyName || 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        itemName: row.ItemName,
        billNo: row.InvoiceNo || '',
        billDate: fmtDate(row.InvoiceDate),
        grnNo: row.GRNNo,
        qty: parseDec(row.Qty),
        uom: row.UOM,
        unitRate: parseDec(row.UnitRate),
        grandTotal: parseDec(row.TotalAmount)
      });
    });

    const result = [];
    let reportTotalQty = 0;
    let reportGrandTotal = 0;

    Object.keys(grouped).sort().forEach(partyName => {
      const items = grouped[partyName];
      let slNo = 0;
      let partyTotalQty = 0;
      let partyGrandTotal = 0;

      const partyItems = items.map(item => {
        slNo++;
        partyTotalQty += item.qty;
        partyGrandTotal += item.grandTotal;
        return { slNo, ...item };
      });

      reportTotalQty += partyTotalQty;
      reportGrandTotal += partyGrandTotal;

      result.push({
        partyName,
        items: partyItems,
        partyTotalQty,
        partyGrandTotal
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Party wise receipt register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportTotalQty,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating party wise receipt register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 3.3 Sub Head Wise Receipt Register
exports.getSubHeadWiseReceiptRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const subheads = parseFilterParam(req.query.subheads);

    let whereClause = `r.InwardDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (subheads) {
      whereClause += ` AND (sh.code IN (:subheads) OR sh.sub_group_name IN (:subheads))`;
      replacements.subheads = subheads;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(sh.sub_group_name, 'Unassigned') AS subHeadName,
        rd.ItemName,
        r.PartyName,
        r.InvoiceNo,
        r.InvoiceDate,
        r.GRNNo,
        rd.Qty,
        rd.UnitRate,
        rd.TotalAmount,
        COALESCE(i.UOM, '') AS UOM
      FROM receipts r
      JOIN receipt_details rd ON rd.GRNNo = r.GRNNo
      LEFT JOIN items i ON i.ItemName = rd.ItemName
      LEFT JOIN sub_heads sh ON sh.code = i.SubHeadCode
      WHERE ${whereClause}
      ORDER BY subHeadName ASC, r.InwardDate ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(row => {
      const key = row.subHeadName;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        itemName: row.ItemName,
        partyName: row.PartyName,
        billNo: row.InvoiceNo || '',
        billDate: fmtDate(row.InvoiceDate),
        grnNo: row.GRNNo,
        qty: parseDec(row.Qty),
        uom: row.UOM,
        unitRate: parseDec(row.UnitRate),
        grandTotal: parseDec(row.TotalAmount)
      });
    });

    const result = [];
    let reportTotalQty = 0;
    let reportGrandTotal = 0;

    Object.keys(grouped).sort().forEach(subHeadName => {
      const items = grouped[subHeadName];
      let slNo = 0;
      let shTotalQty = 0;
      let shGrandTotal = 0;

      const lineItems = items.map(item => {
        slNo++;
        shTotalQty += item.qty;
        shGrandTotal += item.grandTotal;
        return { slNo, ...item };
      });

      reportTotalQty += shTotalQty;
      reportGrandTotal += shGrandTotal;

      result.push({
        subHeadName,
        items: lineItems,
        shTotalQty,
        shGrandTotal
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Sub Head wise receipt register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportTotalQty,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating Sub Head wise receipt register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 3.4 Department Wise Receipt Register
exports.getDepartmentWiseReceiptRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const departments = parseFilterParam(req.query.departments);

    let whereClause = `r.InwardDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (departments) {
      whereClause += ` AND (d.dept_id IN (:departments) OR d.dept_name IN (:departments))`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        SUM(rd.TotalAmount) AS totalAmount,
        SUM(rd.TotalAmount) AS grandTotal
      FROM receipts r
      JOIN receipt_details rd ON rd.GRNNo = r.GRNNo
      LEFT JOIN items i ON i.ItemName = rd.ItemName
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      GROUP BY COALESCE(d.dept_name, 'Unassigned')
      ORDER BY departmentName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportTotalAmount = 0;
    let reportGrandTotal = 0;

    const items = rows.map((row, idx) => {
      const totalAmount = parseDec(row.totalAmount);
      const grandTotal = parseDec(row.grandTotal);
      reportTotalAmount += totalAmount;
      reportGrandTotal += grandTotal;
      return {
        slNo: idx + 1,
        departmentName: row.departmentName,
        totalAmount,
        grandTotal
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Department wise receipt register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportTotalAmount,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating department wise receipt register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 3.5 Item Wise Receipt Register
exports.getItemWiseReceiptRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const items = parseFilterParam(req.query.items);

    let whereClause = `r.InwardDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (items) {
      whereClause += ` AND rd.ItemName IN (:items)`;
      replacements.items = items;
    }

    const rows = await sequelize.query(`
      SELECT
        rd.ItemName,
        r.GRNNo,
        r.PartyName,
        r.InvoiceNo,
        r.InvoiceDate,
        r.InwardDate,
        rd.Qty,
        rd.UnitRate,
        rd.TotalAmount,
        COALESCE(i.UOM, '') AS UOM
      FROM receipts r
      JOIN receipt_details rd ON rd.GRNNo = r.GRNNo
      LEFT JOIN items i ON i.ItemName = rd.ItemName
      WHERE ${whereClause}
      ORDER BY rd.ItemName ASC, r.InwardDate ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};

    rows.forEach(row => {
      const key = row.ItemName;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        partyName: row.PartyName,
        billNo: row.InvoiceNo || '',
        billDate: fmtDate(row.InvoiceDate),
        grnNo: row.GRNNo,
        qty: parseDec(row.Qty),
        uom: row.UOM,
        unitRate: parseDec(row.UnitRate),
        grandTotal: parseDec(row.TotalAmount)
      });
    });

    const result = [];
    let reportTotalQty = 0;
    let reportGrandTotal = 0;

    Object.keys(grouped).sort().forEach(itemName => {
      const itemsList = grouped[itemName];
      let slNo = 0;
      let itemTotalQty = 0;
      let itemGrandTotal = 0;

      const lineItems = itemsList.map(item => {
        slNo++;
        itemTotalQty += item.qty;
        itemGrandTotal += item.grandTotal;
        return { slNo, ...item };
      });

      reportTotalQty += itemTotalQty;
      reportGrandTotal += itemGrandTotal;

      result.push({
        itemName,
        items: lineItems,
        itemTotalQty,
        itemGrandTotal
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Item wise receipt register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportTotalQty,
        reportGrandTotal
      }
    });
  } catch (error) {
    console.error('Error generating item wise receipt register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 3.6 Receipt Return Pending
exports.getReceiptReturnPending = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        po.OrderNo,
        po.OrderDate,
        po.PartyName,
        pod.ItemName,
        pod.Qty AS OrderQty,
        COALESCE(recv.ReceivedQty, 0) AS ReceivedQty,
        (pod.Qty - COALESCE(recv.ReceivedQty, 0)) AS PendingQty,
        pod.UnitRate
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      LEFT JOIN (
        SELECT rd.OrderNo, rd.ItemName, SUM(rd.Qty) AS ReceivedQty
        FROM receipt_details rd
        GROUP BY rd.OrderNo, rd.ItemName
      ) recv ON recv.OrderNo = po.OrderNo AND recv.ItemName = pod.ItemName
      WHERE po.OrderDate BETWEEN :from AND :to
        AND (pod.Qty - COALESCE(recv.ReceivedQty, 0)) > 0
      ORDER BY po.OrderNo ASC, pod.DetailId ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    let reportTotalOrderQty = 0;
    let reportTotalRecQty = 0;
    let reportTotalPendingQty = 0;

    const items = rows.map((r, idx) => {
      const orderQty = parseDec(r.OrderQty);
      const receivedQty = parseDec(r.ReceivedQty);
      const pendingQty = parseDec(r.PendingQty);
      reportTotalOrderQty += orderQty;
      reportTotalRecQty += receivedQty;
      reportTotalPendingQty += pendingQty;

      return {
        slNo: idx + 1,
        orderNo: r.OrderNo,
        orderDate: fmtDate(r.OrderDate),
        partyName: r.PartyName,
        itemName: r.ItemName,
        orderQty,
        receivedQty,
        pendingQty,
        unitRate: parseDec(r.UnitRate)
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Receipt Return Pending',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportTotalOrderQty,
        reportTotalRecQty,
        reportTotalPendingQty
      }
    });
  } catch (error) {
    console.error('Error generating Receipt Return Pending:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  4. STOCK REPORTS
// ══════════════════════════════════════════════════════════════════════

// 4.1 Item Wise Stock Report (Web View)
exports.getItemWiseStockReport = async (req, res) => {
  try {
    const itemsFilter = parseFilterParam(req.query.items);
    let whereClause = `1=1`;
    const replacements = {};

    if (itemsFilter) {
      whereClause += ` AND (i.ItemName IN (:itemsFilter) OR i.ItemCode IN (:itemsFilter))`;
      replacements.itemsFilter = itemsFilter;
    }

    const rows = await sequelize.query(`
      SELECT
        i.ItemCode,
        i.ItemName,
        i.Quantity,
        i.UnitRate,
        (COALESCE(i.Quantity, 0) * COALESCE(i.UnitRate, 0)) AS StockValue,
        COALESCE(i.UOM, '') AS UOM,
        COALESCE(i.Location, '') AS Location,
        COALESCE(d.dept_name, 'Unassigned') AS departmentName
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      ORDER BY departmentName ASC, i.ItemName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportTotalQty = 0;
    let reportTotalValue = 0;

    const items = rows.map((r, idx) => {
      const qty = parseDec(r.Quantity);
      const value = parseDec(r.StockValue);
      reportTotalQty += qty;
      reportTotalValue += value;

      return {
        slNo: idx + 1,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        departmentName: r.departmentName,
        quantity: qty,
        unitRate: parseDec(r.UnitRate),
        value,
        uom: r.UOM,
        location: r.Location
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Item wise stock',
        items,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating Item Wise Stock Report:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.2 Item Wise Opening Stock
exports.getItemWiseOpeningStock = async (req, res) => {
  try {
    const itemsFilter = parseFilterParam(req.query.items);
    let whereClause = `1=1`;
    const replacements = {};

    if (itemsFilter) {
      whereClause += ` AND (i.ItemName IN (:itemsFilter) OR i.ItemCode IN (:itemsFilter))`;
      replacements.itemsFilter = itemsFilter;
    }

    const rows = await sequelize.query(`
      SELECT
        i.ItemCode,
        i.ItemName,
        i.OpeningQty,
        i.UnitRate,
        COALESCE(i.OpenValue, (COALESCE(i.OpeningQty, 0) * COALESCE(i.UnitRate, 0))) AS OpenValue,
        COALESCE(i.UOM, '') AS UOM,
        COALESCE(d.dept_name, 'Unassigned') AS departmentName
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      ORDER BY departmentName ASC, i.ItemName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportTotalQty = 0;
    let reportTotalValue = 0;

    const items = rows.map((r, idx) => {
      const qty = parseDec(r.OpeningQty);
      const value = parseDec(r.OpenValue);
      reportTotalQty += qty;
      reportTotalValue += value;

      return {
        slNo: idx + 1,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        departmentName: r.departmentName,
        openingQty: qty,
        unitRate: parseDec(r.UnitRate),
        openValue: value,
        uom: r.UOM
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Item wise opening stock',
        items,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating Item Wise Opening Stock:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.3 Department Wise Stock Abstract
exports.getDepartmentWiseStock = async (req, res) => {
  try {
    const departments = parseFilterParam(req.query.departments);
    let whereClause = `1=1`;
    const replacements = {};

    if (departments) {
      whereClause += ` AND (d.dept_id IN (:departments) OR d.dept_name IN (:departments))`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        COUNT(i.ItemCode) AS itemCount,
        SUM(COALESCE(i.OpeningQty, 0)) AS totalQty,
        SUM(COALESCE(i.OpeningQty, 0) * COALESCE(i.UnitRate, 0)) AS totalValue
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      GROUP BY COALESCE(d.dept_name, 'Unassigned')
      ORDER BY departmentName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportTotalQty = 0;
    let reportTotalValue = 0;

    const items = rows.map((row, idx) => {
      const totalQty = parseDec(row.totalQty);
      const totalValue = parseDec(row.totalValue);
      reportTotalQty += totalQty;
      reportTotalValue += totalValue;
      return {
        slNo: idx + 1,
        departmentName: row.departmentName,
        itemCount: parseInt(row.itemCount) || 0,
        totalQty,
        totalValue
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Department wise stock abstract',
        items,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating department wise stock abstract:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.4 Department Wise Closing Stock Abstract
exports.getDepartmentWiseClosingStock = async (req, res) => {
  try {
    const departments = parseFilterParam(req.query.departments);
    let whereClause = `1=1`;
    const replacements = {};

    if (departments) {
      whereClause += ` AND (d.dept_id IN (:departments) OR d.dept_name IN (:departments))`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        COUNT(i.ItemCode) AS itemCount,
        SUM(COALESCE(i.Quantity, 0)) AS closingQty,
        SUM(COALESCE(i.Quantity, 0) * COALESCE(i.UnitRate, 0)) AS closingValue
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      GROUP BY COALESCE(d.dept_name, 'Unassigned')
      ORDER BY departmentName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportTotalQty = 0;
    let reportTotalValue = 0;

    const items = rows.map((row, idx) => {
      const closingQty = parseDec(row.closingQty);
      const closingValue = parseDec(row.closingValue);
      reportTotalQty += closingQty;
      reportTotalValue += closingValue;
      return {
        slNo: idx + 1,
        departmentName: row.departmentName,
        itemCount: parseInt(row.itemCount) || 0,
        closingQty,
        closingValue
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Department wise Closing stock abstract',
        items,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating department wise closing stock abstract:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.5 Department Wise Stock Detail
exports.getDepartmentWiseStockDetail = async (req, res) => {
  try {
    const departments = parseFilterParam(req.query.departments);
    let whereClause = `1=1`;
    const replacements = {};

    if (departments) {
      whereClause += ` AND (d.dept_id IN (:departments) OR d.dept_name IN (:departments))`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        i.ItemCode,
        i.ItemName,
        i.Quantity,
        i.UnitRate,
        (COALESCE(i.Quantity, 0) * COALESCE(i.UnitRate, 0)) AS StockValue,
        COALESCE(i.UOM, '') AS UOM
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE ${whereClause}
      ORDER BY departmentName ASC, i.ItemName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const dept = r.departmentName;
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push({
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        qty: parseDec(r.Quantity),
        unitRate: parseDec(r.UnitRate),
        value: parseDec(r.StockValue),
        uom: r.UOM
      });
    });

    const groups = [];
    let reportTotalQty = 0;
    let reportTotalValue = 0;

    Object.keys(grouped).sort().forEach(deptName => {
      const items = grouped[deptName];
      let deptTotalQty = 0;
      let deptTotalValue = 0;
      let slNo = 0;

      const deptItems = items.map(it => {
        slNo++;
        deptTotalQty += it.qty;
        deptTotalValue += it.value;
        return { slNo, ...it };
      });

      reportTotalQty += deptTotalQty;
      reportTotalValue += deptTotalValue;

      groups.push({
        departmentName: deptName,
        items: deptItems,
        deptTotalQty,
        deptTotalValue
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Department wise stock detail',
        groups,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating department wise stock detail:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.6 Sub Head Wise Stock Abstract
exports.getSubHeadWiseStockAbstract = async (req, res) => {
  try {
    const subheads = parseFilterParam(req.query.subheads);
    let whereClause = `1=1`;
    const replacements = {};

    if (subheads) {
      whereClause += ` AND (sh.code IN (:subheads) OR sh.sub_group_name IN (:subheads))`;
      replacements.subheads = subheads;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(sh.sub_group_name, 'Unassigned') AS subHeadName,
        COUNT(i.ItemCode) AS itemCount,
        SUM(COALESCE(i.Quantity, 0)) AS totalQty,
        SUM(COALESCE(i.Quantity, 0) * COALESCE(i.UnitRate, 0)) AS totalValue
      FROM items i
      LEFT JOIN sub_heads sh ON sh.code = i.SubHeadCode
      WHERE ${whereClause}
      GROUP BY COALESCE(sh.sub_group_name, 'Unassigned')
      ORDER BY subHeadName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    let reportTotalQty = 0;
    let reportTotalValue = 0;

    const items = rows.map((r, idx) => {
      const totalQty = parseDec(r.totalQty);
      const totalValue = parseDec(r.totalValue);
      reportTotalQty += totalQty;
      reportTotalValue += totalValue;

      return {
        slNo: idx + 1,
        subHeadName: r.subHeadName,
        itemCount: parseInt(r.itemCount) || 0,
        totalQty,
        totalValue
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Sub Head wise stock abstract',
        items,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating Sub Head wise stock abstract:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.7 Sub Head Wise Stock Detail
exports.getSubHeadWiseStockDetail = async (req, res) => {
  try {
    const subheads = parseFilterParam(req.query.subheads);
    let whereClause = `1=1`;
    const replacements = {};

    if (subheads) {
      whereClause += ` AND (sh.code IN (:subheads) OR sh.sub_group_name IN (:subheads))`;
      replacements.subheads = subheads;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(sh.sub_group_name, 'Unassigned') AS subHeadName,
        i.ItemCode,
        i.ItemName,
        i.Quantity,
        i.UnitRate,
        (COALESCE(i.Quantity, 0) * COALESCE(i.UnitRate, 0)) AS StockValue,
        COALESCE(i.UOM, '') AS UOM
      FROM items i
      LEFT JOIN sub_heads sh ON sh.code = i.SubHeadCode
      WHERE ${whereClause}
      ORDER BY subHeadName ASC, i.ItemName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const sh = r.subHeadName;
      if (!grouped[sh]) grouped[sh] = [];
      grouped[sh].push({
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        qty: parseDec(r.Quantity),
        unitRate: parseDec(r.UnitRate),
        value: parseDec(r.StockValue),
        uom: r.UOM
      });
    });

    const groups = [];
    let reportTotalQty = 0;
    let reportTotalValue = 0;

    Object.keys(grouped).sort().forEach(shName => {
      const items = grouped[shName];
      let shTotalQty = 0;
      let shTotalValue = 0;
      let slNo = 0;

      const shItems = items.map(it => {
        slNo++;
        shTotalQty += it.qty;
        shTotalValue += it.value;
        return { slNo, ...it };
      });

      reportTotalQty += shTotalQty;
      reportTotalValue += shTotalValue;

      groups.push({
        subHeadName: shName,
        items: shItems,
        shTotalQty,
        shTotalValue
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Sub Head wise stock detail',
        groups,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating Sub Head wise stock detail:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.8 Nil Stock Items
exports.getNilStockItems = async (req, res) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        i.ItemCode,
        i.ItemName,
        COALESCE(i.UOM, '') AS UOM,
        COALESCE(i.Location, '') AS Location,
        COALESCE(d.dept_name, 'Unassigned') AS departmentName
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE i.Quantity = 0 OR i.Quantity IS NULL
      ORDER BY departmentName ASC, i.ItemName ASC
    `, { type: sequelize.QueryTypes.SELECT });

    const items = rows.map((r, idx) => ({
      slNo: idx + 1,
      itemCode: r.ItemCode,
      itemName: r.ItemName,
      departmentName: r.departmentName,
      uom: r.UOM,
      location: r.Location
    }));

    res.json({
      success: true,
      data: {
        reportTitle: 'Nil Stock Items',
        items,
        totalItems: items.length
      }
    });
  } catch (error) {
    console.error('Error generating Nil Stock Items:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.9 Max Level Stock Items
exports.getMaxLevelStockItems = async (req, res) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        i.ItemCode,
        i.ItemName,
        i.Quantity,
        i.MaxStockLevel,
        (i.Quantity - i.MaxStockLevel) AS excessQty,
        i.UnitRate,
        COALESCE(i.UOM, '') AS UOM,
        COALESCE(d.dept_name, 'Unassigned') AS departmentName
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE i.MaxStockLevel > 0 AND i.Quantity >= i.MaxStockLevel
      ORDER BY excessQty DESC, i.ItemName ASC
    `, { type: sequelize.QueryTypes.SELECT });

    let reportTotalQty = 0;

    const items = rows.map((r, idx) => {
      const quantity = parseDec(r.Quantity);
      reportTotalQty += quantity;

      return {
        slNo: idx + 1,
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        departmentName: r.departmentName,
        quantity,
        maxStockLevel: parseDec(r.MaxStockLevel),
        excessQty: parseDec(r.excessQty),
        unitRate: parseDec(r.UnitRate),
        uom: r.UOM
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'MaxLevel Stock Items',
        items,
        reportTotalQty
      }
    });
  } catch (error) {
    console.error('Error generating MaxLevel Stock Items:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 4.10 Item Wise Stock - Excel Export
exports.exportItemWiseStock = async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: ['dept_id', 'dept_name'],
      order: [['dept_name', 'ASC']]
    });

    const items = await Item.findAll({
      attributes: ['ItemCode', 'ItemName', 'DepartmentId', 'Quantity', 'UnitRate'],
      order: [['DepartmentId', 'ASC'], ['ItemName', 'ASC']]
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Item Wise Stock');

    sheet.columns = [
      { header: 'Department Name', key: 'departmentName', width: 28 },
      { header: 'Item Code', key: 'itemCode', width: 14 },
      { header: 'Item Name', key: 'itemName', width: 32 },
      { header: 'Quantity', key: 'quantity', width: 14 },
      { header: 'Rate', key: 'rate', width: 14 },
      { header: 'Value', key: 'value', width: 16 }
    ];

    const grouped = new Map();
    for (const item of items) {
      const deptId = item.DepartmentId || 0;
      if (!grouped.has(deptId)) grouped.set(deptId, []);
      grouped.get(deptId).push(item);
    }

    for (const dept of departments) {
      const deptItems = grouped.get(dept.dept_id) || [];
      if (deptItems.length === 0) continue;

      sheet.addRow({
        departmentName: dept.dept_name,
        itemCode: '',
        itemName: '',
        quantity: '',
        rate: '',
        value: ''
      });

      for (const item of deptItems) {
        const qty = Number(item.Quantity || 0);
        const rate = Number(item.UnitRate || 0);

        sheet.addRow({
          departmentName: dept.dept_name,
          itemCode: item.ItemCode,
          itemName: item.ItemName,
          quantity: qty,
          rate: rate,
          value: qty * rate
        });
      }

      sheet.addRow({});
    }

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=item-wise-stock-report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting item wise stock report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting item wise stock report',
      error: error.message
    });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  5. OTHERS (GATE PASS & LOCATION) REPORTS
// ══════════════════════════════════════════════════════════════════════

// 5.1 Gate Pass Pending Report
exports.getGatePassPendingReport = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        gpo.GpNo,
        gpo.GpDate,
        gpo.PartyName,
        gpo.Department,
        gpo.Returnable,
        gpod.ItemName,
        gpod.Qty AS SentQty,
        COALESCE(ret.ReturnedQty, 0) AS ReturnedQty,
        (gpod.Qty - COALESCE(ret.ReturnedQty, 0)) AS PendingQty
      FROM gate_pass_outs gpo
      JOIN gate_pass_out_details gpod ON gpod.GpNo = gpo.GpNo
      LEFT JOIN (
        SELECT gpid.GpNo, gpid.ItemName, SUM(gpid.RecQty) AS ReturnedQty
        FROM gate_pass_in_details gpid
        GROUP BY gpid.GpNo, gpid.ItemName
      ) ret ON ret.GpNo = CAST(gpo.GpNo AS CHAR) AND ret.ItemName = gpod.ItemName
      WHERE gpo.Returnable = 'Yes'
        AND gpo.GpDate BETWEEN :from AND :to
        AND (gpod.Qty - COALESCE(ret.ReturnedQty, 0)) > 0
      ORDER BY gpo.GpDate ASC, gpo.GpNo ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    let reportTotalSentQty = 0;
    let reportTotalRecQty = 0;
    let reportTotalPendingQty = 0;

    const items = rows.map((r, idx) => {
      const sentQty = parseDec(r.SentQty);
      const returnedQty = parseDec(r.ReturnedQty);
      const pendingQty = parseDec(r.PendingQty);
      reportTotalSentQty += sentQty;
      reportTotalRecQty += returnedQty;
      reportTotalPendingQty += pendingQty;

      return {
        slNo: idx + 1,
        gpNo: r.GpNo,
        gpDate: fmtDate(r.GpDate),
        partyName: r.PartyName,
        department: r.Department || '',
        itemName: r.ItemName,
        sentQty,
        returnedQty,
        pendingQty
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Gate Pass Pending Report',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportTotalSentQty,
        reportTotalRecQty,
        reportTotalPendingQty
      }
    });
  } catch (error) {
    console.error('Error generating Gate Pass Pending Report:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 5.2 Party Wise Gate Pass Pending Report
exports.getPartyWiseGatePassPending = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const parties = parseFilterParam(req.query.parties);

    let whereClause = `gpo.Returnable = 'Yes' AND gpo.GpDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (parties) {
      whereClause += ` AND gpo.PartyName IN (:parties)`;
      replacements.parties = parties;
    }

    const rows = await sequelize.query(`
      SELECT
        gpo.PartyName,
        gpo.GpNo,
        gpo.GpDate,
        gpo.Department,
        gpod.ItemName,
        gpod.Qty AS SentQty,
        COALESCE(ret.ReturnedQty, 0) AS ReturnedQty,
        (gpod.Qty - COALESCE(ret.ReturnedQty, 0)) AS PendingQty
      FROM gate_pass_outs gpo
      JOIN gate_pass_out_details gpod ON gpod.GpNo = gpo.GpNo
      LEFT JOIN (
        SELECT gpid.GpNo, gpid.ItemName, SUM(gpid.RecQty) AS ReturnedQty
        FROM gate_pass_in_details gpid
        GROUP BY gpid.GpNo, gpid.ItemName
      ) ret ON ret.GpNo = CAST(gpo.GpNo AS CHAR) AND ret.ItemName = gpod.ItemName
      WHERE ${whereClause}
        AND (gpod.Qty - COALESCE(ret.ReturnedQty, 0)) > 0
      ORDER BY gpo.PartyName ASC, gpo.GpDate ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const party = r.PartyName || 'Unknown';
      if (!grouped[party]) grouped[party] = [];
      grouped[party].push({
        gpNo: r.GpNo,
        gpDate: fmtDate(r.GpDate),
        department: r.Department || '',
        itemName: r.ItemName,
        sentQty: parseDec(r.SentQty),
        returnedQty: parseDec(r.ReturnedQty),
        pendingQty: parseDec(r.PendingQty)
      });
    });

    const groups = [];
    let reportTotalPendingQty = 0;

    Object.keys(grouped).sort().forEach(partyName => {
      const items = grouped[partyName];
      let partyPendingQty = 0;
      let slNo = 0;

      const partyItems = items.map(it => {
        slNo++;
        partyPendingQty += it.pendingQty;
        return { slNo, ...it };
      });

      reportTotalPendingQty += partyPendingQty;

      groups.push({
        partyName,
        items: partyItems,
        partyPendingQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Party wise Gate Pass Pending Report',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalPendingQty
      }
    });
  } catch (error) {
    console.error('Error generating Party wise Gate Pass Pending:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 5.3 Gate Pass Returnable / NonReturnable Report
exports.getGatePassReturnableNonReturnable = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        gpo.Returnable,
        gpo.GpNo,
        gpo.GpDate,
        gpo.PartyName,
        gpo.Department,
        gpod.ItemName,
        gpod.Qty,
        COALESCE(gpod.Reason, gpo.Remarks, '') AS Reason
      FROM gate_pass_outs gpo
      JOIN gate_pass_out_details gpod ON gpod.GpNo = gpo.GpNo
      WHERE gpo.GpDate BETWEEN :from AND :to
      ORDER BY gpo.Returnable DESC, gpo.GpDate ASC, gpo.GpNo ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const type = r.Returnable === 'Yes' ? 'Returnable' : 'Non-Returnable';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        gpNo: r.GpNo,
        gpDate: fmtDate(r.GpDate),
        partyName: r.PartyName,
        department: r.Department || '',
        itemName: r.ItemName,
        qty: parseDec(r.Qty),
        reason: r.Reason
      });
    });

    const groups = [];
    let reportTotalQty = 0;

    ['Returnable', 'Non-Returnable'].forEach(type => {
      if (!grouped[type]) return;
      const items = grouped[type];
      let typeTotalQty = 0;
      let slNo = 0;

      const lineItems = items.map(it => {
        slNo++;
        typeTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportTotalQty += typeTotalQty;

      groups.push({
        returnableType: type,
        items: lineItems,
        typeTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Gate Pass Returnable/NonReturnable Report',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty
      }
    });
  } catch (error) {
    console.error('Error generating GP Returnable/NonReturnable Report:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 5.4 Gate Pass Returnable PartyWise
exports.getGatePassReturnablePartyWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const parties = parseFilterParam(req.query.parties);

    let whereClause = `gpo.Returnable = 'Yes' AND gpo.GpDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (parties) {
      whereClause += ` AND gpo.PartyName IN (:parties)`;
      replacements.parties = parties;
    }

    const rows = await sequelize.query(`
      SELECT
        gpo.PartyName,
        gpo.GpNo,
        gpo.GpDate,
        gpo.Department,
        gpod.ItemName,
        gpod.Qty,
        COALESCE(gpod.Reason, gpo.Remarks, '') AS Reason
      FROM gate_pass_outs gpo
      JOIN gate_pass_out_details gpod ON gpod.GpNo = gpo.GpNo
      WHERE ${whereClause}
      ORDER BY gpo.PartyName ASC, gpo.GpDate ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const party = r.PartyName || 'Unknown';
      if (!grouped[party]) grouped[party] = [];
      grouped[party].push({
        gpNo: r.GpNo,
        gpDate: fmtDate(r.GpDate),
        department: r.Department || '',
        itemName: r.ItemName,
        qty: parseDec(r.Qty),
        reason: r.Reason
      });
    });

    const groups = [];
    let reportTotalQty = 0;

    Object.keys(grouped).sort().forEach(partyName => {
      const items = grouped[partyName];
      let partyTotalQty = 0;
      let slNo = 0;

      const partyItems = items.map(it => {
        slNo++;
        partyTotalQty += it.qty;
        return { slNo, ...it };
      });

      reportTotalQty += partyTotalQty;

      groups.push({
        partyName,
        items: partyItems,
        partyTotalQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Gate Pass Returnable PartyWise',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty
      }
    });
  } catch (error) {
    console.error('Error generating GP Returnable PartyWise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 5.5 Gate Pass NonReturnable Report
exports.getGatePassNonReturnableReport = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        gpo.GpNo,
        gpo.GpDate,
        gpo.PartyName,
        gpo.Department,
        gpod.ItemName,
        gpod.Qty,
        COALESCE(gpod.Reason, gpo.Remarks, '') AS Reason
      FROM gate_pass_outs gpo
      JOIN gate_pass_out_details gpod ON gpod.GpNo = gpo.GpNo
      WHERE gpo.Returnable = 'No'
        AND gpo.GpDate BETWEEN :from AND :to
      ORDER BY gpo.GpDate ASC, gpo.GpNo ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    let reportTotalQty = 0;

    const items = rows.map((r, idx) => {
      const qty = parseDec(r.Qty);
      reportTotalQty += qty;

      return {
        slNo: idx + 1,
        gpNo: r.GpNo,
        gpDate: fmtDate(r.GpDate),
        partyName: r.PartyName,
        department: r.Department || '',
        itemName: r.ItemName,
        qty,
        reason: r.Reason
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Gate Pass NonReturnable Report',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportTotalQty
      }
    });
  } catch (error) {
    console.error('Error generating GP NonReturnable Report:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 5.6 Gate Pass In Report
exports.getGatePassInReport = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        gpi.InNo,
        gpi.GiDate,
        gpi.PartyName,
        gpi.DcNo,
        gpi.DcDate,
        gpi.InvoiceNo,
        gpi.InvoiceDate,
        gpid.ItemName,
        gpid.PendingQty,
        gpid.RecQty,
        gpid.GpNo,
        gpid.Reason
      FROM gate_pass_ins gpi
      JOIN gate_pass_in_details gpid ON gpid.InNo = gpi.InNo
      WHERE gpi.GiDate BETWEEN :from AND :to
      ORDER BY gpi.GiDate ASC, gpi.InNo ASC, gpid.DetailId ASC
    `, { replacements: { from, to }, type: sequelize.QueryTypes.SELECT });

    let reportTotalRecQty = 0;

    const items = rows.map((r, idx) => {
      const recQty = parseDec(r.RecQty);
      reportTotalRecQty += recQty;

      return {
        slNo: idx + 1,
        inNo: r.InNo,
        giDate: fmtDate(r.GiDate),
        partyName: r.PartyName,
        dcNo: r.DcNo || '',
        dcDate: fmtDate(r.DcDate),
        invoiceNo: r.InvoiceNo || '',
        itemName: r.ItemName,
        pendingQty: parseDec(r.PendingQty),
        recQty,
        gpNo: r.GpNo || '',
        reason: r.Reason || ''
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Gate Pass In Report',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        items,
        reportTotalRecQty
      }
    });
  } catch (error) {
    console.error('Error generating Gate Pass In Report:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 5.7 Gate Pass In PartyWise
exports.getGatePassInPartyWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const parties = parseFilterParam(req.query.parties);

    let whereClause = `gpi.GiDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (parties) {
      whereClause += ` AND gpi.PartyName IN (:parties)`;
      replacements.parties = parties;
    }

    const rows = await sequelize.query(`
      SELECT
        gpi.PartyName,
        gpi.InNo,
        gpi.GiDate,
        gpi.DcNo,
        gpid.ItemName,
        gpid.RecQty,
        gpid.GpNo,
        gpid.Reason
      FROM gate_pass_ins gpi
      JOIN gate_pass_in_details gpid ON gpid.InNo = gpi.InNo
      WHERE ${whereClause}
      ORDER BY gpi.PartyName ASC, gpi.GiDate ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const party = r.PartyName || 'Unknown';
      if (!grouped[party]) grouped[party] = [];
      grouped[party].push({
        inNo: r.InNo,
        giDate: fmtDate(r.GiDate),
        dcNo: r.DcNo || '',
        itemName: r.ItemName,
        recQty: parseDec(r.RecQty),
        gpNo: r.GpNo || '',
        reason: r.Reason || ''
      });
    });

    const groups = [];
    let reportTotalRecQty = 0;

    Object.keys(grouped).sort().forEach(partyName => {
      const items = grouped[partyName];
      let partyTotalRecQty = 0;
      let slNo = 0;

      const partyItems = items.map(it => {
        slNo++;
        partyTotalRecQty += it.recQty;
        return { slNo, ...it };
      });

      reportTotalRecQty += partyTotalRecQty;

      groups.push({
        partyName,
        items: partyItems,
        partyTotalRecQty
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Gate Pass In PartyWise',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalRecQty
      }
    });
  } catch (error) {
    console.error('Error generating Gate Pass In PartyWise:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 5.8 Item Register Location Wise Report
exports.getItemRegisterLocationWise = async (req, res) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(i.Location, 'Unassigned') AS location,
        i.ItemCode,
        i.ItemName,
        i.Quantity,
        i.UnitRate,
        (COALESCE(i.Quantity, 0) * COALESCE(i.UnitRate, 0)) AS StockValue,
        COALESCE(i.UOM, '') AS UOM,
        COALESCE(d.dept_name, 'Unassigned') AS departmentName
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      ORDER BY location ASC, i.ItemName ASC
    `, { type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(r => {
      const loc = r.location;
      if (!grouped[loc]) grouped[loc] = [];
      grouped[loc].push({
        itemCode: r.ItemCode,
        itemName: r.ItemName,
        departmentName: r.departmentName,
        qty: parseDec(r.Quantity),
        unitRate: parseDec(r.UnitRate),
        value: parseDec(r.StockValue),
        uom: r.UOM
      });
    });

    const groups = [];
    let reportTotalQty = 0;
    let reportTotalValue = 0;

    Object.keys(grouped).sort().forEach(location => {
      const items = grouped[location];
      let locTotalQty = 0;
      let locTotalValue = 0;
      let slNo = 0;

      const locItems = items.map(it => {
        slNo++;
        locTotalQty += it.qty;
        locTotalValue += it.value;
        return { slNo, ...it };
      });

      reportTotalQty += locTotalQty;
      reportTotalValue += locTotalValue;

      groups.push({
        location,
        items: locItems,
        locTotalQty,
        locTotalValue
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Item Register Location wise Report',
        groups,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating Item Register Location Wise Report:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  6. ISSUE REPORTS
// ══════════════════════════════════════════════════════════════════════

// 6.1 Date Wise Issue Register
exports.getDateWiseIssueRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        ii.IssueNo,
        ii.IssueDate,
        ii.Department,
        iid.ItemName,
        iid.Qty,
        COALESCE(iid.UOM, i.UOM, '') AS UOM,
        COALESCE(i.UnitRate, 0) AS UnitRate
      FROM item_issues ii
      JOIN item_issue_details iid ON iid.IssueNo = ii.IssueNo
      LEFT JOIN items i ON i.ItemName = iid.ItemName
      WHERE ii.IssueDate BETWEEN :from AND :to
      ORDER BY ii.IssueDate ASC, ii.IssueNo ASC, iid.DetailId ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

    const grouped = {};

    rows.forEach(row => {
      const dateKey = row.IssueDate;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      const qty = parseDec(row.Qty);
      const unitRate = parseDec(row.UnitRate);
      grouped[dateKey].push({
        issueNo: row.IssueNo,
        department: row.Department,
        itemName: row.ItemName,
        qty,
        value: qty * unitRate,
        uom: row.UOM
      });
    });

    const result = [];
    let reportTotalQty = 0;
    let reportTotalValue = 0;

    Object.keys(grouped).sort().forEach(dateKey => {
      const items = grouped[dateKey];
      let slNo = 0;
      let dateTotalQty = 0;
      let dateTotalValue = 0;

      const dateItems = items.map(item => {
        slNo++;
        dateTotalQty += item.qty;
        dateTotalValue += item.value;
        return { slNo, ...item };
      });

      reportTotalQty += dateTotalQty;
      reportTotalValue += dateTotalValue;

      result.push({
        date: dateKey,
        dateFormatted: fmtDate(dateKey),
        items: dateItems,
        dateTotalQty,
        dateTotalValue
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Date wise issue register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating date wise issue register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 6.2 Item Wise Issue Register
exports.getItemWiseIssueRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const itemsFilter = parseFilterParam(req.query.items);

    let whereClause = `ii.IssueDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (itemsFilter) {
      whereClause += ` AND iid.ItemName IN (:itemsFilter)`;
      replacements.itemsFilter = itemsFilter;
    }

    const rows = await sequelize.query(`
      SELECT
        iid.ItemName,
        ii.IssueNo,
        ii.IssueDate,
        ii.Department,
        iid.Qty,
        COALESCE(iid.UOM, i.UOM, '') AS UOM,
        COALESCE(i.UnitRate, 0) AS UnitRate
      FROM item_issues ii
      JOIN item_issue_details iid ON iid.IssueNo = ii.IssueNo
      LEFT JOIN items i ON i.ItemName = iid.ItemName
      WHERE ${whereClause}
      ORDER BY iid.ItemName ASC, ii.IssueDate ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};

    rows.forEach(row => {
      const key = row.ItemName;
      if (!grouped[key]) grouped[key] = [];
      const qty = parseDec(row.Qty);
      const unitRate = parseDec(row.UnitRate);
      grouped[key].push({
        issueNo: row.IssueNo,
        issueDate: fmtDate(row.IssueDate),
        department: row.Department,
        qty,
        value: qty * unitRate,
        uom: row.UOM
      });
    });

    const result = [];
    let reportTotalQty = 0;
    let reportTotalValue = 0;

    Object.keys(grouped).sort().forEach(itemName => {
      const items = grouped[itemName];
      let slNo = 0;
      let itemTotalQty = 0;
      let itemTotalValue = 0;

      const lineItems = items.map(item => {
        slNo++;
        itemTotalQty += item.qty;
        itemTotalValue += item.value;
        return { slNo, ...item };
      });

      reportTotalQty += itemTotalQty;
      reportTotalValue += itemTotalValue;

      result.push({
        itemName,
        items: lineItems,
        itemTotalQty,
        itemTotalValue
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Item wise issue register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating item wise issue register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 6.3 Sub Head Wise Issue Register
exports.getSubHeadWiseIssueRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const subheads = parseFilterParam(req.query.subheads);

    let whereClause = `ii.IssueDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (subheads) {
      whereClause += ` AND (sh.code IN (:subheads) OR sh.sub_group_name IN (:subheads))`;
      replacements.subheads = subheads;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(sh.sub_group_name, 'Unassigned') AS subHeadName,
        iid.ItemName,
        ii.IssueNo,
        ii.IssueDate,
        ii.Department,
        iid.Qty,
        COALESCE(iid.UOM, i.UOM, '') AS UOM,
        COALESCE(i.UnitRate, 0) AS UnitRate
      FROM item_issues ii
      JOIN item_issue_details iid ON iid.IssueNo = ii.IssueNo
      LEFT JOIN items i ON i.ItemName = iid.ItemName
      LEFT JOIN sub_heads sh ON sh.code = i.SubHeadCode
      WHERE ${whereClause}
      ORDER BY subHeadName ASC, iid.ItemName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};
    rows.forEach(row => {
      const sh = row.subHeadName;
      if (!grouped[sh]) grouped[sh] = [];
      const qty = parseDec(row.Qty);
      const unitRate = parseDec(row.UnitRate);
      grouped[sh].push({
        itemName: row.ItemName,
        issueNo: row.IssueNo,
        issueDate: fmtDate(row.IssueDate),
        department: row.Department,
        qty,
        value: qty * unitRate,
        uom: row.UOM
      });
    });

    const result = [];
    let reportTotalQty = 0;
    let reportTotalValue = 0;

    Object.keys(grouped).sort().forEach(shName => {
      const items = grouped[shName];
      let slNo = 0;
      let shTotalQty = 0;
      let shTotalValue = 0;

      const lineItems = items.map(item => {
        slNo++;
        shTotalQty += item.qty;
        shTotalValue += item.value;
        return { slNo, ...item };
      });

      reportTotalQty += shTotalQty;
      reportTotalValue += shTotalValue;

      result.push({
        subHeadName: shName,
        items: lineItems,
        shTotalQty,
        shTotalValue
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Sub Head wise issue register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating Sub Head wise issue register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 6.4 Department Wise Issue Register
exports.getDepartmentWiseIssueRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const departments = parseFilterParam(req.query.departments);

    let whereClause = `ii.IssueDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (departments) {
      whereClause += ` AND ii.Department IN (:departments)`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        ii.Department AS departmentName,
        iid.ItemName,
        iid.Qty,
        COALESCE(iid.UOM, i.UOM, '') AS UOM,
        COALESCE(i.UnitRate, 0) AS UnitRate
      FROM item_issues ii
      JOIN item_issue_details iid ON iid.IssueNo = ii.IssueNo
      LEFT JOIN items i ON i.ItemName = iid.ItemName
      WHERE ${whereClause}
      ORDER BY ii.Department ASC, iid.ItemName ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const grouped = {};

    rows.forEach(row => {
      const dept = row.departmentName || 'Unassigned';
      if (!grouped[dept]) grouped[dept] = {};
      const itemKey = row.ItemName;
      if (!grouped[dept][itemKey]) {
        grouped[dept][itemKey] = { qty: 0, value: 0, uom: row.UOM };
      }
      const qty = parseDec(row.Qty);
      const unitRate = parseDec(row.UnitRate);
      grouped[dept][itemKey].qty += qty;
      grouped[dept][itemKey].value += qty * unitRate;
    });

    const result = [];
    let reportTotalQty = 0;
    let reportTotalValue = 0;

    Object.keys(grouped).sort().forEach(deptName => {
      const itemsMap = grouped[deptName];
      let deptTotalQty = 0;
      let deptTotalValue = 0;

      const items = Object.keys(itemsMap).sort().map(itemName => {
        const item = itemsMap[itemName];
        deptTotalQty += item.qty;
        deptTotalValue += item.value;
        return {
          itemName,
          qty: item.qty,
          value: item.value,
          uom: item.uom
        };
      });

      reportTotalQty += deptTotalQty;
      reportTotalValue += deptTotalValue;

      result.push({
        departmentName: deptName,
        items,
        deptTotalQty,
        deptTotalValue
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Department wise issue register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups: result,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating department wise issue register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 6.5 Month Wise Item Movement Report (Item Wise)
exports.getMonthWiseItemMovementItemWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const itemsFilter = parseFilterParam(req.query.items);

    let whereReceipt = `r.InwardDate BETWEEN :from AND :to`;
    let whereIssue = `ii.IssueDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (itemsFilter) {
      whereReceipt += ` AND rd.ItemName IN (:itemsFilter)`;
      whereIssue += ` AND iid.ItemName IN (:itemsFilter)`;
      replacements.itemsFilter = itemsFilter;
    }

    const receipts = await sequelize.query(`
      SELECT
        rd.ItemName,
        DATE_FORMAT(r.InwardDate, '%Y-%m') AS monthKey,
        DATE_FORMAT(r.InwardDate, '%b %Y') AS monthLabel,
        SUM(rd.Qty) AS qty
      FROM receipts r
      JOIN receipt_details rd ON rd.GRNNo = r.GRNNo
      WHERE ${whereReceipt}
      GROUP BY rd.ItemName, monthKey, monthLabel
      ORDER BY monthKey ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const issues = await sequelize.query(`
      SELECT
        iid.ItemName,
        DATE_FORMAT(ii.IssueDate, '%Y-%m') AS monthKey,
        DATE_FORMAT(ii.IssueDate, '%b %Y') AS monthLabel,
        SUM(iid.Qty) AS qty
      FROM item_issues ii
      JOIN item_issue_details iid ON iid.IssueNo = ii.IssueNo
      WHERE ${whereIssue}
      GROUP BY iid.ItemName, monthKey, monthLabel
      ORDER BY monthKey ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    // Collect all unique months
    const monthMap = {};
    [...receipts, ...issues].forEach(r => {
      monthMap[r.monthKey] = r.monthLabel;
    });
    const sortedMonths = Object.keys(monthMap).sort().map(k => ({ key: k, label: monthMap[k] }));

    // Group by ItemName
    const itemMap = {};
    receipts.forEach(r => {
      if (!itemMap[r.ItemName]) itemMap[r.ItemName] = { itemName: r.ItemName, receipts: {}, issues: {} };
      itemMap[r.ItemName].receipts[r.monthKey] = parseDec(r.qty);
    });
    issues.forEach(i => {
      if (!itemMap[i.ItemName]) itemMap[i.ItemName] = { itemName: i.ItemName, receipts: {}, issues: {} };
      itemMap[i.ItemName].issues[i.monthKey] = parseDec(i.qty);
    });

    const rows = Object.keys(itemMap).sort().map((itemName, idx) => {
      const data = itemMap[itemName];
      const monthlyData = {};
      let totalRec = 0;
      let totalIss = 0;

      sortedMonths.forEach(m => {
        const rec = data.receipts[m.key] || 0;
        const iss = data.issues[m.key] || 0;
        totalRec += rec;
        totalIss += iss;
        monthlyData[m.key] = { rec, iss, net: rec - iss };
      });

      return {
        slNo: idx + 1,
        itemName,
        monthlyData,
        totalRec,
        totalIss,
        netMovement: totalRec - totalIss
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Month wise Item Movement Report (Item wise)',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        months: sortedMonths,
        rows
      }
    });
  } catch (error) {
    console.error('Error generating Month Wise Item Movement (Item):', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 6.6 Month Wise Item Movement Report (Department Wise)
exports.getMonthWiseItemMovementDepartmentWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const departments = parseFilterParam(req.query.departments);

    let whereClause = `ii.IssueDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (departments) {
      whereClause += ` AND ii.Department IN (:departments)`;
      replacements.departments = departments;
    }

    const issues = await sequelize.query(`
      SELECT
        COALESCE(ii.Department, 'Unassigned') AS departmentName,
        DATE_FORMAT(ii.IssueDate, '%Y-%m') AS monthKey,
        DATE_FORMAT(ii.IssueDate, '%b %Y') AS monthLabel,
        SUM(iid.Qty) AS qty
      FROM item_issues ii
      JOIN item_issue_details iid ON iid.IssueNo = ii.IssueNo
      WHERE ${whereClause}
      GROUP BY departmentName, monthKey, monthLabel
      ORDER BY monthKey ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const monthMap = {};
    issues.forEach(r => { monthMap[r.monthKey] = r.monthLabel; });
    const sortedMonths = Object.keys(monthMap).sort().map(k => ({ key: k, label: monthMap[k] }));

    const deptMap = {};
    issues.forEach(i => {
      const dept = i.departmentName;
      if (!deptMap[dept]) deptMap[dept] = { departmentName: dept, monthlyQty: {} };
      deptMap[dept].monthlyQty[i.monthKey] = parseDec(i.qty);
    });

    const rows = Object.keys(deptMap).sort().map((deptName, idx) => {
      const data = deptMap[deptName];
      const monthlyData = {};
      let totalQty = 0;

      sortedMonths.forEach(m => {
        const qty = data.monthlyQty[m.key] || 0;
        totalQty += qty;
        monthlyData[m.key] = qty;
      });

      return {
        slNo: idx + 1,
        departmentName: deptName,
        monthlyData,
        totalQty
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Month wise Item Movement Report (Department wise)',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        months: sortedMonths,
        rows
      }
    });
  } catch (error) {
    console.error('Error generating Month Wise Item Movement (Dept):', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 6.7 Month Wise Item Movement Report (Subhead Wise)
exports.getMonthWiseItemMovementSubHeadWise = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const subheads = parseFilterParam(req.query.subheads);

    let whereClause = `ii.IssueDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (subheads) {
      whereClause += ` AND (sh.code IN (:subheads) OR sh.sub_group_name IN (:subheads))`;
      replacements.subheads = subheads;
    }

    const issues = await sequelize.query(`
      SELECT
        COALESCE(sh.sub_group_name, 'Unassigned') AS subHeadName,
        DATE_FORMAT(ii.IssueDate, '%Y-%m') AS monthKey,
        DATE_FORMAT(ii.IssueDate, '%b %Y') AS monthLabel,
        SUM(iid.Qty) AS qty
      FROM item_issues ii
      JOIN item_issue_details iid ON iid.IssueNo = ii.IssueNo
      LEFT JOIN items i ON i.ItemName = iid.ItemName
      LEFT JOIN sub_heads sh ON sh.code = i.SubHeadCode
      WHERE ${whereClause}
      GROUP BY subHeadName, monthKey, monthLabel
      ORDER BY monthKey ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const monthMap = {};
    issues.forEach(r => { monthMap[r.monthKey] = r.monthLabel; });
    const sortedMonths = Object.keys(monthMap).sort().map(k => ({ key: k, label: monthMap[k] }));

    const shMap = {};
    issues.forEach(i => {
      const sh = i.subHeadName;
      if (!shMap[sh]) shMap[sh] = { subHeadName: sh, monthlyQty: {} };
      shMap[sh].monthlyQty[i.monthKey] = parseDec(i.qty);
    });

    const rows = Object.keys(shMap).sort().map((shName, idx) => {
      const data = shMap[shName];
      const monthlyData = {};
      let totalQty = 0;

      sortedMonths.forEach(m => {
        const qty = data.monthlyQty[m.key] || 0;
        totalQty += qty;
        monthlyData[m.key] = qty;
      });

      return {
        slNo: idx + 1,
        subHeadName: shName,
        monthlyData,
        totalQty
      };
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Month wise Item Movement Report (Subhead wise)',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        months: sortedMonths,
        rows
      }
    });
  } catch (error) {
    console.error('Error generating Month Wise Item Movement (Subhead):', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 6.8 Department-Item Wise Issue Register
exports.getDepartmentItemWiseIssueRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);
    const departments = parseFilterParam(req.query.departments);

    let whereClause = `ii.IssueDate BETWEEN :from AND :to`;
    const replacements = { from, to };

    if (departments) {
      whereClause += ` AND ii.Department IN (:departments)`;
      replacements.departments = departments;
    }

    const rows = await sequelize.query(`
      SELECT
        COALESCE(ii.Department, 'Unassigned') AS departmentName,
        iid.ItemName,
        ii.IssueNo,
        ii.IssueDate,
        iid.Qty,
        COALESCE(iid.UOM, i.UOM, '') AS UOM,
        COALESCE(i.UnitRate, 0) AS UnitRate
      FROM item_issues ii
      JOIN item_issue_details iid ON iid.IssueNo = ii.IssueNo
      LEFT JOIN items i ON i.ItemName = iid.ItemName
      WHERE ${whereClause}
      ORDER BY departmentName ASC, iid.ItemName ASC, ii.IssueDate ASC
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    // Nested grouping: Department -> Item -> Issues
    const deptMap = {};

    rows.forEach(r => {
      const dept = r.departmentName;
      if (!deptMap[dept]) deptMap[dept] = {};
      const item = r.ItemName;
      if (!deptMap[dept][item]) deptMap[dept][item] = [];

      const qty = parseDec(r.Qty);
      const unitRate = parseDec(r.UnitRate);
      deptMap[dept][item].push({
        issueNo: r.IssueNo,
        issueDate: fmtDate(r.IssueDate),
        qty,
        unitRate,
        value: qty * unitRate,
        uom: r.UOM
      });
    });

    const groups = [];
    let reportTotalQty = 0;
    let reportTotalValue = 0;

    Object.keys(deptMap).sort().forEach(deptName => {
      const itemMap = deptMap[deptName];
      let deptTotalQty = 0;
      let deptTotalValue = 0;
      const itemGroups = [];

      Object.keys(itemMap).sort().forEach(itemName => {
        const issuesList = itemMap[itemName];
        let itemTotalQty = 0;
        let itemTotalValue = 0;
        let slNo = 0;

        const lineItems = issuesList.map(it => {
          slNo++;
          itemTotalQty += it.qty;
          itemTotalValue += it.value;
          return { slNo, ...it };
        });

        deptTotalQty += itemTotalQty;
        deptTotalValue += itemTotalValue;

        itemGroups.push({
          itemName,
          items: lineItems,
          itemTotalQty,
          itemTotalValue
        });
      });

      reportTotalQty += deptTotalQty;
      reportTotalValue += deptTotalValue;

      groups.push({
        departmentName: deptName,
        itemGroups,
        deptTotalQty,
        deptTotalValue
      });
    });

    res.json({
      success: true,
      data: {
        reportTitle: 'Department-Item wise issue register',
        period: `${fmtDateFull(from)} to ${fmtDateFull(to)}`,
        groups,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating Department-Item wise issue register:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};