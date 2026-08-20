// frontend/src/pages/BillEntry.jsx
import { useState, useEffect, useMemo, useCallback, memo, Fragment } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import {
  Plus, Edit2, Trash2, Save, X, FileText, ArrowUpDown, Receipt as ReceiptIcon,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, ChevronDown,
  Inbox, Printer, Layers
} from 'lucide-react';
import Layout from '../components/Layout';
import SearchSelect from '../components/SearchSelect';
import CustomSelect from '../components/CustomSelect';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const formatRoundOff = (val) => {
  const num = parseFloat(val) || 0;
  if (num > 0) return `+${num.toFixed(2)}`;
  return num.toFixed(2);
};

const initialFormState = {
  VoucherNo: '',
  GateInwardNo: '',
  GRNNo: '',
  PartyName: '',
  AccDate: new Date().toISOString().split('T')[0],
  PartyBillNo: '',
  BillDate: new Date().toISOString().split('T')[0],
  PurchaseType: '',
  BillAmount: '',
  TDS: '',
  Narration: '',
  Total: 0,
  Discount: '',
  GST: '',
  IGST: '',
  VAT_CST: '',
  P_F: '',
  LorryFreight: '',
  RoundOff: 0,
  TaxRndOff: 0,
  GrandTotal: 0
};

