const ExcelJS = require('exceljs');
const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/db');
const Item = require('../models/Item');
const Department = require('../models/Department');
const Receipt = require('../models/Receipt');
const ReceiptDetail = require('../models/ReceiptDetail');
const PurchaseOrder = require('../models/PurchaseOrder');
const PurchaseOrderDetail = require('../models/PurchaseOrderDetail');
const ItemIssue = require('../models/ItemIssue');
const ItemIssueDetail = require('../models/ItemIssueDetail');

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

// ── Filter Options ───────────────────────────────────────────────────

exports.getFilterOptions = async (req, res) => {
  try {
    const [departments, parties] = await Promise.all([
      Department.findAll({ attributes: ['dept_id', 'dept_name'], order: [['dept_name', 'ASC']], raw: true }),
      sequelize.query(
        `SELECT DISTINCT PartyName FROM receipts WHERE PartyName IS NOT NULL
         UNION
         SELECT DISTINCT PartyName FROM purchase_orders WHERE PartyName IS NOT NULL
         ORDER BY PartyName ASC`,
        { type: sequelize.QueryTypes.SELECT }
      )
    ]);

    res.json({
      success: true,
      data: {
        departments,
        parties: parties.map(p => p.PartyName)
      }
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ success: false, message: 'Error fetching filter options', error: error.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
//  RECEIPT REPORTS
// ══════════════════════════════════════════════════════════════════════

// 1. Date Wise Receipt Register
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

    // Group by date
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
        grandTotal: parseDec(row.TotalAmount) // line-level grand total = totalAmount for receipt register
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

// 2. Party Wise Receipt Register
exports.getPartyWiseReceiptRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

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
      WHERE r.InwardDate BETWEEN :from AND :to
      ORDER BY r.PartyName ASC, r.GRNNo ASC, rd.DetailId ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

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
        reportTitle: 'Date wise receipt register',
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

// 3. Department Wise Receipt Register
exports.getDepartmentWiseReceiptRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        SUM(rd.TotalAmount) AS totalAmount,
        SUM(rd.TotalAmount) AS grandTotal
      FROM receipts r
      JOIN receipt_details rd ON rd.GRNNo = r.GRNNo
      LEFT JOIN items i ON i.ItemName = rd.ItemName
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      WHERE r.InwardDate BETWEEN :from AND :to
      GROUP BY COALESCE(d.dept_name, 'Unassigned')
      ORDER BY departmentName ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

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

// 4. Item Wise Receipt Register
exports.getItemWiseReceiptRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

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
      WHERE r.InwardDate BETWEEN :from AND :to
      ORDER BY rd.ItemName ASC, r.InwardDate ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

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
      const items = grouped[itemName];
      let slNo = 0;
      let itemTotalQty = 0;
      let itemGrandTotal = 0;

      const lineItems = items.map(item => {
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

// ══════════════════════════════════════════════════════════════════════
//  PURCHASE ORDER REPORTS
// ══════════════════════════════════════════════════════════════════════

// 5. Supplier Wise Order Details
exports.getSupplierWiseOrderDetails = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

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
        pod.TaxAmount,
        pod.PF_Pct,
        pod.PF_Amount,
        pod.GrandTotal
      FROM purchase_orders po
      JOIN purchase_order_details pod ON pod.OrderNo = po.OrderNo
      WHERE po.OrderDate BETWEEN :from AND :to
      ORDER BY po.PartyName ASC, po.OrderNo ASC, pod.DetailId ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

    // Group by PartyName -> OrderNo
    const supplierMap = {};

    rows.forEach(row => {
      const supplier = row.PartyName || 'Unknown';
      if (!supplierMap[supplier]) supplierMap[supplier] = {};
      const orderNo = row.OrderNo;
      if (!supplierMap[supplier][orderNo]) supplierMap[supplier][orderNo] = { orderDate: row.OrderDate, items: [] };
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

      Object.keys(orders).forEach(orderNo => {
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
        reportTitle: 'Purchase Order Details',
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

// 6. Department Wise Order Details
exports.getDepartmentWiseOrderDetails = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

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
      WHERE po.OrderDate BETWEEN :from AND :to
      ORDER BY departmentName ASC, po.OrderDate ASC, pod.DetailId ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

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
        reportTitle: 'Department wise order details',
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

// ══════════════════════════════════════════════════════════════════════
//  ISSUE REPORTS
// ══════════════════════════════════════════════════════════════════════

// 7. Date Wise Issue Register
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

// 8. Item Wise Issue Register
exports.getItemWiseIssueRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

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
      WHERE ii.IssueDate BETWEEN :from AND :to
      ORDER BY iid.ItemName ASC, ii.IssueDate ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

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

// 9. Department Wise Issue Register
exports.getDepartmentWiseIssueRegister = async (req, res) => {
  try {
    const { from, to } = dateRange(req);

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
      WHERE ii.IssueDate BETWEEN :from AND :to
      ORDER BY ii.Department ASC, iid.ItemName ASC
    `, {
      replacements: { from, to },
      type: sequelize.QueryTypes.SELECT
    });

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

// ══════════════════════════════════════════════════════════════════════
//  STOCK REPORTS
// ══════════════════════════════════════════════════════════════════════

// 10. Department Wise Stock
exports.getDepartmentWiseStock = async (req, res) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        COALESCE(d.dept_name, 'Unassigned') AS departmentName,
        COUNT(i.ItemCode) AS itemCount,
        SUM(COALESCE(i.OpeningQty, 0)) AS totalQty,
        SUM(COALESCE(i.OpeningQty, 0) * COALESCE(i.UnitRate, 0)) AS totalValue
      FROM items i
      LEFT JOIN departments d ON d.dept_id = i.DepartmentId
      GROUP BY COALESCE(d.dept_name, 'Unassigned')
      ORDER BY departmentName ASC
    `, {
      type: sequelize.QueryTypes.SELECT
    });

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
        reportTitle: 'Department Wise Stock Abstract',
        items,
        reportTotalQty,
        reportTotalValue
      }
    });
  } catch (error) {
    console.error('Error generating department wise stock:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
};

// 11. Item Wise Stock – Excel export (existing)
exports.exportItemWiseStock = async (req, res) => {
  try {
    const departments = await Department.findAll({
      attributes: ['dept_id', 'dept_name'],
      order: [['dept_name', 'ASC']]
    });

    const items = await Item.findAll({
      attributes: ['ItemCode', 'ItemName', 'DepartmentId', 'OpeningQty', 'UnitRate'],
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

    const deptMap = new Map(departments.map(d => [d.dept_id, d.dept_name]));
    const grouped = new Map();

    for (const item of items) {
      const deptId = item.DepartmentId || 0;
      if (!grouped.has(deptId)) grouped.set(deptId, []);
      grouped.get(deptId).push(item);
    }

    for (const dept of departments) {
      const deptItems = grouped.get(dept.dept_id) || [];
      if (deptItems.length === 0) continue;

      // Department heading row
      sheet.addRow({
        departmentName: dept.dept_name,
        itemCode: '',
        itemName: '',
        quantity: '',
        rate: '',
        value: ''
      });

      // Department item rows
      for (const item of deptItems) {
        const qty = Number(item.OpeningQty || 0);
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

      sheet.addRow({}); // blank separator row
    }

    // Header style
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