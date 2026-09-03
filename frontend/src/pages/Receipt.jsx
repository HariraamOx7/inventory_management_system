// frontend/src/pages/Receipt.jsx
import { useState, useEffect, useMemo, Fragment } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Receipt as ReceiptIcon, ArrowUpDown, FileText,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, ChevronDown, Inbox, Layers
} from 'lucide-react';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'https://krexports.org/krest';

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
  const [expandedGRNNo, setExpandedGRNNo] = useState(null);

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
          InvoiceNo: data.InvoiceNo || '',
          InvoiceDate: data.InvoiceDate ? new Date(data.InvoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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
      BillAmount: parseFloat(receipt.BillAmount) > 0 ? receipt.BillAmount : '',
      Total: receipt.Total || 0,
      Discount: parseFloat(receipt.Discount) > 0 ? receipt.Discount : '',
      GST: parseFloat(receipt.GST) > 0 ? receipt.GST : '',
      IGST: parseFloat(receipt.IGST) > 0 ? receipt.IGST : '',
      VAT_CST: parseFloat(receipt.VAT_CST) > 0 ? receipt.VAT_CST : '',
      P_F: parseFloat(receipt.P_F) > 0 ? receipt.P_F : '',
      LorryFreight: parseFloat(receipt.LorryFreight) > 0 ? receipt.LorryFreight : '',
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

    if (receipt.gateInwards && receipt.gateInwards.length > 0) {
      setLinkedGateInwards(receipt.gateInwards);
    } else if (orderNo) {
      axios.get(`${API_URL}/receipts/purchase-order-details`, { params: { orderNo } })
        .then(res => {
          if (res.data?.success && res.data.data.gateInwards) {
            setLinkedGateInwards(res.data.data.gateInwards);
          }
        })
        .catch(err => console.error('Error fetching PO details on edit:', err));
    } else if (receipt.GateInwardNo) {
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
      const serverErr = error.response?.data?.error;
      const serverMsg = error.response?.data?.message;
      const msg = serverErr ? `${serverMsg || 'Error'}: ${serverErr}` : (serverMsg || error.message || 'Error saving receipt');
      showToast(msg, 'error');
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

        {/* Main Data Table (Matching Purchase Order Table Layout) */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">All Receipts (GRN)</h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
              Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-3 w-12 text-center"></th>
                  <th className="py-4 px-4 whitespace-nowrap">GRN No</th>
                  <th className="py-4 px-4">Party Name</th>
                  <th className="py-4 px-4 whitespace-nowrap">Purchase Order No</th>
                  <th className="py-4 px-4 whitespace-nowrap">Invoice No</th>
                  <th className="py-4 px-4 whitespace-nowrap">Invoice Date</th>
                  <th className="py-4 px-4 whitespace-nowrap">Inward Date</th>
                  <th className="py-4 px-4 text-center whitespace-nowrap">Batches</th>
                  <th className="py-4 px-4 text-right whitespace-nowrap">Amount (₹)</th>
                  <th className="py-4 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedReceipts.map((receipt) => {
                  const isExpanded = expandedGRNNo === receipt.GRNNo;
                  const poNo = (receipt.details && receipt.details[0]?.OrderNo) || receipt.OrderNo || '';
                  const batchCount = receipt.gateInwards ? receipt.gateInwards.length : (receipt.GateInwardNo ? 1 : 0);

                  return (
                    <Fragment key={receipt.GRNNo}>
                      <tr className="hover:bg-slate-50/60 transition-colors group">
                        <td className="py-4 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedGRNNo(isExpanded ? null : receipt.GRNNo)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse gate inward batches & details" : "Expand gate inward batches & details"}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
                          GRN-{String(receipt.GRNNo).padStart(3, '0')}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-800">{receipt.PartyName}</div>
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap font-medium text-slate-700">
                          {poNo ? `PO-${String(poNo).padStart(3, '0')}` : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {receipt.InvoiceNo ? receipt.InvoiceNo : <span className="text-slate-400">-</span>}
                        </td>
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                          {receipt.InvoiceDate ? new Date(receipt.InvoiceDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                          {receipt.InwardDate ? new Date(receipt.InwardDate).toLocaleDateString('en-GB') : '-'}
                        </td>
                        <td className="py-4 px-4 text-center font-medium text-slate-600 whitespace-nowrap">
                          {batchCount} {batchCount === 1 ? 'batch' : 'batches'}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                          ₹{(receipt.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDrawer(receipt)}
                              className="px-3.5 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 font-medium text-xs cursor-pointer"
                              title="Edit Receipt"
                            >
                              <Edit2 size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(receipt.GRNNo)}
                              className="px-3.5 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/20 flex items-center gap-1.5 font-medium text-xs cursor-pointer"
                              title="Delete Receipt"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-table for Gate Inwards and Received Items */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={10} className="p-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">

                                  Gate Inwards & Items for GRN
                                </h4>

                              </div>

                              {/* Gate Inward Batches Table (Line-wise) */}
                              {receipt.gateInwards && receipt.gateInwards.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    Number of Gate Inwards ({receipt.gateInwards.length})
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
                                        {receipt.gateInwards.map((gi) => (
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
                                receipt.GateInwardNo && (
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                                    <span>Gate Inward: <strong className="text-slate-800 font-semibold">GI-{String(receipt.GateInwardNo).padStart(3, '0')}</strong></span>
                                    <span>Inward Date: <strong className="text-slate-700">{receipt.InwardDate ? new Date(receipt.InwardDate).toLocaleDateString('en-GB') : '-'}</strong></span>
                                    <span>Invoice: <strong className="text-slate-700">{receipt.InvoiceNo || 'N/A'}</strong></span>
                                  </div>
                                )
                              )}

                              {/* Consolidated Received Items Table */}
                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                  Receipt Items Summary ({receipt.details?.length || 0})
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-slate-200">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                        <th className="py-2.5 px-3">Item Name</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap">Order No</th>
                                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Received Qty</th>
                                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Unit Rate (₹)</th>
                                        <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">Item Total (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                      {(receipt.details || []).map((item, idx) => {
                                        const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
                                        const rate = parseFloat(item.UnitRate) || 0;
                                        const itemTotal = qty * rate;
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
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Financial Summary */}
                              <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-slate-600">
                                  <span>Subtotal: <strong className="text-slate-800 font-semibold">₹{(receipt.Total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                                  {parseFloat(receipt.Discount) > 0 && <span>Discount: <strong className="text-slate-800 font-semibold">-₹{parseFloat(receipt.Discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                                  {parseFloat(receipt.GST) > 0 && <span>Tax (GST): <strong className="text-slate-800 font-semibold">+₹{parseFloat(receipt.GST).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                                  {parseFloat(receipt.P_F) > 0 && <span>P&F: <strong className="text-slate-800 font-semibold">+₹{parseFloat(receipt.P_F).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                                  {parseFloat(receipt.LorryFreight) > 0 && <span>Freight: <strong className="text-slate-800 font-semibold">+₹{parseFloat(receipt.LorryFreight).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>}
                                  <span>Round Off: <strong className="text-slate-700">{formatRoundOff(receipt.RoundOff)}</strong></span>
                                </div>
                                <div className="text-sm font-bold text-emerald-600">
                                  Grand Total: ₹{(receipt.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {paginatedReceipts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ReceiptIcon className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-600 mb-2">No Receipts found</h3>
                      <p className="text-slate-500">Try adjusting your search query or add a new GRN entry</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

        {/* Centered Modal Window for Add New & Edit Receipt (GRN) */}
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
                      <ReceiptIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {isNewEntry ? 'Add New Receipt (GRN)' : 'Edit Receipt (GRN)'}
                      </h2>
                      <p className="text-sm text-blue-100 mt-0.5">
                        GRN No: GRN-{String(formData.GRNNo).padStart(3, '0')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseEditDrawer}
                    className="p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Modal Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  <form id="receipt-form" onSubmit={handleSave} className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4 shadow-sm">
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
                              <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Party Name</label>
                              <input
                                type="text"
                                value={formData.PartyName}
                                disabled
                                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-semibold text-base shadow-sm cursor-not-allowed"
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          {!isNewEntry ? (
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Purchase Order No</label>
                              <input
                                type="text"
                                value={formData.OrderNo ? `PO-${formData.OrderNo}` : (formData.GateInwardNo ? `GI-${formData.GateInwardNo}` : '-')}
                                disabled
                                className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 font-semibold text-base shadow-sm cursor-not-allowed"
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
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold uppercase tracking-wider text-slate-700">
                                Gate Inward Batches ({linkedGateInwards.length})
                              </span>
                              {formData.OrderNo && (
                                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200">
                                  PO-{formData.OrderNo}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {linkedGateInwards.map((gi) => (
                              <div
                                key={gi.InwardNo}
                                className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 flex flex-col justify-between space-y-1 hover:bg-slate-100/70 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 text-sm">
                                    GI-{String(gi.InwardNo).padStart(3, '0')}
                                  </span>
                                  <span className="text-xs text-slate-500 font-medium">
                                    {gi.InwardDate ? new Date(gi.InwardDate).toLocaleDateString('en-GB') : '-'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                  <span className="text-slate-500 font-medium">Inward Batch</span>
                                  <span className="text-slate-700 font-semibold">{gi.details?.length || 0} item(s)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Invoice Details Section */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                        Invoice Details
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Invoice No</label>
                          <input
                            type="text"
                            value={formData.InvoiceNo}
                            onChange={(e) => setFormData({ ...formData, InvoiceNo: e.target.value })}
                            placeholder="Enter Invoice No"
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Invoice Date</label>
                          <input
                            type="date"
                            value={formData.InvoiceDate}
                            onChange={(e) => setFormData({ ...formData, InvoiceDate: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Inward Date</label>
                          <input
                            type="date"
                            value={formData.InwardDate}
                            onChange={(e) => setFormData({ ...formData, InwardDate: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Items Section Table */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden mt-4 shadow-sm">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-base font-bold text-slate-800">Received Items ({items.length})</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase text-xs tracking-wider">
                              <th className="py-3 px-4">Item Name</th>
                              <th className="py-3 px-4 text-right">Received Qty</th>
                              <th className="py-3 px-4 text-right w-36">Unit Rate (₹)</th>
                              <th className="py-3 px-4 text-right font-bold">Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {items.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="py-8 text-center text-slate-400 text-base">
                                  Select a Gate Inward No above to view received items
                                </td>
                              </tr>
                            ) : (
                              items.map((item, idx) => {
                                const qty = parseFloat(item.ReceivedQty !== undefined ? item.ReceivedQty : item.Qty) || 0;
                                const rate = parseFloat(item.UnitRate) || 0;
                                const rowTotal = qty * rate;
                                return (
                                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-4 font-semibold text-slate-800 text-base">{item.ItemName}</td>
                                    <td className="py-3 px-4 text-right font-medium text-base text-slate-700">{qty}</td>
                                    <td className="py-3 px-4 text-right">
                                      <input
                                        type="number"
                                        step="any" value={item.UnitRate}
                                        onWheel={(e) => e.target.blur()}
                                        onChange={(e) => {
                                          const nextItems = [...items];
                                          nextItems[idx] = { ...item, UnitRate: e.target.value };
                                          setItems(nextItems);
                                        }}
                                        className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-right font-bold text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-slate-900 text-base">
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
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <span className="text-base font-bold text-slate-800">Financial Summary</span>
                        <button
                          type="button"
                          onClick={() => setNoRoundOff(prev => !prev)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${noRoundOff
                            ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          title={noRoundOff ? "Round off value is set to 0. Click to restore calculated round off." : "Click to set round off value to 0"}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${noRoundOff ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                          {noRoundOff ? 'Zero Round Off (Active)' : 'Zero Round Off'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span className="font-semibold">Items Subtotal:</span>
                        <span className="font-bold text-slate-900 text-base">₹{(formData.Total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Discount (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.Discount || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, Discount: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Total Tax / GST (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.GST || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, GST: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Packing & Forwarding (P&F) (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.P_F || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, P_F: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-600 mb-1.5">Lorry Freight (₹)</label>
                          <input
                            type="number"
                            step="any"
                            value={formData.LorryFreight || ''}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setFormData({ ...formData, LorryFreight: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-base bg-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600 pt-3 border-t border-slate-200">
                        <span className="font-semibold">Round Off:</span>
                        <span className="font-bold text-slate-800 text-base">{formatRoundOff(formData.RoundOff)}</span>
                      </div>
                      <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200">
                        <span>Grand Total:</span>
                        <span className="text-emerald-600 text-2xl font-extrabold">₹{(formData.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleCloseEditDrawer}
                    className="px-6 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold text-base transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="receipt-form"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold text-base shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
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
