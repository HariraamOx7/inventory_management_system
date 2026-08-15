// frontend/src/pages/Receipt.jsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Receipt as ReceiptIcon, ArrowUpDown, FileText,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox
} from 'lucide-react';
import Layout from '../components/Layout';
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
  GRNNo: '',
  OrderNo: '',
  GateInwardNo: '',
  PartyName: '',
  InwardDate: new Date().toISOString().split('T')[0],
  InvoiceNo: '',
  InvoiceDate: new Date().toISOString().split('T')[0],
  DCNo: '',
  DCDate: new Date().toISOString().split('T')[0],
  FormType: '',
  BillAmount: 0,
  Total: 0,
  Discount: '',
  GST: '',
  IGST: '',
  VAT_CST: '',
  P_F: '',
  LorryFreight: '',
  RoundOff: 0,
  GrandTotal: 0
};

export default function Receipt() {
  const showToast = useToastStore(state => state.showToast);

  const [formData, setFormData] = useState(initialFormState);
  const [parties, setParties] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [linkedGateInwards, setLinkedGateInwards] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [editingGRNNo, setEditingGRNNo] = useState(null);

  // Slide-over Drawer states (Matching Item Master style)
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

  // Fetch initial data
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [grnRes, partiesRes, receiptsRes] = await Promise.all([
        axios.get(`${API_URL}/receipts/last-grn-no`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/receipts/parties`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/receipts`).catch(() => ({ data: { success: false } }))
      ]);

      if (grnRes.data?.success) {
        setFormData(prev => ({
          ...prev,
          GRNNo: (grnRes.data.data.lastGRNNo + 1).toString()
        }));
      }

      if (partiesRes.data?.success) {
        setParties(partiesRes.data.data || []);
      }

      if (receiptsRes.data?.success) {
        setReceipts(receiptsRes.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Memoized options for fast, stable rendering
  const partyOptions = useMemo(() => {
    return parties.map(p => ({ value: p.name, label: p.name }));
  }, [parties]);

  const purchaseOrderOptions = useMemo(() => {
    return purchaseOrders.map(po => ({
      value: po.OrderNo,
      label: `PO-${po.OrderNo} (${po.OrderDate ? new Date(po.OrderDate).toLocaleDateString('en-GB') : ''}) - ₹${parseFloat(po.GrandTotal || 0).toLocaleString('en-IN')}`,
      name: `PO-${po.OrderNo}`
    }));
  }, [purchaseOrders]);

  // Handle Party Selection (directly fetches POs without intermediate clearing flash)
  const handlePartyChange = async (val) => {
    setFormData(prev => ({
      ...prev,
      PartyName: val,
      OrderNo: '',
      GateInwardNo: '',
      InvoiceNo: '',
      InvoiceDate: ''
    }));
    setLinkedGateInwards([]);
    setItems([]);

    if (!val) {
      setPurchaseOrders([]);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/receipts/available-purchase-orders`, {
        params: { partyName: val }
      });
      if (res.data?.success) {
        const pos = res.data.data || [];
        setPurchaseOrders(pos);
      }
    } catch (err) {
      console.error('Error fetching available POs for receipt:', err);
    }
  };

  // Handle PO Selection (fetches details and all linked gate inwards)
  const handleOrderChange = async (orderNo) => {
    setFormData(prev => ({ ...prev, OrderNo: orderNo }));

    if (!orderNo) {
      setLinkedGateInwards([]);
      setItems([]);
      return;
    }

    try {
      const res = await axios.get(`${API_URL}/receipts/purchase-order-details`, {
        params: { orderNo }
      });

      if (res.data?.success) {
        const data = res.data.data;
        const poTotals = data.POTotals || { Discount: 0, GST: 0, IGST: 0, VAT_CST: 0, P_F: 0, LorryFreight: 0, RoundOff: 0 };
        const isZeroRound = poTotals.RoundOff !== undefined && poTotals.RoundOff !== null && Math.abs(parseFloat(poTotals.RoundOff) || 0) < 0.0001;
        setNoRoundOff(isZeroRound);

        setLinkedGateInwards(data.gateInwards || []);
        setItems(data.details || []);

        setFormData(prev => ({
          ...prev,
          OrderNo: orderNo,
          GateInwardNo: data.GateInwardNo || prev.GateInwardNo,
          InwardDate: data.InwardDate ? new Date(data.InwardDate).toISOString().split('T')[0] : prev.InwardDate,
          InvoiceNo: data.InvoiceNo || prev.InvoiceNo,
          InvoiceDate: data.InvoiceDate ? new Date(data.InvoiceDate).toISOString().split('T')[0] : prev.InvoiceDate,
          Discount: parseFloat(poTotals.Discount) > 0 ? parseFloat(poTotals.Discount) : '',
          GST: parseFloat(poTotals.GST) > 0 ? parseFloat(poTotals.GST) : '',
          IGST: parseFloat(poTotals.IGST) > 0 ? parseFloat(poTotals.IGST) : '',
          VAT_CST: parseFloat(poTotals.VAT_CST) > 0 ? parseFloat(poTotals.VAT_CST) : '',
          P_F: parseFloat(poTotals.P_F) > 0 ? parseFloat(poTotals.P_F) : '',
          LorryFreight: parseFloat(poTotals.LorryFreight) > 0 ? parseFloat(poTotals.LorryFreight) : ''
        }));
      }
    } catch (err) {
      console.error('Error fetching PO receipt details:', err);
    }
  };

  // Recalculate item totals
  useEffect(() => {
    const total = items.reduce((sum, item) => {
      const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
      const rate = parseFloat(item.UnitRate) || 0;
      return sum + (qty * rate);
    }, 0);

    setFormData(prev => {
      if (prev.Total === total) return prev;
      return {
        ...prev,
        Total: total
      };
    });
  }, [items]);

  // Recalculate RoundOff & GrandTotal
  useEffect(() => {
    const total = parseFloat(formData.Total) || 0;
    const discount = parseFloat(formData.Discount) || 0;
    const gst = parseFloat(formData.GST) || 0;
    const igst = parseFloat(formData.IGST) || 0;
    const vatCst = parseFloat(formData.VAT_CST) || 0;
    const pf = parseFloat(formData.P_F) || 0;
    const lorryFreight = parseFloat(formData.LorryFreight) || 0;
    const unroundedGrandTotal = total - discount + gst + igst + vatCst + pf + lorryFreight;
    const computedGrandTotal = Math.round(unroundedGrandTotal);
    const computedRoundOff = noRoundOff ? 0 : parseFloat((computedGrandTotal - unroundedGrandTotal).toFixed(2));

    setFormData(prev => {
      const prevGrand = parseFloat(prev.GrandTotal) || 0;
      const prevRound = parseFloat(prev.RoundOff) || 0;
      if (prevGrand === computedGrandTotal && prevRound === computedRoundOff && prev.BillAmount === computedGrandTotal) return prev;
      return { ...prev, GrandTotal: computedGrandTotal, RoundOff: computedRoundOff, BillAmount: computedGrandTotal };
    });
  }, [
    formData.Total,
    formData.Discount,
    formData.GST,
    formData.IGST,
    formData.VAT_CST,
    formData.P_F,
    formData.LorryFreight,
    noRoundOff
  ]);

  // Unique parties list
  const uniqueParties = useMemo(() => {
    const setP = new Set();
    receipts.forEach(r => { if (r.PartyName) setP.add(r.PartyName.trim()); });
    return Array.from(setP).sort();
  }, [receipts]);

  // Filtered and sorted receipts
  const filteredAndSortedReceipts = useMemo(() => {
    return receipts
      .filter(r => {
        const matchSearch = search.trim() === '' ||
          String(r.GRNNo).toLowerCase().includes(search.toLowerCase()) ||
          String(r.GateInwardNo).toLowerCase().includes(search.toLowerCase()) ||
          (r.PartyName && r.PartyName.toLowerCase().includes(search.toLowerCase())) ||
          (r.InvoiceNo && r.InvoiceNo.toLowerCase().includes(search.toLowerCase()));
        const matchParty = partyFilter === 'ALL' || r.PartyName === partyFilter;
        return matchSearch && matchParty;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.InwardDate || b.createdAt) - new Date(a.InwardDate || a.createdAt);
        }
        if (sortBy === 'oldest') {
          return new Date(a.InwardDate || a.createdAt) - new Date(b.InwardDate || b.createdAt);
        }
        if (sortBy === 'grn_desc') {
          return Number(b.GRNNo) - Number(a.GRNNo);
        }
        if (sortBy === 'grn_asc') {
          return Number(a.GRNNo) - Number(b.GRNNo);
        }
        if (sortBy === 'total_desc') {
          return (b.GrandTotal || 0) - (a.GrandTotal || 0);
        }
        return 0;
      });
  }, [receipts, search, partyFilter, sortBy]);

  // Pagination calculations
  const totalItems = filteredAndSortedReceipts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedReceipts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedReceipts.slice(start, start + itemsPerPage);
  }, [filteredAndSortedReceipts, currentPage, itemsPerPage]);

  const handleOpenAddDrawer = () => {
    setIsNewEntry(true);
    setEditingGRNNo(null);
    setFormData(initialFormState);
    setItems([]);
    setNoRoundOff(false);
    fetchInitialData();
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleOpenEditDrawer = (receipt) => {
    setIsNewEntry(false);
    setNoRoundOff(receipt.RoundOff !== undefined && receipt.RoundOff !== null && Math.abs(parseFloat(receipt.RoundOff) || 0) < 0.0001);
    const orderNo = (receipt.details && receipt.details[0]?.OrderNo) || receipt.OrderNo || '';
    setFormData({
      GRNNo: receipt.GRNNo.toString(),
      OrderNo: orderNo,
      GateInwardNo: receipt.GateInwardNo,
      PartyName: receipt.PartyName,
      InwardDate: receipt.InwardDate ? new Date(receipt.InwardDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      InvoiceNo: receipt.InvoiceNo || '',
      InvoiceDate: receipt.InvoiceDate ? new Date(receipt.InvoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      FormType: receipt.FormType || '',
      BillAmount: receipt.BillAmount || 0,
      Total: receipt.Total || 0,
      Discount: receipt.Discount || 0,
      GST: receipt.GST || 0,
      IGST: receipt.IGST || 0,
      VAT_CST: receipt.VAT_CST || 0,
      P_F: receipt.P_F || 0,
      LorryFreight: receipt.LorryFreight || 0,
      RoundOff: receipt.RoundOff || 0,
      GrandTotal: receipt.GrandTotal || 0
    });

    if (receipt.details) {
      setItems(receipt.details.map(detail => {
        const qtyVal = detail.ReceivedQty !== undefined ? detail.ReceivedQty : (detail.Qty !== undefined ? detail.Qty : 0);
        return {
          ItemName: detail.ItemName,
          PendingQty: detail.PendingQty || 0,
          ReceivedQty: qtyVal,
          Qty: qtyVal,
          UnitRate: detail.UnitRate || 0,
          OrderNo: detail.OrderNo || orderNo
        };
      }));
    }

    if (receipt.GateInwardNo) {
      setLinkedGateInwards([{
        InwardNo: receipt.GateInwardNo,
        OrderNo: orderNo,
        InwardDate: receipt.InwardDate,
        InvoiceNo: receipt.InvoiceNo,
        InvoiceDate: receipt.InvoiceDate,
        details: receipt.details || []
      }]);
    }

    setEditingGRNNo(receipt.GRNNo);
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleCloseEditDrawer = () => {
    setIsDrawerVisible(false);
    setTimeout(() => {
      setEditDrawerOpen(false);
      setEditingGRNNo(null);
      setFormData(initialFormState);
      setPurchaseOrders([]);
      setLinkedGateInwards([]);
      setItems([]);
    }, 300);
  };

  const handleDelete = async (grnNo) => {
    if (!window.confirm(`Are you sure you want to delete Receipt GRN #${grnNo}?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/receipts/${grnNo}`);
      showToast('Receipt deleted successfully!', 'success');
      fetchInitialData();
    } catch (error) {
      console.error('Error deleting receipt:', error);
      showToast(error.response?.data?.message || 'Error deleting receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.PartyName) {
      showToast('Please select a Party Name', 'error');
      return;
    }

    if (!formData.OrderNo && !formData.GateInwardNo) {
      showToast('Please select a Purchase Order', 'error');
      return;
    }

    if (!items || items.length === 0) {
      showToast('No items available for this receipt', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        items: items.map(item => {
          const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
          const rate = parseFloat(item.UnitRate) || 0;
          return {
            ItemName: item.ItemName,
            OrderNo: item.OrderNo || formData.OrderNo || null,
            Qty: qty,
            ReceivedQty: qty,
            UnitRate: rate,
            TotalAmount: qty * rate
          };
        })
      };

      if (editingGRNNo) {
        await axios.put(`${API_URL}/receipts/${editingGRNNo}`, payload);
        showToast('Receipt updated successfully!', 'success');
      } else {
        await axios.post(`${API_URL}/receipts`, payload);
        showToast('Receipt created successfully!', 'success');
      }

      handleCloseEditDrawer();
      fetchInitialData();
    } catch (error) {
      console.error('Error saving receipt:', error);
      showToast(error.response?.data?.message || 'Error saving receipt', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <PageHeader
          title="Receipt (GRN)"
          subtitle="To Add, Modify Goods Receipt Notes"
          icon={ReceiptIcon}
          actionText="Add New Receipt"
          onActionClick={handleOpenAddDrawer}
        />

        {/* Search & Filters Card (Item Master Style) */}
        <FilterPanel
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by GRN no, inward no, party name..."
          filters={[
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
                ...uniqueParties.map(p => ({ value: p, label: p }))
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
                { value: 'grn_desc', label: 'GRN No: High to Low' },
                { value: 'grn_asc', label: 'GRN No: Low to High' },
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
          ]}
        />

        {/* Receipts List Card (Item Master Row Cards Layout & Colors) */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">All Receipts (GRN)</h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
              Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedReceipts.map((receipt) => (
              <div
                key={receipt.GRNNo}
                className="p-6 hover:bg-slate-50 transition-colors duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-800 text-lg">
                          {receipt.PartyName}
                        </h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          GRN-{String(receipt.GRNNo).padStart(3, '0')}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3 pt-3 border-t border-slate-100">
                        <div>
                          <span className="text-slate-500 text-xs block">PO & Inward</span>
                          <span className="text-slate-700 font-medium">
                            {receipt.details?.[0]?.OrderNo ? `PO-${receipt.details[0].OrderNo}` : ''}
                            {receipt.GateInwardNo ? ` (GI-${String(receipt.GateInwardNo).padStart(3, '0')})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs block">Inward Date</span>
                          <span className="text-slate-700 font-medium">
                            {receipt.InwardDate ? new Date(receipt.InwardDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs block">Invoice No & Date</span>
                          <span className="text-slate-800 font-medium">
                            {receipt.InvoiceNo ? (
                              <>
                                <span className="font-semibold text-blue-700">{receipt.InvoiceNo}</span>
                                {receipt.InvoiceDate && (
                                  <span className="text-xs text-slate-500 block">
                                    {new Date(receipt.InvoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-xs block">Grand Total</span>
                          <span className="text-emerald-600 font-bold text-base">₹{(receipt.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons (Matching Item Master Royal Blue & Red colors and sizes) */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditDrawer(receipt)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(receipt.GRNNo)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {paginatedReceipts.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ReceiptIcon className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Receipts found</h3>
                <p className="text-slate-500">Try adjusting your search query or add a new GRN entry</p>
              </div>
            )}
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
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

        {/* Rightward Slide-Over Edit Drawer (Item Master Exact Edit Drawer Modal) */}
        {editDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isDrawerVisible ? 'opacity-100' : 'opacity-0'
                }`}
              onClick={handleCloseEditDrawer}
            />

            {/* Right Drawer Modal */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
              <div
                className={`w-screen max-w-2xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isDrawerVisible ? 'translate-x-0' : 'translate-x-full'
                  }`}
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                      <ReceiptIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {isNewEntry ? 'Add New Receipt (GRN)' : 'Edit Receipt (GRN)'}
                      </h2>
                      <p className="text-xs text-blue-100">
                        GRN No: GRN-{String(formData.GRNNo).padStart(3, '0')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseEditDrawer}
                    className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Drawer Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <form id="receipt-form" onSubmit={handleSave} className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4 shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        <div>
                          {isNewEntry ? (
                            <CustomSelect
                              label="Party Name *"
                              searchable
                              placeholder="Select party name"
                              value={formData.PartyName}
                              onChange={handlePartyChange}
                              options={partyOptions}
                              searchPlaceholder="Search party by name..."
                            />
                          ) : (
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Party Name</label>
                              <input
                                type="text"
                                value={formData.PartyName}
                                disabled
                                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold shadow-sm cursor-not-allowed"
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          {!isNewEntry ? (
                            <div>
                              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Purchase Order No</label>
                              <input
                                type="text"
                                value={formData.OrderNo ? `PO-${formData.OrderNo}` : (formData.GateInwardNo ? `GI-${formData.GateInwardNo}` : '-')}
                                disabled
                                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold shadow-sm cursor-not-allowed"
                              />
                            </div>
                          ) : (
                            <div>
                              <CustomSelect
                                label="Purchase Order No *"
                                searchable
                                placeholder={formData.PartyName ? (purchaseOrders.length > 0 ? 'Select purchase order' : 'No completed purchase orders available') : 'Select party name first'}
                                value={formData.OrderNo}
                                onChange={handleOrderChange}
                                options={purchaseOrderOptions}
                                searchPlaceholder="Search purchase order..."
                                disabled={!formData.PartyName}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Linked Gate Inwards Section */}
                      {linkedGateInwards.length > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 shadow-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                                Gate Inward Batches ({linkedGateInwards.length})
                              </span>
                              {formData.OrderNo && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full border border-slate-200">
                                  PO-{formData.OrderNo}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {linkedGateInwards.map((gi) => (
                              <div
                                key={gi.InwardNo}
                                className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-200/80 flex flex-col justify-between space-y-1 hover:bg-slate-100/70 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 text-xs">
                                    GI-{String(gi.InwardNo).padStart(3, '0')}
                                  </span>
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {gi.InwardDate ? new Date(gi.InwardDate).toLocaleDateString('en-GB') : '-'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                  <span>Invoice: <strong className="text-slate-700">{gi.InvoiceNo || 'N/A'}</strong></span>
                                  <span className="text-slate-500 font-medium">{gi.details?.length || 0} item(s)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Invoice Details Section */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                        Invoice Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Invoice No</label>
                          <input
                            type="text"
                            value={formData.InvoiceNo}
                            onChange={(e) => setFormData({ ...formData, InvoiceNo: e.target.value })}
                            placeholder="Enter Invoice No"
                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Invoice Date</label>
                          <input
                            type="date"
                            value={formData.InvoiceDate}
                            onChange={(e) => setFormData({ ...formData, InvoiceDate: e.target.value })}
                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Inward Date</label>
                          <input
                            type="date"
                            value={formData.InwardDate}
                            onChange={(e) => setFormData({ ...formData, InwardDate: e.target.value })}
                            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Items Section Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-700">Received Items ({items.length})</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-white text-slate-500 font-semibold uppercase text-[11px]">
                              <th className="py-2.5 px-3">Item Name</th>
                              <th className="py-2.5 px-3 text-right">Received Qty</th>
                              <th className="py-2.5 px-3 text-right w-32">Unit Rate (₹)</th>
                              <th className="py-2.5 px-3 text-right font-bold">Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {items.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="py-6 text-center text-slate-400">
                                  Select a Gate Inward No above to view received items
                                </td>
                              </tr>
                            ) : (
                              items.map((item, idx) => {
                                const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
                                const rate = parseFloat(item.UnitRate) || 0;
                                const rowTotal = qty * rate;
                                return (
                                  <tr key={idx} className="hover:bg-slate-50">
                                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.ItemName}</td>
                                    <td className="py-2.5 px-3 text-right font-medium">{qty}</td>
                                    <td className="py-2.5 px-3 text-right">
                                      <input
                                        type="number"
                                        step="any" value={item.UnitRate}
                                        onWheel={(e) => e.target.blur()}
                                        onChange={(e) => {
                                          const nextItems = [...items];
                                          nextItems[idx] = { ...item, UnitRate: e.target.value };
                                          setItems(nextItems);
                                        }}
                                        className="w-24 px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                      ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Financial Summary</span>
                        <button
                          type="button"
                          onClick={() => setNoRoundOff(prev => !prev)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${noRoundOff
                            ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          title={noRoundOff ? "Round off value is set to 0. Click to restore calculated round off." : "Click to set round off value to 0"}
                        >
                          <span className={`w-2 h-2 rounded-full ${noRoundOff ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                          {noRoundOff ? 'Zero Round Off (Active)' : 'Zero Round Off'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-bold text-slate-800">₹{(formData.Total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Discount (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.Discount || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, Discount: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Total Tax / GST (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.GST || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, GST: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Packing & Forwarding (P&F) (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.P_F || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, P_F: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Lorry Freight (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.LorryFreight || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, LorryFreight: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-medium"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-200">
                        <span>Round Off:</span>
                        <span className="font-semibold">{formatRoundOff(formData.RoundOff)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                        <span>Grand Total:</span>
                        <span className="text-emerald-600 text-lg">₹{(formData.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Drawer Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseEditDrawer}
                    className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="receipt-form"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isNewEntry ? 'Save Receipt' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Scoped Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-30 rounded-2xl min-h-[400px]">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl flex items-center gap-3">
              <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-slate-700 font-semibold text-xs tracking-wide">Loading data...</span>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
