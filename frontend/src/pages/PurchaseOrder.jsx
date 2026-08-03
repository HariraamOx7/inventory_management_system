// frontend/src/pages/PurchaseOrder.jsx
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, ShoppingBag,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import Layout from '../components/Layout';
import SearchSelect from '../components/SearchSelect';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const formatRoundOff = (val) => {
  const num = parseFloat(val) || 0;
  if (num > 0) return `+${num.toFixed(2)}`;
  return num.toFixed(2);
};

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (val, decimals = 2) => {
  const num = parseFloat(val) || 0;
  return num.toFixed(decimals);
};

const formatDateForInput = (dateStr) => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const initialHeadState = {
  OrderNo: '',
  OrderDate: new Date().toISOString().split('T')[0],
  PartyName: '',
  Address: '',
  Place: '',
  Remarks: '',
  RefNo: '',
  DutyWithoutPF: false,
  VoltasFormat: false,
  VatWithPF: false
};

const initialDetailState = {
  ItemName: '',
  Qty: '',
  UnitRate: '',
  TotalAmount: 0,
  DiscountPct: '',
  DiscountAmt: 0,
  GSTType: 'SGST+CGST',
  GSTPct: '',
  SGSTPct: '',
  SGST: 0,
  CGSTPct: '',
  CGST: 0,
  IGSTPct: '',
  IGST: 0,
  TaxType: 'Excise',
  TaxPct: '',
  TaxAmount: 0,
  PF_Pct: '',
  PF_Amount: '',
  LorryFreight: '',
  RoundOff: '',
  GrandTotal: 0,
  MRS_No: ''
};

