// frontend/src/pages/UOM.jsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Scale, AlertCircle, Search, ArrowUpDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function UOM() {
  const navigate = useNavigate();
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newUom, setNewUom] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editUom, setEditUom] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Search & Pagination
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchUoms = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/uoms`);
      if (response.data?.success) {
        setUoms(response.data.data);
      }
    } catch (error) {
      setError('Error fetching UOMs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUoms();
  }, []);

  const filteredUoms = useMemo(() => {
    return uoms.filter(u =>
      search.trim() === '' ||
      String(u.id).toLowerCase().includes(search.toLowerCase()) ||
      (u.uom && u.uom.toLowerCase().includes(search.toLowerCase()))
    );
  }, [uoms, search]);

  const totalItems = filteredUoms.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedUoms = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredUoms.slice(start, start + itemsPerPage);
  }, [filteredUoms, currentPage, itemsPerPage]);

  const handleAddUom = async (e) => {
    e.preventDefault();
    if (!newUom.trim()) return;

    try {
      setLoading(true);
      await axios.post(`${API_URL}/uoms`, { uom: newUom.trim() });
      setNewUom('');
      setShowAddForm(false);
      fetchUoms();
    } catch (error) {
      setError('Error adding UOM: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (uom) => {
    setEditingId(uom.id);
    setEditUom(uom.uom);
  };

  const handleUpdate = async (id) => {
    try {
      setLoading(true);
      await axios.put(`${API_URL}/uoms/${id}`, { uom: editUom.trim() });
      setEditingId(null);
      fetchUoms();
    } catch (error) {
      setError('Error updating UOM: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this UOM?')) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/uoms/${id}`);
      fetchUoms();
    } catch (error) {
      setError('Error deleting UOM: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <PageHeader
          title="Unit of Measurement (UOM)"
          subtitle="Manage inventory measurement units (e.g. Kg, Pcs, Meter)"
          icon={Scale}
          actionText="Add New UOM"
          onActionClick={() => setShowAddForm(true)}
        />

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border-l-4 border-rose-500 rounded-xl p-4 shadow-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-rose-800 text-sm">Error</h3>
              <p className="text-rose-700 text-xs mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Add UOM Card Form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800">Add New Unit of Measurement</h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Unit Name (UOM) *
                </label>
                <input
                  type="text"
                  required
                  value={newUom}
                  onChange={(e) => setNewUom(e.target.value)}
                  placeholder="Enter unit of measurement (e.g., Kg, Liter, Pcs)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Save UOM
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter Panel */}
        <FilterPanel
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by unit name or ID..."
          filters={[
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

        {/* UOMs List Card (Item Master Design) */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">All Units of Measurement</h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
              Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedUoms.map((uom) => (
              <div
                key={uom.id}
                className="p-6 hover:bg-slate-50 transition-colors duration-200"
              >
                {editingId === uom.id ? (
                  /* Edit Mode */
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={editUom}
                      onChange={(e) => setEditUom(e.target.value)}
                      className="flex-1 px-4 py-2 border-2 border-blue-400 rounded-xl text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleUpdate(uom.id)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Changes
                    </button>
                  </div>
                ) : (
                  /* View Mode Card */
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-slate-800 text-lg">
                          {uom.uom}
                        </h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          ID: {uom.id}
                        </span>
                      </div>
                    </div>

                    {/* Royal Blue Edit & Bright Red Delete Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(uom)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(uom.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {paginatedUoms.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scale className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No UOMs found</h3>
                <p className="text-slate-500">Try adjusting your search query or add a new unit</p>
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

        {/* Content-Scoped Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-30 rounded-2xl min-h-[300px]">
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