// frontend/src/pages/Reports.jsx
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
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
  FileText
} from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const categoryIcons = {
  Purchase: ShoppingCart,
  Receipt: PackageCheck,
  Issue: Send,
  Stock: Boxes
};

const reportOptions = {
  Purchase: [
    { label: 'Supplier Wise Order Details', key: 'supplier-wise' },
    { label: 'Department Wise Order Details', key: 'department-wise' }
  ],
  Receipt: [
    { label: 'Date Wise Receipt Register', key: 'date-wise' },
    { label: 'Party Wise Receipt Register', key: 'party-wise' },
    { label: 'Department Wise Receipt Register', key: 'department-wise' },
    { label: 'Item Wise Receipt Register', key: 'item-wise' }
  ],
  Issue: [
    { label: 'Date Wise Issue Register', key: 'date-wise' },
    { label: 'Item Wise Issue Register', key: 'item-wise' },
    { label: 'Department Wise Issue Register', key: 'department-wise' }
  ],
  Stock: [
    { label: 'Item Wise Stock (Excel Export)', key: 'item-wise' },
    { label: 'Department Wise Stock Abstract', key: 'department-wise' }
  ]
};

const categoryApiPrefix = {
  Purchase: 'purchase',
  Receipt: 'receipt',
  Issue: 'issue',
  Stock: 'stock'
};

const apiEndpoints = {
  'receipt/date-wise': '/reports/receipt/date-wise',
  'receipt/party-wise': '/reports/receipt/party-wise',
  'receipt/department-wise': '/reports/receipt/department-wise',
  'receipt/item-wise': '/reports/receipt/item-wise',
  'purchase/supplier-wise': '/reports/purchase/supplier-wise',
  'purchase/department-wise': '/reports/purchase/department-wise',
  'issue/date-wise': '/reports/issue/date-wise',
  'issue/item-wise': '/reports/issue/item-wise',
  'issue/department-wise': '/reports/issue/department-wise',
  'stock/department-wise': '/reports/stock/department-wise'
};

// ═══════════════════════════════════════════════════════════════
//  1. Date Wise Receipt Register
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

// ═══════════════════════════════════════════════════════════════
//  2. Party Wise Receipt Register
// ═══════════════════════════════════════════════════════════════
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
              <td colSpan={cols}>{g.partyName}</td>
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
              <td className="r">{fmt(g.partyTotalQty)}</td>
              <td></td>
              <td></td>
              <td className="r red">{fmt(g.partyGrandTotal)}</td>
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

