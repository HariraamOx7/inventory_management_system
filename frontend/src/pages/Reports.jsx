// frontend/src/pages/Reports.jsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Download,
  Eye,
  Loader2,
  Calendar,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  X,
  ShoppingCart,
  PackageCheck,
  Send,
  Boxes,
  FileText,
  ClipboardList
} from 'lucide-react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import Layout from '../components/Layout';
import EntityFilterPanel from '../components/EntityFilterPanel';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const categoryIcons = {
  'Purchase Report': ShoppingCart,
  Billing: FileText,
  'Receipt Report': PackageCheck,
  'Stock Report': Boxes,
  Others: ClipboardList,
  'Issue Report': Send
};

const reportOptions = {
  'Purchase Report': [
    { label: 'Order No Wise Order Details', key: 'orderno-wise', filterType: 'orders', filterLabel: 'Order No', queryParam: 'orders' },
    { label: 'Supplier Wise Order Details', key: 'supplier-wise', filterType: 'parties', filterLabel: 'Supplier/Party', queryParam: 'parties' },
    { label: 'Department Wise Order Details', key: 'department-wise', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Purchase Order Pending Wise Details', key: 'pending-wise' },
    { label: 'Purchase Order Pending Date Wise Details', key: 'pending-date-wise' },
    { label: 'Purchase Order Price Comparision With ItemName', key: 'price-comparison', filterType: 'items', filterLabel: 'Item', queryParam: 'items' },
    { label: 'Purchase Order Party Wise Pending Details', key: 'party-pending', filterType: 'parties', filterLabel: 'Party/Supplier', queryParam: 'parties' }
  ],
  Billing: [
    { label: 'Day Book', key: 'day-book' },
    { label: 'Bill Report [ Purchase Type wise ]', key: 'purchasetype-wise', filterType: 'purchasetypes', filterLabel: 'Purchase Type', queryParam: 'purchasetypes' },
    { label: 'Bill Report(Abstract)-[ Purchase Type wise ]', key: 'purchasetype-wise-abstract', filterType: 'purchasetypes', filterLabel: 'Purchase Type', queryParam: 'purchasetypes' },
    { label: 'Purchase Register [ Purchase Type wise ]', key: 'purchase-register', filterType: 'purchasetypes', filterLabel: 'Purchase Type', queryParam: 'purchasetypes' },
    { label: 'Bill Report - Date wise', key: 'date-wise' },
    { label: 'Bill Report - Party wise', key: 'party-wise', filterType: 'parties', filterLabel: 'Party', queryParam: 'parties' },
    { label: 'Bill Report(Abstract)- Party wise', key: 'party-wise-abstract', filterType: 'parties', filterLabel: 'Party', queryParam: 'parties' },
    { label: 'Bill Report [ Department wise ]', key: 'department-wise', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Bill Report(Abstract)- Department wise', key: 'department-wise-abstract', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Bill Report - Sub Head wise', key: 'subhead-wise', filterType: 'subheads', filterLabel: 'Sub Head', queryParam: 'subheads' },
    { label: 'Bill Report - Item wise', key: 'item-wise', filterType: 'items', filterLabel: 'Item', queryParam: 'items' }
  ],
  'Receipt Report': [
    { label: 'Date wise receipt register', key: 'date-wise' },
    { label: 'Party wise receipt register', key: 'party-wise', filterType: 'parties', filterLabel: 'Party', queryParam: 'parties' },
    { label: 'Sub Head wise receipt register', key: 'subhead-wise', filterType: 'subheads', filterLabel: 'Sub Head', queryParam: 'subheads' },
    { label: 'Department wise receipt register', key: 'department-wise', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Item wise receipt register', key: 'item-wise', filterType: 'items', filterLabel: 'Item', queryParam: 'items' },
    { label: 'Receipt Return Pending', key: 'return-pending' }
  ],
  'Stock Report': [
    { label: 'Item wise stock', key: 'item-wise-report', filterType: 'items', filterLabel: 'Item', queryParam: 'items' },
    { label: 'Item wise opening stock', key: 'item-opening', filterType: 'items', filterLabel: 'Item', queryParam: 'items' },
    { label: 'Department wise stock abstract', key: 'department-wise', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Department wise Closing stock abstract', key: 'department-closing', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Department wise stock detail', key: 'department-detail', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Sub Head wise stock abstract', key: 'subhead-wise', filterType: 'subheads', filterLabel: 'Sub Head', queryParam: 'subheads' },
    { label: 'Sub Head wise stock detail', key: 'subhead-detail', filterType: 'subheads', filterLabel: 'Sub Head', queryParam: 'subheads' },
    { label: 'Nil Stock Items', key: 'nil-stock' },
    { label: 'MaxLevel Stock Items', key: 'max-level' },
    { label: 'Item Wise Stock (Excel Export)', key: 'item-wise' }
  ],
  Others: [
    { label: 'Gate Pass Pending Report', key: 'gatepass-pending' },
    { label: 'Party wise Gate Pass Pending Report', key: 'gatepass-pending-party', filterType: 'parties', filterLabel: 'Party', queryParam: 'parties' },
    { label: 'Gate Pass Returnable/NonReturnable Report', key: 'gatepass-returnable-nonreturnable' },
    { label: 'Gate Pass Returnable PartyWise', key: 'gatepass-returnable-party', filterType: 'parties', filterLabel: 'Party', queryParam: 'parties' },
    { label: 'Gate Pass NonReturnable Report', key: 'gatepass-nonreturnable' },
    { label: 'Gate Pass In Report', key: 'gatepass-in' },
    { label: 'Gate Pass In PartyWise', key: 'gatepass-in-party', filterType: 'parties', filterLabel: 'Party', queryParam: 'parties' },
    { label: 'Item Register Location wise Report', key: 'item-location' }
  ],
  'Issue Report': [
    { label: 'Date wise issue register', key: 'date-wise' },
    { label: 'Item wise issue register', key: 'item-wise', filterType: 'items', filterLabel: 'Item', queryParam: 'items' },
    { label: 'Sub Head wise issue register', key: 'subhead-wise', filterType: 'subheads', filterLabel: 'Sub Head', queryParam: 'subheads' },
    { label: 'Department wise issue register', key: 'department-wise', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Month wise Item Movement Report (Item wise)', key: 'month-movement-item', filterType: 'items', filterLabel: 'Item', queryParam: 'items' },
    { label: 'Month wise Item Movement Report (Department wise)', key: 'month-movement-dept', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' },
    { label: 'Month wise Item Movement Report (Subhead wise)', key: 'month-movement-subhead', filterType: 'subheads', filterLabel: 'Sub Head', queryParam: 'subheads' },
    { label: 'Department-Item wise issue register', key: 'department-item-wise', filterType: 'departments', filterLabel: 'Department', queryParam: 'departments' }
  ]
};

const categoryApiPrefix = {
  'Purchase Report': 'purchase',
  Billing: 'billing',
  'Receipt Report': 'receipt',
  'Stock Report': 'stock',
  Others: 'others',
  'Issue Report': 'issue'
};

// ═══════════════════════════════════════════════════════════════
//  1. PURCHASE REPORT RENDERERS
// ═══════════════════════════════════════════════════════════════

function OrderNoWiseOrderReport({ data }) {
  const cols = 9;
  return (
    <table className="rpt-tbl compact">
      <thead>
        <tr>
          <th style={{ width: 35 }}>SL No.</th>
          <th>ItemName</th>
          <th className="r">Qty</th>
          <th className="r">UnitRate</th>
          <th className="r">TotalAmt.</th>
          <th className="r">Dis.%</th>
          <th className="r">Tax %</th>
          <th className="r">Pf %</th>
          <th className="r">GrandTotal</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((ord, oi) => (
          <React.Fragment key={`ord-${oi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>
                Order No: {ord.orderNo} | Date: {ord.orderDate} | Party: {ord.partyName}
              </td>
            </tr>
            {ord.items.map((it, ii) => (
              <tr key={`o${oi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td>{it.itemName}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td className="r">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.totalAmount)}</td>
                <td className="r">{fmt(it.discountPct)}</td>
                <td className="r">{fmt(it.dutyPct)}</td>
                <td className="r">{fmt(it.pfPct)}</td>
                <td className="r">{fmt(it.grandTotal)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={2} className="lbl r">Order Subtotal:</td>
              <td className="r">{fmt(ord.orderTotalQty)}</td>
              <td colSpan={5}></td>
              <td className="r red">{fmt(ord.orderGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={2} className="lbl r">Report Total:</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td colSpan={5}></td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function SupplierWiseOrderReport({ data }) {
  const cols = 14;
  return (
    <table className="rpt-tbl compact">
      <thead>
        <tr>
          <th style={{ width: 35 }}>SL No.</th>
          <th>OrderDate</th>
          <th>ItemName</th>
          <th className="r">Qty</th>
          <th className="r">PerQty</th>
          <th className="r">UnitRate</th>
          <th className="r">TotalAmt.</th>
          <th className="r">Dis.%</th>
          <th className="r">Duty %</th>
          <th className="r">Educess %</th>
          <th className="r">HsCess %</th>
          <th className="r">Vat %</th>
          <th className="r">Pf %</th>
          <th className="r">GrandTotal</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((sup, si) => (
          <React.Fragment key={`sup-${si}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{sup.supplierName}</td>
            </tr>
            {sup.orders.map((ord, oi) => (
              <React.Fragment key={`ord-${si}-${oi}`}>
                <tr className="row-sub-hdr">
                  <td colSpan={cols}>Order No: {ord.orderNo}</td>
                </tr>
                {ord.items.map((it, ii) => (
                  <tr key={`o${si}${oi}r${ii}`}>
                    <td className="c">{it.slNo}</td>
                    <td>{it.orderDate}</td>
                    <td>{it.itemName}</td>
                    <td className="r">{fmt(it.qty)}</td>
                    <td className="r">{fmt(it.perQty)}</td>
                    <td className="r">{fmt(it.unitRate)}</td>
                    <td className="r">{fmt(it.totalAmount)}</td>
                    <td className="r">{fmt(it.discountPct)}</td>
                    <td className="r">{fmt(it.dutyPct)}</td>
                    <td className="r">{fmt(it.educessPct)}</td>
                    <td className="r">{fmt(it.hsCessPct)}</td>
                    <td className="r">{fmt(it.vatPct)}</td>
                    <td className="r">{fmt(it.pfPct)}</td>
                    <td className="r">{fmt(it.grandTotal)}</td>
                  </tr>
                ))}
                <tr className="row-subtotal">
                  <td colSpan={13} className="lbl r">Order Total:</td>
                  <td className="r red">{fmt(ord.orderGrandTotal)}</td>
                </tr>
              </React.Fragment>
            ))}
            <tr className="row-subtotal grp">
              <td colSpan={13} className="lbl r">Supplier Total:</td>
              <td className="r red">{fmt(sup.supplierGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={13} className="lbl r">Report Grand Total:</td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function DeptWiseOrderReport({ data }) {
  const cols = 13;
  return (
    <table className="rpt-tbl compact">
      <thead>
        <tr>
          <th>OrderDate</th>
          <th>ItemName</th>
          <th className="r">Qty</th>
          <th className="r">PQty</th>
          <th className="r">UnitRate</th>
          <th className="r">TotalAmount</th>
          <th className="r">Dis %</th>
          <th className="r">Duty %</th>
          <th className="r">Edu %</th>
          <th className="r">HsCes %</th>
          <th className="r">VatPer</th>
          <th className="r">Pfper</th>
          <th className="r">GrandTotal</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`dept-ord-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.departmentName}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`do${gi}r${ii}`}>
                <td>{it.orderDate}</td>
                <td>{it.itemName}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td className="r">{fmt(it.pQty)}</td>
                <td className="r">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.totalAmount)}</td>
                <td className="r">{fmt(it.discountPct)}</td>
                <td className="r">{fmt(it.dutyPct)}</td>
                <td className="r">{fmt(it.eduPct)}</td>
                <td className="r">{fmt(it.hsCesPct)}</td>
                <td className="r">{fmt(it.vatPer)}</td>
                <td className="r">{fmt(it.pfPer)}</td>
                <td className="r">{fmt(it.grandTotal)}</td>
              </tr>
            ))}
            <tr className="row-subtotal grp">
              <td colSpan={12} className="lbl r">Department Total:</td>
              <td className="r red">{fmt(g.deptGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={12} className="lbl r">Report Grand Total:</td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function POPendingWiseReport({ data }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Order No.</th>
          <th>Order Date</th>
          <th>Party Name</th>
          <th>Item Name</th>
          <th className="r">Order Qty</th>
          <th className="r">Rec Qty</th>
          <th className="r">Pending Qty</th>
          <th className="r">Unit Rate</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td className="c font-semibold">{it.orderNo}</td>
            <td>{it.orderDate}</td>
            <td>{it.partyName}</td>
            <td>{it.itemName}</td>
            <td className="r">{fmt(it.orderQty)}</td>
            <td className="r">{fmt(it.receivedQty)}</td>
            <td className="r red">{fmt(it.pendingQty)}</td>
            <td className="r">{fmt(it.unitRate)}</td>
          </tr>
        ))}
        <tr className="row-grand">
          <td colSpan={5} className="lbl r">Total:</td>
          <td className="r">{fmt(data.reportTotalOrderQty)}</td>
          <td className="r">{fmt(data.reportTotalRecQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalPendingQty)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

function POPendingDateWiseReport({ data }) {
  const cols = 8;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Order No.</th>
          <th>Party Name</th>
          <th>Item Name</th>
          <th className="r">Order Qty</th>
          <th className="r">Rec Qty</th>
          <th className="r">Pending Qty</th>
          <th className="r">Unit Rate</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`p-date-${gi}`}>
            <tr className="row-date-hdr">
              <td colSpan={cols}><span className="date-box">{g.dateFormatted}</span></td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`pd${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.orderNo}</td>
                <td>{it.partyName}</td>
                <td>{it.itemName}</td>
                <td className="r">{fmt(it.orderQty)}</td>
                <td className="r">{fmt(it.receivedQty)}</td>
                <td className="r red">{fmt(it.pendingQty)}</td>
                <td className="r">{fmt(it.unitRate)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={4} className="lbl r">Date Total:</td>
              <td className="r">{fmt(g.dateTotalOrderQty)}</td>
              <td className="r">{fmt(g.dateTotalRecQty)}</td>
              <td className="r red">{fmt(g.dateTotalPendingQty)}</td>
              <td></td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={4} className="lbl r">Report Total:</td>
          <td className="r">{fmt(data.reportTotalOrderQty)}</td>
          <td className="r">{fmt(data.reportTotalRecQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalPendingQty)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

function POPriceComparisonReport({ data }) {
  const cols = 7;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Order No.</th>
          <th>Order Date</th>
          <th>Party Name</th>
          <th className="r">Qty</th>
          <th className="r">Unit Rate</th>
          <th className="r">Total Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`pc-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>
                {g.itemName}
                <span className="ml-3 text-xs font-normal text-slate-500">
                  (Min Rate: {fmt(g.minRate)} | Max Rate: {fmt(g.maxRate)})
                </span>
              </td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`pci${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.orderNo}</td>
                <td>{it.orderDate}</td>
                <td>{it.partyName}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td className="r font-bold text-indigo-700">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.totalAmount)}</td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

function POPartyWisePendingReport({ data }) {
  const cols = 7;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Order No.</th>
          <th>Order Date</th>
          <th>Item Name</th>
          <th className="r">Order Qty</th>
          <th className="r">Rec Qty</th>
          <th className="r">Pending Qty</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`pop-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.partyName}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`popi${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.orderNo}</td>
                <td>{it.orderDate}</td>
                <td>{it.itemName}</td>
                <td className="r">{fmt(it.orderQty)}</td>
                <td className="r">{fmt(it.receivedQty)}</td>
                <td className="r red">{fmt(it.pendingQty)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={4} className="lbl r">Party Total:</td>
              <td className="r">{fmt(g.partyTotalOrderQty)}</td>
              <td className="r">{fmt(g.partyTotalRecQty)}</td>
              <td className="r red">{fmt(g.partyTotalPendingQty)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={4} className="lbl r">Report Total:</td>
          <td className="r">{fmt(data.reportTotalOrderQty)}</td>
          <td className="r">{fmt(data.reportTotalRecQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalPendingQty)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  2. BILLING REPORT RENDERERS
// ═══════════════════════════════════════════════════════════════

function DayBookReport({ data }) {
  const cols = 10;
  return (
    <table className="rpt-tbl compact">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Voucher No</th>
          <th>Party Name</th>
          <th>Party Bill No</th>
          <th>Bill Date</th>
          <th>Purchase Type</th>
          <th className="r">Bill Amount</th>
          <th className="r">GST</th>
          <th className="r">Discount</th>
          <th className="r">Grand Total</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`db-${gi}`}>
            <tr className="row-date-hdr">
              <td colSpan={cols}><span className="date-box">{g.dateFormatted}</span></td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`dbi${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.voucherNo}</td>
                <td>{it.partyName}</td>
                <td>{it.partyBillNo}</td>
                <td>{it.billDate}</td>
                <td>{it.purchaseType}</td>
                <td className="r">{fmt(it.billAmount)}</td>
                <td className="r">{fmt(it.gst)}</td>
                <td className="r">{fmt(it.discount)}</td>
                <td className="r font-bold">{fmt(it.grandTotal)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={6} className="lbl r">Date Total:</td>
              <td className="r">{fmt(g.dateBillAmount)}</td>
              <td className="r">{fmt(g.dateGST)}</td>
              <td className="r">{fmt(g.dateDiscount)}</td>
              <td className="r red">{fmt(g.dateGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={6} className="lbl r">Day Book Grand Total:</td>
          <td className="r">{fmt(data.reportBillAmount)}</td>
          <td className="r">{fmt(data.reportGST)}</td>
          <td className="r">{fmt(data.reportDiscount)}</td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function GenericGroupingBillReport({ data, groupHeaderLabel = '' }) {
  const cols = 9;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Voucher No</th>
          <th>Party Name</th>
          <th>Item Name</th>
          <th className="r">Qty</th>
          <th className="r">Unit Rate</th>
          <th className="r">Total Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`bg-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.purchaseType || g.partyName || g.departmentName || g.subHeadName || g.itemName || g.dateFormatted}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`bgi${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.voucherNo}</td>
                <td>{it.partyName || it.accDate}</td>
                <td>{it.itemName || it.partyName}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td className="r">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.totalAmount)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={4} className="lbl r">Group Total:</td>
              <td className="r">{fmt(g.typeTotalQty || g.partyTotalQty || g.deptTotalQty || g.shTotalQty || g.itemTotalQty || g.dateTotalQty)}</td>
              <td></td>
              <td className="r red">{fmt(g.typeTotalAmount || g.partyTotalAmount || g.deptTotalAmount || g.shTotalAmount || g.itemTotalAmount || g.dateTotalAmount)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={4} className="lbl r">Report Total:</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td></td>
          <td className="r red dbl">{fmt(data.reportTotalAmount)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function BillAbstractReport({ data, keyHeader = 'Name' }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 50 }}>Sl. No.</th>
          <th>{keyHeader}</th>
          <th className="r">Vouchers</th>
          <th className="r">Bill Amount</th>
          <th className="r">Grand Total</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td className="font-semibold">{it.purchaseType || it.partyName || it.departmentName}</td>
            <td className="r">{it.voucherCount}</td>
            <td className="r">{fmt(it.billAmount || it.totalAmount)}</td>
            <td className="r font-bold">{fmt(it.grandTotal || it.totalAmount)}</td>
          </tr>
        ))}
        <tr className="row-grand">
          <td colSpan={3} className="lbl r">Total:</td>
          <td className="r">{fmt(data.reportBillAmount || data.reportTotalAmount)}</td>
          <td className="r red dbl">{fmt(data.reportGrandTotal || data.reportTotalAmount)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function PurchaseRegisterReport({ data }) {
  const cols = 12;
  return (
    <table className="rpt-tbl compact">
      <thead>
        <tr>
          <th style={{ width: 35 }}>Sl.</th>
          <th>Voucher</th>
          <th>Acc Date</th>
          <th>Party Name</th>
          <th>Bill No</th>
          <th className="r">Bill Amt</th>
          <th className="r">GST</th>
          <th className="r">IGST</th>
          <th className="r">VAT</th>
          <th className="r">P&F</th>
          <th className="r">Round</th>
          <th className="r">Grand Total</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`pr-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.purchaseType}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`pri${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.voucherNo}</td>
                <td>{it.accDate}</td>
                <td>{it.partyName}</td>
                <td>{it.partyBillNo}</td>
                <td className="r">{fmt(it.billAmount)}</td>
                <td className="r">{fmt(it.gst)}</td>
                <td className="r">{fmt(it.igst)}</td>
                <td className="r">{fmt(it.vat)}</td>
                <td className="r">{fmt(it.pf)}</td>
                <td className="r">{fmt(it.roundOff)}</td>
                <td className="r font-bold">{fmt(it.grandTotal)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={5} className="lbl r">Type Total:</td>
              <td className="r">{fmt(g.typeBillAmount)}</td>
              <td colSpan={5}></td>
              <td className="r red">{fmt(g.typeGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={5} className="lbl r">Grand Total:</td>
          <td className="r">{fmt(data.reportBillAmount)}</td>
          <td colSpan={5}></td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  3. RECEIPT REPORT RENDERERS
// ═══════════════════════════════════════════════════════════════

function DateWiseReceiptReport({ data }) {
  const cols = 9;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Item Name</th>
          <th>Party Name</th>
          <th>BillNo</th>
          <th>Bill Date</th>
          <th className="r">Qty UOM</th>
          <th className="r">Unit Rate</th>
          <th className="r">Total Amount</th>
          <th className="r">Grand Total</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`group-d-${gi}`}>
            <tr className="row-date-hdr">
              <td colSpan={cols}><span className="date-box">{g.dateFormatted}</span></td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`d${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td>{it.itemName}</td>
                <td>{it.partyName}</td>
                <td>{it.billNo}</td>
                <td>{it.billDate}</td>
                <td className="r">{fmt(it.qty)}{it.uom}</td>
                <td className="r">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.totalAmount)}</td>
                <td className="r">{fmt(it.grandTotal)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={5} className="r lbl">Date Total</td>
              <td className="r">{fmt(g.dateTotalQty)}</td>
              <td></td>
              <td className="r">{fmt(g.dateTotalAmount)}</td>
              <td className="r red">{fmt(g.dateGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={5} className="r lbl">Report Total</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td></td>
          <td className="r">{fmt(data.reportTotalAmount)}</td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function PartyWiseReceiptReport({ data }) {
  const cols = 9;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Item Name</th>
          <th>BillNo</th>
          <th>Bill Date</th>
          <th>GRNNo</th>
          <th className="r">Qty</th>
          <th>UOM</th>
          <th className="r">Unit Rate</th>
          <th className="r">Grand Total</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`group-p-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.partyName || g.subHeadName}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`p${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td>{it.itemName}</td>
                <td>{it.billNo}</td>
                <td>{it.billDate}</td>
                <td>{it.grnNo}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td>{it.uom}</td>
                <td className="r">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.grandTotal)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={5}></td>
              <td className="r">{fmt(g.partyTotalQty || g.shTotalQty)}</td>
              <td></td>
              <td></td>
              <td className="r red">{fmt(g.partyGrandTotal || g.shGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={5}></td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td></td>
          <td></td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function DeptWiseReceiptReport({ data }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 50 }}>Sl. No.</th>
          <th>Department Name</th>
          <th className="r">Total Amount</th>
          <th className="r">Grand Total</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td>{it.departmentName}</td>
            <td className="r">{fmt(it.totalAmount)}</td>
            <td className="r">{fmt(it.grandTotal)}</td>
          </tr>
        ))}
        <tr className="row-grand">
          <td></td>
          <td></td>
          <td className="r">{fmt(data.reportTotalAmount)}</td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function ItemWiseReceiptReport({ data }) {
  const cols = 9;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Party Name</th>
          <th>BillNo</th>
          <th>Bill Date</th>
          <th>GRNNo</th>
          <th className="r">Qty</th>
          <th>UOM</th>
          <th className="r">Unit Rate</th>
          <th className="r">Grand Total</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`group-i-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.itemName}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`i${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td>{it.partyName}</td>
                <td>{it.billNo}</td>
                <td>{it.billDate}</td>
                <td>{it.grnNo}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td>{it.uom}</td>
                <td className="r">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.grandTotal)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={5}></td>
              <td className="r">{fmt(g.itemTotalQty)}</td>
              <td></td>
              <td></td>
              <td className="r red">{fmt(g.itemGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={5}></td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td></td>
          <td></td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function ReceiptReturnPendingReport({ data }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Order No</th>
          <th>Order Date</th>
          <th>Party Name</th>
          <th>Item Name</th>
          <th className="r">Order Qty</th>
          <th className="r">Rec Qty</th>
          <th className="r">Pending Qty</th>
          <th className="r">Unit Rate</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td className="c font-semibold">{it.orderNo}</td>
            <td>{it.orderDate}</td>
            <td>{it.partyName}</td>
            <td>{it.itemName}</td>
            <td className="r">{fmt(it.orderQty)}</td>
            <td className="r">{fmt(it.receivedQty)}</td>
            <td className="r red">{fmt(it.pendingQty)}</td>
            <td className="r">{fmt(it.unitRate)}</td>
          </tr>
        ))}
        <tr className="row-grand">
          <td colSpan={5} className="lbl r">Total:</td>
          <td className="r">{fmt(data.reportTotalOrderQty)}</td>
          <td className="r">{fmt(data.reportTotalRecQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalPendingQty)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  4. STOCK REPORT RENDERERS
// ═══════════════════════════════════════════════════════════════

function StockItemsListReport({ data, isOpening = false }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Item Code</th>
          <th>Item Name</th>
          <th>Department</th>
          <th className="r">{isOpening ? 'Opening Qty' : 'Quantity'}</th>
          <th className="r">Unit Rate</th>
          <th className="r">Value</th>
          <th>UOM</th>
          {!isOpening && <th>Location</th>}
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td className="c font-medium">{it.itemCode}</td>
            <td className="font-semibold">{it.itemName}</td>
            <td>{it.departmentName}</td>
            <td className="r font-bold">{fmt(isOpening ? it.openingQty : it.quantity)}</td>
            <td className="r">{fmt(it.unitRate)}</td>
            <td className="r">{fmt(isOpening ? it.openValue : it.value)}</td>
            <td>{it.uom}</td>
            {!isOpening && <td>{it.location}</td>}
          </tr>
        ))}
        <tr className="row-grand">
          <td colSpan={4} className="lbl r">Stock Total:</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td></td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
          <td></td>
          {!isOpening && <td></td>}
        </tr>
      </tbody>
    </table>
  );
}

function StockAbstractReport({ data, groupLabel = 'Department' }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 50 }}>Sl. No.</th>
          <th>{groupLabel} Name</th>
          <th className="r">Item Count</th>
          <th className="r">Total Qty</th>
          <th className="r">Total Value</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td className="font-semibold">{it.departmentName || it.subHeadName}</td>
            <td className="r">{it.itemCount}</td>
            <td className="r">{fmt(it.totalQty || it.closingQty)}</td>
            <td className="r">{fmt(it.totalValue || it.closingValue)}</td>
          </tr>
        ))}
        <tr className="row-grand">
          <td colSpan={3} className="lbl r">Total:</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function StockDetailGroupReport({ data }) {
  const cols = 6;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Item Code</th>
          <th>Item Name</th>
          <th className="r">Qty</th>
          <th className="r">Unit Rate</th>
          <th className="r">Stock Value</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`sd-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.departmentName || g.subHeadName}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`sdi${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.itemCode}</td>
                <td>{it.itemName}</td>
                <td className="r font-semibold">{fmt(it.qty)}</td>
                <td className="r">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.value)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={3} className="lbl r">Subtotal:</td>
              <td className="r">{fmt(g.deptTotalQty || g.shTotalQty)}</td>
              <td></td>
              <td className="r red">{fmt(g.deptTotalValue || g.shTotalValue)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={3} className="lbl r">Grand Total:</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td></td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function NilOrMaxStockReport({ data, isMax = false }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Item Code</th>
          <th>Item Name</th>
          <th>Department</th>
          {isMax ? (
            <>
              <th className="r">Current Qty</th>
              <th className="r">Max Level</th>
              <th className="r">Excess Qty</th>
              <th>UOM</th>
            </>
          ) : (
            <>
              <th>UOM</th>
              <th>Location</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td className="c">{it.itemCode}</td>
            <td className="font-semibold">{it.itemName}</td>
            <td>{it.departmentName}</td>
            {isMax ? (
              <>
                <td className="r font-bold text-rose-600">{fmt(it.quantity)}</td>
                <td className="r">{fmt(it.maxStockLevel)}</td>
                <td className="r font-bold text-amber-700">{fmt(it.excessQty)}</td>
                <td>{it.uom}</td>
              </>
            ) : (
              <>
                <td>{it.uom}</td>
                <td>{it.location}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  5. OTHERS (GATE PASS & LOCATION) REPORT RENDERERS
// ═══════════════════════════════════════════════════════════════

function GatePassPendingReport({ data }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>GP No</th>
          <th>GP Date</th>
          <th>Party Name</th>
          <th>Department</th>
          <th>Item Name</th>
          <th className="r">Sent Qty</th>
          <th className="r">Returned Qty</th>
          <th className="r">Pending Qty</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td className="c font-semibold">{it.gpNo}</td>
            <td>{it.gpDate}</td>
            <td>{it.partyName}</td>
            <td>{it.department}</td>
            <td>{it.itemName}</td>
            <td className="r">{fmt(it.sentQty)}</td>
            <td className="r">{fmt(it.returnedQty)}</td>
            <td className="r red font-bold">{fmt(it.pendingQty)}</td>
          </tr>
        ))}
        <tr className="row-grand">
          <td colSpan={6} className="lbl r">Total:</td>
          <td className="r">{fmt(data.reportTotalSentQty)}</td>
          <td className="r">{fmt(data.reportTotalRecQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalPendingQty)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function GatePassGroupReport({ data }) {
  const cols = 8;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>GP No</th>
          <th>GP Date</th>
          <th>Department</th>
          <th>Item Name</th>
          <th className="r">Qty / Pending</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`gpg-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.partyName || g.returnableType}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`gpgi${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.gpNo || it.inNo}</td>
                <td>{it.gpDate || it.giDate}</td>
                <td>{it.department || it.dcNo}</td>
                <td>{it.itemName}</td>
                <td className="r font-semibold">{fmt(it.qty || it.pendingQty || it.recQty)}</td>
                <td>{it.reason}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={5} className="lbl r">Subtotal:</td>
              <td className="r red">{fmt(g.partyTotalQty || g.typeTotalQty || g.partyPendingQty || g.partyTotalRecQty)}</td>
              <td></td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={5} className="lbl r">Grand Total:</td>
          <td className="r red dbl">{fmt(data.reportTotalQty || data.reportTotalPendingQty || data.reportTotalRecQty)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

function GatePassInListReport({ data }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>In No</th>
          <th>In Date</th>
          <th>Party Name</th>
          <th>DC No</th>
          <th>Item Name</th>
          <th className="r">Pending Qty</th>
          <th className="r">Rec Qty</th>
          <th>Ref GP No</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td className="c font-semibold">{it.inNo}</td>
            <td>{it.giDate}</td>
            <td>{it.partyName}</td>
            <td>{it.dcNo}</td>
            <td>{it.itemName}</td>
            <td className="r">{fmt(it.pendingQty)}</td>
            <td className="r font-bold text-emerald-700">{fmt(it.recQty)}</td>
            <td className="c">{it.gpNo}</td>
          </tr>
        ))}
        <tr className="row-grand">
          <td colSpan={7} className="lbl r">Total Received:</td>
          <td className="r red dbl">{fmt(data.reportTotalRecQty)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

function LocationWiseStockReport({ data }) {
  const cols = 7;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Item Code</th>
          <th>Item Name</th>
          <th>Department</th>
          <th className="r">Quantity</th>
          <th className="r">Unit Rate</th>
          <th className="r">Stock Value</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`loc-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>Location: {g.location}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`loci${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td className="c">{it.itemCode}</td>
                <td>{it.itemName}</td>
                <td>{it.departmentName}</td>
                <td className="r font-semibold">{fmt(it.qty)}</td>
                <td className="r">{fmt(it.unitRate)}</td>
                <td className="r">{fmt(it.value)}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={4} className="lbl r">Location Total:</td>
              <td className="r">{fmt(g.locTotalQty)}</td>
              <td></td>
              <td className="r red">{fmt(g.locTotalValue)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={4} className="lbl r">Grand Total:</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td></td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  6. ISSUE REPORT RENDERERS
// ═══════════════════════════════════════════════════════════════

function DateWiseIssueReport({ data }) {
  const cols = 7;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Issue No.</th>
          <th>Department</th>
          <th>Item</th>
          <th className="r">Qty</th>
          <th className="r">Value</th>
          <th>UOM</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`issue-d-${gi}`}>
            <tr className="row-date-hdr">
              <td colSpan={cols}><span className="date-box">{g.dateFormatted}</span></td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`i${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td>{it.issueNo}</td>
                <td>{it.department}</td>
                <td>{it.itemName}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td className="r">{fmt(it.value)}</td>
                <td>{it.uom}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={4} className="r lbl">Date Total</td>
              <td className="r">{fmt(g.dateTotalQty)}</td>
              <td className="r red">{fmt(g.dateTotalValue)}</td>
              <td></td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={4} className="r lbl">Report Total</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

function ItemWiseIssueReport({ data }) {
  const cols = 7;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Issue No.</th>
          <th>Issue Date</th>
          <th>Department</th>
          <th className="r">Qty</th>
          <th className="r">Value</th>
          <th>UOM</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`issue-i-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.itemName || g.subHeadName}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`ii${gi}r${ii}`}>
                <td className="c">{it.slNo}</td>
                <td>{it.issueNo}</td>
                <td>{it.issueDate}</td>
                <td>{it.department}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td className="r">{fmt(it.value)}</td>
                <td>{it.uom}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td colSpan={4}></td>
              <td className="r">{fmt(g.itemTotalQty || g.shTotalQty)}</td>
              <td className="r red">{fmt(g.itemTotalValue || g.shTotalValue)}</td>
              <td></td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={4}></td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

function DeptWiseIssueReport({ data }) {
  const cols = 4;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th>Item</th>
          <th className="r">Qty</th>
          <th className="r">Value</th>
          <th>UOM</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((g, gi) => (
          <React.Fragment key={`dept-iss-${gi}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>{g.departmentName}</td>
            </tr>
            {g.items.map((it, ii) => (
              <tr key={`di${gi}r${ii}`}>
                <td>{it.itemName}</td>
                <td className="r">{fmt(it.qty)}</td>
                <td className="r">{fmt(it.value)}</td>
                <td>{it.uom}</td>
              </tr>
            ))}
            <tr className="row-subtotal">
              <td></td>
              <td className="r">{fmt(g.deptTotalQty)}</td>
              <td className="r red">{fmt(g.deptTotalValue)}</td>
              <td></td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td></td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  );
}

function MonthWiseMovementReport({ data, isItemPivot = false }) {
  const months = data.months || [];
  return (
    <div className="overflow-x-auto">
      <table className="rpt-tbl compact">
        <thead>
          <tr>
            <th style={{ width: 40 }}>Sl.</th>
            <th>{isItemPivot ? 'Item Name' : 'Department / SubHead'}</th>
            {months.map((m) => (
              <th key={m.key} className="c" style={{ minWidth: 90 }}>
                {m.label}
              </th>
            ))}
            <th className="r" style={{ minWidth: 100 }}>Total Qty</th>
            {isItemPivot && <th className="r" style={{ minWidth: 100 }}>Net Movement</th>}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.slNo}>
              <td className="c">{row.slNo}</td>
              <td className="font-semibold">{row.itemName || row.departmentName || row.subHeadName}</td>
              {months.map((m) => {
                const cell = row.monthlyData[m.key];
                if (isItemPivot) {
                  return (
                    <td key={m.key} className="c text-xs">
                      {cell ? (
                        <div className="flex flex-col text-[11px]">
                          <span className="text-emerald-600">R: {fmt(cell.rec)}</span>
                          <span className="text-rose-600">I: {fmt(cell.iss)}</span>
                        </div>
                      ) : '-'}
                    </td>
                  );
                }
                return (
                  <td key={m.key} className="r font-medium">
                    {cell ? fmt(cell) : '-'}
                  </td>
                );
              })}
              <td className="r font-bold">{fmt(row.totalQty || row.totalIss)}</td>
              {isItemPivot && (
                <td className={`r font-bold ${row.netMovement < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmt(row.netMovement)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeptItemWiseIssueReport({ data }) {
  const cols = 6;
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 40 }}>Sl. No.</th>
          <th>Issue No.</th>
          <th>Issue Date</th>
          <th className="r">Qty</th>
          <th className="r">Unit Rate</th>
          <th className="r">Value</th>
        </tr>
      </thead>
      <tbody>
        {data.groups.map((deptGroup, di) => (
          <React.Fragment key={`dept-${di}`}>
            <tr className="row-group-hdr">
              <td colSpan={cols}>Department: {deptGroup.departmentName}</td>
            </tr>
            {deptGroup.itemGroups.map((itemGroup, ii) => (
              <React.Fragment key={`dept-${di}-item-${ii}`}>
                <tr className="row-sub-hdr">
                  <td colSpan={cols}>Item: {itemGroup.itemName}</td>
                </tr>
                {itemGroup.items.map((it, idx) => (
                  <tr key={`di${di}it${ii}r${idx}`}>
                    <td className="c">{it.slNo}</td>
                    <td>{it.issueNo}</td>
                    <td>{it.issueDate}</td>
                    <td className="r">{fmt(it.qty)}</td>
                    <td className="r">{fmt(it.unitRate)}</td>
                    <td className="r">{fmt(it.value)}</td>
                  </tr>
                ))}
                <tr className="row-subtotal">
                  <td colSpan={3} className="lbl r">Item Total:</td>
                  <td className="r">{fmt(itemGroup.itemTotalQty)}</td>
                  <td></td>
                  <td className="r red">{fmt(itemGroup.itemTotalValue)}</td>
                </tr>
              </React.Fragment>
            ))}
            <tr className="row-subtotal grp">
              <td colSpan={3} className="lbl r">Department Grand Total:</td>
              <td className="r">{fmt(deptGroup.deptTotalQty)}</td>
              <td></td>
              <td className="r red">{fmt(deptGroup.deptTotalValue)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={3} className="lbl r">Report Total:</td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td></td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Main Reports Page Component
// ═══════════════════════════════════════════════════════════════
const Reports = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const [selectedCategory, setSelectedCategory] = useState('Purchase Report');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReportKey, setSelectedReportKey] = useState('');

  // Entity Filter state
  const [selectedEntities, setSelectedEntities] = useState([]);
  const [isAllEntitiesSelected, setIsAllEntitiesSelected] = useState(true);

  // Inline report state
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [activeReportKey, setActiveReportKey] = useState('');
  const [activeReportTitle, setActiveReportTitle] = useState('');
  const [excelDownloading, setExcelDownloading] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);

  const reportContainerRef = useRef(null);
  const printPaperRef = useRef(null);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedReportKey('');
    setSelectedEntities([]);
    setIsAllEntitiesSelected(true);
    setReportData(null);
  };

  const handleReportSelectionChange = (key) => {
    setSelectedReportKey(key);
    setSelectedEntities([]);
    setIsAllEntitiesSelected(true);
    setReportData(null);
  };

  const currentReports = reportOptions[selectedCategory] || [];
  const currentReportConfig = currentReports.find((r) => r.key === selectedReportKey);

  const handleGenerateReport = async () => {
    if (!selectedReportKey) {
      showToast('Please select a report first', 'error');
      return;
    }

    // Special case: Stock -> Item Wise Stock (Excel Export)
    if (selectedCategory === 'Stock Report' && selectedReportKey === 'item-wise') {
      handleExcelDownload();
      return;
    }

    const prefix = categoryApiPrefix[selectedCategory];
    const fullKey = `${prefix}/${selectedReportKey}`;
    const reportTitle = currentReportConfig?.label || 'Report';

    try {
      setReportLoading(true);
      setReportError('');
      setActiveReportKey(fullKey);
      setActiveReportTitle(reportTitle);

      const params = { fromDate, toDate };

      // Append entity filter if defined and not selecting all (or pass explicitly)
      if (currentReportConfig?.filterType && currentReportConfig?.queryParam) {
        if (selectedEntities.length > 0 && !isAllEntitiesSelected) {
          params[currentReportConfig.queryParam] = selectedEntities.join(',');
        }
      }

      const res = await axios.get(`${API_URL}/reports/${prefix}/${selectedReportKey}`, { params });

      if (res.data?.success) {
        setReportData(res.data.data);
        showToast('Report generated successfully', 'success');

        setTimeout(() => {
          reportContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        setReportError(res.data?.message || 'Failed to load report');
        showToast(res.data?.message || 'Failed to load report', 'error');
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      const errMsg = err.response?.data?.message || 'Error communicating with server';
      setReportError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setReportLoading(false);
    }
  };

  const handleExcelDownload = async () => {
    try {
      setExcelDownloading(true);
      const response = await axios.get(`${API_URL}/reports/stock/item-wise`, {
        responseType: 'blob',
        params: { fromDate, toDate }
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ItemWiseStock_${fromDate}_to_${toDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Item Wise Stock Excel downloaded', 'success');
    } catch (error) {
      console.error('Error generating item wise stock report:', error);
      showToast('Failed to download Item Wise Stock report', 'error');
    } finally {
      setExcelDownloading(false);
    }
  };

  const handleClearReport = () => {
    setReportData(null);
    setReportError('');
    setActiveReportKey('');
    setActiveReportTitle('');
  };

  const handleSaveReport = async () => {
    if (!printPaperRef.current || !reportData) return;
    try {
      setSavingPdf(true);
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const cleanTitle = (reportData.reportTitle || activeReportTitle || 'Report')
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${cleanTitle}_${fromDate}_to_${toDate}.pdf`;

      await doc.html(printPaperRef.current, {
        callback: (pdf) => {
          pdf.save(filename);
          showToast('Report PDF downloaded successfully', 'success');
        },
        x: 15,
        y: 15,
        width: 810,
        windowWidth: 1100,
        autoPaging: 'text'
      });
    } catch (err) {
      console.error('Error saving report PDF:', err);
      showToast('Failed to download report PDF', 'error');
    } finally {
      setSavingPdf(false);
    }
  };

  const renderReportContent = () => {
    if (!reportData) return null;

    switch (activeReportKey) {
      // 1. Purchase
      case 'purchase/orderno-wise':
        return <OrderNoWiseOrderReport data={reportData} />;
      case 'purchase/supplier-wise':
        return <SupplierWiseOrderReport data={reportData} />;
      case 'purchase/department-wise':
        return <DeptWiseOrderReport data={reportData} />;
      case 'purchase/pending-wise':
        return <POPendingWiseReport data={reportData} />;
      case 'purchase/pending-date-wise':
        return <POPendingDateWiseReport data={reportData} />;
      case 'purchase/price-comparison':
        return <POPriceComparisonReport data={reportData} />;
      case 'purchase/party-pending':
        return <POPartyWisePendingReport data={reportData} />;

      // 2. Billing
      case 'billing/day-book':
        return <DayBookReport data={reportData} />;
      case 'billing/purchasetype-wise':
      case 'billing/date-wise':
      case 'billing/party-wise':
      case 'billing/department-wise':
      case 'billing/subhead-wise':
      case 'billing/item-wise':
        return <GenericGroupingBillReport data={reportData} />;
      case 'billing/purchasetype-wise-abstract':
        return <BillAbstractReport data={reportData} keyHeader="Purchase Type" />;
      case 'billing/party-wise-abstract':
        return <BillAbstractReport data={reportData} keyHeader="Party Name" />;
      case 'billing/department-wise-abstract':
        return <BillAbstractReport data={reportData} keyHeader="Department" />;
      case 'billing/purchase-register':
        return <PurchaseRegisterReport data={reportData} />;

      // 3. Receipt
      case 'receipt/date-wise':
        return <DateWiseReceiptReport data={reportData} />;
      case 'receipt/party-wise':
      case 'receipt/subhead-wise':
        return <PartyWiseReceiptReport data={reportData} />;
      case 'receipt/department-wise':
        return <DeptWiseReceiptReport data={reportData} />;
      case 'receipt/item-wise':
        return <ItemWiseReceiptReport data={reportData} />;
      case 'receipt/return-pending':
        return <ReceiptReturnPendingReport data={reportData} />;

      // 4. Stock
      case 'stock/item-wise-report':
        return <StockItemsListReport data={reportData} isOpening={false} />;
      case 'stock/item-opening':
        return <StockItemsListReport data={reportData} isOpening={true} />;
      case 'stock/department-wise':
      case 'stock/department-closing':
        return <StockAbstractReport data={reportData} groupLabel="Department" />;
      case 'stock/subhead-wise':
        return <StockAbstractReport data={reportData} groupLabel="Sub Head" />;
      case 'stock/department-detail':
      case 'stock/subhead-detail':
        return <StockDetailGroupReport data={reportData} />;
      case 'stock/nil-stock':
        return <NilOrMaxStockReport data={reportData} isMax={false} />;
      case 'stock/max-level':
        return <NilOrMaxStockReport data={reportData} isMax={true} />;

      // 5. Others
      case 'others/gatepass-pending':
        return <GatePassPendingReport data={reportData} />;
      case 'others/gatepass-pending-party':
      case 'others/gatepass-returnable-party':
      case 'others/gatepass-returnable-nonreturnable':
      case 'others/gatepass-nonreturnable':
      case 'others/gatepass-in-party':
        return <GatePassGroupReport data={reportData} />;
      case 'others/gatepass-in':
        return <GatePassInListReport data={reportData} />;
      case 'others/item-location':
        return <LocationWiseStockReport data={reportData} />;

      // 6. Issue
      case 'issue/date-wise':
        return <DateWiseIssueReport data={reportData} />;
      case 'issue/item-wise':
      case 'issue/subhead-wise':
        return <ItemWiseIssueReport data={reportData} />;
      case 'issue/department-wise':
        return <DeptWiseIssueReport data={reportData} />;
      case 'issue/month-movement-item':
        return <MonthWiseMovementReport data={reportData} isItemPivot={true} />;
      case 'issue/month-movement-dept':
      case 'issue/month-movement-subhead':
        return <MonthWiseMovementReport data={reportData} isItemPivot={false} />;
      case 'issue/department-item-wise':
        return <DeptItemWiseIssueReport data={reportData} />;

      default:
        return <p className="text-center py-6 text-slate-500">Unknown report type: {activeReportKey}</p>;
    }
  };

  return (
    <Layout>
      <style>{`
        /* ── Report Paper Styles ────────────────────────────────────────── */
        .rv-paper-card {
          font-family: 'Segoe UI', Tahoma, -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .rpt-tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          color: #1e293b;
        }
        .rpt-tbl.compact {
          font-size: 12px;
        }
        .rpt-tbl thead th {
          color: #1e3a8a;
          font-weight: 600;
          font-size: 12.5px;
          padding: 8px 10px;
          border-bottom: 2px solid #1e3a8a;
          white-space: nowrap;
          text-align: left;
        }
        .rpt-tbl thead th.r { text-align: right; }
        .rpt-tbl thead th.c { text-align: center; }

        .rpt-tbl tbody td {
          padding: 6px 10px;
          vertical-align: top;
          line-height: 1.5;
        }
        .rpt-tbl td.r { text-align: right; }
        .rpt-tbl td.c { text-align: center; }
        .rpt-tbl td.red { color: #dc2626; font-weight: 700; }
        .rpt-tbl td.lbl { font-weight: 600; color: #1e3a8a; }
        .rpt-tbl td.dbl { border-bottom: 3px double #1e3a8a; }

        /* Row Groups */
        .row-date-hdr td {
          padding: 14px 10px 4px 10px !important;
        }
        .date-box {
          border: 1px solid #cbd5e1;
          padding: 3px 12px;
          background: #f8fafc;
          border-radius: 4px;
          font-weight: 600;
          font-size: 12px;
          display: inline-block;
          color: #0f172a;
        }
        .row-group-hdr td {
          padding: 16px 10px 4px 10px !important;
          font-weight: 700;
          color: #881337;
          font-size: 13px;
          letter-spacing: 0.01em;
          border-top: 1px solid #f1f5f9;
        }
        .row-sub-hdr td {
          padding: 6px 10px 4px 24px !important;
          font-weight: 600;
          color: #1e3a8a;
          font-size: 12.5px;
        }
        .row-subtotal td {
          border-top: 1px dashed #cbd5e1;
          padding-top: 5px !important;
          padding-bottom: 7px !important;
          font-weight: 600;
        }
        .row-subtotal.grp td {
          border-top: 1px dashed #94a3b8;
          padding-bottom: 12px !important;
        }
        .row-grand td {
          border-top: 1.5px solid #475569;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          font-weight: 700;
          font-size: 13.5px;
          background: #f8fafc;
        }

        /* ── Clean Print Engine ────────────────────────────────────────── */
        @media print {
          body, html {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          nav, aside, header, .no-print, button {
            display: none !important;
          }
          .print-full-view {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .rpt-tbl {
            page-break-inside: auto;
          }
          .rpt-tbl tr {
            page-break-inside: avoid;
          }
          .row-date-hdr, .row-group-hdr, .row-sub-hdr {
            page-break-after: avoid;
          }
          .row-subtotal, .row-grand {
            page-break-before: avoid;
          }
          .rpt-tbl td.red {
            color: #dc2626 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .rpt-tbl thead th {
            color: #1e3a8a !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Navigation & Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-semibold mb-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
              <FileText className="text-indigo-600 w-7 h-7" />
              Reports & Registers
            </h1>
          </div>
        </div>

        {/* Filters Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 no-print">
          {/* Category Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              1. Select Report Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.keys(reportOptions).map((category) => {
                const isSelected = selectedCategory === category;
                const IconComponent = categoryIcons[category] || Layers;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryChange(category)}
                    className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl font-semibold text-xs transition-all duration-150 cursor-pointer border ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <IconComponent size={16} className={isSelected ? 'text-white' : 'text-slate-500'} />
                    <span className="truncate">{category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range & Specific Report Selection */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-4 border-t border-slate-100">
            {/* From Date */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>

            {/* To Date */}
            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Calendar size={14} className="text-slate-400" />
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>

            {/* Report Dropdown */}
            <div className="md:col-span-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <FileSpreadsheet size={14} className="text-slate-400" />
                Report Name
              </label>
              <select
                value={selectedReportKey}
                onChange={(e) => handleReportSelectionChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none cursor-pointer"
              >
                <option value="">-- Choose a {selectedCategory} --</option>
                {currentReports.map((report) => (
                  <option key={report.key} value={report.key}>
                    {report.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Entity Filter Panel (e.g. Departments, Parties, Items, Subheads, Orders) */}
          {currentReportConfig?.filterType && (
            <EntityFilterPanel
              filterType={currentReportConfig.filterType}
              filterLabel={currentReportConfig.filterLabel}
              fromDate={fromDate}
              toDate={toDate}
              selectedIds={selectedEntities}
              onChange={(ids, allSelected) => {
                setSelectedEntities(ids);
                setIsAllEntitiesSelected(allSelected);
              }}
            />
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-500">
              {selectedReportKey ? (
                <span>
                  Ready to view:{' '}
                  <strong className="text-slate-800">
                    {currentReportConfig?.label}
                  </strong>
                </span>
              ) : (
                <span>Select a report from above to proceed</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {reportData && (
                <button
                  type="button"
                  onClick={handleClearReport}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <X size={16} />
                  <span>Clear Preview</span>
                </button>
              )}

              {selectedCategory === 'Stock Report' && selectedReportKey === 'item-wise' ? (
                <button
                  type="button"
                  onClick={handleExcelDownload}
                  disabled={excelDownloading}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {excelDownloading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Download size={18} />
                  )}
                  <span>{excelDownloading ? 'Exporting...' : 'Download Excel'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={reportLoading || !selectedReportKey}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reportLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Eye size={18} />
                  )}
                  <span>{reportLoading ? 'Generating Report...' : 'View Report'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Inline Report Output Section */}
        <div ref={reportContainerRef}>
          {reportLoading && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center gap-3 no-print">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <p className="text-slate-700 font-semibold text-base">Generating Report Data...</p>
              <p className="text-slate-400 text-xs">Querying database for period {fromDate} to {toDate}</p>
            </div>
          )}

          {reportError && !reportLoading && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center no-print">
              <p className="text-rose-700 font-semibold text-sm">{reportError}</p>
              <button
                onClick={handleGenerateReport}
                className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}

          {reportData && !reportLoading && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden print-full-view">
              {/* Report Header Bar */}
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 no-print">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      {reportData.reportTitle || activeReportTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Period: <strong className="text-slate-700">{reportData.period || `${fromDate} to ${toDate}`}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Printer size={16} />
                    <span>Print Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearReport}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    title="Close preview"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Printable Paper Canvas */}
              <div className="p-6 sm:p-8 lg:p-10 overflow-x-auto custom-scrollbar rv-paper-card">
                {/* Formal Report Header */}
                <div className="mb-4 pb-3 border-b-2 border-rose-600">
                  <div className="text-base font-bold text-slate-900">
                    {reportData.reportTitle || activeReportTitle}
                    {reportData.period ? ` for the Period Of ${reportData.period}` : ` (${fromDate} to ${toDate})`}
                  </div>
                </div>

                {/* Render Selected Report Table */}
                {renderReportContent()}
              </div>
            </div>
          )}

          {!reportData && !reportLoading && !reportError && (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center no-print">
              <FileSpreadsheet className="mx-auto text-slate-300 w-12 h-12 mb-3" />
              <h3 className="text-slate-700 font-semibold text-sm">No Report Loaded</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-md mx-auto">
                Select your desired category, date range, and report name above, then click{' '}
                <strong className="text-slate-600">View Report</strong> to display the ledger preview here.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Reports;