export default function PurchaseOrder() {
  const showToast = useToastStore(state => state.showToast);

  // Core Data States
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form Drawer States
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(true);
  const [editingOrderNo, setEditingOrderNo] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);

  // Form States
  const [headData, setHeadData] = useState(initialHeadState);
  const [items, setItems] = useState([]);
  const [detailData, setDetailData] = useState(initialDetailState);

  // Row Expand & View Modal State for Table
  const [expandedOrderNo, setExpandedOrderNo] = useState(null);
  const [viewOrderModal, setViewOrderModal] = useState(null);

  // Filters & Sorting & Pagination
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch Purchase Orders
  const fetchPurchaseOrders = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/purchase-orders`);
      if (res.data?.success) {
        setPurchaseOrders(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  }, []);

  // Initial Data Load
  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      await fetchPurchaseOrders();

      const [supplierRes, itemRes] = await Promise.all([
        axios.get(`${API_URL}/purchase-orders/suppliers`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/purchase-orders/items`).catch(() => ({ data: { success: false } }))
      ]);

      if (supplierRes.data?.success) {
        setSuppliers(supplierRes.data.data);
      }
      if (itemRes.data?.success) {
        setItemsList(itemRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      showToast('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchPurchaseOrders, showToast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Fetch Supplier Address & Place when PartyName changes in Drawer form
  useEffect(() => {
    if (headData.PartyName) {
      const supplier = suppliers.find(s => s.name === headData.PartyName || s.AccountName === headData.PartyName);
      if (supplier) {
        setHeadData(prev => ({
          ...prev,
          Address: supplier.Address || supplier.address || prev.Address,
          Place: supplier.Place || supplier.place || prev.Place
        }));
      }
    }
  }, [headData.PartyName, suppliers]);

  // Recalculate detail item financial figures when Qty, UnitRate, Discount, or Taxes change
  useEffect(() => {
    const qty = parseFloat(detailData.Qty) || 0;
    const unitRate = parseFloat(detailData.UnitRate) || 0;
    const totalAmount = qty * unitRate;

    const discountPct = parseFloat(detailData.DiscountPct) || 0;
    const discountAmt = (totalAmount * discountPct) / 100;
    const amountAfterDiscount = totalAmount - discountAmt;

    let sgst = 0, cgst = 0, igst = 0;
    if (detailData.GSTType === 'SGST+CGST') {
      const sgstPct = parseFloat(detailData.SGSTPct) || 0;
      const cgstPct = parseFloat(detailData.CGSTPct) || 0;
      sgst = (amountAfterDiscount * sgstPct) / 100;
      cgst = (amountAfterDiscount * cgstPct) / 100;
    } else {
      const igstPct = parseFloat(detailData.IGSTPct) || 0;
      igst = (amountAfterDiscount * igstPct) / 100;
    }

    const pfAmt = parseFloat(detailData.PF_Amount) || 0;
    const lorryFreight = parseFloat(detailData.LorryFreight) || 0;
    const unroundedGrandTotal = amountAfterDiscount + sgst + cgst + igst + pfAmt + lorryFreight;
    const grandTotal = Math.round(unroundedGrandTotal);

    setDetailData(prev => ({
      ...prev,
      TotalAmount: totalAmount,
      DiscountAmt: discountAmt,
      SGST: sgst,
      CGST: cgst,
      IGST: igst,
      GrandTotal: grandTotal
    }));
  }, [
    detailData.Qty,
    detailData.UnitRate,
    detailData.DiscountPct,
    detailData.SGSTPct,
    detailData.CGSTPct,
    detailData.IGSTPct,
    detailData.GSTType,
    detailData.PF_Amount,
    detailData.LorryFreight
  ]);

  // Compute overall order totals from items list
  const totals = useMemo(() => {
    const total = items.reduce((sum, i) => sum + (parseFloat(i.TotalAmount) || 0), 0);
    const discount = items.reduce((sum, i) => sum + (parseFloat(i.DiscountAmt) || 0), 0);
    const gst = items.reduce((sum, i) => sum + (parseFloat(i.SGST) || 0) + (parseFloat(i.CGST) || 0), 0);
    const igst = items.reduce((sum, i) => sum + (parseFloat(i.IGST) || 0), 0);
    const pf = items.reduce((sum, i) => sum + (parseFloat(i.PF_Amount) || 0), 0);
    const lorryFreight = items.reduce((sum, i) => sum + (parseFloat(i.LorryFreight) || 0), 0);
    const unroundedGrandTotal = total - discount + gst + igst + pf + lorryFreight;
    const grandTotal = Math.round(unroundedGrandTotal);
    const roundOff = parseFloat((grandTotal - unroundedGrandTotal).toFixed(2));

    return {
      Total: total,
      Discount: discount,
      GST: gst,
      IGST: igst,
      P_F: pf,
      LorryFreight: lorryFreight,
      RoundOff: roundOff,
      GrandTotal: grandTotal
    };
  }, [items]);

  // Drawer Handlers
  const handleOpenAddDrawer = async () => {
    setIsNewEntry(true);
    setEditingOrderNo(null);
    setEditingItemIndex(null);
    setItems([]);
    setDetailData(initialDetailState);

    let nextNo = '1';
    try {
      const res = await axios.get(`${API_URL}/purchase-orders/last-order-no`);
      if (res.data?.success) {
        nextNo = (Number(res.data.data.lastOrderNo) + 1).toString();
      }
    } catch (e) {
      console.error(e);
    }

    setHeadData({
      ...initialHeadState,
      OrderNo: nextNo
    });

    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleOpenEditDrawer = (order) => {
    setIsNewEntry(false);
    setEditingOrderNo(order.OrderNo);
    setEditingItemIndex(null);
    setHeadData({
      OrderNo: order.OrderNo.toString(),
      OrderDate: formatDateForInput(order.OrderDate),
      PartyName: order.PartyName || '',
      Address: order.Address || '',
      Place: order.Place || '',
      Remarks: order.Remarks || '',
      RefNo: order.RefNo || '',
      DutyWithoutPF: order.DutyWithoutPF || false,
      VoltasFormat: order.VoltasFormat || false,
      VatWithPF: order.VatWithPF || false
    });

    setItems((order.details || []).map(d => ({
      ItemName: d.ItemName,
      Qty: d.Qty || 0,
      UnitRate: d.UnitRate || 0,
      TotalAmount: d.TotalAmount || 0,
      DiscountPct: d.DiscountPct || 0,
      DiscountAmt: d.DiscountAmt || 0,
      GSTType: d.GSTType || 'SGST+CGST',
      SGSTPct: d.SGSTPct || 0,
      SGST: d.SGST || 0,
      CGSTPct: d.CGSTPct || 0,
      CGST: d.CGST || 0,
      IGSTPct: d.IGSTPct || 0,
      IGST: d.IGST || 0,
      PF_Pct: d.PF_Pct || 0,
      PF_Amount: d.PF_Amount || 0,
      LorryFreight: d.LorryFreight || 0,
      GrandTotal: d.GrandTotal || 0,
      MRS_No: d.MRS_No || ''
    })));

    setDetailData(initialDetailState);
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleCloseEditDrawer = () => {
    setIsDrawerVisible(false);
    setTimeout(() => {
      setEditDrawerOpen(false);
      setEditingOrderNo(null);
      setEditingItemIndex(null);
      setHeadData(initialHeadState);
      setItems([]);
    }, 300);
  };

  // Add Item to Draft
  const handleAddItem = () => {
    if (!detailData.ItemName || !detailData.Qty) {
      showToast('Item Name and Quantity are required', 'error');
      return;
    }

    const newItem = {
      ...detailData,
      Qty: parseFloat(detailData.Qty) || 0,
      UnitRate: parseFloat(detailData.UnitRate) || 0,
      TotalAmount: parseFloat(detailData.TotalAmount) || 0,
      DiscountPct: parseFloat(detailData.DiscountPct) || 0,
      DiscountAmt: parseFloat(detailData.DiscountAmt) || 0,
      SGSTPct: parseFloat(detailData.SGSTPct) || 0,
      SGST: parseFloat(detailData.SGST) || 0,
      CGSTPct: parseFloat(detailData.CGSTPct) || 0,
      CGST: parseFloat(detailData.CGST) || 0,
      IGSTPct: parseFloat(detailData.IGSTPct) || 0,
      IGST: parseFloat(detailData.IGST) || 0,
      PF_Amount: parseFloat(detailData.PF_Amount) || 0,
      LorryFreight: parseFloat(detailData.LorryFreight) || 0,
      GrandTotal: parseFloat(detailData.GrandTotal) || 0
    };

    setItems([...items, newItem]);
    setDetailData(initialDetailState);
    showToast('Item added to purchase order', 'success');
  };

  const handleStartEditItem = (index) => {
    const item = items[index];
    if (!item) return;
    setEditingItemIndex(index);
    setDetailData({
      ItemName: item.ItemName || '',
      Qty: item.Qty !== undefined ? item.Qty : '',
      UnitRate: item.UnitRate !== undefined ? item.UnitRate : '',
      TotalAmount: item.TotalAmount || 0,
      DiscountPct: item.DiscountPct !== undefined ? item.DiscountPct : '',
      DiscountAmt: item.DiscountAmt || 0,
      GSTType: item.GSTType || 'SGST+CGST',
      SGSTPct: item.SGSTPct !== undefined ? item.SGSTPct : '',
      SGST: item.SGST || 0,
      CGSTPct: item.CGSTPct !== undefined ? item.CGSTPct : '',
      CGST: item.CGST || 0,
      IGSTPct: item.IGSTPct !== undefined ? item.IGSTPct : '',
      IGST: item.IGST || 0,
      TaxType: item.TaxType || 'Excise',
      TaxPct: item.TaxPct !== undefined ? item.TaxPct : '',
      TaxAmount: item.TaxAmount || 0,
      PF_Pct: item.PF_Pct !== undefined ? item.PF_Pct : '',
      PF_Amount: item.PF_Amount !== undefined ? item.PF_Amount : '',
      LorryFreight: item.LorryFreight !== undefined ? item.LorryFreight : '',
      GrandTotal: item.GrandTotal || 0,
      MRS_No: item.MRS_No || ''
    });
    showToast(`Editing item #${index + 1}: ${item.ItemName}`, 'info');
  };

  const handleUpdateItem = () => {
    if (editingItemIndex === null) return;
    if (!detailData.ItemName || !detailData.Qty) {
      showToast('Item Name and Quantity are required', 'error');
      return;
    }

    const updatedItem = {
      ...detailData,
      Qty: parseFloat(detailData.Qty) || 0,
      UnitRate: parseFloat(detailData.UnitRate) || 0,
      TotalAmount: parseFloat(detailData.TotalAmount) || 0,
      DiscountPct: parseFloat(detailData.DiscountPct) || 0,
      DiscountAmt: parseFloat(detailData.DiscountAmt) || 0,
      SGSTPct: parseFloat(detailData.SGSTPct) || 0,
      SGST: parseFloat(detailData.SGST) || 0,
      CGSTPct: parseFloat(detailData.CGSTPct) || 0,
      CGST: parseFloat(detailData.CGST) || 0,
      IGSTPct: parseFloat(detailData.IGSTPct) || 0,
      IGST: parseFloat(detailData.IGST) || 0,
      PF_Amount: parseFloat(detailData.PF_Amount) || 0,
      LorryFreight: parseFloat(detailData.LorryFreight) || 0,
      GrandTotal: parseFloat(detailData.GrandTotal) || 0
    };

    const newItems = [...items];
    newItems[editingItemIndex] = updatedItem;
    setItems(newItems);
    setEditingItemIndex(null);
    setDetailData(initialDetailState);
    showToast('Item updated successfully', 'success');
  };

  const handleCancelEditItem = () => {
    setEditingItemIndex(null);
    setDetailData(initialDetailState);
  };

  const handleRemoveItem = (index) => {
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      setDetailData(initialDetailState);
    } else if (editingItemIndex !== null && index < editingItemIndex) {
      setEditingItemIndex(prev => prev - 1);
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Save / Update PO
  const handleSavePO = async (e) => {
    if (e) e.preventDefault();

    if (!headData.PartyName) {
      showToast('Please select a Party Name', 'error');
      return;
    }

    if (items.length === 0) {
      showToast('Please add at least one item to the purchase order', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...headData,
        items,
        ...totals
      };

      if (isNewEntry) {
        await axios.post(`${API_URL}/purchase-orders`, payload);
        showToast('Purchase Order created successfully!', 'success');
      } else {
        await axios.put(`${API_URL}/purchase-orders/${editingOrderNo}`, payload);
        showToast('Purchase Order updated successfully!', 'success');
      }

      handleCloseEditDrawer();
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error saving purchase order:', error);
      const msg = error.response?.data?.message || error.message || 'Error saving purchase order';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete PO
  const handleDeletePO = async (orderNo) => {
    if (!window.confirm(`Are you sure you want to delete Purchase Order #${orderNo}?`)) return;

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/purchase-orders/${orderNo}`);
      showToast(`Purchase Order #${orderNo} deleted successfully!`, 'success');
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      showToast('Error deleting purchase order: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filter & Sort POs
  const filteredAndSortedOrders = useMemo(() => {
    return purchaseOrders
      .filter(o => {
        const query = search.trim().toLowerCase();
        const matchSearch = query === '' ||
          String(o.OrderNo).toLowerCase().includes(query) ||
          (o.PartyName && o.PartyName.toLowerCase().includes(query)) ||
          (o.RefNo && o.RefNo.toLowerCase().includes(query)) ||
          (o.Remarks && o.Remarks.toLowerCase().includes(query));

        const matchParty = partyFilter === 'ALL' || o.PartyName === partyFilter;
        const matchStatus = statusFilter === 'ALL' || (o.Status || 'Draft') === statusFilter;

        return matchSearch && matchParty && matchStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.OrderDate || b.createdAt) - new Date(a.OrderDate || a.createdAt);
        }
        if (sortBy === 'oldest') {
          return new Date(a.OrderDate || a.createdAt) - new Date(b.OrderDate || b.createdAt);
        }
        if (sortBy === 'order_desc') {
          return Number(b.OrderNo) - Number(a.OrderNo);
        }
        if (sortBy === 'order_asc') {
          return Number(a.OrderNo) - Number(b.OrderNo);
        }
        if (sortBy === 'total_desc') {
          return (b.GrandTotal || 0) - (a.GrandTotal || 0);
        }
        return 0;
      });
  }, [purchaseOrders, search, partyFilter, statusFilter, sortBy]);

  // Unique Parties for Filter Panel
  const partyOptions = useMemo(() => {
    const set = new Set(purchaseOrders.map(o => o.PartyName).filter(Boolean));
    return Array.from(set).sort();
  }, [purchaseOrders]);

  // Pagination calculations
  const totalItemsCount = filteredAndSortedOrders.length;
  const totalPages = Math.ceil(totalItemsCount / itemsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedOrders.slice(start, start + itemsPerPage);
  }, [filteredAndSortedOrders, currentPage, itemsPerPage]);

  // Supplier Options for SearchSelect
  const supplierOptions = useMemo(() =>
    suppliers.map(s => ({
      value: s.name || s.AccountName,
      label: s.name || s.AccountName,
      sub: s.Place ? `Place: ${s.Place}` : '',
      Address: s.Address,
      Place: s.Place
    })),
    [suppliers]
  );

  // Item Options for SearchSelect
  const itemOptions = useMemo(() =>
    itemsList.map(i => ({
      value: i.ItemName,
      label: i.ItemName,
      sub: i.UnitRate ? `Unit Rate: ₹${i.UnitRate}` : '',
      UnitRate: i.UnitRate
    })),
    [itemsList]
  );

  return (
    <Layout>
      <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <PageHeader
          title="Purchase Order Entry"
          subtitle="Create, view, and manage supplier purchase orders"
          icon={ShoppingBag}
          actionText="Add New Purchase Order"
          onActionClick={handleOpenAddDrawer}
        />

        {/* Filters & Search Card */}
        <FilterPanel
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by order no, party name, ref no..."
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
                { value: "ALL", label: "All Parties" },
                ...partyOptions.map(p => ({ value: p, label: p }))
              ]
            },
            {
              label: "Status",
              icon: FileText,
              value: statusFilter,
              onChange: (val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              },
              options: [
                { value: "ALL", label: "All Statuses" },
                { value: "Draft", label: "Draft" },
                { value: "InwardCreated", label: "Inward Created" }
              ]
            }
          ]}
          sortOptions={[
            { value: "newest", label: "Newest First" },
            { value: "oldest", label: "Oldest First" },
            { value: "order_desc", label: "Order No (High-Low)" },
            { value: "order_asc", label: "Order No (Low-High)" },
            { value: "total_desc", label: "Grand Total (High-Low)" }
          ]}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Main Data Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-4 w-12 text-center"></th>
                  <th className="py-4 px-6 whitespace-nowrap">Order No</th>
                  <th className="py-4 px-6 whitespace-nowrap">Order Date</th>
                  <th className="py-4 px-6">Party Name</th>
                  <th className="py-4 px-6 whitespace-nowrap">Ref No</th>
                  <th className="py-4 px-6 text-center whitespace-nowrap">Status</th>
                  <th className="py-4 px-6 text-center whitespace-nowrap">Items</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">Grand Total (₹)</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedOrders.map((order) => {
                  const isExpanded = expandedOrderNo === order.OrderNo;
                  const detailCount = order.details ? order.details.length : 0;
                  const status = order.Status || 'Draft';

                  return (
                    <Fragment key={order.OrderNo}>
                      <tr className="hover:bg-slate-50/60 transition-colors group">
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedOrderNo(isExpanded ? null : order.OrderNo)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse item details" : "Expand item details"}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-900 whitespace-nowrap">
                          PO-{String(order.OrderNo).padStart(3, '0')}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-medium whitespace-nowrap">
                          {order.OrderDate ? new Date(order.OrderDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-800">{order.PartyName}</div>
                          {order.Place && <div className="text-xs text-slate-400">{order.Place}</div>}
                        </td>
                        <td className="py-4 px-6 text-slate-600 whitespace-nowrap">
                          {order.RefNo || '-'}
                        </td>
                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${status === 'InwardCreated'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                            {status === 'InwardCreated' ? 'Inward Created' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center font-medium text-slate-600 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setExpandedOrderNo(isExpanded ? null : order.OrderNo)}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-blue-600 font-semibold text-xs transition-colors cursor-pointer border border-slate-200/60"
                            title="Click to expand item details"
                          >
                            {detailCount} items
                          </button>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-emerald-600 text-base whitespace-nowrap">
                          ₹{formatCurrency(order.GrandTotal)}
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDrawer(order)}
                              className="px-3.5 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 font-medium text-xs cursor-pointer"
                              title="Edit Purchase Order"
                            >
                              <Edit2 size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePO(order.OrderNo)}
                              className="px-3.5 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/20 flex items-center gap-1.5 font-medium text-xs cursor-pointer"
                              title="Delete Purchase Order"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-table for Order Items */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={9} className="p-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                  <ShoppingBag size={14} className="text-blue-500" />
                                  Order Items for PO-{String(order.OrderNo).padStart(3, '0')} ({detailCount} {detailCount === 1 ? 'item' : 'items'})
                                </h4>
                                <span className="text-xs text-slate-500 font-medium">
                                  Supplier: <strong className="text-slate-800">{order.PartyName}</strong>
                                </span>
                              </div>

                              {order.details && order.details.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                                        <th className="py-2.5 px-3">Item Name</th>
                                        <th className="py-2.5 px-3 text-right">Qty</th>
                                        <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                                        <th className="py-2.5 px-3 text-right">Discount (₹)</th>
                                        <th className="py-2.5 px-3 text-right">Tax (GST/IGST)</th>
                                        <th className="py-2.5 px-3 text-right">P&F (₹)</th>
                                        <th className="py-2.5 px-3 text-right">Lorry Freight (₹)</th>
                                        <th className="py-2.5 px-3">MRS No</th>
                                        <th className="py-2.5 px-3 text-right font-bold text-slate-900">Item Total (₹)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                      {order.details.map((item, idx) => {
                                        const qty = parseFloat(item.Qty) || 0;
                                        const sgst = parseFloat(item.SGST) || 0;
                                        const cgst = parseFloat(item.CGST) || 0;
                                        const igst = parseFloat(item.IGST) || 0;
                                        const taxSum = sgst + cgst + igst;
                                        const itemTotal = item.GrandTotal || item.TotalAmount || 0;

                                        return (
                                          <tr key={idx} className="hover:bg-slate-50">
                                            <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                                            <td className="py-2.5 px-3 font-semibold text-slate-800">{item.ItemName}</td>
                                            <td className="py-2.5 px-3 text-right font-medium">{qty}</td>
                                            <td className="py-2.5 px-3 text-right">₹{formatCurrency(item.UnitRate)}</td>
                                            <td className="py-2.5 px-3 text-right text-slate-500">₹{formatCurrency(item.DiscountAmt)}</td>
                                            <td className="py-2.5 px-3 text-right text-slate-500">₹{formatCurrency(taxSum)}</td>
                                            <td className="py-2.5 px-3 text-right text-slate-500">₹{formatCurrency(item.PF_Amount)}</td>
                                            <td className="py-2.5 px-3 text-right text-slate-500">₹{formatCurrency(item.LorryFreight)}</td>
                                            <td className="py-2.5 px-3 text-slate-500">{item.MRS_No || '-'}</td>
                                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                              ₹{formatCurrency(itemTotal)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic py-2 text-center">No item details recorded for this purchase order.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {paginatedOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShoppingBag className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-600 mb-2">No Purchase Orders found</h3>
                      <p className="text-slate-500">Try adjusting your search filter or create a new order</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalItemsCount > 0 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span>
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, totalItemsCount)} to {Math.min(currentPage * itemsPerPage, totalItemsCount)} of {totalItemsCount} orders
                </span>
                <div className="flex items-center gap-2">
                  <label htmlFor="po-per-page" className="font-medium text-slate-600">Per page:</label>
                  <select
                    id="po-per-page"
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-300 text-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 text-slate-600 cursor-pointer"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* View Order Modal */}
        {viewOrderModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    Purchase Order Details (PO-{String(viewOrderModal.OrderNo).padStart(3, '0')})
                  </h3>
                  <p className="text-blue-100 text-xs mt-0.5">
                    Order Date: {viewOrderModal.OrderDate ? new Date(viewOrderModal.OrderDate).toLocaleDateString('en-IN') : '-'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewOrderModal(null)}
                  className="p-1 text-blue-100 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* Header Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Supplier Party</span>
                    <strong className="text-slate-800 text-base">{viewOrderModal.PartyName}</strong>
                    {viewOrderModal.Place && <span className="text-xs text-slate-500 block">{viewOrderModal.Place}</span>}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Ref No</span>
                    <span className="text-slate-800 font-semibold">{viewOrderModal.RefNo || '-'}</span>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Status</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5">
                      {viewOrderModal.Status || 'Draft'}
                    </span>
                  </div>
                  {viewOrderModal.Address && (
                    <div className="sm:col-span-2">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Address</span>
                      <span className="text-slate-700">{viewOrderModal.Address}</span>
                    </div>
                  )}
                  {viewOrderModal.Remarks && (
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Remarks</span>
                      <span className="text-slate-700">{viewOrderModal.Remarks}</span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Order Items ({viewOrderModal.details ? viewOrderModal.details.length : 0})</span>
                  </h4>
                  {viewOrderModal.details && viewOrderModal.details.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                            <th className="py-3 px-3">#</th>
                            <th className="py-3 px-3">Item Name</th>
                            <th className="py-3 px-3 text-right">Qty</th>
                            <th className="py-3 px-3 text-right">Unit Rate (₹)</th>
                            <th className="py-3 px-3 text-right">Discount (₹)</th>
                            <th className="py-3 px-3 text-right">Tax (GST/IGST)</th>
                            <th className="py-3 px-3 text-right">P&F (₹)</th>
                            <th className="py-3 px-3 text-right">Lorry Freight (₹)</th>
                            <th className="py-3 px-3">MRS No</th>
                            <th className="py-3 px-3 text-right font-bold text-slate-900">Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {viewOrderModal.details.map((item, idx) => {
                            const sgst = parseFloat(item.SGST) || 0;
                            const cgst = parseFloat(item.CGST) || 0;
                            const igst = parseFloat(item.IGST) || 0;
                            const taxSum = sgst + cgst + igst;
                            return (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-3 px-3 font-medium text-slate-400">{idx + 1}</td>
                                <td className="py-3 px-3 font-semibold text-slate-800">{item.ItemName}</td>
                                <td className="py-3 px-3 text-right font-semibold">{item.Qty}</td>
                                <td className="py-3 px-3 text-right">₹{(item.UnitRate || 0).toFixed(2)}</td>
                                <td className="py-3 px-3 text-right text-slate-500">₹{(item.DiscountAmt || 0).toFixed(2)}</td>
                                <td className="py-3 px-3 text-right text-slate-500">₹{taxSum.toFixed(2)}</td>
                                <td className="py-3 px-3 text-right text-slate-500">₹{(item.PF_Amount || 0).toFixed(2)}</td>
                                <td className="py-3 px-3 text-right text-slate-500">₹{formatCurrency(item.LorryFreight)}</td>
                                <td className="py-3 px-3 text-slate-500">{item.MRS_No || '-'}</td>
                                <td className="py-3 px-3 text-right font-bold text-slate-900">
                                  ₹{(item.GrandTotal || item.TotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">No order items recorded.</p>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Items Total:</span>
                    <span className="font-semibold text-slate-800">₹{(viewOrderModal.Total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {viewOrderModal.Discount > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Discount:</span>
                      <span className="font-medium text-amber-600">-₹{parseFloat(viewOrderModal.Discount).toFixed(2)}</span>
                    </div>
                  )}
                  {(viewOrderModal.GST > 0 || viewOrderModal.IGST > 0) && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Tax (GST/IGST):</span>
                      <span className="font-medium text-slate-700">+₹{(parseFloat(viewOrderModal.GST || 0) + parseFloat(viewOrderModal.IGST || 0)).toFixed(2)}</span>
                    </div>
                  )}
                  {viewOrderModal.P_F > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>P & F:</span>
                      <span className="font-medium text-slate-700">+₹{parseFloat(viewOrderModal.P_F).toFixed(2)}</span>
                    </div>
                  )}
                  {viewOrderModal.LorryFreight > 0 && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Lorry Freight:</span>
                      <span className="font-medium text-slate-700">+₹{parseFloat(viewOrderModal.LorryFreight).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="text-emerald-600 text-base">₹{(viewOrderModal.GrandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const orderToEdit = viewOrderModal;
                    setViewOrderModal(null);
                    handleOpenEditDrawer(orderToEdit);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 size={14} />
                  Edit Order
                </button>
                <button
                  type="button"
                  onClick={() => setViewOrderModal(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-medium text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Slide-Over Modal Form Drawer */}
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
                className={`w-screen max-w-3xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isDrawerVisible ? 'translate-x-0' : 'translate-x-full'
                  }`}
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
                  <div>
                    <h3 className="text-lg font-bold">
                      {isNewEntry ? 'Create New Purchase Order' : `Edit Purchase Order #${headData.OrderNo}`}
                    </h3>
                    <p className="text-blue-100 text-xs mt-0.5">
                      Fill in supplier details and add items to order
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEditDrawer}
                    className="p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Drawer Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
                  <form id="po-form" onSubmit={handleSavePO} className="space-y-6">

                    {/* Section 1: Order & Supplier Information */}
                    <div className="bg-white p-5 border border-slate-200 rounded-xl space-y-4 shadow-xs">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-100 pb-2">
                        1. Supplier & Order Information
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Order No</label>
                          <input
                            type="text"
                            readOnly
                            value={`PO-${String(headData.OrderNo).padStart(3, '0')}`}
                            className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 font-bold focus:outline-none cursor-not-allowed"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Order Date *</label>
                          <input
                            type="date"
                            required
                            value={headData.OrderDate}
                            onChange={(e) => setHeadData({ ...headData, OrderDate: e.target.value })}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <SearchSelect
                          label="Party Name *"
                          required
                          options={supplierOptions}
                          value={headData.PartyName}
                          onChange={(val) => setHeadData(prev => ({ ...prev, PartyName: val }))}
                          placeholder="Search supplier or party..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                          <input
                            type="text"
                            value={headData.Address}
                            onChange={(e) => setHeadData({ ...headData, Address: e.target.value })}
                            placeholder="Supplier address"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Place</label>
                          <input
                            type="text"
                            value={headData.Place}
                            onChange={(e) => setHeadData({ ...headData, Place: e.target.value })}
                            placeholder="Place / City"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Ref No</label>
                          <input
                            type="text"
                            value={headData.RefNo}
                            onChange={(e) => setHeadData({ ...headData, RefNo: e.target.value })}
                            placeholder="Reference No"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                          <input
                            type="text"
                            value={headData.Remarks}
                            onChange={(e) => setHeadData({ ...headData, Remarks: e.target.value })}
                            placeholder="Order remarks"
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Add / Edit Item Component */}
                    <div className={`p-5 border rounded-xl space-y-4 shadow-xs transition-colors ${editingItemIndex !== null ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate-200'
                      }`}>
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider text-xs border-b border-slate-100 pb-2 flex items-center justify-between">
                        <span>{editingItemIndex !== null ? `2. Edit Item #${editingItemIndex + 1}` : '2. Add Items to Order'}</span>
                        {editingItemIndex !== null && (
                          <span className="text-xs text-amber-700 font-semibold">
                            Editing item details
                          </span>
                        )}
                      </h4>

                      <div>
                        <SearchSelect
                          label="Item Name *"
                          options={itemOptions}
                          value={detailData.ItemName}
                          onChange={(val, opt) => {
                            setDetailData(prev => ({
                              ...prev,
                              ItemName: val,
                              UnitRate: opt?.UnitRate || prev.UnitRate
                            }));
                          }}
                          placeholder="Search item..."
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Qty *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={detailData.Qty}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setDetailData({ ...detailData, Qty: e.target.value })}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Unit Rate (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={detailData.UnitRate}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setDetailData({ ...detailData, UnitRate: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Discount (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={detailData.DiscountPct}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setDetailData({ ...detailData, DiscountPct: e.target.value })}
                            placeholder="0%"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Total (₹)</label>
                          <input
                            type="text"
                            readOnly
                            value={`₹${formatNumber(detailData.TotalAmount)}`}
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">GST Type</label>
                          <select
                            value={detailData.GSTType}
                            onChange={(e) => setDetailData({ ...detailData, GSTType: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="SGST+CGST">SGST + CGST</option>
                            <option value="IGST">IGST</option>
                          </select>
                        </div>

                        {detailData.GSTType === 'SGST+CGST' ? (
                          <>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">SGST %</label>
                              <input
                                type="number"
                                step="0.01"
                                value={detailData.SGSTPct}
                                onWheel={(e) => e.target.blur()}
                                onChange={(e) => setDetailData({ ...detailData, SGSTPct: e.target.value, CGSTPct: e.target.value })}
                                placeholder="9%"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">CGST %</label>
                              <input
                                type="number"
                                step="0.01"
                                value={detailData.CGSTPct}
                                onWheel={(e) => e.target.blur()}
                                onChange={(e) => setDetailData({ ...detailData, CGSTPct: e.target.value })}
                                placeholder="9%"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </>
                        ) : (
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">IGST %</label>
                            <input
                              type="number"
                              step="0.01"
                              value={detailData.IGSTPct}
                              onWheel={(e) => e.target.blur()}
                              onChange={(e) => setDetailData({ ...detailData, IGSTPct: e.target.value })}
                              placeholder="18%"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">P & F (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={detailData.PF_Amount}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setDetailData({ ...detailData, PF_Amount: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Lorry Freight (₹)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={detailData.LorryFreight}
                            onWheel={(e) => e.target.blur()}
                            onChange={(e) => setDetailData({ ...detailData, LorryFreight: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">MRS No</label>
                          <input
                            type="text"
                            value={detailData.MRS_No}
                            onChange={(e) => setDetailData({ ...detailData, MRS_No: e.target.value })}
                            placeholder="Enter MRS no"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Item Total (₹)</label>
                          <input
                            type="text"
                            readOnly
                            value={`₹${formatNumber(detailData.GrandTotal)}`}
                            className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-800"
                          />
                        </div>
                      </div>

                      {editingItemIndex !== null ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleUpdateItem}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                          >
                            <Save size={16} />
                            Update Item #{editingItemIndex + 1}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditItem}
                            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <X size={16} />
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Plus size={16} />
                          Add Item to Order
                        </button>
                      )}
                    </div>

                    {/* Section 3: Added Items Table */}
                    {items.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            3. Added Items ({items.length})
                          </h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200 bg-white text-slate-500 font-semibold uppercase text-[11px]">
                                <th className="py-2.5 px-3 w-10 text-center">#</th>
                                <th className="py-2.5 px-3">Item Name</th>
                                <th className="py-2.5 px-3 text-right">Qty</th>
                                <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                                <th className="py-2.5 px-3 text-right">Discount</th>
                                <th className="py-2.5 px-3 text-right">Tax (₹)</th>
                                <th className="py-2.5 px-3 text-right">Lorry Freight</th>
                                <th className="py-2.5 px-3">MRS No</th>
                                <th className="py-2.5 px-3 text-right font-bold">Item Total (₹)</th>
                                <th className="py-2.5 px-3 text-center">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {items.map((item, idx) => {
                                const taxSum = (parseFloat(item.SGST) || 0) + (parseFloat(item.CGST) || 0) + (parseFloat(item.IGST) || 0);
                                const isItemEditing = editingItemIndex === idx;
                                return (
                                  <tr key={idx} className={`transition-colors ${isItemEditing ? 'bg-amber-50/80 border-l-4 border-l-amber-500' : 'hover:bg-slate-50'}`}>
                                    <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.ItemName}</td>
                                    <td className="py-2.5 px-3 text-right font-medium">{item.Qty}</td>
                                    <td className="py-2.5 px-3 text-right">₹{formatCurrency(item.UnitRate)}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-500">₹{formatCurrency(item.DiscountAmt)}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-500">₹{formatCurrency(taxSum)}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-500">₹{formatCurrency(item.LorryFreight)}</td>
                                    <td className="py-2.5 px-3 text-slate-500">{item.MRS_No || '-'}</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                      ₹{formatCurrency(item.GrandTotal || item.TotalAmount)}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditItem(idx)}
                                          className={`px-2.5 py-1 text-white rounded-md transition-all shadow-xs flex items-center gap-1 font-medium text-xs cursor-pointer ${isItemEditing
                                            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                            : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                                            }`}
                                          title="Edit item details"
                                        >
                                          <Edit2 size={12} />
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveItem(idx)}
                                          className="px-2.5 py-1 bg-red-500 text-white hover:bg-red-600 rounded-md transition-all shadow-xs flex items-center gap-1 font-medium text-xs cursor-pointer shadow-red-500/20"
                                          title="Remove item"
                                        >
                                          <Trash2 size={12} />
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Section 4: Financial Summary */}
                    <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-3 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                        4. Order Summary
                      </h4>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-bold text-slate-800">₹{totals.Total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>

                      {totals.Discount > 0 && (
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Total Discount:</span>
                          <span className="font-medium text-amber-600">-₹{totals.Discount.toFixed(2)}</span>
                        </div>
                      )}

                      {(totals.GST > 0 || totals.IGST > 0) && (
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Total Tax (GST):</span>
                          <span className="font-medium text-slate-700">+₹{(totals.GST + totals.IGST).toFixed(2)}</span>
                        </div>
                      )}

                      {totals.P_F > 0 && (
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Packing & Forwarding (P&F):</span>
                          <span className="font-medium text-slate-700">+₹{totals.P_F.toFixed(2)}</span>
                        </div>
                      )}

                      {totals.LorryFreight > 0 && (
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Lorry Freight:</span>
                          <span className="font-medium text-slate-700">+₹{totals.LorryFreight.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100">
                        <span>Round Off:</span>
                        <span className="font-semibold">{formatRoundOff(totals.RoundOff)}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                        <span>Grand Total:</span>
                        <span className="text-emerald-600 text-lg">₹{totals.GrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
                    form="po-form"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isNewEntry ? 'Save Purchase Order' : 'Save Changes'}
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
