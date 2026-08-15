// frontend/src/pages/GateInward.jsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Truck, ArrowUpDown, Package2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Inbox
} from 'lucide-react';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const initialFormState = {
  InwardNo: '',
  OrderNo: '',
  PartyName: '',
  InwardDate: new Date().toISOString().split('T')[0],
  InvoiceNo: '',
  InvoiceDate: new Date().toISOString().split('T')[0]
};

const formatDateForInput = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const hasInvalidReceivedQty = (items = []) =>
  items.some((item) => {
    const pendingQty = parseFloat(item.PendingQty) || 0;
    const receivedQty = parseFloat(item.ReceivedQty) || 0;
    return receivedQty < 0 || receivedQty > pendingQty;
  });

export default function GateInward() {
  const showToast = useToastStore(state => state.showToast);

  const [formData, setFormData] = useState(initialFormState);
  const [parties, setParties] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gateInwards, setGateInwards] = useState([]);
  const [editingInwardNo, setEditingInwardNo] = useState(null);
  const [invoiceDuplicateWarning, setInvoiceDuplicateWarning] = useState(null);

  // Slide-over Drawer states (Matching Item Master style)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(false);

  // Filters & Sorting state
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch initial data on mount
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [inwardRes, partiesRes, inwardsRes] = await Promise.all([
        axios.get(`${API_URL}/gate-inwards/last-inward-no`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/gate-inwards/get-parties`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/gate-inwards`).catch(() => ({ data: { success: false } }))
      ]);

      if (inwardRes.data?.success) {
        setFormData(prev => ({
          ...prev,
          InwardNo: (inwardRes.data.data.lastInwardNo + 1).toString()
        }));
      }

      if (partiesRes.data?.success) {
        setParties(partiesRes.data.data);
      }

      if (inwardsRes.data?.success) {
        setGateInwards(inwardsRes.data.data);
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

  // Fetch purchase orders when party is selected in form
  useEffect(() => {
    if (formData.PartyName && !editingInwardNo) {
      const fetchPartyPOs = async () => {
        try {
          const response = await axios.get(`${API_URL}/gate-inwards/purchase-orders-by-party`, {
            params: { partyName: formData.PartyName }
          });

          if (response.data?.success) {
            setPurchaseOrders(response.data.data || []);
          }
        } catch (error) {
          console.error('Error fetching party purchase orders:', error);
        }
      };

      fetchPartyPOs();
    } else if (!editingInwardNo) {
      setPurchaseOrders([]);
      setItems([]);
    }
  }, [formData.PartyName, editingInwardNo]);

  // Fetch items when orderNo is selected
  useEffect(() => {
    if (formData.OrderNo && !editingInwardNo) {
      const fetchOrderItems = async () => {
        try {
          const response = await axios.get(`${API_URL}/gate-inwards/items-by-order`, {
            params: { orderNo: formData.OrderNo }
          });

          if (response.data?.success) {
            const itemsWithReceivedQty = (response.data.data || []).map(item => ({
              ItemName: item.ItemName,
              OrderNo: item.OrderNo || formData.OrderNo,
              PendingQty: item.Qty,
              ReceivedQty: ''
            }));
            setItems(itemsWithReceivedQty);
          }
        } catch (error) {
          console.error('Error fetching order items:', error);
        }
      };

      fetchOrderItems();
    } else if (!editingInwardNo) {
      setItems([]);
    }
  }, [formData.OrderNo, editingInwardNo]);

  // Filtered and Sorted list
  const filteredAndSortedInwards = useMemo(() => {
    return gateInwards
      .filter(inward => {
        const matchSearch = search.trim() === '' ||
          String(inward.InwardNo).toLowerCase().includes(search.toLowerCase()) ||
          (inward.PartyName && inward.PartyName.toLowerCase().includes(search.toLowerCase())) ||
          (inward.InvoiceNo && inward.InvoiceNo.toLowerCase().includes(search.toLowerCase()));
        const matchParty = partyFilter === 'ALL' || (inward.PartyName || '').trim() === partyFilter.trim();
        return matchSearch && matchParty;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.InwardDate || b.createdAt) - new Date(a.InwardDate || a.createdAt);
        }
        if (sortBy === 'oldest') {
          return new Date(a.InwardDate || a.createdAt) - new Date(b.InwardDate || b.createdAt);
        }
        if (sortBy === 'inward_desc') {
          return Number(b.InwardNo) - Number(a.InwardNo);
        }
        if (sortBy === 'inward_asc') {
          return Number(a.InwardNo) - Number(b.InwardNo);
        }
        return 0;
      });
  }, [gateInwards, search, partyFilter, sortBy]);

  // Pagination calculations
  const totalItems = filteredAndSortedInwards.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedInwards = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedInwards.slice(start, start + itemsPerPage);
  }, [filteredAndSortedInwards, currentPage, itemsPerPage]);

  const handleOpenAddDrawer = () => {
    setIsNewEntry(true);
    setEditingInwardNo(null);
    setFormData(initialFormState);
    setItems([]);
    fetchInitialData();
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleOpenEditDrawer = (inward) => {
    setIsNewEntry(false);
    setEditingInwardNo(inward.InwardNo);
    const orderNo = inward.OrderNo || (inward.details && inward.details[0]?.OrderNo) || '';
    setFormData({
      InwardNo: inward.InwardNo,
      OrderNo: orderNo,
      PartyName: inward.PartyName || '',
      InwardDate: formatDateForInput(inward.InwardDate) || new Date().toISOString().split('T')[0],
      InvoiceNo: inward.InvoiceNo || '',
      InvoiceDate: formatDateForInput(inward.InvoiceDate)
    });

    if (inward.details) {
      setItems(inward.details.map(d => ({
        ItemName: d.ItemName,
        OrderNo: d.OrderNo || orderNo,
        PendingQty: d.PendingQty || 0,
        ReceivedQty: d.ReceivedQty || 0
      })));
    } else {
      setItems([]);
    }

    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 10);
  };

  const handleCloseEditDrawer = () => {
    setIsDrawerVisible(false);
    setTimeout(() => {
      setEditDrawerOpen(false);
      setEditingInwardNo(null);
      setFormData(initialFormState);
      setPurchaseOrders([]);
      setItems([]);
      setInvoiceDuplicateWarning(null);
    }, 300);
  };

  const handleDelete = async (inwardNo) => {
    if (!window.confirm(`Are you sure you want to delete Gate Inward #${inwardNo}?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/gate-inwards/${inwardNo}`);
      showToast('Gate Inward deleted successfully!', 'success');
      fetchInitialData();
    } catch (error) {
      console.error('Error deleting gate inward:', error);
      showToast(error.response?.data?.message || 'Error deleting gate inward', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper: run layered deletion confirmation for a duplicate gate inward chain
  const handleDuplicateGateInwardCleanup = async (duplicate) => {
    const { InwardNo: dupInwardNo, PartyName: dupParty, InvoiceNo: dupInvoice, OrderNo, hasPurchaseOrder } = duplicate;

    // Layer 1: Confirm GateInward deletion
    const confirmGI = window.confirm(
      `⚠️ DUPLICATE GATE INWARD FOUND\n\n` +
      `Party: ${dupParty}\nInvoice No: ${dupInvoice}\nInward No: GI-${String(dupInwardNo).padStart(3, '0')}\n\n` +
      `Do you want to DELETE this duplicate Gate Inward (#${dupInwardNo}) to proceed?`
    );
    if (!confirmGI) {
      showToast('Save cancelled — duplicate Gate Inward was not removed.', 'warning');
      return false;
    }

    const layers = { gateInward: true, purchaseOrder: false };

    // Layer 2: Confirm PurchaseOrder deletion
    if (hasPurchaseOrder && OrderNo) {
      layers.purchaseOrder = window.confirm(
        `Also DELETE the linked Purchase Order (#${OrderNo}) and its item details?\n\n(Will be skipped if another Gate Inward references the same PO.)`
      );
    }

    // Execute cascade delete
    try {
      await axios.delete(`${API_URL}/gate-inwards/delete-inward-chain/${dupInwardNo}`, { data: { layers } });
      showToast(`Duplicate Gate Inward #${dupInwardNo} and selected linked records removed.`, 'success');
      setInvoiceDuplicateWarning(null);
      return true;
    } catch (deleteErr) {
      console.error('Error deleting duplicate gate inward chain:', deleteErr);
      showToast(deleteErr.response?.data?.message || 'Failed to delete duplicate records.', 'error');
      return false;
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.PartyName) {
      showToast('Please select a Party Name', 'error');
      return;
    }

    if (!formData.OrderNo) {
      showToast('Please select a Purchase Order', 'error');
      return;
    }

    if (!items || items.length === 0) {
      showToast('No items available for selected purchase order', 'error');
      return;
    }

    const hasReceivedQty = items.some(item => (parseFloat(item.ReceivedQty) || 0) > 0);
    if (!hasReceivedQty) {
      showToast('Please enter received quantity for at least one item', 'error');
      return;
    }

    if (hasInvalidReceivedQty(items)) {
      showToast('Received quantity should be less than or equal to pending qty', 'warning');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        items: items.map(item => ({
          ...item,
          OrderNo: item.OrderNo || formData.OrderNo
        }))
      };

      if (editingInwardNo) {
        try {
          await axios.put(`${API_URL}/gate-inwards/${editingInwardNo}`, payload);
          showToast('Gate Inward updated successfully!', 'success');
          handleCloseEditDrawer();
          fetchInitialData();
        } catch (updateErr) {
          if (updateErr.response?.status === 409) {
            showToast(updateErr.response?.data?.message || 'Duplicate invoice number detected.', 'error');
          } else {
            throw updateErr;
          }
        }
      } else {
        try {
          await axios.post(`${API_URL}/gate-inwards`, payload);
          showToast('Gate Inward entry saved successfully!', 'success');
          handleCloseEditDrawer();
          fetchInitialData();
        } catch (createErr) {
          if (createErr.response?.status === 409 && createErr.response?.data?.duplicate) {
            setLoading(false);
            const cleaned = await handleDuplicateGateInwardCleanup(createErr.response.data.duplicate);
            if (cleaned) {
              setLoading(true);
              await axios.post(`${API_URL}/gate-inwards`, payload);
              showToast('Gate Inward entry saved successfully!', 'success');
              handleCloseEditDrawer();
              fetchInitialData();
            }
            return;
          }
          throw createErr;
        }
      }
    } catch (error) {
      console.error('Error saving gate inward:', error);
      showToast(error.response?.data?.message || 'Error saving gate inward entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <PageHeader
          title="Gate Inward"
          subtitle="To Add, Modify gate inward details"
          icon={Truck}
          actionText="Add New Gate Inward"
          onActionClick={handleOpenAddDrawer}
        />

        {/* Search & Filters Card (Item Master Style) */}
        <FilterPanel
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by inward no, party name..."
          filters={[
            {
              label: "Party Name",
              icon: Truck,
              value: partyFilter,
              onChange: (val) => {
                setPartyFilter(val);
                setCurrentPage(1);
              },
              options: [
                { value: 'ALL', label: 'All Parties' },
                ...[...new Set(gateInwards.map(g => g.PartyName).filter(Boolean))].sort()
                  .map(name => ({ value: name, label: name }))
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
                { value: 'inward_desc', label: 'Inward No: High to Low' },
                { value: 'inward_asc', label: 'Inward No: Low to High' }
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

        {/* Gate Inwards List Card (Item Master Row Cards Layout & Colors) */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">All Gate Inwards</h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
              Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedInwards.map((inward) => (
              <div
                key={inward.InwardNo}
                className="p-6 hover:bg-slate-50 transition-colors duration-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-800 text-lg">
                          {inward.PartyName}
                        </h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          GI-{String(inward.InwardNo).padStart(3, '0')}
                        </span>
                        {inward.OrderNo && (
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold rounded-full">
                            PO-{inward.OrderNo}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                        <div>
                          <span className="text-slate-500">Inward Date:</span>{' '}
                          <span className="text-slate-700 font-medium">
                            {new Date(inward.InwardDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        {inward.InvoiceNo && (
                          <div>
                            <span className="text-slate-500">Invoice No:</span>{' '}
                            <span className="text-slate-700 font-medium">{inward.InvoiceNo}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500">Purchase Order:</span>{' '}
                          <span className="text-slate-700 font-medium">{inward.OrderNo ? `PO-${inward.OrderNo}` : '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Items:</span>{' '}
                          <span className="text-slate-700 font-medium">{inward.details?.length || 0} items</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons (Matching Item Master Exact Royal Blue & Red colors and sizes) */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDrawer(inward)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(inward.InwardNo)}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {paginatedInwards.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Truck className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Gate Inwards found</h3>
                <p className="text-slate-500">Try adjusting your search query or add a new entry</p>
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
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {isNewEntry ? 'Add New Gate Inward' : 'Edit Gate Inward'}
                      </h2>
                      <p className="text-xs text-blue-100">
                        Inward No: GI-{String(formData.InwardNo).padStart(3, '0')}
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
                  <form id="gate-inward-form" onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Inward No</label>
                        <input
                          type="text"
                          value={`GI-${String(formData.InwardNo).padStart(3, '0')}`}
                          disabled
                          className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Inward Date</label>
                        <input
                          type="date"
                          value={formData.InwardDate}
                          onChange={(e) => setFormData({ ...formData, InwardDate: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        {!isNewEntry ? (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Party Name</label>
                            <input
                              type="text"
                              value={formData.PartyName}
                              disabled
                              className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
                            />
                          </div>
                        ) : (
                          <CustomSelect
                            label="Party Name *"
                            searchable
                            options={parties.map(p => ({ value: p.name, label: p.name }))}
                            value={formData.PartyName}
                            onChange={(val) => {
                              setFormData(prev => ({ ...prev, PartyName: val, OrderNo: '' }));
                              setItems([]);
                            }}
                            placeholder="Select party name"
                            searchPlaceholder="Search party by name..."
                          />
                        )}
                      </div>

                      <div>
                        {!isNewEntry ? (
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Purchase Order No</label>
                            <input
                              type="text"
                              value={formData.OrderNo ? `PO-${formData.OrderNo}` : '-'}
                              disabled
                              className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
                            />
                          </div>
                        ) : (
                          <CustomSelect
                            label="Purchase Order No *"
                            searchable
                            options={purchaseOrders.map(po => ({
                              value: po.OrderNo,
                              label: `PO-${po.OrderNo} (${po.OrderDate ? new Date(po.OrderDate).toLocaleDateString('en-GB') : ''}) - ₹${parseFloat(po.GrandTotal || 0).toLocaleString('en-IN')}`,
                              name: `PO-${po.OrderNo}`
                            }))}
                            value={formData.OrderNo}
                            onChange={(val) => setFormData(prev => ({ ...prev, OrderNo: val }))}
                            placeholder={formData.PartyName ? (purchaseOrders.length > 0 ? "Select purchase order" : "No pending POs found") : "Select party name first"}
                            searchPlaceholder="Search purchase order..."
                            disabled={!formData.PartyName}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Invoice No</label>
                        <input
                          type="text"
                          value={formData.InvoiceNo}
                          onChange={(e) => {
                            setFormData({ ...formData, InvoiceNo: e.target.value });
                            setInvoiceDuplicateWarning(null);
                          }}
                          onBlur={async (e) => {
                            const invoiceVal = e.target.value.trim();
                            const partyVal = formData.PartyName;
                            if (!invoiceVal || !partyVal) return;
                            try {
                              const params = { partyName: partyVal, invoiceNo: invoiceVal };
                              if (editingInwardNo) params.excludeInwardNo = editingInwardNo;
                              const res = await axios.get(`${API_URL}/gate-inwards/check-duplicate-invoice`, { params });
                              if (res.data?.duplicate) {
                                setInvoiceDuplicateWarning(res.data.duplicate);
                              } else {
                                setInvoiceDuplicateWarning(null);
                              }
                            } catch {/* silent */ }
                          }}
                          placeholder="Enter Invoice No"
                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${invoiceDuplicateWarning ? 'border-amber-400 bg-amber-50' : 'border-slate-300'
                            }`}
                        />
                        {invoiceDuplicateWarning && (
                          <p className="mt-1 text-xs text-amber-600 font-medium">
                            ⚠️ Invoice already used in Gate Inward #GI-{String(invoiceDuplicateWarning.InwardNo).padStart(3, '0')}{' '}
                            ({new Date(invoiceDuplicateWarning.InwardDate).toLocaleDateString('en-GB')})
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Date</label>
                        <input
                          type="date"
                          value={formData.InvoiceDate}
                          onChange={(e) => setFormData({ ...formData, InvoiceDate: e.target.value })}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Items Section Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-6 shadow-sm">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h4 className="text-base font-bold text-slate-800">Received Items ({items.length})</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase text-xs tracking-wider">
                              <th className="py-3.5 px-4">Item Name</th>
                              <th className="py-3.5 px-4">Order No</th>
                              <th className="py-3.5 px-4 text-right">Pending Qty</th>
                              <th className="py-3.5 px-4 text-right w-44">Received Qty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {items.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="py-8 text-center text-slate-400 text-sm">
                                  No items found for selected party
                                </td>
                              </tr>
                            ) : (
                              items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-3.5 px-4 font-semibold text-slate-800 text-base">{item.ItemName}</td>
                                  <td className="py-3.5 px-4 text-slate-600 font-medium text-sm">{item.OrderNo}</td>
                                  <td className="py-3.5 px-4 text-right font-semibold text-slate-700 text-sm">{item.PendingQty}</td>
                                  <td className="py-3.5 px-4 text-right">
                                    <input
                                      type="number"
                                      step="any" value={item.ReceivedQty}
                                      onWheel={(e) => e.target.blur()}
                                      onChange={(e) => {
                                        const enteredValue = e.target.value;
                                        const pendingQty = parseFloat(item.PendingQty) || 0;
                                        const parsedValue = enteredValue === '' ? '' : parseFloat(enteredValue);

                                        const updated = [...items];
                                        if (enteredValue === '') {
                                          updated[idx].ReceivedQty = '';
                                        } else if (Number.isNaN(parsedValue) || parsedValue < 0) {
                                          updated[idx].ReceivedQty = '';
                                        } else if (parsedValue > pendingQty) {
                                          updated[idx].ReceivedQty = pendingQty;
                                          showToast(`Received quantity for ${item.ItemName} cannot exceed pending qty`, 'warning');
                                        } else {
                                          updated[idx].ReceivedQty = parsedValue;
                                        }

                                        setItems(updated);
                                      }}
                                      max={item.PendingQty}
                                      min="0"
                                      className="w-36 px-3 py-2 border-2 border-blue-400 rounded-lg text-right font-bold text-blue-600 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                                    />
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
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
                    form="gate-inward-form"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {isNewEntry ? 'Save Entry' : 'Save Changes'}
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
