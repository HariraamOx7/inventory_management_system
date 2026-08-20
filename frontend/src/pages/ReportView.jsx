// frontend/src/pages/ReportView.jsx
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ═══════════════════════════════════════════════════════════════
//  1. Date Wise Receipt Register
// ═══════════════════════════════════════════════════════════════
function DateWiseReceiptReport({ data }) {
  const cols = 9;
  return (
    <>
      <table className="rpt-tbl">
        <thead>
          <tr>
            <th style={{width:40}}>Sl. No.</th>
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
            <>
              <tr key={`dh${gi}`} className="row-date-hdr">
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
              <tr key={`ds${gi}`} className="row-subtotal">
                <td colSpan={5} className="r lbl">Date Total</td>
                <td className="r">{fmt(g.dateTotalQty)}</td>
                <td></td>
                <td className="r">{fmt(g.dateTotalAmount)}</td>
                <td className="r red">{fmt(g.dateGrandTotal)}</td>
              </tr>
            </>
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
    </>
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
          <th style={{width:40}}>Sl. No.</th>
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
          <>
            <tr key={`ph${gi}`} className="row-group-hdr">
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
            <tr key={`ps${gi}`} className="row-subtotal">
              <td colSpan={5}></td>
              <td className="r">{fmt(g.partyTotalQty)}</td>
              <td></td>
              <td></td>
              <td className="r red">{fmt(g.partyGrandTotal)}</td>
            </tr>
          </>
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
          <th style={{width:50}}>Sl. No.</th>
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
          <th style={{width:40}}>Sl. No.</th>
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
          <>
            <tr key={`ih${gi}`} className="row-group-hdr">
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
            <tr key={`is${gi}`} className="row-subtotal">
              <td colSpan={5}></td>
              <td className="r">{fmt(g.itemTotalQty)}</td>
              <td></td>
              <td></td>
              <td className="r red">{fmt(g.itemGrandTotal)}</td>
            </tr>
          </>
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
          <th style={{width:35}}>SL No.</th>
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
          <>
            {/* Supplier header */}
            <tr key={`sh${si}`} className="row-group-hdr">
              <td colSpan={cols}>{sup.supplierName}</td>
            </tr>
            {sup.orders.map((ord, oi) => (
              <>
                {/* Order number sub-header */}
                <tr key={`oh${si}${oi}`} className="row-sub-hdr">
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
                <tr key={`os${si}${oi}`} className="row-subtotal">
                  <td colSpan={13}></td>
                  <td className="r red">{fmt(ord.orderGrandTotal)}</td>
                </tr>
              </>
            ))}
            {/* Supplier subtotal */}
            <tr key={`ss${si}`} className="row-subtotal grp">
              <td colSpan={13}></td>
              <td className="r red">{fmt(sup.supplierGrandTotal)}</td>
            </tr>
          </>
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
          <>
            <tr key={`doh${gi}`} className="row-group-hdr">
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
            <tr key={`dos${gi}`} className="row-subtotal grp">
              <td colSpan={12}></td>
              <td className="r red">{fmt(g.deptGrandTotal)}</td>
            </tr>
          </>
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
          <th style={{width:40}}>Sl. No.</th>
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
          <>
            <tr key={`ih${gi}`} className="row-date-hdr">
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
            <tr key={`is${gi}`} className="row-subtotal">
              <td colSpan={4} className="r lbl">Date Total</td>
              <td className="r">{fmt(g.dateTotalQty)}</td>
              <td className="r red">{fmt(g.dateTotalValue)}</td>
              <td></td>
            </tr>
          </>
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
          <th style={{width:40}}>Sl. No.</th>
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
          <>
            <tr key={`iih${gi}`} className="row-group-hdr">
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
            <tr key={`iis${gi}`} className="row-subtotal">
              <td colSpan={4}></td>
              <td className="r">{fmt(g.itemTotalQty)}</td>
              <td className="r red">{fmt(g.itemTotalValue)}</td>
              <td></td>
            </tr>
          </>
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
          <>
            <tr key={`dih${gi}`} className="row-group-hdr">
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
            <tr key={`dis${gi}`} className="row-subtotal">
              <td></td>
              <td className="r">{fmt(g.deptTotalQty)}</td>
              <td className="r red">{fmt(g.deptTotalValue)}</td>
              <td></td>
            </tr>
          </>
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
          <th style={{width:50}}>Sl. No.</th>
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
//  Main Report View Page
// ═══════════════════════════════════════════════════════════════
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

export default function ReportView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const category = searchParams.get('category') || '';
  const report   = searchParams.get('report') || '';
  const fromDate = searchParams.get('fromDate') || '';
  const toDate   = searchParams.get('toDate') || '';
  const title    = searchParams.get('title') || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reportKey = `${category}/${report}`;

  useEffect(() => {
    const fetchReport = async () => {
      const endpoint = apiEndpoints[reportKey];
      if (!endpoint) { setError(`Unknown report: ${reportKey}`); setLoading(false); return; }
      try {
        setLoading(true);
        const res = await axios.get(`${API_URL}${endpoint}`, { params: { fromDate, toDate } });
        if (res.data?.success) setData(res.data.data);
        else setError(res.data?.message || 'Failed to load report');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load report');
      } finally { setLoading(false); }
    };
    fetchReport();
  }, [reportKey, fromDate, toDate]);

  const renderReport = () => {
    if (!data) return null;
    switch (reportKey) {
      case 'receipt/date-wise':       return <DateWiseReceiptReport data={data} />;
      case 'receipt/party-wise':      return <PartyWiseReceiptReport data={data} />;
      case 'receipt/department-wise': return <DeptWiseReceiptReport data={data} />;
      case 'receipt/item-wise':       return <ItemWiseReceiptReport data={data} />;
      case 'purchase/supplier-wise':  return <SupplierWiseOrderReport data={data} />;
      case 'purchase/department-wise':return <DeptWiseOrderReport data={data} />;
      case 'issue/date-wise':         return <DateWiseIssueReport data={data} />;
      case 'issue/item-wise':         return <ItemWiseIssueReport data={data} />;
      case 'issue/department-wise':   return <DeptWiseIssueReport data={data} />;
      case 'stock/department-wise':   return <DeptWiseStockReport data={data} />;
      default: return <p>Unknown report type</p>;
    }
  };

  return (
    <>
      <style>{`
/* ── Page ─────────────────────────────────────────────────── */
.rv-page { font-family: 'Segoe UI', Tahoma, sans-serif; background: #eef1f5; min-height: 100vh; }

/* ── Toolbar ──────────────────────────────────────────────── */
.rv-bar { background:#fff; border-bottom:1px solid #e2e4e8; padding:10px 28px;
  display:flex; align-items:center; justify-content:space-between;
  position:sticky; top:0; z-index:50; box-shadow:0 1px 4px rgba(0,0,0,.06); }
.rv-bar .rv-left { display:flex; align-items:center; gap:14px; }
.rv-bar .rv-back { display:flex; align-items:center; gap:5px; color:#2563eb; cursor:pointer;
  background:none; border:none; font-size:13.5px; font-weight:500; padding:5px 8px; border-radius:5px; }
.rv-bar .rv-back:hover { background:#eff6ff; }
.rv-bar .rv-title { font-size:15px; font-weight:600; color:#1e293b; }
.rv-bar .rv-print { display:flex; align-items:center; gap:5px; background:#2563eb; color:#fff;
  border:none; padding:7px 16px; border-radius:7px; font-size:13.5px; font-weight:600; cursor:pointer; }
.rv-bar .rv-print:hover { background:#1d4ed8; }

/* ── Paper ─────────────────────────────────────────────────── */
.rv-paper { max-width:1120px; margin:20px auto; background:#fff;
  padding:36px 44px; box-shadow:0 1px 10px rgba(0,0,0,.07); border-radius:3px; }

.rv-hdr { margin-bottom:12px; }
.rv-hdr-title { color:#1e3a5f; font-size:13.5px; font-weight:600; }
.rv-divider { border:none; border-top:2.5px solid #dc2626; margin:0 0 18px 0; }

/* ── Table ─────────────────────────────────────────────────── */
.rpt-tbl { width:100%; border-collapse:collapse; font-size:13px; color:#1e3a5f; }
.rpt-tbl.compact { font-size:12px; }

.rpt-tbl thead th {
  color:#1e3a8a; font-weight:600; font-size:12.5px;
  padding:7px 10px; border-bottom:1px solid #1e3a8a;
  white-space:nowrap; text-decoration:underline; text-align:left;
}
.rpt-tbl thead th.r { text-align:right; }

.rpt-tbl tbody td { padding:5px 10px; vertical-align:top; line-height:1.6; }
.rpt-tbl td.r { text-align:right; }
.rpt-tbl td.c { text-align:center; }
.rpt-tbl td.red { color:#dc2626; font-weight:700; }
.rpt-tbl td.lbl { font-weight:600; color:#1e3a8a; }
.rpt-tbl td.dbl { border-bottom:3px double #1e3a5f; }

/* ── Date Header Row ──────────────────────────────────────── */
.row-date-hdr td { padding:12px 10px 4px 10px !important; }
.date-box { border:1px solid #c8ccd2; padding:2px 10px; background:#fafafa;
  font-weight:600; font-size:12.5px; display:inline-block; }

/* ── Group Header Row (Supplier / Party / Item / Department) */
.row-group-hdr td { padding:14px 10px 4px 10px !important; font-weight:700;
  color:#7f1d1d; font-size:13px; letter-spacing:.01em; }

/* ── Sub Header Row (Order Number) ────────────────────────── */
.row-sub-hdr td { padding:6px 10px 4px 28px !important; font-weight:700;
  color:#1e3a5f; font-size:12.5px; }

/* ── Subtotal Row ─────────────────────────────────────────── */
.row-subtotal td { border-top:1px dashed #b0b4bb; padding-top:4px !important;
  padding-bottom:6px !important; font-weight:600; }
.row-subtotal.grp td { border-top:1px dashed #9ca3af; padding-bottom:10px !important; }

/* ── Grand Total Row ──────────────────────────────────────── */
.row-grand td { border-top:1px dashed #6b7280; padding-top:8px !important;
  padding-bottom:8px !important; font-weight:700; font-size:13px; }

/* ── Misc ──────────────────────────────────────────────────── */
.rv-loading { display:flex; align-items:center; justify-content:center; gap:10px;
  padding:70px 0; color:#6b7280; font-size:15px; }
.rv-error { text-align:center; padding:50px 0; color:#dc2626; font-size:15px; }
.rv-empty { text-align:center; padding:50px 0; color:#6b7280; font-size:15px; }

/* ── Print ─────────────────────────────────────────────────── */
@media print {
  body { background:#fff !important; margin:0; }
  .rv-bar { display:none !important; }
  .rv-page { background:#fff !important; }
  .rv-paper { max-width:100%; margin:0; padding:14px 18px; box-shadow:none; border-radius:0; }
  .rpt-tbl { page-break-inside:auto; }
  .rpt-tbl tr { page-break-inside:avoid; }
  .row-date-hdr, .row-group-hdr, .row-sub-hdr { page-break-after:avoid; }
  .row-subtotal, .row-grand { page-break-before:avoid; }
  .rpt-tbl td.red { color:#dc2626 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .rv-divider { border-top-color:#dc2626 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .row-group-hdr td { color:#7f1d1d !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .rpt-tbl thead th { color:#1e3a8a !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
      `}</style>

      <div className="rv-page">
        <div className="rv-bar">
          <div className="rv-left">
            <button className="rv-back" onClick={() => navigate('/reports')}>
              <ArrowLeft size={16} /> Back to Reports
            </button>
            <span className="rv-title">{title}</span>
          </div>
          <button className="rv-print" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
        </div>

        <div className="rv-paper">
          {loading ? (
            <div className="rv-loading"><Loader2 size={22} className="animate-spin" /> Loading report...</div>
          ) : error ? (
            <div className="rv-error">{error}</div>
          ) : !data ? (
            <div className="rv-empty">No data available</div>
          ) : (
            <>
              <div className="rv-hdr">
                <div className="rv-hdr-title">
                  {data.reportTitle || title}
                  {data.period ? ` for the Period Of ${data.period}` : ''}
                </div>
              </div>
              <hr className="rv-divider" />
              {renderReport()}
            </>
          )}
        </div>
      </div>
    </>
  );
}
