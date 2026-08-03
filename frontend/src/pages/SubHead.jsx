// frontend/src/pages/SubHead.jsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Save, X, Layers, AlertCircle, Search, ArrowUpDown,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';
import CustomSelect from '../components/CustomSelect';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function SubHead() {
  const navigate = useNavigate();
  const [subHeads, setSubHeads] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newSubHead, setNewSubHead] = useState({
    code: '',
    sub_group_name: '',
    department_id: ''
  });
  const [editingCode, setEditingCode] = useState(null);
  const [editData, setEditData] = useState({
    code: '',
    sub_group_name: '',
    department_id: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Search, Filter & Pagination
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${API_URL}/departments`);
      if (response.data?.success) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchSubHeads = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/sub-heads?sort=code&order=ASC`);
      if (response.data?.success) {
        const sorted = response.data.data.sort((a, b) => parseInt(a.code) - parseInt(b.code));
        setSubHeads(sorted);
      }
    } catch (error) {
      setError('Error fetching sub heads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getLastCode = async () => {
    try {
      const response = await axios.get(`${API_URL}/sub-heads/last-code`);
      if (response.data?.success) {
        const nextCode = (parseInt(response.data.data.lastCode) + 1).toString();
        setNewSubHead(prev => ({ ...prev, code: nextCode }));
      }
    } catch (error) {
      console.error('Error fetching last code:', error);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchSubHeads();
    getLastCode();
  }, []);

  const filteredSubHeads = useMemo(() => {
    return subHeads.filter(sh => {
      const matchesSearch = search.trim() === '' ||
        String(sh.code).toLowerCase().includes(search.toLowerCase()) ||
        (sh.sub_group_name && sh.sub_group_name.toLowerCase().includes(search.toLowerCase()));

      const matchesDept = departmentFilter === 'ALL' || String(sh.department_id) === String(departmentFilter);

      return matchesSearch && matchesDept;
    });
  }, [subHeads, search, departmentFilter]);

  const totalItems = filteredSubHeads.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedSubHeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSubHeads.slice(start, start + itemsPerPage);
  }, [filteredSubHeads, currentPage, itemsPerPage]);

  const handleAddSubHead = async (e) => {
    e.preventDefault();
    if (!newSubHead.sub_group_name.trim() || !newSubHead.department_id) {
      setError('Please fill in both Sub Head Name and Department.');
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_URL}/sub-heads`, {
        sub_group_name: newSubHead.sub_group_name.trim(),
        department_id: newSubHead.department_id
      });
      setNewSubHead({ code: '', sub_group_name: '', department_id: '' });
      setShowAddForm(false);
      fetchSubHeads();
      getLastCode();
    } catch (error) {
      setError('Error adding sub head: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (subHead) => {
    setEditingCode(subHead.code);
    setEditData({
      code: subHead.code,
      sub_group_name: subHead.sub_group_name,
      department_id: subHead.department_id
    });
  };

  const handleUpdate = async (code) => {
    try {
      setLoading(true);
      await axios.put(`${API_URL}/sub-heads/${code}`, {
        sub_group_name: editData.sub_group_name.trim(),
        department_id: editData.department_id
      });
      setEditingCode(null);
      fetchSubHeads();
    } catch (error) {
      setError('Error updating sub head: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (code) => {
    if (!window.confirm('Are you sure you want to delete this sub head?')) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/sub-heads/${code}`);
      fetchSubHeads();
      getLastCode();
    } catch (error) {
      setError('Error deleting sub head: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => String(d.dept_id) === String(deptId));
    return dept ? dept.dept_name : 'N/A';
  };

  return (
    <Layout>
      <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <PageHeader
          title="Sub Head Master"
          subtitle="Manage sub-group categories and assign them to departments"
          icon={Layers}
          actionText="Add New Sub Head"
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

        {/* Add Form Card */}
        {showAddForm && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800">Add New Sub Head</h2>
              <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSubHead} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Sub Head Code
                  </label>
                  <input
                    type="text"
                    value={newSubHead.code}
                    disabled
                    placeholder="Auto generated"
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Sub Head Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSubHead.sub_group_name}
                    onChange={(e) => setNewSubHead({ ...newSubHead, sub_group_name: e.target.value })}
                    placeholder="Enter sub head name"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <CustomSelect
                    label="Department *"
                    value={newSubHead.department_id}
                    onChange={(val) => setNewSubHead({ ...newSubHead, department_id: val })}
                    options={[
                      { value: '', label: 'Select Department' },
                      ...departments.map(d => ({ value: d.dept_id, label: d.dept_name }))
                    ]}
                  />
                </div>
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
                  Save Sub Head
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
          searchPlaceholder="Search by sub head name or code..."
          filters={[
            {
              label: "Department",
              value: departmentFilter,
              onChange: (val) => {
                setDepartmentFilter(val);
                setCurrentPage(1);
              },
              options: [
                { value: 'ALL', label: 'All Departments' },
                ...departments.map(d => ({ value: d.dept_id, label: d.dept_name }))
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

        {/* List Card (Item Master Design) */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-700">All Sub Heads</h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
              Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedSubHeads.map((sh) => (
              <div
                key={sh.code}
                className="p-6 hover:bg-slate-50 transition-colors duration-200"
              >
                {editingCode === sh.code ? (
                  /* Edit Mode */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Code</label>
                        <input
                          type="text"
                          value={editData.code}
                          disabled
                          className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Sub Head Name</label>
                        <input
                          type="text"
                          value={editData.sub_group_name}
                          onChange={(e) => setEditData({ ...editData, sub_group_name: e.target.value })}
                          className="w-full px-3 py-2 border border-blue-400 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <CustomSelect
                          label="Department"
                          value={editData.department_id}
                          onChange={(val) => setEditData({ ...editData, department_id: val })}
                          options={departments.map(d => ({ value: d.dept_id, label: d.dept_name }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingCode(null)}
                        className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdate(sh.code)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View Mode Card */
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-slate-800 text-lg">
                          {sh.sub_group_name}
                        </h3>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          Code: {sh.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Department: <span className="font-semibold text-slate-700">{getDepartmentName(sh.department_id)}</span>
                      </p>
                    </div>

                    {/* Royal Blue Edit & Bright Red Delete Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(sh)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(sh.code)}
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

            {paginatedSubHeads.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No sub heads found</h3>
                <p className="text-slate-500">Try adjusting your search or department filter</p>
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