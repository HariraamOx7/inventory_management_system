// frontend/src/pages/PurchaseOrder.jsx
import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, ShoppingBag, Copy,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import Layout from '../components/Layout';
import SearchSelect from '../components/SearchSelect';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'https://krexports.org/krest';

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

const formatRate = (val) => {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

// The line total is calculated from the rate the user entered. If a default rate
// ever replaces that value in state, keep the rate consistent with the total.
const resolveLineUnitRate = ({ Qty, UnitRate, TotalAmount }) => {
  const qty = parseFloat(Qty) || 0;
  const unitRate = parseFloat(UnitRate) || 0;
  const totalAmount = parseFloat(TotalAmount) || 0;

  if (qty > 0 && totalAmount > 0 && Math.abs(totalAmount - (qty * unitRate)) > 0.005) {
    return totalAmount / qty;
  }

  return unitRate;
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
  PerQty: '1',
  UOM: '',
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

  // Add New Item (Items API) - Popup Modal States
  const [showAddItemMasterModal, setShowAddItemMasterModal] = useState(false);
  const [imDepartments, setImDepartments] = useState([]);
  const [imSubHeads, setImSubHeads] = useState([]);
  const [imUOMs, setImUOMs] = useState([]);
  const [imSaving, setImSaving] = useState(false);
  const initialImForm = {
    ItemName: '', Category: '', Commodity: '', UnitRate: '',
    MinStockLevel: '', Quantity: '', MaxStockLevel: '', OpenValue: '',
    Location: '', DepartmentId: '', SubHeadCode: '', HSNCode: '', UOM: ''
  };
  const [imFormData, setImFormData] = useState(initialImForm);

  // Form States
  const [headData, setHeadData] = useState(initialHeadState);
  const [items, setItems] = useState([]);
  const [detailData, setDetailData] = useState(initialDetailState);
  const [noRoundOff, setNoRoundOff] = useState(false);

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

  // ── Add New Item Popup Helpers (uses /api/items) ───────────────────────────
  const imFetchDepartments = useCallback(async () => {
    if (imDepartments.length > 0) return;
    try {
      const res = await axios.get(`${API_URL}/departments`);
      if (res.data.success) setImDepartments(res.data.data);
    } catch (e) { console.error(e); }
  }, [imDepartments.length]);

  const imFetchSubHeads = async (deptId) => {
    try {
      const res = await axios.get(`${API_URL}/sub-heads/by-department`, { params: { deptId } });
      if (res.data.success) setImSubHeads(res.data.data);
    } catch (e) { console.error(e); setImSubHeads([]); }
  };

  const imFetchUOMs = useCallback(async () => {
    if (imUOMs.length > 0) return;
    try {
      const res = await axios.get(`${API_URL}/uoms`);
      if (res.data.success) setImUOMs(res.data.data);
    } catch (e) { console.error(e); }
  }, [imUOMs.length]);

  const handleOpenAddItemMasterModal = async () => {
    setImFormData(initialImForm);
    setImSubHeads([]);
    await Promise.all([imFetchDepartments(), imFetchUOMs()]);
    setShowAddItemMasterModal(true);
  };

  const handleImDeptChange = (e) => {
    const deptId = e.target.value;
    setImFormData(prev => ({ ...prev, DepartmentId: deptId, SubHeadCode: '' }));
    setImSubHeads([]);
    if (deptId) imFetchSubHeads(deptId);
  };

  const handleImFieldChange = (field) => (e) => {
    setImFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleImSave = async (e) => {
    e.preventDefault();
    if (!imFormData.ItemName || !imFormData.DepartmentId || !imFormData.SubHeadCode) {
      showToast('Item Name, Department and Sub Head are required', 'error');
      return;
    }
    try {
      setImSaving(true);
      const res = await axios.post(`${API_URL}/items`, {
        ItemName: imFormData.ItemName,
        Category: imFormData.Category || null,
        Commodity: imFormData.Commodity || null,
        UnitRate: parseFloat(imFormData.UnitRate) || 0,
        MinStockLevel: parseFloat(imFormData.MinStockLevel) || 0,
        Quantity: parseFloat(imFormData.Quantity) || 0,
        OpeningQty: parseFloat(imFormData.Quantity) || 0,
        MaxStockLevel: parseFloat(imFormData.MaxStockLevel) || 0,
        OpenValue: parseFloat(imFormData.OpenValue) || 0,
        Location: imFormData.Location || null,
        DepartmentId: imFormData.DepartmentId,
        HSNCode: imFormData.HSNCode || null,
        SubHeadCode: imFormData.SubHeadCode,
        UOM: imFormData.UOM || null
      });
      // Refresh PO items list so new item appears in search
      const itemRes = await axios.get(`${API_URL}/purchase-orders/items`).catch(() => ({ data: { success: false } }));
      if (itemRes.data?.success) setItemsList(itemRes.data.data);
      // Auto-select in detail form
      setDetailData(prev => ({ ...prev, ItemName: imFormData.ItemName, UnitRate: parseFloat(imFormData.UnitRate) || prev.UnitRate }));
      showToast(`Item "${imFormData.ItemName}" added successfully`, 'success');
      setShowAddItemMasterModal(false);
    } catch (err) {
      showToast('Error saving item: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setImSaving(false);
    }
  };
  // ──────────────────────────────────────────────────────────────────────────

  // Fetch Supplier Address & Place when PartyName changes in Drawer form
  useEffect(() => {
    if (headData.PartyName) {
      const party = headData.PartyName.trim().toLowerCase();
      const supplier = suppliers.find(s =>
        (s.name && s.name.trim().toLowerCase() === party) ||
        (s.AccountName && s.AccountName.trim().toLowerCase() === party)
      );
      if (supplier) {
        setHeadData(prev => ({
          ...prev,
          Address: prev.Address || supplier.Address || supplier.address || '',
          Place: prev.Place || supplier.Place || supplier.place || ''
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

    const pfAmt = parseFloat(detailData.PF_Amount) || 0;
    const lorryFreight = parseFloat(detailData.LorryFreight) || 0;

    // Lorry freight and P&F amount are added to total amount before calculating GST
    const taxableAmount = amountAfterDiscount + pfAmt + lorryFreight;

    let sgst = 0, cgst = 0, igst = 0;
    if (detailData.GSTType === 'SGST+CGST') {
      const sgstPct = parseFloat(detailData.SGSTPct) || 0;
      const cgstPct = parseFloat(detailData.CGSTPct) || 0;
      sgst = (taxableAmount * sgstPct) / 100;
      cgst = (taxableAmount * cgstPct) / 100;
    } else {
      const igstPct = parseFloat(detailData.IGSTPct) || 0;
      igst = (taxableAmount * igstPct) / 100;
    }

    const unroundedGrandTotal = taxableAmount + sgst + cgst + igst;
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
    const roundOff = noRoundOff ? 0 : parseFloat((grandTotal - unroundedGrandTotal).toFixed(2));

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
  }, [items, noRoundOff]);

  // Drawer Handlers
  const handleOpenAddDrawer = async () => {
    setIsNewEntry(true);
    setEditingOrderNo(null);
    setEditingItemIndex(null);
    setItems([]);
    setNoRoundOff(false);
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
    setNoRoundOff(Number(order.RoundOff) === 0);
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
      Qty: parseFloat(d.Qty) > 0 ? d.Qty : '',
      PerQty: d.PerQty || '1',
      UOM: d.UOM || '',
      UnitRate: parseFloat(d.UnitRate) > 0 ? d.UnitRate : '',
      TotalAmount: d.TotalAmount || 0,
      DiscountPct: parseFloat(d.DiscountPct) > 0 ? d.DiscountPct : '',
      DiscountAmt: d.DiscountAmt || 0,
      GSTType: d.GSTType || 'SGST+CGST',
      GSTPct: d.GSTPct || (d.GSTType === 'IGST' ? (parseFloat(d.IGSTPct) || '') : ((parseFloat(d.SGSTPct) || 0) + (parseFloat(d.CGSTPct) || 0)) || ''),
      SGSTPct: parseFloat(d.SGSTPct) > 0 ? d.SGSTPct : '',
      SGST: d.SGST || 0,
      CGSTPct: parseFloat(d.CGSTPct) > 0 ? d.CGSTPct : '',
      CGST: d.CGST || 0,
      IGSTPct: parseFloat(d.IGSTPct) > 0 ? d.IGSTPct : '',
      IGST: d.IGST || 0,
      PF_Pct: parseFloat(d.PF_Pct) > 0 ? d.PF_Pct : '',
      PF_Amount: parseFloat(d.PF_Amount) > 0 ? d.PF_Amount : '',
      LorryFreight: parseFloat(d.LorryFreight) > 0 ? d.LorryFreight : '',
      GrandTotal: d.GrandTotal || 0,
      MRS_No: d.MRS_No || ''
    })));

    setDetailData(initialDetailState);
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleDuplicatePO = async (order) => {
    setIsNewEntry(true);
    setEditingOrderNo(null);
    setEditingItemIndex(null);
    setNoRoundOff(Number(order.RoundOff) === 0);

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
      OrderNo: nextNo,
      OrderDate: new Date().toISOString().split('T')[0],
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
      Qty: parseFloat(d.Qty) > 0 ? d.Qty : '',
      PerQty: d.PerQty || '1',
      UOM: d.UOM || '',
      UnitRate: parseFloat(d.UnitRate) > 0 ? d.UnitRate : '',
      TotalAmount: d.TotalAmount || 0,
      DiscountPct: parseFloat(d.DiscountPct) > 0 ? d.DiscountPct : '',
      DiscountAmt: d.DiscountAmt || 0,
      GSTType: d.GSTType || 'SGST+CGST',
      GSTPct: d.GSTPct || (d.GSTType === 'IGST' ? (parseFloat(d.IGSTPct) || '') : ((parseFloat(d.SGSTPct) || 0) + (parseFloat(d.CGSTPct) || 0)) || ''),
      SGSTPct: parseFloat(d.SGSTPct) > 0 ? d.SGSTPct : '',
      SGST: d.SGST || 0,
      CGSTPct: parseFloat(d.CGSTPct) > 0 ? d.CGSTPct : '',
      CGST: d.CGST || 0,
      IGSTPct: parseFloat(d.IGSTPct) > 0 ? d.IGSTPct : '',
      IGST: d.IGST || 0,
      PF_Pct: parseFloat(d.PF_Pct) > 0 ? d.PF_Pct : '',
      PF_Amount: parseFloat(d.PF_Amount) > 0 ? d.PF_Amount : '',
      LorryFreight: parseFloat(d.LorryFreight) > 0 ? d.LorryFreight : '',
      GrandTotal: d.GrandTotal || 0,
      MRS_No: d.MRS_No || ''
    })));

    setDetailData(initialDetailState);
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
    showToast(`PO #${order.OrderNo} details copied to new order #PO-${String(nextNo).padStart(3, '0')}`, 'info');
  };

  const handleCloseEditDrawer = () => {
    setIsDrawerVisible(false);
    setTimeout(() => {
      setEditDrawerOpen(false);
      setEditingOrderNo(null);
      setEditingItemIndex(null);
      setHeadData(initialHeadState);
      setItems([]);
      setNoRoundOff(false);
    }, 300);
  };

  // Copy previous item details
  const handleCopyPreviousItemDetails = useCallback(() => {
    if (items.length === 0) {
      showToast('No previous item available to copy details from', 'warning');
      return;
    }
    const targetItem = editingItemIndex !== null && editingItemIndex > 0
      ? items[editingItemIndex - 1]
      : items[items.length - 1];

    setDetailData(curr => ({
      ...curr,
      DiscountPct: targetItem.DiscountPct !== undefined ? targetItem.DiscountPct : '',
      GSTType: targetItem.GSTType || 'SGST+CGST',
      SGSTPct: targetItem.SGSTPct !== undefined ? targetItem.SGSTPct : '',
      CGSTPct: targetItem.CGSTPct !== undefined ? targetItem.CGSTPct : '',
      IGSTPct: targetItem.IGSTPct !== undefined ? targetItem.IGSTPct : '',
      PF_Amount: targetItem.PF_Amount !== undefined ? targetItem.PF_Amount : '',
      LorryFreight: targetItem.LorryFreight !== undefined ? targetItem.LorryFreight : '',
      MRS_No: targetItem.MRS_No || ''
    }));
    showToast('Copied previous item tax, freight & discount details', 'info');
  }, [items, editingItemIndex, showToast]);

  // Add Item to Draft
  const handleAddItem = () => {
    if (!detailData.ItemName || !detailData.Qty) {
      showToast('Item Name and Quantity are required', 'error');
      return;
    }

    const gstType = detailData.GSTType || 'SGST+CGST';
    const sgstPct = parseFloat(detailData.SGSTPct) || 0;
    const cgstPct = parseFloat(detailData.CGSTPct) || 0;
    const igstPct = parseFloat(detailData.IGSTPct) || 0;
    const totalGstPct = gstType === 'IGST' ? igstPct : (sgstPct + cgstPct);

    const newItem = {
      ...detailData,
      Qty: parseFloat(detailData.Qty) || 0,
      PerQty: detailData.PerQty || '1',
      UOM: detailData.UOM || '',
      UnitRate: resolveLineUnitRate(detailData),
      TotalAmount: parseFloat(detailData.TotalAmount) || 0,
      DiscountPct: parseFloat(detailData.DiscountPct) || 0,
      DiscountAmt: parseFloat(detailData.DiscountAmt) || 0,
      GSTType: gstType,
      GSTPct: totalGstPct,
      SGSTPct: sgstPct,
      SGST: parseFloat(detailData.SGST) || 0,
      CGSTPct: cgstPct,
      CGST: parseFloat(detailData.CGST) || 0,
      IGSTPct: igstPct,
      IGST: parseFloat(detailData.IGST) || 0,
      PF_Amount: parseFloat(detailData.PF_Amount) || 0,
      LorryFreight: parseFloat(detailData.LorryFreight) || 0,
      GrandTotal: parseFloat(detailData.GrandTotal) || 0,
      MRS_No: detailData.MRS_No || ''
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
      Qty: parseFloat(item.Qty) > 0 ? item.Qty : '',
      PerQty: item.PerQty || '1',
      UOM: item.UOM || '',
      UnitRate: parseFloat(item.UnitRate) > 0 ? item.UnitRate : '',
      TotalAmount: item.TotalAmount || 0,
      DiscountPct: parseFloat(item.DiscountPct) > 0 ? item.DiscountPct : '',
      DiscountAmt: item.DiscountAmt || 0,
      GSTType: item.GSTType || 'SGST+CGST',
      SGSTPct: parseFloat(item.SGSTPct) > 0 ? item.SGSTPct : '',
      SGST: item.SGST || 0,
      CGSTPct: parseFloat(item.CGSTPct) > 0 ? item.CGSTPct : '',
      CGST: item.CGST || 0,
      IGSTPct: parseFloat(item.IGSTPct) > 0 ? item.IGSTPct : '',
      IGST: item.IGST || 0,
      TaxType: item.TaxType || 'Excise',
      TaxPct: parseFloat(item.TaxPct) > 0 ? item.TaxPct : '',
      TaxAmount: item.TaxAmount || 0,
      PF_Pct: parseFloat(item.PF_Pct) > 0 ? item.PF_Pct : '',
      PF_Amount: parseFloat(item.PF_Amount) > 0 ? item.PF_Amount : '',
      LorryFreight: parseFloat(item.LorryFreight) > 0 ? item.LorryFreight : '',
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

    const gstType = detailData.GSTType || 'SGST+CGST';
    const sgstPct = parseFloat(detailData.SGSTPct) || 0;
    const cgstPct = parseFloat(detailData.CGSTPct) || 0;
    const igstPct = parseFloat(detailData.IGSTPct) || 0;
    const totalGstPct = gstType === 'IGST' ? igstPct : (sgstPct + cgstPct);

    const updatedItem = {
      ...detailData,
      Qty: parseFloat(detailData.Qty) || 0,
      PerQty: detailData.PerQty || '1',
      UOM: detailData.UOM || '',
      UnitRate: resolveLineUnitRate(detailData),
      TotalAmount: parseFloat(detailData.TotalAmount) || 0,
      DiscountPct: parseFloat(detailData.DiscountPct) || 0,
      DiscountAmt: parseFloat(detailData.DiscountAmt) || 0,
      GSTType: gstType,
      GSTPct: totalGstPct,
      SGSTPct: sgstPct,
      SGST: parseFloat(detailData.SGST) || 0,
      CGSTPct: cgstPct,
      CGST: parseFloat(detailData.CGST) || 0,
      IGSTPct: igstPct,
      IGST: parseFloat(detailData.IGST) || 0,
      PF_Amount: parseFloat(detailData.PF_Amount) || 0,
      LorryFreight: parseFloat(detailData.LorryFreight) || 0,
      GrandTotal: parseFloat(detailData.GrandTotal) || 0,
      MRS_No: detailData.MRS_No || ''
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
        items: items.map(item => ({
          ...item,
          UnitRate: resolveLineUnitRate(item)
        })),
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
    suppliers.map(s => {
      const name = (s.name || s.AccountName || '').trim();
      return {
        value: name,
        label: name,
        sub: s.Place ? `Place: ${s.Place}` : '',
        Address: s.Address || s.address || '',
        Place: s.Place || s.place || ''
      };
    }),
    [suppliers]
  );

  // Item Options for SearchSelect
  const itemOptions = useMemo(() =>
    itemsList.map(i => ({
      value: i.ItemName,
      label: i.ItemName,
      sub: i.UnitRate ? `Unit Rate: ₹${i.UnitRate}${i.UOM ? ' | ' + i.UOM : ''}` : (i.UOM || ''),
      UnitRate: i.UnitRate,
      UOM: i.UOM || ''
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
                  <th className="py-4 px-3 w-12 text-center"></th>
                  <th className="py-4 px-4 whitespace-nowrap">Order No</th>
                  <th className="py-4 px-4 whitespace-nowrap">Order Date</th>
                  <th className="py-4 px-4">Party Name</th>
                  <th className="py-4 px-4 whitespace-nowrap">Ref No</th>
                  <th className="py-4 px-4 text-center whitespace-nowrap">Status</th>
                  <th className="py-4 px-4 text-center whitespace-nowrap">Items</th>
                  <th className="py-4 px-4 text-right whitespace-nowrap">Grand Total (₹)</th>
                  <th className="py-4 px-4 text-right whitespace-nowrap">Actions</th>
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
                        <td className="py-4 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setExpandedOrderNo(isExpanded ? null : order.OrderNo)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse item details" : "Expand item details"}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900 whitespace-nowrap">
                          PO-{String(order.OrderNo).padStart(3, '0')}
                        </td>
                        <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {order.OrderDate ? new Date(order.OrderDate).toLocaleDateString('en-IN') : '-'}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-semibold text-slate-800">{order.PartyName}</div>
                          {order.Place && <div className="text-xs text-slate-400">{order.Place}</div>}
                        </td>
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                          {order.RefNo || '-'}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : status === 'Partial'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                            {status === 'Completed' ? 'Completed' : status === 'Partial' ? 'Partial' : 'Draft'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center font-medium text-slate-600 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setExpandedOrderNo(isExpanded ? null : order.OrderNo)}
                            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-blue-600 font-semibold text-xs transition-colors cursor-pointer border border-slate-200/60"
                            title="Click to expand item details"
                          >
                            {detailCount} items
                          </button>
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-emerald-600 text-sm whitespace-nowrap">
                          ₹{formatCurrency(order.GrandTotal)}
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleDuplicatePO(order)}
                              className="px-3.5 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 font-medium text-xs cursor-pointer"
                              title="Duplicate / Copy Purchase Order"
                            >
                              <Copy size={14} />
                              Copy
                            </button>
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
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border-0">
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
                                <td className="py-3 px-3 text-right">₹{formatRate(item.UnitRate)}</td>
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
                    const orderToCopy = viewOrderModal;
                    setViewOrderModal(null);
                    handleDuplicatePO(orderToCopy);
                  }}
                  className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-xl font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Copy as New Order"
                >
                  <Copy size={14} />
                  Copy Order
                </button>
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
        {/* Centered Modal Window for Create / Edit Purchase Order */}
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
                className={`relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden border-0 pointer-events-auto transform transition-all duration-300 ease-out ${isDrawerVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
                  }`}
              >
                {/* Modal Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md flex-shrink-0">
                  <div>
                    <h3 className="text-2xl font-bold">
                      {isNewEntry ? 'Create New Purchase Order' : `Edit Purchase Order #${headData.OrderNo}`}
                    </h3>
                    <p className="text-blue-100 text-sm mt-0.5">
                      Fill in supplier details and add items to order
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEditDrawer}
                    className="p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Modal Scrollable Body */}
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
                          onChange={(val, opt) => {
                            setHeadData(prev => ({
                              ...prev,
                              PartyName: val,
                              Address: opt?.Address !== undefined ? (opt.Address || '') : (opt?.address || prev.Address),
                              Place: opt?.Place !== undefined ? (opt.Place || '') : (opt?.place || prev.Place)
                            }));
                          }}
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
                        <div className="flex items-center gap-2">
                          {items.length > 0 && (
                            <button
                              type="button"
                              onClick={handleCopyPreviousItemDetails}
                              title="Copy tax, freight and discount from previous item"
                              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                            >
                              <Copy size={12} />
                              <span>Copy Previous</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleOpenAddItemMasterModal}
                            title="Add new item to Item Master"
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-sm cursor-pointer"
                          >
                            <Plus size={12} />
                            New Item
                          </button>
                        </div>
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
                              UnitRate: opt?.UnitRate !== undefined && opt?.UnitRate !== null && opt?.UnitRate !== '' ? opt.UnitRate : prev.UnitRate,
                              UOM: opt?.UOM || prev.UOM || ''
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
                            step="1"
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
                            step="any"
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
                            step="1"
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
                                step="1"
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
                                step="1"
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
                              step="1"
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
                            step="1"
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
                            step="1"
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
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                              3. Added Items ({items.length})
                            </h4>

                          </div>
                          {items.length > 1 && (
                            <span className="text-[11px] font-medium text-slate-500">
                              Total Items: {items.reduce((sum, it) => sum + (parseFloat(it.Qty) || 0), 0)}
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto max-w-full">
                          <table className="min-w-full text-xs text-left border-collapse whitespace-nowrap">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600 font-bold uppercase text-[10.5px] tracking-wider">
                                <th className="py-2.5 px-3 w-10 text-center">#</th>
                                <th className="py-2.5 px-3 min-w-[200px]">Item Name</th>
                                <th className="py-2.5 px-3 text-right">Qty</th>
                                <th className="py-2.5 px-3 text-center">Per Qty</th>
                                <th className="py-2.5 px-3 text-right">Unit Rate (₹)</th>
                                <th className="py-2.5 px-3 text-right">Discount</th>
                                <th className="py-2.5 px-3 text-right bg-slate-200/50">Total Amount (₹)</th>
                                <th className="py-2.5 px-3 text-center">GST Type</th>
                                <th className="py-2.5 px-3 text-right">GST %</th>
                                <th className="py-2.5 px-3 text-right">SGST %</th>
                                <th className="py-2.5 px-3 text-right">SGST (₹)</th>
                                <th className="py-2.5 px-3 text-right">CGST %</th>
                                <th className="py-2.5 px-3 text-right">CGST (₹)</th>
                                <th className="py-2.5 px-3 text-right">IGST %</th>
                                <th className="py-2.5 px-3 text-right">IGST (₹)</th>
                                <th className="py-2.5 px-3 text-right">P & F (₹)</th>
                                <th className="py-2.5 px-3 text-right">Lorry Freight (₹)</th>
                                <th className="py-2.5 px-3 text-center">MRS No</th>
                                <th className="py-2.5 px-3 text-right font-bold bg-emerald-50/60 text-emerald-800">Grand Total (₹)</th>
                                <th className="py-2.5 px-3 text-center sticky right-0 bg-slate-100 shadow-xs">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {items.map((item, idx) => {
                                const isItemEditing = editingItemIndex === idx;
                                const gstType = item.GSTType || 'SGST+CGST';
                                const totalGstPct = gstType === 'IGST'
                                  ? (parseFloat(item.IGSTPct) || 0)
                                  : ((parseFloat(item.SGSTPct) || 0) + (parseFloat(item.CGSTPct) || 0));

                                return (
                                  <tr
                                    key={idx}
                                    className={`transition-colors ${isItemEditing
                                      ? 'bg-amber-50/80 border-l-4 border-l-amber-500 font-medium'
                                      : 'hover:bg-slate-50'
                                      }`}
                                  >
                                    <td className="py-3 px-3.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                                    <td className="py-3 px-3.5 font-semibold text-slate-800">{item.ItemName}</td>
                                    <td className="py-3 px-3.5 text-right font-bold text-slate-900">{item.Qty}</td>
                                    <td className="py-3 px-3.5 text-center text-slate-500">{item.PerQty || item.UOM || '1'}</td>
                                    <td className="py-3 px-3.5 text-right font-medium">₹{formatRate(item.UnitRate)}</td>
                                    <td className="py-3 px-3.5 text-right text-slate-500">
                                      {parseFloat(item.DiscountPct) > 0
                                        ? `${item.DiscountPct}% (₹${formatCurrency(item.DiscountAmt)})`
                                        : (parseFloat(item.DiscountAmt) > 0 ? `₹${formatCurrency(item.DiscountAmt)}` : '0')}
                                    </td>
                                    <td className="py-3 px-3.5 text-right font-bold text-slate-800 bg-slate-50/60">
                                      ₹{formatCurrency(item.TotalAmount)}
                                    </td>
                                    <td className="py-3 px-3.5 text-center">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                        {gstType === 'SGST+CGST' ? 'GST [' + totalGstPct + '%]' : gstType}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3.5 text-right font-semibold text-slate-700">{totalGstPct}</td>
                                    <td className="py-3 px-3.5 text-right text-slate-600">{parseFloat(item.SGSTPct) || 0}</td>
                                    <td className="py-3 px-3.5 text-right font-medium text-slate-700">₹{formatCurrency(item.SGST)}</td>
                                    <td className="py-3 px-3.5 text-right text-slate-600">{parseFloat(item.CGSTPct) || 0}</td>
                                    <td className="py-3 px-3.5 text-right font-medium text-slate-700">₹{formatCurrency(item.CGST)}</td>
                                    <td className="py-3 px-3.5 text-right text-slate-600">{parseFloat(item.IGSTPct) || 0}</td>
                                    <td className="py-3 px-3.5 text-right font-medium text-slate-700">₹{formatCurrency(item.IGST)}</td>
                                    <td className="py-3 px-3.5 text-right text-slate-600">₹{formatCurrency(item.PF_Amount)}</td>
                                    <td className="py-3 px-3.5 text-right text-slate-600">₹{formatCurrency(item.LorryFreight)}</td>
                                    <td className="py-3 px-3.5 text-center text-slate-500">{item.MRS_No || '-'}</td>
                                    <td className="py-3 px-3.5 text-right font-bold text-emerald-700 bg-emerald-50/40">
                                      ₹{formatCurrency(item.GrandTotal || item.TotalAmount)}
                                    </td>
                                    <td className="py-3 px-3.5 text-center sticky right-0 bg-white/95 backdrop-blur-xs shadow-xs z-10">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditItem(idx)}
                                          className={`px-3 py-1.5 text-white rounded-lg transition-all shadow-sm flex items-center gap-1 font-semibold text-sm cursor-pointer ${isItemEditing
                                            ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                            : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'
                                            }`}
                                          title="Edit item details"
                                        >
                                          <Edit2 size={14} />
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveItem(idx)}
                                          className="px-3 py-1.5 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-all shadow-sm flex items-center gap-1 font-semibold text-sm cursor-pointer shadow-red-500/20"
                                          title="Remove item"
                                        >
                                          <Trash2 size={14} />
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
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                          4. Order Summary
                        </h4>
                        <button
                          type="button"
                          onClick={() => setNoRoundOff(prev => !prev)}
                          className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer border ${noRoundOff
                            ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          title={noRoundOff ? "Round off value is set to 0. Click to restore calculated round off." : "Click to set round off value to 0"}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${noRoundOff ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                          {noRoundOff ? 'Zero Round Off (Active)' : 'Zero Round Off'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Items Subtotal:</span>
                        <span className="font-bold text-slate-900 text-base">₹{totals.Total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>

                      {totals.Discount > 0 && (
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>Total Discount:</span>
                          <span className="font-semibold text-amber-600 text-base">-₹{totals.Discount.toFixed(2)}</span>
                        </div>
                      )}

                      {(totals.GST > 0 || totals.IGST > 0) && (
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>Total Tax (GST):</span>
                          <span className="font-semibold text-slate-700 text-base">+₹{(totals.GST + totals.IGST).toFixed(2)}</span>
                        </div>
                      )}

                      {totals.P_F > 0 && (
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>Packing & Forwarding (P&F):</span>
                          <span className="font-semibold text-slate-700 text-base">+₹{totals.P_F.toFixed(2)}</span>
                        </div>
                      )}

                      {totals.LorryFreight > 0 && (
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span>Lorry Freight:</span>
                          <span className="font-semibold text-slate-700 text-base">+₹{totals.LorryFreight.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm text-slate-600 pt-3 border-t border-slate-100">
                        <span>Round Off:</span>
                        <span className="font-semibold text-base">{formatRoundOff(totals.RoundOff)}</span>
                      </div>

                      <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200">
                        <span>Grand Total:</span>
                        <span className="text-emerald-600 text-xl">₹{totals.GrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                  </form>
                </div>

                {/* Drawer Footer */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 rounded-b-2xl">
                  <button
                    type="button"
                    onClick={handleCloseEditDrawer}
                    className="px-6 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="po-form"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isNewEntry ? 'Save Purchase Order' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Add New Item – Popup Modal ────────────────────────────────────── */}
        {showAddItemMasterModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border-0 overflow-hidden flex flex-col max-h-[90vh]">

              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Add New Item</h3>
                  <p className="text-slate-500 text-xs mt-0.5">Fill in the details to add a new item to the system</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddItemMasterModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Body */}
              <form onSubmit={handleImSave} className="overflow-y-auto flex-1">
                <div className="p-6 space-y-5">

                  {/* Row 1: Department + Sub Head */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">DEPARTMENT *</label>
                      <select
                        value={imFormData.DepartmentId}
                        onChange={handleImDeptChange}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
                      >
                        <option value="">Select Department</option>
                        {imDepartments.map(d => (
                          <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">SUB HEAD *</label>
                      <select
                        value={imFormData.SubHeadCode}
                        onChange={handleImFieldChange('SubHeadCode')}
                        required
                        disabled={!imFormData.DepartmentId}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 disabled:bg-slate-100 disabled:cursor-not-allowed"
                      >
                        <option value="">Select Sub Head</option>
                        {imSubHeads.map(sh => (
                          <option key={sh.code} value={sh.code}>{sh.code} - {sh.sub_group_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Item Name (full width) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Item Name *</label>
                    <input
                      type="text"
                      value={imFormData.ItemName}
                      onChange={handleImFieldChange('ItemName')}
                      placeholder="Enter item name"
                      required
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                    />
                  </div>

                  {/* Row 3: Category + Commodity */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                      <input
                        type="text"
                        value={imFormData.Category}
                        onChange={handleImFieldChange('Category')}
                        placeholder="Enter category"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Commodity</label>
                      <input
                        type="text"
                        value={imFormData.Commodity}
                        onChange={handleImFieldChange('Commodity')}
                        placeholder="Enter commodity"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Row 4: Unit Rate + Min Stock Level */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Unit Rate</label>
                      <input
                        type="number" step="1" onWheel={e => e.target.blur()}
                        value={imFormData.UnitRate}
                        onChange={handleImFieldChange('UnitRate')}
                        placeholder="0"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Min. Stock Level</label>
                      <input
                        type="number" step="1" onWheel={e => e.target.blur()}
                        value={imFormData.MinStockLevel}
                        onChange={handleImFieldChange('MinStockLevel')}
                        placeholder="0"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Row 5: Quantity + Max Stock Level */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                      <input
                        type="number" step="1" onWheel={e => e.target.blur()}
                        value={imFormData.Quantity}
                        onChange={handleImFieldChange('Quantity')}
                        placeholder="0"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Max. Stock Level</label>
                      <input
                        type="number" step="1" onWheel={e => e.target.blur()}
                        value={imFormData.MaxStockLevel}
                        onChange={handleImFieldChange('MaxStockLevel')}
                        placeholder="0"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Row 6: Opening Value + Location */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Opening Value</label>
                      <input
                        type="number" step="1" onWheel={e => e.target.blur()}
                        value={imFormData.OpenValue}
                        onChange={handleImFieldChange('OpenValue')}
                        placeholder="0"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
                      <input
                        type="text"
                        value={imFormData.Location}
                        onChange={handleImFieldChange('Location')}
                        placeholder="Enter location"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                  </div>

                  {/* Row 7: HSN Code + UOM */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">HSN Code</label>
                      <input
                        type="text"
                        value={imFormData.HSNCode}
                        onChange={handleImFieldChange('HSNCode')}
                        placeholder="Enter HSN code"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">UOM</label>
                      <select
                        value={imFormData.UOM}
                        onChange={handleImFieldChange('UOM')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
                      >
                        <option value="">Select UOM</option>
                        {imUOMs.map(u => (
                          <option key={u.id} value={u.uom}>{u.uom}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                </div>

                {/* Sticky Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3 flex-shrink-0">
                  <button
                    type="submit"
                    disabled={imSaving || !imFormData.ItemName || !imFormData.DepartmentId || !imFormData.SubHeadCode}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    {imSaving ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                    ) : (
                      <><Plus size={15} /> Add Item</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddItemMasterModal(false)}
                    className="px-6 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