// Memoized Table Row Component
const BillRow = memo(function BillRow({
  bill,
  isExpanded,
  onToggleExpand,
  onPrint,
  onEdit,
  onDelete
}) {
  const billItems = bill.details || bill.BillEntryDetails || [];

  return (
    <Fragment>
      <tr className="hover:bg-slate-50/60 transition-colors group">
        <td className="py-4 px-3 text-center">
          <button
            type="button"
            onClick={() => onToggleExpand(bill.VoucherNo)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title={isExpanded ? "Collapse bill item details & gate inwards" : "Expand bill item details & gate inwards"}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </td>
        <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-100 font-semibold text-xs">
            VCH-{String(bill.VoucherNo).padStart(3, '0')}
          </span>
        </td>
        <td className="py-4 px-4">
          <div className="font-semibold text-slate-800">{bill.PartyName}</div>
        </td>
        <td className="py-4 px-4 whitespace-nowrap font-medium text-slate-700">
          {bill.GRNNo ? `GRN-${String(bill.GRNNo).padStart(3, '0')}` : <span className="text-slate-400">-</span>}
        </td>
        <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
          {bill.PartyBillNo || <span className="text-slate-400">-</span>}
        </td>
        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
          {bill.BillDate ? new Date(bill.BillDate).toLocaleDateString('en-GB') : '-'}
        </td>
        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
          {bill.AccDate ? new Date(bill.AccDate).toLocaleDateString('en-GB') : '-'}
        </td>
        <td className="py-4 px-4 whitespace-nowrap">
          {bill.PurchaseType ? (
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium border border-slate-200">
              {bill.PurchaseType}
            </span>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="py-4 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
          ₹{(bill.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
        <td className="py-4 px-4 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onPrint(bill.VoucherNo)}
              className="px-3.5 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 font-medium text-xs cursor-pointer"
              title="Print Purchase Voucher"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              type="button"
              onClick={() => onEdit(bill)}
              className="px-3.5 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 font-medium text-xs cursor-pointer"
              title="Edit Bill Entry"
            >
              <Edit2 size={14} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(bill.VoucherNo)}
              className="px-3.5 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/20 flex items-center gap-1.5 font-medium text-xs cursor-pointer"
              title="Delete Bill Entry"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Sub-table for Gate Inwards & Billed Items */}
      {isExpanded && (
        <tr className="bg-slate-50/90 border-b border-slate-200">
          <td colSpan={10} className="p-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={14} className="text-blue-600" />
                  Bill & Gate Inward Details for VCH-{String(bill.VoucherNo).padStart(3, '0')} ({bill.PartyName})
                </h4>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {bill.GRNNo && <span>GRN: <strong className="text-slate-700">GRN-{bill.GRNNo}</strong></span>}
                  {bill.PartyBillNo && <span>Party Bill No: <strong className="text-slate-700">{bill.PartyBillNo}</strong></span>}
                </div>
              </div>

              {/* Gate Inward Batches Table (Matching Receipt.jsx) */}
              {bill.gateInwards && bill.gateInwards.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Linked Gate Inwards ({bill.gateInwards.length})
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                          <th className="py-2.5 px-3 whitespace-nowrap">Inward No</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Inward Date</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Invoice No</th>
                          <th className="py-2.5 px-3 whitespace-nowrap">Invoice Date</th>
                          <th className="py-2.5 px-3">Received Items in Batch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {bill.gateInwards.map((gi) => (
                          <tr key={gi.InwardNo} className="hover:bg-slate-50/70">
                            <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                              GI-{String(gi.InwardNo).padStart(3, '0')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {gi.InwardDate ? new Date(gi.InwardDate).toLocaleDateString('en-GB') : '-'}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                              {gi.InvoiceNo || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {gi.InvoiceDate ? new Date(gi.InvoiceDate).toLocaleDateString('en-GB') : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {gi.details && gi.details.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {gi.details.map((d, dIdx) => (
                                    <span key={dIdx} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs">
                                      <span className="font-medium text-slate-800">{d.ItemName}:</span>
                                      <span className="font-semibold text-slate-900">{d.ReceivedQty ?? d.Qty} units</span>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No item details recorded</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                bill.GateInwardNo && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>Gate Inward: <strong className="text-slate-800 font-semibold">GI-{String(bill.GateInwardNo).padStart(3, '0')}</strong></span>
                    <span>Inward Date: <strong className="text-slate-700">{bill.AccDate ? new Date(bill.AccDate).toLocaleDateString('en-GB') : '-'}</strong></span>
                    <span>Party Bill No: <strong className="text-slate-700">{bill.PartyBillNo || 'N/A'}</strong></span>
                  </div>
                )
              )}

              {/* Billed Items Table */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Billed Line Items ({billItems.length})
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">PO Order No</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Billed Qty</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Unit Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">Item Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                      {billItems.map((item, idx) => {
                        const qty = parseFloat(item.Qty !== undefined ? item.Qty : (item.ReceivedQty || 0)) || 0;
                        const rate = parseFloat(item.UnitRate) || 0;
                        const itemTotal = parseFloat(item.TotalAmount) || (qty * rate);
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">{item.ItemName}</td>
                            <td className="py-2.5 px-3 text-slate-600">{item.OrderNo ? `PO-${item.OrderNo}` : '-'}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{qty}</td>
                            <td className="py-2.5 px-3 text-right">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                      {billItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-3 px-4 text-center text-slate-400 italic">
                            No line items recorded for this bill entry
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-600">
                  <span>Subtotal: <strong className="text-slate-800 font-semibold">₹{(bill.Total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  {parseFloat(bill.Discount) > 0 && <span>Discount: <strong className="text-slate-800 font-semibold">-₹{parseFloat(bill.Discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                  {parseFloat(bill.GST) > 0 && <span>Tax (GST): <strong className="text-slate-800 font-semibold">+₹{parseFloat(bill.GST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                  {parseFloat(bill.IGST) > 0 && <span>IGST: <strong className="text-slate-800 font-semibold">+₹{parseFloat(bill.IGST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                  {parseFloat(bill.VAT_CST) > 0 && <span>VAT/CST: <strong className="text-slate-800 font-semibold">+₹{parseFloat(bill.VAT_CST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                  {parseFloat(bill.P_F) > 0 && <span>P&F: <strong className="text-slate-800 font-semibold">+₹{parseFloat(bill.P_F).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                  {parseFloat(bill.LorryFreight) > 0 && <span>Freight: <strong className="text-slate-800 font-semibold">+₹{parseFloat(bill.LorryFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                  <span>Round Off: <strong className="text-slate-700">{formatRoundOff(bill.RoundOff)}</strong></span>
                </div>
                <div className="text-sm font-bold text-emerald-600">
                  Grand Total: ₹{(bill.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
});

export default function BillEntry() {
  const showToast = useToastStore(state => state.showToast);

  const [formData, setFormData] = useState(initialFormState);
  const [parties, setParties] = useState([]);
  const [grnsList, setGrnsList] = useState([]);
  const [linkedGateInwards, setLinkedGateInwards] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [billEntries, setBillEntries] = useState([]);
  const [editingVoucherNo, setEditingVoucherNo] = useState(null);
  const [expandedVoucherNo, setExpandedVoucherNo] = useState(null);
  const [purchaseTypes, setPurchaseTypes] = useState([]);

  // Slide-over Drawer states (Matching Receipt / Item Master style)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [noRoundOff, setNoRoundOff] = useState(false);

  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchBillEntries = useCallback(async () => {
    try {
      const billsRes = await axios.get(`${API_URL}/bill-entries`);
      if (billsRes.data?.success) {
        setBillEntries(billsRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching bill entries:', error);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      await fetchBillEntries();

      const [ptRes, partiesRes] = await Promise.all([
        axios.get(`${API_URL}/purchase-types`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/bill-entries/available-parties`).catch(() => ({ data: { success: false } }))
      ]);

      if (ptRes.data?.success) {
        setPurchaseTypes(ptRes.data.data);
      }

      if (partiesRes.data?.success) {
        setParties((partiesRes.data.data || []).map(name => ({ name })));
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchBillEntries]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Fetch available GRNs when party is selected in form
  useEffect(() => {
    if (formData.PartyName) {
      const fetchPartyGRNs = async () => {
        try {
          const grnRes = await axios.get(`${API_URL}/bill-entries/available-grns`, {
            params: { partyName: formData.PartyName }
          }).catch(() => ({ data: { success: false } }));

          if (grnRes.data?.success) {
            setGrnsList(grnRes.data.data || []);
          }
        } catch (error) {
          console.error('Error fetching GRNs for party:', error);
        }
      };

      fetchPartyGRNs();
    } else {
      setGrnsList([]);
    }
  }, [formData.PartyName]);

  // Helper to generate default narration
  const generateNarration = useCallback((itemList, billNo, billDate) => {
    if (!itemList || itemList.length === 0) return '';
    const itemPart = itemList.length === 1
      ? itemList[0].ItemName
      : `${itemList[0].ItemName} etc`;
    const billDateObj = billDate ? new Date(billDate) : null;
    const billDateFormatted = billDateObj && !isNaN(billDateObj.getTime())
      ? `${String(billDateObj.getDate()).padStart(2, '0')}-${String(billDateObj.getMonth() + 1).padStart(2, '0')}-${billDateObj.getFullYear()}`
      : '';
    const billRefPart = billNo || billDateFormatted
      ? ` as per Bill no:${billNo || ''}${billDateFormatted ? `/${billDateFormatted}` : ''}`
      : '';
    return `Being Supply of ${itemPart}${billRefPart}`;
  }, []);

  // Fetch GRN details when GRNNo changes in form (only for new entries)
  useEffect(() => {
    if (formData.GRNNo && isNewEntry) {
      const fetchGRNDetails = async () => {
        try {
          const response = await axios.get(`${API_URL}/bill-entries/grn-details`, {
            params: { grnNo: formData.GRNNo }
          });
          if (response.data?.success) {
            const receipt = response.data.data;
            const isZeroRound = receipt.RoundOff !== undefined && receipt.RoundOff !== null && Math.abs(parseFloat(receipt.RoundOff) || 0) < 0.0001;
            setNoRoundOff(isZeroRound);

            setLinkedGateInwards(receipt.gateInwards || []);

            const details = receipt.details || receipt.ReceiptDetails || [];
            const mappedItems = details.map(d => {
              const qtyVal = d.Qty !== undefined ? d.Qty : (d.ReceivedQty !== undefined ? d.ReceivedQty : 0);
              const rateVal = parseFloat(d.UnitRate) || 0;
              return {
                ItemName: d.ItemName,
                ReceivedQty: qtyVal,
                Qty: qtyVal,
                UnitRate: rateVal,
                OrderNo: d.OrderNo,
                GRNNo: d.GRNNo || receipt.GRNNo,
                DiscountAmt: parseFloat(d.DiscountAmt) || 0,
                DiscountPct: parseFloat(d.DiscountPct) || 0,
                GSTType: d.GSTType || (d.GSTPct ? `GST [${d.GSTPct} %]` : 'GST [0 %]'),
                GSTPct: parseFloat(d.GSTPct) || 0,
                SGSTPct: parseFloat(d.SGSTPct) || 0,
                CGSTPct: parseFloat(d.CGSTPct) || 0,
                IGSTPct: parseFloat(d.IGSTPct) || 0,
                TotalAmount: d.TotalAmount !== undefined ? parseFloat(d.TotalAmount) : (qtyVal * rateVal)
              };
            });

            const invoiceDateStr = receipt.InvoiceDate ? new Date(receipt.InvoiceDate).toISOString().split('T')[0] : formData.BillDate;
            const autoNarration = generateNarration(mappedItems, receipt.InvoiceNo || '', invoiceDateStr);

            setFormData(prev => ({
              ...prev,
              GateInwardNo: receipt.GateInwardNo || prev.GateInwardNo,
              PartyName: receipt.PartyName || prev.PartyName,
              PartyBillNo: receipt.InvoiceNo || '',
              BillDate: invoiceDateStr,
              Narration: autoNarration || prev.Narration,
              Total: receipt.Total || 0,
              Discount: parseFloat(receipt.Discount) > 0 ? receipt.Discount : '',
              GST: parseFloat(receipt.GST) > 0 ? receipt.GST : '',
              IGST: parseFloat(receipt.IGST) > 0 ? receipt.IGST : '',
              VAT_CST: parseFloat(receipt.VAT_CST) > 0 ? receipt.VAT_CST : '',
              P_F: parseFloat(receipt.P_F) > 0 ? receipt.P_F : '',
              LorryFreight: parseFloat(receipt.LorryFreight) > 0 ? receipt.LorryFreight : '',
              RoundOff: receipt.RoundOff || 0,
              GrandTotal: receipt.GrandTotal || 0,
              BillAmount: receipt.GrandTotal || 0
            }));

            if (mappedItems.length > 0) {
              setItems(mappedItems);
            }
          }
        } catch (error) {
          console.error('Error fetching GRN details:', error);
        }
      };
      fetchGRNDetails();
    }
  }, [formData.GRNNo, isNewEntry, generateNarration, formData.BillDate]);

  // Derived financial computations using useMemo (zero cascading effects)
  const calculatedTotal = useMemo(() => {
    if (items.length > 0) {
      return items.reduce((sum, item) => {
        const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
        const rate = parseFloat(item.UnitRate) || 0;
        return sum + (qty * rate);
      }, 0);
    }
    return parseFloat(formData.Total) || 0;
  }, [items, formData.Total]);

  const financialCalculations = useMemo(() => {
    const total = calculatedTotal;
    const discount = parseFloat(formData.Discount) || 0;
    const gst = parseFloat(formData.GST) || 0;
    const igst = parseFloat(formData.IGST) || 0;
    const vatCst = parseFloat(formData.VAT_CST) || 0;
    const pf = parseFloat(formData.P_F) || 0;
    const lorryFreight = parseFloat(formData.LorryFreight) || 0;
    const unroundedGrandTotal = total - discount + gst + igst + vatCst + pf + lorryFreight;
    const grandTotal = Math.round(unroundedGrandTotal);
    const roundOff = noRoundOff ? 0 : parseFloat((grandTotal - unroundedGrandTotal).toFixed(2));

    return {
      total,
      grandTotal,
      roundOff,
      billAmount: grandTotal
    };
  }, [calculatedTotal, formData.Discount, formData.GST, formData.IGST, formData.VAT_CST, formData.P_F, formData.LorryFreight, noRoundOff]);

  // Auto-generate Narration for new entries only when needed
  useEffect(() => {
    if (items.length > 0 && isNewEntry) {
      const autoNarration = generateNarration(items, formData.PartyBillNo, formData.BillDate);
      setFormData(prev => {
        if (!prev.Narration || prev.Narration.startsWith('Being Supply of') || prev.Narration === autoNarration) {
          if (prev.Narration === autoNarration) return prev;
          return { ...prev, Narration: autoNarration };
        }
        return prev;
      });
    }
  }, [items, formData.PartyBillNo, formData.BillDate, isNewEntry, generateNarration]);

  // Unique parties from existing bill entries (for filter dropdown)
  const uniqueBillParties = useMemo(() => {
    const setP = new Set();
    billEntries.forEach(b => {
      if (b.PartyName) setP.add(b.PartyName.trim());
    });
    return Array.from(setP).sort();
  }, [billEntries]);

  // Filtered & Sorted Bill Entries
  const filteredAndSortedBills = useMemo(() => {
    return billEntries
      .filter(b => {
        const matchSearch = search.trim() === '' ||
          String(b.VoucherNo).toLowerCase().includes(search.toLowerCase()) ||
          String(b.GRNNo).toLowerCase().includes(search.toLowerCase()) ||
          String(b.GateInwardNo).toLowerCase().includes(search.toLowerCase()) ||
          (b.gateInwards && b.gateInwards.some(gi => String(gi.InwardNo).toLowerCase().includes(search.toLowerCase()))) ||
          (b.PartyName && b.PartyName.toLowerCase().includes(search.toLowerCase())) ||
          (b.PartyBillNo && b.PartyBillNo.toLowerCase().includes(search.toLowerCase()));
        const matchParty = partyFilter === 'ALL' || b.PartyName === partyFilter;
        return matchSearch && matchParty;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.AccDate || b.createdAt) - new Date(a.AccDate || a.createdAt);
        }
        if (sortBy === 'oldest') {
          return new Date(a.AccDate || a.createdAt) - new Date(b.AccDate || b.createdAt);
        }
        if (sortBy === 'voucher_desc') {
          return Number(b.VoucherNo) - Number(a.VoucherNo);
        }
        if (sortBy === 'voucher_asc') {
          return Number(a.VoucherNo) - Number(b.VoucherNo);
        }
        if (sortBy === 'total_desc') {
          return (b.GrandTotal || 0) - (a.GrandTotal || 0);
        }
        return 0;
      });
  }, [billEntries, search, partyFilter, sortBy]);

  // Pagination calculations
  const totalItems = filteredAndSortedBills.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedBills.slice(start, start + itemsPerPage);
  }, [filteredAndSortedBills, currentPage, itemsPerPage]);

  const handleOpenAddDrawer = useCallback(() => {
    setIsNewEntry(true);
    setEditingVoucherNo(null);
    setFormData(initialFormState);
    setItems([]);
    setGrnsList([]);
    setLinkedGateInwards([]);
    setNoRoundOff(false);

    // Refresh if empty
    if (parties.length === 0) {
      axios.get(`${API_URL}/bill-entries/available-parties`)
        .then(res => { if (res.data?.success) setParties((res.data.data || []).map(n => ({ name: n }))); })
        .catch(() => { });
    }
    if (purchaseTypes.length === 0) {
      axios.get(`${API_URL}/purchase-types`)
        .then(res => { if (res.data?.success) setPurchaseTypes(res.data.data); })
        .catch(() => { });
    }

    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  }, [parties.length, purchaseTypes.length]);

  const handleOpenEditDrawer = useCallback(async (bill) => {
    setIsNewEntry(false);
    setNoRoundOff(bill.RoundOff !== undefined && bill.RoundOff !== null && Math.abs(parseFloat(bill.RoundOff) || 0) < 0.0001);
    setFormData({
      VoucherNo: bill.VoucherNo.toString(),
      GateInwardNo: bill.GateInwardNo || '',
      GRNNo: bill.GRNNo || '',
      PartyName: bill.PartyName || '',
      AccDate: bill.AccDate ? new Date(bill.AccDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      PartyBillNo: bill.PartyBillNo || '',
      BillDate: bill.BillDate ? new Date(bill.BillDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      PurchaseType: bill.PurchaseType || '',
      BillAmount: parseFloat(bill.BillAmount) > 0 ? bill.BillAmount : '',
      TDS: parseFloat(bill.TDS) > 0 ? bill.TDS : '',
      Narration: bill.Narration || '',
      Total: bill.Total || 0,
      Discount: parseFloat(bill.Discount) > 0 ? bill.Discount : '',
      GST: parseFloat(bill.GST) > 0 ? bill.GST : '',
      IGST: parseFloat(bill.IGST) > 0 ? bill.IGST : '',
      VAT_CST: parseFloat(bill.VAT_CST) > 0 ? bill.VAT_CST : '',
      P_F: parseFloat(bill.P_F) > 0 ? bill.P_F : '',
      LorryFreight: parseFloat(bill.LorryFreight) > 0 ? bill.LorryFreight : '',
      RoundOff: bill.RoundOff || 0,
      TaxRndOff: bill.TaxRndOff || 0,
      GrandTotal: bill.GrandTotal || 0
    });

    if (bill.gateInwards && bill.gateInwards.length > 0) {
      setLinkedGateInwards(bill.gateInwards);
    } else if (bill.GRNNo) {
      axios.get(`${API_URL}/bill-entries/grn-details`, { params: { grnNo: bill.GRNNo } })
        .then(res => {
          if (res.data?.success && res.data.data?.gateInwards) {
            setLinkedGateInwards(res.data.data.gateInwards);
          }
        })
        .catch(() => { });
    } else if (bill.GateInwardNo) {
      setLinkedGateInwards([{
        InwardNo: bill.GateInwardNo,
        InwardDate: bill.AccDate,
        InvoiceNo: bill.PartyBillNo
      }]);
    } else {
      setLinkedGateInwards([]);
    }

    const details = bill.details || bill.BillEntryDetails || [];
    const mappedItems = details.map(d => {
      const qtyVal = d.Qty !== undefined ? d.Qty : (d.ReceivedQty !== undefined ? d.ReceivedQty : 0);
      const rateVal = parseFloat(d.UnitRate) || 0;
      return {
        ItemName: d.ItemName,
        ReceivedQty: qtyVal,
        Qty: qtyVal,
        UnitRate: rateVal,
        OrderNo: d.OrderNo,
        GRNNo: d.GRNNo || bill.GRNNo,
        DiscountAmt: parseFloat(d.DiscountAmt) || 0,
        GSTType: d.GSTType || (d.GSTPct ? `GST [${d.GSTPct} %]` : ''),
        GSTPct: parseFloat(d.GSTPct) || 0,
        TotalAmount: d.TotalAmount !== undefined ? parseFloat(d.TotalAmount) : (qtyVal * rateVal)
      };
    });
    setItems(mappedItems);

    setEditingVoucherNo(bill.VoucherNo);
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);

    // Enrich with GRN item details if available
    if (bill.GRNNo) {
      try {
        const res = await axios.get(`${API_URL}/bill-entries/grn-details`, {
          params: { grnNo: bill.GRNNo }
        });
        if (res.data?.success && res.data?.data?.details) {
          const grnItemMap = {};
          res.data.data.details.forEach(gd => {
            grnItemMap[gd.ItemName] = gd;
          });
          setItems(prev => prev.map(item => {
            const gd = grnItemMap[item.ItemName];
            if (gd) {
              return {
                ...item,
                GRNNo: item.GRNNo || gd.GRNNo || bill.GRNNo,
                DiscountAmt: gd.DiscountAmt || item.DiscountAmt || 0,
                GSTType: gd.GSTType || item.GSTType,
                GSTPct: gd.GSTPct !== undefined ? gd.GSTPct : item.GSTPct
              };
            }
            return item;
          }));
        }
      } catch (err) {
        console.error('Error enriching edit drawer items:', err);
      }
    }
  }, []);

  const handleCloseEditDrawer = useCallback(() => {
    setIsDrawerVisible(false);
    setTimeout(() => {
      setEditDrawerOpen(false);
      setEditingVoucherNo(null);
      setFormData(initialFormState);
      setLinkedGateInwards([]);
      setItems([]);
    }, 300);
  }, []);

  const handleDelete = useCallback(async (voucherNo) => {
    if (!window.confirm(`Are you sure you want to delete Bill Entry #${voucherNo}?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/bill-entries/${voucherNo}`);
      showToast('Bill entry deleted successfully!', 'success');
      fetchBillEntries();
    } catch (error) {
      console.error('Error deleting bill entry:', error);
      showToast(error.response?.data?.message || 'Error deleting bill entry', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchBillEntries, showToast]);

  // Helper: run layered deletion confirmation for a duplicate bill entry chain
  const handleDuplicateBillCleanup = useCallback(async (duplicate, payload) => {
    const { VoucherNo, PartyName: dupParty, PartyBillNo: dupBillNo, GRNNo, GateInwardNo, hasReceipt, hasGateInward, hasPurchaseOrder } = duplicate;

    // Layer 1: Confirm BillEntry deletion
    const confirmBill = window.confirm(
      `⚠️ DUPLICATE BILL ENTRY FOUND\n\n` +
      `Party: ${dupParty}\nBill No: ${dupBillNo}\nVoucher No: ${VoucherNo}\n\n` +
      `Do you want to DELETE this duplicate bill entry (#${VoucherNo}) to proceed?`
    );
    if (!confirmBill) {
      showToast('Save cancelled — duplicate bill entry was not removed.', 'warning');
      return false;
    }

    const layers = { bill: true, receipt: false, gateInward: false, purchaseOrder: false };

    // Layer 2: Confirm Receipt deletion
    if (hasReceipt && GRNNo) {
      layers.receipt = window.confirm(
        `Also DELETE the linked Receipt/GRN (GRN #${GRNNo}) and its item details?`
      );
    }

    // Layer 3: Confirm GateInward deletion
    if (hasGateInward && GateInwardNo) {
      layers.gateInward = window.confirm(
        `Also DELETE the linked Gate Inward (#${GateInwardNo}) and its item details?`
      );
    }

    // Layer 4: Confirm PurchaseOrder deletion
    if (hasPurchaseOrder && layers.gateInward) {
      layers.purchaseOrder = window.confirm(
        `Also DELETE the linked Purchase Order (Order #${duplicate.OrderNo}) and its item details?\n\n(Will be skipped if another Gate Inward references the same PO.)`
      );
    }

    // Execute cascade delete
    try {
      await axios.delete(`${API_URL}/bill-entries/delete-chain/${VoucherNo}`, { data: { layers } });
      showToast(`Duplicate bill entry #${VoucherNo} and selected linked records removed.`, 'success');
      return true;
    } catch (deleteErr) {
      console.error('Error deleting duplicate chain:', deleteErr);
      showToast(deleteErr.response?.data?.message || 'Failed to delete duplicate records.', 'error');
      return false;
    }
  }, [showToast]);

  const handleSave = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!formData.PartyName) {
      showToast('Please select Party Name', 'error');
      return;
    }
    if (!formData.GRNNo) {
      showToast('Please select a GRN No / PO Reference', 'error');
      return;
    }

    const cleanNum = (val, defaultVal = 0) => {
      if (val === '' || val === null || val === undefined || isNaN(val)) return defaultVal;
      return parseFloat(val);
    };

    const payload = {
      ...formData,
      BillAmount: financialCalculations.billAmount,
      TDS: cleanNum(formData.TDS),
      Total: financialCalculations.total,
      Discount: cleanNum(formData.Discount),
      GST: cleanNum(formData.GST),
      IGST: cleanNum(formData.IGST),
      VAT_CST: cleanNum(formData.VAT_CST),
      P_F: cleanNum(formData.P_F),
      LorryFreight: cleanNum(formData.LorryFreight),
      RoundOff: financialCalculations.roundOff,
      TaxRndOff: cleanNum(formData.TaxRndOff),
      GrandTotal: financialCalculations.grandTotal,
      items: items.map(item => {
        const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
        const rate = parseFloat(item.UnitRate) || 0;
        return {
          ItemName: item.ItemName,
          OrderNo: item.OrderNo || null,
          Qty: qty,
          ReceivedQty: qty,
          UnitRate: rate,
          TotalAmount: qty * rate
        };
      })
    };

    try {
      setLoading(true);
      if (editingVoucherNo) {
        await axios.put(`${API_URL}/bill-entries/${editingVoucherNo}`, payload);
        showToast('Bill entry updated successfully!', 'success');
        handleCloseEditDrawer();
        fetchBillEntries();
      } else {
        try {
          await axios.post(`${API_URL}/bill-entries`, payload);
          showToast('Bill entry created successfully!', 'success');
          handleCloseEditDrawer();
          fetchBillEntries();
        } catch (createErr) {
          if (createErr.response?.status === 409 && createErr.response?.data?.duplicate) {
            // Duplicate detected — run layered confirmation flow
            setLoading(false);
            const cleaned = await handleDuplicateBillCleanup(createErr.response.data.duplicate, payload);
            if (cleaned) {
              // Re-attempt save after cleanup
              setLoading(true);
              await axios.post(`${API_URL}/bill-entries`, payload);
              showToast('Bill entry created successfully!', 'success');
              handleCloseEditDrawer();
              fetchBillEntries();
            }
            return;
          }
          throw createErr;
        }
      }
    } catch (error) {
      console.error('Error saving bill entry:', error);
      const serverErr = error.response?.data?.error;
      const serverMsg = error.response?.data?.message;
      const msg = serverErr ? `${serverMsg || 'Error'}: ${serverErr}` : (serverMsg || error.message || 'Error saving bill entry. Please check all fields and try again.');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, financialCalculations, items, editingVoucherNo, showToast, handleCloseEditDrawer, fetchBillEntries, handleDuplicateBillCleanup]);

  const generatePurchaseVoucherPDF = useCallback((bill) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Helper functions
    const fmt = (num) => {
      const n = parseFloat(num) || 0;
      return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const drawLine = (yPos, x1 = margin, x2 = pageWidth - margin) => {
      doc.setLineWidth(0.2);
      doc.line(x1, yPos, x2, yPos);
    };

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Purchase Voucher', pageWidth / 2, y, { align: 'center' });
    const titleWidth = doc.getTextWidth('Purchase Voucher');
    doc.setLineWidth(0.3);
    doc.line((pageWidth - titleWidth) / 2, y + 1, (pageWidth + titleWidth) / 2, y + 1);
    y += 10;

    // Vou.No. and Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Vou.No.   ${bill.VoucherNo}`, margin, y);
    const accDate = bill.AccDate ? new Date(bill.AccDate) : new Date();
    const dateStr = `${String(accDate.getDate()).padStart(2, '0')}-${String(accDate.getMonth() + 1).padStart(2, '0')}-${String(accDate.getFullYear()).slice(-2)}`;
    doc.text(`Date :   ${dateStr}`, pageWidth - margin - 50, y);
    y += 3;
    drawLine(y);
    y += 5;

    // Table header
    const col1X = margin;
    const col2X = margin + contentWidth * 0.6;
    const col3X = margin + contentWidth * 0.8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Description / Account Head', col1X + 12, y);
    doc.text('Debit', col2X + 15, y, { align: 'right' });
    doc.text('Credit', col3X + 30, y, { align: 'right' });
    y += 2;
    drawLine(y);
    y += 6;

    // Debit entries
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let totalDebit = 0;
    let totalCredit = 0;

    const totalAmount = parseFloat(bill.Total) || 0;
    const discountAmt = parseFloat(bill.Discount) || 0;
    const pfAmt = parseFloat(bill.P_F) || 0;
    const lorryAmt = parseFloat(bill.LorryFreight) || 0;
    const vatCstAmt = parseFloat(bill.VAT_CST) || 0;
    const gstAmount = parseFloat(bill.GST) || 0;
    const igstAmount = parseFloat(bill.IGST) || 0;
    const baseForGst = totalAmount - discountAmt + pfAmt + lorryAmt;

    // GST entries (Iterate over grouped tax breakdown if available)
    if (bill.taxBreakdown && bill.taxBreakdown.length > 0) {
      bill.taxBreakdown.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (amt > 0) {
          doc.text(t.label, col1X + 12, y);
          doc.text(fmt(amt), col2X + 15, y, { align: 'right' });
          totalDebit += amt;
          y += 5;
        }
      });
    } else {
      if (gstAmount > 0) {
        const sgstAmt = bill.SGSTAmount || parseFloat((gstAmount / 2).toFixed(2));
        const cgstAmt = bill.CGSTAmount || parseFloat((gstAmount / 2).toFixed(2));
        let sgstPct = parseFloat(bill.SGSTPct) || 0;
        let cgstPct = parseFloat(bill.CGSTPct) || 0;

        if (!sgstPct && baseForGst > 0) {
          sgstPct = parseFloat(((sgstAmt / baseForGst) * 100).toFixed(2));
        }
        if (!cgstPct && baseForGst > 0) {
          cgstPct = parseFloat(((cgstAmt / baseForGst) * 100).toFixed(2));
        }

        const sgstStr = sgstPct > 0 ? ` ${sgstPct % 1 === 0 ? sgstPct.toFixed(0) : sgstPct.toFixed(2)}%` : '';
        const cgstStr = cgstPct > 0 ? ` ${cgstPct % 1 === 0 ? cgstPct.toFixed(0) : cgstPct.toFixed(2)}%` : '';

        const sgstLabel = `INPUT SGST${sgstStr}`;
        const cgstLabel = `INPUT CGST${cgstStr}`;

        doc.text(sgstLabel, col1X + 12, y);
        doc.text(fmt(sgstAmt), col2X + 15, y, { align: 'right' });
        totalDebit += sgstAmt;
        y += 5;

        doc.text(cgstLabel, col1X + 12, y);
        doc.text(fmt(cgstAmt), col2X + 15, y, { align: 'right' });
        totalDebit += cgstAmt;
        y += 5;
      }

      // IGST entry
      if (igstAmount > 0) {
        let igstPct = parseFloat(bill.IGSTPct) || 0;
        if (!igstPct && baseForGst > 0) {
          igstPct = parseFloat(((igstAmount / baseForGst) * 100).toFixed(2));
        }
        const igstStr = igstPct > 0 ? ` ${igstPct % 1 === 0 ? igstPct.toFixed(0) : igstPct.toFixed(2)}%` : '';
        const igstLabel = `INPUT IGST${igstStr}`;
        doc.text(igstLabel, col1X + 12, y);
        doc.text(fmt(igstAmount), col2X + 15, y, { align: 'right' });
        totalDebit += igstAmount;
        y += 5;
      }
    }

    // Purchase amount (Debit)
    const purchaseLabel = bill.PurchaseAccountName || bill.PurchaseType || 'PURCHASE OF MATERIALS';
    doc.text(purchaseLabel, col1X + 12, y);
    doc.text(fmt(totalAmount), col2X + 15, y, { align: 'right' });
    totalDebit += totalAmount;
    y += 5;

    // Discount (Credit)
    if (discountAmt > 0) {
      totalCredit += discountAmt;
    }

    // VAT/CST
    if (vatCstAmt > 0) {
      doc.text('VAT / CST', col1X + 12, y);
      doc.text(fmt(vatCstAmt), col2X + 15, y, { align: 'right' });
      totalDebit += vatCstAmt;
      y += 5;
    }

    // P&F
    if (pfAmt > 0) {
      doc.text('PACKING & FORWARDING', col1X + 12, y);
      doc.text(fmt(pfAmt), col2X + 15, y, { align: 'right' });
      totalDebit += pfAmt;
      y += 5;
    }

    // Lorry Freight
    if (lorryAmt > 0) {
      doc.text('LORRY FREIGHT', col1X + 12, y);
      doc.text(fmt(lorryAmt), col2X + 15, y, { align: 'right' });
      totalDebit += lorryAmt;
      y += 5;
    }

    // Party payable amount
    const partyPayable = bill.GrandTotal !== undefined && bill.GrandTotal !== null
      ? parseFloat(bill.GrandTotal)
      : Math.round(totalAmount - discountAmt + gstAmount + igstAmount + vatCstAmt + pfAmt + lorryAmt);

    // Exact Round Off needed to balance Debit and Credit to 0.00 mismatch
    const targetCredit = parseFloat((totalCredit + partyPayable).toFixed(2));
    const currentDebit = parseFloat(totalDebit.toFixed(2));
    const roundOff = parseFloat((targetCredit - currentDebit).toFixed(2));

    // Skip round off line if the bill was saved with "No Round Off" active
    const billHasNoRoundOff = bill.RoundOff !== undefined && bill.RoundOff !== null && Math.abs(parseFloat(bill.RoundOff) || 0) < 0.0001;

    if (Math.abs(roundOff) > 0.0001 && !billHasNoRoundOff) {
      doc.text('To', col1X, y);
      doc.text('ROUND OFF', col1X + 12, y);
      if (roundOff > 0) {
        doc.text(fmt(roundOff), col3X + 30, y, { align: 'right' });
      } else {
        doc.text(fmt(Math.abs(roundOff)), col3X + 30, y, { align: 'right' });
        totalCredit += Math.abs(roundOff);
      }
      y += 5;
    }

    // Party Name (Credit entry)
    doc.text('To', col1X, y);
    doc.text(bill.PartyName || '', col1X + 12, y);
    doc.text(fmt(partyPayable), col3X + 30, y, { align: 'right' });
    totalCredit = partyPayable;
    y += 3;
    drawLine(y);
    y += 5;

    // Totals row (always strictly balanced with rounded debit)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const roundedDebit = Math.round(totalDebit);
    doc.text(fmt(roundedDebit), col2X + 15, y, { align: 'right' });
    doc.text(fmt(totalCredit), col3X + 30, y, { align: 'right' });
    y += 3;
    drawLine(y);
    y += 6;

    // Narration
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const narration = bill.Narration || '';
    if (narration) {
      const lines = doc.splitTextToSize(narration, contentWidth - 10);
      doc.text(lines, col1X, y);
      y += lines.length * 4.5;
    }
    y += 8;

    // Signature line
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Prepared', margin + 10, y);
    doc.text('Verified', pageWidth / 2, y, { align: 'center' });
    doc.text('Authorised Signatory', pageWidth - margin - 10, y, { align: 'right' });
    y += 12;

    // Payment Particulars section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Payment Particulars', pageWidth / 2, y, { align: 'center' });
    const ppTitleWidth = doc.getTextWidth('Payment Particulars');
    doc.setLineWidth(0.3);
    doc.line((pageWidth - ppTitleWidth) / 2, y + 1, (pageWidth + ppTitleWidth) / 2, y + 1);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Payment Vou.No. dt.____/____/______Cash/Cheque / UTR No.________________________', margin, y);
    y += 5;
    doc.text('                       dt.____ / ____ / ______Rs.___________', margin, y);
    y += 8;

    doc.text('A/c.Head :', margin, y);
    doc.text('Receiver Signature', pageWidth - margin - 10, y, { align: 'right' });

    // Save
    doc.save(`Purchase_Voucher_${bill.VoucherNo}.pdf`);
    showToast('PDF generated successfully!', 'success');
  }, [showToast]);

  const handlePrint = useCallback(async (voucherNo) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/bill-entries/print-data/${voucherNo}`);
      if (!response.data?.success) {
        showToast('Error fetching print data', 'error');
        return;
      }
      const bill = response.data.data;
      generatePurchaseVoucherPDF(bill);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Error generating PDF', 'error');
    } finally {
      setLoading(false);
    }
  }, [generatePurchaseVoucherPDF, showToast]);

  const toggleExpandRow = useCallback((voucherNo) => {
    setExpandedVoucherNo(prev => prev === voucherNo ? null : voucherNo);
  }, []);

  // Filter configuration memoized
  const filterConfigs = useMemo(() => [
    {
      label: "Party Name",
      icon: FileText,
      value: partyFilter,
      onChange: (val) => {
        setPartyFilter(val);
        setCurrentPage(1);
      },
      options: [
        { value: 'ALL', label: 'All Parties' },
        ...uniqueBillParties.map(p => ({ value: p, label: p }))
      ],
      searchable: true
    },
    {
      label: "Sort By",
      icon: ArrowUpDown,
      value: sortBy,
      onChange: (val) => setSortBy(val),
      options: [
        { value: 'newest', label: 'Date: Newest First' },
        { value: 'oldest', label: 'Date: Oldest First' },
        { value: 'voucher_desc', label: 'Voucher No: High to Low' },
        { value: 'voucher_asc', label: 'Voucher No: Low to High' },
        { value: 'total_desc', label: 'Grand Total: High to Low' }
      ]
    },
    {
      label: "Page Size",
      value: itemsPerPage,
      onChange: (val) => {
        setItemsPerPage(Number(val));
        setCurrentPage(1);
      },
      options: [
        { value: 5, label: '5 per page' },
        { value: 10, label: '10 per page' },
        { value: 25, label: '25 per page' },
        { value: 50, label: '50 per page' }
      ]
    }
  ], [partyFilter, uniqueBillParties, sortBy, itemsPerPage]);

  return (
    <Layout>
      <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <PageHeader
          title="Bill Entry (Purchase Invoice)"
          subtitle="To Add, Modify supplier purchase bill entries"
          icon={FileText}
          actionText="Add New Bill Entry"
          onActionClick={handleOpenAddDrawer}
        />

        {/* Search & Filters Card (Matching Receipt Style) */}
        <FilterPanel
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by voucher no, GRN no, gate inward no, party name, bill no..."
          filters={filterConfigs}
        />

        {/* Main Data Table (Matching Receipt Table Layout & Expandable Rows) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">All Bill Entries</h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
              Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-3 w-12 text-center"></th>
                  <th className="py-4 px-4 whitespace-nowrap">Voucher No</th>
                  <th className="py-4 px-4">Party Name</th>
                  <th className="py-4 px-4 whitespace-nowrap">GRN Reference</th>
                  <th className="py-4 px-4 whitespace-nowrap">Party Bill No</th>
                  <th className="py-4 px-4 whitespace-nowrap">Bill Date</th>
                  <th className="py-4 px-4 whitespace-nowrap">Accounting Date</th>
                  <th className="py-4 px-4 whitespace-nowrap">Purchase Type</th>
                  <th className="py-4 px-4 text-right whitespace-nowrap">Amount (₹)</th>
                  <th className="py-4 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedBills.map((bill) => (
                  <BillRow
                    key={bill.VoucherNo}
                    bill={bill}
                    isExpanded={expandedVoucherNo === bill.VoucherNo}
                    onToggleExpand={toggleExpandRow}
                    onPrint={handlePrint}
                    onEdit={handleOpenEditDrawer}
                    onDelete={handleDelete}
                  />
                ))}

                {paginatedBills.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-600 mb-2">No Bill Entries found</h3>
                      <p className="text-slate-500">Try adjusting your search query or add a new bill entry</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar (Matching Receipt Table Style) */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Centered Modal Window for Add New & Edit Bill Entry */}
        {editDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center">
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-300 ${isDrawerVisible ? 'opacity-100' : 'opacity-0'
                }`}
              onClick={handleCloseEditDrawer}
            />

            {/* Centered Modal Container */}
            <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 sm:p-6 pointer-events-none">
              <div
                className={`relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden border-0 pointer-events-auto transform transition-all duration-300 ease-out ${isDrawerVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                  }`}
              >
                {/* Modal Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {isNewEntry ? 'Add New Bill Entry' : 'Edit Bill Entry'}
                      </h2>
                      <p className="text-sm text-blue-100 mt-0.5">
                        Voucher No: VCH-{String(formData.VoucherNo || '').padStart(3, '0')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEditDrawer}
                    className="p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Modal Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <form id="bill-entry-form" onSubmit={handleSave} className="space-y-6">
                    <div>
                      {!isNewEntry ? (
                        <div>
                          <label className="block text-base font-semibold text-slate-700 mb-2">Party Name</label>
                          <input
                            type="text"
                            value={formData.PartyName}
                            disabled
                            className="w-full px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-semibold text-base cursor-not-allowed"
                          />
                        </div>
                      ) : (
                        <SearchSelect
                          label="Party Name *"
                          required
                          options={parties.map(p => ({ value: p.name, label: p.name }))}
                          value={formData.PartyName}
                          onChange={(val) => setFormData(prev => ({ ...prev, PartyName: val, GateInwardNo: '', GRNNo: '' }))}
                          placeholder="Search supplier or party..."
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-base font-semibold text-slate-700 mb-2">GRN No / PO Reference *</label>
                      {!isNewEntry ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-semibold text-slate-500 block mb-1">GRN Number</span>
                            <input
                              type="text"
                              value={formData.GRNNo ? `GRN-${String(formData.GRNNo).padStart(3, '0')}` : '—'}
                              disabled
                              className="w-full px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 font-semibold text-base cursor-not-allowed"
                            />
                          </div>
                          {formData.GateInwardNo && (
                            <div>
                              <span className="text-sm font-semibold text-slate-500 block mb-1">Gate Inward</span>
                              <input
                                type="text"
                                value={`GI-${String(formData.GateInwardNo).padStart(3, '0')}`}
                                disabled
                                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-600 text-base cursor-not-allowed"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <SearchSelect
                            selectOnly
                            options={grnsList.map(r => ({
                              value: r.GRNNo,
                              label: `GRN-${r.GRNNo}${r.OrderNoDisplay ? ` (${r.OrderNoDisplay})` : ''}`,
                              sub: `Date: ${r.InwardDate || '—'} | Total: ₹${parseFloat(r.GrandTotal || r.BillAmount || 0).toLocaleString('en-IN')}${r.InvoiceNo ? ` | Inv: ${r.InvoiceNo}` : ''}${r.GateInwardDisplay ? ` | ${r.GateInwardDisplay}` : ''}`
                            }))}
                            value={formData.GRNNo}
                            onChange={(val) => {
                              const selected = grnsList.find(g => String(g.GRNNo) === String(val));
                              setFormData(prev => ({
                                ...prev,
                                GRNNo: val,
                                GateInwardNo: selected ? selected.GateInwardNo : prev.GateInwardNo
                              }));
                            }}
                            placeholder={formData.PartyName ? (grnsList.length > 0 ? "Select GRN No / PO..." : "No unbilled GRNs available for this party") : "Select Party Name first..."}
                            disabled={!formData.PartyName}
                          />
                        </div>
                      )}

                      {/* Display All Linked Gate Inwards in Modal */}
                      {linkedGateInwards && linkedGateInwards.length > 0 ? (
                        <div className="mt-3 text-sm text-slate-600 bg-blue-50/80 border border-blue-100 rounded-xl px-4 py-2.5 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-blue-700">Linked Gate Inwards ({linkedGateInwards.length}):</span>
                            <span className="font-bold text-slate-800">
                              {linkedGateInwards.map(gi => `GI-${String(gi.InwardNo).padStart(3, '0')}`).join(', ')}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-xs text-slate-600">
                            {linkedGateInwards.map(gi => (
                              <span key={gi.InwardNo} className="bg-white border border-blue-200 px-2.5 py-1 rounded-lg shadow-2xs">
                                GI-{String(gi.InwardNo).padStart(3, '0')} {gi.InwardDate ? `(${new Date(gi.InwardDate).toLocaleDateString('en-GB')})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        formData.GateInwardNo && (
                          <div className="mt-2.5 text-sm text-slate-600 flex items-center gap-2 bg-blue-50/80 border border-blue-100 rounded-xl px-4 py-2">
                            <span className="font-semibold text-blue-700">Auto-Linked Gate Inward:</span>
                            <span className="font-bold">GI-{String(formData.GateInwardNo).padStart(3, '0')}</span>
                          </div>
                        )
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-base font-semibold text-slate-700 mb-2">Party Bill No</label>
                        <input
                          type="text"
                          value={formData.PartyBillNo}
                          onChange={(e) => setFormData(prev => ({ ...prev, PartyBillNo: e.target.value }))}
                          placeholder="Enter Party Bill No (optional)"
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-base font-semibold text-slate-700 mb-2">Accounting Date</label>
                        <input
                          type="date"
                          value={formData.AccDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, AccDate: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-base font-semibold text-slate-700 mb-2">Bill Date</label>
                        <input
                          type="date"
                          value={formData.BillDate}
                          onChange={(e) => setFormData(prev => ({ ...prev, BillDate: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-medium"
                        />
                      </div>

                      <div>
                        <CustomSelect
                          label="Purchase Type"
                          value={formData.PurchaseType}
                          onChange={(val) => setFormData(prev => ({ ...prev, PurchaseType: val }))}
                          options={[
                            { value: '', label: 'Select Purchase Type' },
                            ...purchaseTypes.map(pt => ({ value: pt.PurchaseType || pt.typename || pt.type, label: pt.PurchaseType || pt.typename || pt.type }))
                          ]}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-base font-semibold text-slate-700 mb-2">Narration</label>
                      <textarea
                        value={formData.Narration}
                        onChange={(e) => setFormData(prev => ({ ...prev, Narration: e.target.value }))}
                        placeholder="Enter any accounting narration or remarks..."
                        rows={3}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-base font-medium"
                      />
                    </div>

                    {/* Billed Items List Table */}
                    {items.length > 0 && (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden mt-4 shadow-sm">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <h4 className="text-base font-bold text-slate-800">Billed Items ({items.length})</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase text-xs tracking-wider">
                                <th className="py-3 px-4">Item Name</th>
                                <th className="py-3 px-4 text-right">Qty</th>
                                <th className="py-3 px-4 text-right">Unit Rate</th>
                                <th className="py-3 px-4 text-right">Total Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {items.map((item, idx) => {
                                const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
                                const rate = parseFloat(item.UnitRate) || 0;
                                const total = qty * rate;
                                return (
                                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-4 font-semibold text-slate-800 text-base">
                                      {item.ItemName}
                                      {item.OrderNo && <span className="text-xs text-slate-400 ml-2">(PO-{item.OrderNo})</span>}
                                    </td>
                                    <td className="py-3 px-4 text-right text-slate-700 font-medium text-base">{qty}</td>
                                    <td className="py-3 px-4 text-right text-slate-700 font-medium text-base">₹{rate.toFixed(2)}</td>
                                    <td className="py-3 px-4 text-right font-bold text-slate-900 text-base">₹{total.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Financial Summary & Breakdown Form Card */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                      <h4 className="text-base font-bold text-slate-800 mb-2">Financial Breakdown</h4>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Subtotal (Total)</label>
                          <input
                            type="number"
                            value={financialCalculations.total || 0}
                            disabled
                            className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 text-base font-bold cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Discount (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.Discount || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData(prev => ({ ...prev, Discount: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">GST (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.GST || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData(prev => ({ ...prev, GST: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">IGST (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.IGST || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData(prev => ({ ...prev, IGST: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">VAT / CST (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.VAT_CST || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData(prev => ({ ...prev, VAT_CST: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">P & F (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.P_F || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData(prev => ({ ...prev, P_F: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Lorry Freight (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.LorryFreight || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData(prev => ({ ...prev, LorryFreight: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-semibold text-slate-600">Round Off</label>
                            <label className="flex items-center gap-1 cursor-pointer text-xs text-slate-500">
                              <input
                                type="checkbox"
                                checked={noRoundOff}
                                onChange={(e) => setNoRoundOff(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                              />
                              No Round
                            </label>
                          </div>
                          <input
                            type="text"
                            value={formatRoundOff(financialCalculations.roundOff)}
                            disabled
                            className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-slate-700 text-base font-bold cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-base font-bold text-slate-700">Grand Total (Bill Amount)</span>
                        <span className="text-2xl font-extrabold text-emerald-600">
                          ₹{(financialCalculations.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleCloseEditDrawer}
                    className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors font-semibold text-base cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="bill-entry-form"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 font-semibold text-base cursor-pointer disabled:opacity-50"
                  >
                    <Save size={18} />
                    {loading ? 'Saving...' : (isNewEntry ? 'Save Bill Entry' : 'Update Bill Entry')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