// ═══════════════════════════════════════════════════════════════
//  3. Department Wise Receipt Register
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  4. Item Wise Receipt Register
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  5. Supplier Wise Order Details
// ═══════════════════════════════════════════════════════════════
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
            {/* Supplier header */}
            <tr className="row-group-hdr">
              <td colSpan={cols}>{sup.supplierName}</td>
            </tr>
            {sup.orders.map((ord, oi) => (
              <React.Fragment key={`ord-${si}-${oi}`}>
                {/* Order number sub-header */}
                <tr className="row-sub-hdr">
                  <td colSpan={cols}>{ord.orderNo}</td>
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
                {/* Order subtotal */}
                <tr className="row-subtotal">
                  <td colSpan={13}></td>
                  <td className="r red">{fmt(ord.orderGrandTotal)}</td>
                </tr>
              </React.Fragment>
            ))}
            {/* Supplier subtotal */}
            <tr className="row-subtotal grp">
              <td colSpan={13}></td>
              <td className="r red">{fmt(sup.supplierGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={13}></td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  6. Department Wise Order Details
// ═══════════════════════════════════════════════════════════════
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
              <td colSpan={12}></td>
              <td className="r red">{fmt(g.deptGrandTotal)}</td>
            </tr>
          </React.Fragment>
        ))}
        <tr className="row-grand">
          <td colSpan={12}></td>
          <td className="r red dbl">{fmt(data.reportGrandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  7. Date Wise Issue Register
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

// ═══════════════════════════════════════════════════════════════
//  8. Item Wise Issue Register
// ═══════════════════════════════════════════════════════════════
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
              <td colSpan={cols}>{g.itemName}</td>
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
              <td className="r">{fmt(g.itemTotalQty)}</td>
              <td className="r red">{fmt(g.itemTotalValue)}</td>
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

// ═══════════════════════════════════════════════════════════════
//  9. Department Wise Issue Register
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
//  10. Department Wise Stock
// ═══════════════════════════════════════════════════════════════
function DeptWiseStockReport({ data }) {
  return (
    <table className="rpt-tbl">
      <thead>
        <tr>
          <th style={{ width: 50 }}>Sl. No.</th>
          <th>Department Name</th>
          <th className="r">Item Count</th>
          <th className="r">Total Qty</th>
          <th className="r">Total Value</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((it) => (
          <tr key={it.slNo}>
            <td className="c">{it.slNo}</td>
            <td>{it.departmentName}</td>
            <td className="r">{it.itemCount}</td>
            <td className="r">{fmt(it.totalQty)}</td>
            <td className="r">{fmt(it.totalValue)}</td>
          </tr>
        ))}
        <tr className="row-grand">
          <td colSpan={3}></td>
          <td className="r">{fmt(data.reportTotalQty)}</td>
          <td className="r red dbl">{fmt(data.reportTotalValue)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Main Reports Page with Integrated Blended UI
// ═══════════════════════════════════════════════════════════════
const Reports = () => {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const [selectedCategory, setSelectedCategory] = useState('Purchase');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReportKey, setSelectedReportKey] = useState('');

  // Inline report state
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [activeReportKey, setActiveReportKey] = useState('');
  const [activeReportTitle, setActiveReportTitle] = useState('');
  const [excelDownloading, setExcelDownloading] = useState(false);

  const reportContainerRef = useRef(null);

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedReportKey('');
  };

  const handleGenerateReport = async () => {
    if (!selectedReportKey) {
      showToast('Please select a report first', 'error');
      return;
    }

    // Special case: Stock -> Item Wise Stock => download Excel
    if (selectedCategory === 'Stock' && selectedReportKey === 'item-wise') {
      handleExcelDownload();
      return;
    }

    const prefix = categoryApiPrefix[selectedCategory];
    const key = `${prefix}/${selectedReportKey}`;
    const endpoint = apiEndpoints[key];
    const reportTitle = currentReports.find((r) => r.key === selectedReportKey)?.label || 'Report';

    if (!endpoint) {
      showToast(`Unknown report configuration: ${key}`, 'error');
      return;
    }

    try {
      setReportLoading(true);
      setReportError('');
      setActiveReportKey(key);
      setActiveReportTitle(reportTitle);

      const res = await axios.get(`${API_URL}${endpoint}`, {
        params: { fromDate, toDate }
      });

      if (res.data?.success) {
        setReportData(res.data.data);
        showToast('Report generated successfully', 'success');

        // Smooth scroll to the report section
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

  const renderReportContent = () => {
    if (!reportData) return null;
    switch (activeReportKey) {
      case 'receipt/date-wise':
        return <DateWiseReceiptReport data={reportData} />;
      case 'receipt/party-wise':
        return <PartyWiseReceiptReport data={reportData} />;
      case 'receipt/department-wise':
        return <DeptWiseReceiptReport data={reportData} />;
      case 'receipt/item-wise':
        return <ItemWiseReceiptReport data={reportData} />;
      case 'purchase/supplier-wise':
        return <SupplierWiseOrderReport data={reportData} />;
      case 'purchase/department-wise':
        return <DeptWiseOrderReport data={reportData} />;
      case 'issue/date-wise':
        return <DateWiseIssueReport data={reportData} />;
      case 'issue/item-wise':
        return <ItemWiseIssueReport data={reportData} />;
      case 'issue/department-wise':
        return <DeptWiseIssueReport data={reportData} />;
      case 'stock/department-wise':
        return <DeptWiseStockReport data={reportData} />;
      default:
        return <p className="text-center py-6 text-slate-500">Unknown report type</p>;
    }
  };

  const currentReports = reportOptions[selectedCategory] || [];

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.keys(reportOptions).map((category) => {
                const isSelected = selectedCategory === category;
                const IconComponent = categoryIcons[category] || Layers;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryChange(category)}
                    className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-150 cursor-pointer border ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-600 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <IconComponent size={18} className={isSelected ? 'text-white' : 'text-slate-500'} />
                    <span>{category}</span>
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
                onChange={(e) => setSelectedReportKey(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none cursor-pointer"
              >
                <option value="">-- Choose a {selectedCategory} Report --</option>
                {currentReports.map((report) => (
                  <option key={report.key} value={report.key}>
                    {report.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-500">
              {selectedReportKey ? (
                <span>
                  Ready to view:{' '}
                  <strong className="text-slate-800">
                    {currentReports.find((r) => r.key === selectedReportKey)?.label}
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

              {selectedCategory === 'Stock' && selectedReportKey === 'item-wise' ? (
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
                {/* Formal Report Header (Visible in print and screen) */}
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