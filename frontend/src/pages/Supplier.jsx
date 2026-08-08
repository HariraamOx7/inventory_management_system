import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Plus, Edit2, Trash2, Save, X, Truck, AlertCircle, ArrowLeft,
    Search, Filter, RotateCcw, ChevronLeft, ChevronRight,
    ChevronsLeft, ChevronsRight, SlidersHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomSelect from '../components/CustomSelect';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const initialFormState = {
    Description: '',
    AccountName: '',
    Place: '',
    Address: '',
    DeliveryAddress: '',
    OpeningCredit: 0,
    OpeningDebit: 0,
    TINNo: '',
    CSTNo: '',
    PhNo: '',
    Fax: '',
    CellNo: '',
    Email: '',
    WebSite: '',
    AccountNo: '',
    ContactPerson: '',
    Pincode: '',
    PanNumber: '',
    Department: '',
    GSTNo: ''
};

export default function Supplier() {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editDrawerOpen, setEditDrawerOpen] = useState(false);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [editFormData, setEditFormData] = useState(initialFormState);
    const [nextCode, setNextCode] = useState('');

    // Search, Filter & Pagination states
    const [search, setSearch] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('ALL');
    const [placeFilter, setPlaceFilter] = useState('ALL');
    const [gstFilter, setGstFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1, limit: 10 });
    const [uniquePlaces, setUniquePlaces] = useState([]);
    const [uniqueDepartments, setUniqueDepartments] = useState(['SALES', 'OTHERS']);

    // Prevent background scrolling when edit window is open
    useEffect(() => {
        if (editDrawerOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [editDrawerOpen]);

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const params = {
                page: currentPage,
                limit: itemsPerPage
            };
            if (search.trim()) params.search = search.trim();
            if (departmentFilter !== 'ALL') params.department = departmentFilter;
            if (placeFilter !== 'ALL') params.place = placeFilter;
            if (gstFilter !== 'ALL') params.gstStatus = gstFilter;

            const response = await axios.get(`${API_URL}/suppliers`, { params });
            if (response.data.success) {
                setSuppliers(response.data.data);
                if (response.data.pagination) {
                    setPagination(response.data.pagination);
                }
            }
        } catch (error) {
            setError('Error fetching suppliers: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchFilterMetadata = async () => {
        try {
            const response = await axios.get(`${API_URL}/suppliers`);
            if (response.data.success && Array.isArray(response.data.data)) {
                const places = Array.from(new Set(response.data.data.map(s => s.Place).filter(Boolean))).sort();
                const depts = Array.from(new Set(['SALES', 'OTHERS', ...response.data.data.map(s => s.Department).filter(Boolean)])).sort();
                setUniquePlaces(places);
                setUniqueDepartments(depts);
            }
        } catch (err) {
            console.error('Error fetching filter metadata:', err);
        }
    };

    const getLastCode = async () => {
        try {
            const response = await axios.get(`${API_URL}/suppliers/last-code`);
            if (response.data.success) {
                const nextNum = (parseInt(response.data.data.lastCode || 0) + 1).toString();
                setNextCode(nextNum);
            }
        } catch (error) {
            console.error('Error fetching last code:', error);
        }
    };

    useEffect(() => {
        fetchFilterMetadata();
        getLastCode();
    }, []);

    useEffect(() => {
        fetchSuppliers();
    }, [currentPage, itemsPerPage, search, departmentFilter, placeFilter, gstFilter]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleDepartmentChange = (e) => {
        setDepartmentFilter(e.target.value);
        setCurrentPage(1);
    };

    const handlePlaceChange = (e) => {
        setPlaceFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleGstChange = (e) => {
        setGstFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleLimitChange = (e) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setSearch('');
        setDepartmentFilter('ALL');
        setPlaceFilter('ALL');
        setGstFilter('ALL');
        setCurrentPage(1);
    };

    const handleAddSupplier = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await axios.post(`${API_URL}/suppliers`, formData);
            setFormData(initialFormState);
            setShowAddForm(false);
            fetchSuppliers();
            fetchFilterMetadata();
            getLastCode();
        } catch (error) {
            setError('Error adding supplier: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (supplier) => {
        setEditingId(supplier.AccCode);
        setEditFormData({ ...supplier });
        setEditDrawerOpen(true);
        setTimeout(() => {
            setIsDrawerVisible(true);
        }, 10);
    };

    const handleCloseEditDrawer = () => {
        setIsDrawerVisible(false);
        setTimeout(() => {
            setEditDrawerOpen(false);
            setEditingId(null);
        }, 300);
    };

    const handleUpdate = async (accCode) => {
        try {
            setLoading(true);
            await axios.put(`${API_URL}/suppliers/${accCode}`, editFormData);
            handleCloseEditDrawer();
            fetchSuppliers();
            fetchFilterMetadata();
        } catch (error) {
            setError('Error updating supplier: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (accCode) => {
        if (!window.confirm('Are you sure you want to delete this supplier?')) return;

        try {
            setLoading(true);
            await axios.delete(`${API_URL}/suppliers/${accCode}`);
            fetchSuppliers();
            fetchFilterMetadata();
            getLastCode();
        } catch (error) {
            setError('Error deleting supplier: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e, isEdit = false) => {
        const { name, value } = e.target;
        if (isEdit) {
            setEditFormData(prev => ({ ...prev, [name]: value }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const activeFiltersCount = (search.trim() ? 1 : 0) +
        (departmentFilter !== 'ALL' ? 1 : 0) +
        (placeFilter !== 'ALL' ? 1 : 0) +
        (gstFilter !== 'ALL' ? 1 : 0);

    const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

    const getPageNumbers = () => {
        const totalPages = pagination.totalPages || 1;
        const current = pagination.page || 1;
        const pages = [];

        let startPage = Math.max(1, current - 2);
        let endPage = Math.min(totalPages, current + 2);

        if (endPage - startPage < 4) {
            if (startPage === 1) {
                endPage = Math.min(totalPages, startPage + 4);
            } else if (endPage === totalPages) {
                startPage = Math.max(1, endPage - 4);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    const renderFormFields = (data, isEdit = false) => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Account Name</label>
                    <input
                        type="text"
                        name="AccountName"
                        value={data.AccountName || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter account name"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                    <input
                        type="text"
                        name="Description"
                        value={data.Description || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter description"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Place</label>
                    <input
                        type="text"
                        name="Place"
                        value={data.Place || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter place"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Ph. No.</label>
                    <input
                        type="text"
                        name="PhNo"
                        value={data.PhNo || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter phone number"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">CST No.</label>
                    <input
                        type="text"
                        name="CSTNo"
                        value={data.CSTNo || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter CST No."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">TIN No.</label>
                    <input
                        type="text"
                        name="TINNo"
                        value={data.TINNo || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter TIN No."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input
                        type="email"
                        name="Email"
                        value={data.Email || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter email"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Fax</label>
                    <input
                        type="text"
                        name="Fax"
                        value={data.Fax || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter fax"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <textarea
                    name="Address"
                    value={data.Address || ''}
                    onChange={(e) => handleInputChange(e, isEdit)}
                    placeholder="Enter address"
                    rows="3"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Address</label>
                <textarea
                    name="DeliveryAddress"
                    value={data.DeliveryAddress || ''}
                    onChange={(e) => handleInputChange(e, isEdit)}
                    placeholder="Enter delivery address"
                    rows="3"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Opening Credit</label>
                    <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="OpeningCredit"
                        value={data.OpeningCredit ?? 0}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter opening credit"
                        step="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Opening Debit</label>
                    <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="OpeningDebit"
                        value={data.OpeningDebit ?? 0}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter opening debit"
                        step="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Account No.</label>
                    <input
                        type="text"
                        name="AccountNo"
                        value={data.AccountNo || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter account number"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">PAN Number</label>
                    <input
                        type="text"
                        name="PanNumber"
                        value={data.PanNumber || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter PAN number"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Department</label>
                    <select
                        name="Department"
                        value={data.Department || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="">Select Department</option>
                        <option value="SALES">SALES</option>
                        <option value="OTHERS">OTHERS</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">GST No.</label>
                    <input
                        type="text"
                        name="GSTNo"
                        value={data.GSTNo || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter GST No."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Contact Person</label>
                    <input
                        type="text"
                        name="ContactPerson"
                        value={data.ContactPerson || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter contact person"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Pincode</label>
                    <input
                        type="text"
                        name="Pincode"
                        value={data.Pincode || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter pincode"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cell No.</label>
                    <input
                        type="text"
                        name="CellNo"
                        value={data.CellNo || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter cell number"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">WebSite</label>
                    <input
                        type="text"
                        name="WebSite"
                        value={data.WebSite || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter website"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
                {/* Header Section */}
                <PageHeader
                    title="Supplier Master"
                    subtitle="Manage supplier accounts, addresses, contacts, and GST numbers"
                    icon={Truck}
                    actionText="Add New Supplier"
                    onActionClick={() => setShowAddForm(true)}
                />

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-red-800 mb-1">Error</h3>
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Add Supplier Form */}
                {showAddForm && (
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 mb-6 border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-700">Add New Supplier</h2>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSupplier}>
                            {renderFormFields(formData, false)}
                            <div className="flex gap-3 pt-4 mt-6 border-t border-slate-200">
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                                    disabled={loading}
                                >
                                    <Plus className="w-5 h-5" />
                                    Add Supplier
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(false)}
                                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Search & Filters Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-6 mb-6">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-4">
                        {/* Search Bar */}
                        <div className="relative flex-1">
                            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={search}
                                onChange={handleSearchChange}
                                placeholder="Search by supplier name..."
                                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                            />
                            {search && (
                                <button
                                    onClick={() => { setSearch(''); setCurrentPage(1); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Reset Filters Button */}
                        {activeFiltersCount > 0 && (
                            <button
                                onClick={handleResetFilters}
                                className="px-4 py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl font-medium transition-all flex items-center justify-center gap-2 flex-shrink-0"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset Filters ({activeFiltersCount})
                            </button>
                        )}
                    </div>

                    {/* Filter Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                        <div>
                            <CustomSelect
                                label="Department"
                                icon={SlidersHorizontal}
                                value={departmentFilter}
                                onChange={setDepartmentFilter}
                                options={[
                                    { value: 'ALL', label: 'All Departments' },
                                    ...uniqueDepartments.map(dept => ({ value: dept, label: dept }))
                                ]}
                            />
                        </div>

                        <div>
                            <CustomSelect
                                label="Place / City"
                                icon={Filter}
                                value={placeFilter}
                                onChange={setPlaceFilter}
                                options={[
                                    { value: 'ALL', label: 'All Places' },
                                    ...uniquePlaces.map(p => ({ value: p, label: p }))
                                ]}
                                searchable={true}
                                searchPlaceholder="Search place..."
                            />
                        </div>

                        <div>
                            <CustomSelect
                                label="GST Status"
                                icon={Filter}
                                value={gstFilter}
                                onChange={setGstFilter}
                                options={[
                                    { value: 'ALL', label: 'All GST Status' },
                                    { value: 'registered', label: 'GST Registered' },
                                    { value: 'unregistered', label: 'Non-GST' }
                                ]}
                            />
                        </div>

                        <div>
                            <CustomSelect
                                label="Page Size"
                                icon={Filter}
                                value={itemsPerPage}
                                onChange={setItemsPerPage}
                                options={[
                                    { value: 5, label: '5 per page' },
                                    { value: 10, label: '10 per page' },
                                    { value: 25, label: '25 per page' },
                                    { value: 50, label: '50 per page' },
                                    { value: 100, label: '100 per page' }
                                ]}
                            />
                        </div>
                    </div>
                </div>

                {/* Suppliers List */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-slate-700">All Suppliers</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                {pagination.total} supplier{pagination.total !== 1 ? 's' : ''} total
                                {activeFiltersCount > 0 && <span className="text-blue-600 font-medium ml-1.5">({activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} active)</span>}
                            </p>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {suppliers.map((supplier) => (
                            <div
                                key={supplier.AccCode}
                                className="p-6 hover:bg-slate-50 transition-colors duration-200"
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                                                <h3 className="font-semibold text-slate-800 text-lg">
                                                    {supplier.AccountName || 'N/A'}
                                                </h3>
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                                    Code: {supplier.AccCode}
                                                </span>
                                                {supplier.Department && (
                                                    <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium rounded-md">
                                                        {supplier.Department}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                                {supplier.Description && (
                                                    <div><span className="text-slate-500">Description:</span> <span className="text-slate-700 font-medium">{supplier.Description}</span></div>
                                                )}
                                                {supplier.Place && (
                                                    <div><span className="text-slate-500">Place:</span> <span className="text-slate-700 font-medium">{supplier.Place}</span></div>
                                                )}
                                                {supplier.PhNo && (
                                                    <div><span className="text-slate-500">Ph:</span> <span className="text-slate-700 font-medium">{supplier.PhNo}</span></div>
                                                )}
                                                {supplier.CellNo && (
                                                    <div><span className="text-slate-500">Cell:</span> <span className="text-slate-700 font-medium">{supplier.CellNo}</span></div>
                                                )}
                                                {supplier.Email && (
                                                    <div><span className="text-slate-500">Email:</span> <span className="text-slate-700 font-medium">{supplier.Email}</span></div>
                                                )}
                                                {supplier.ContactPerson && (
                                                    <div><span className="text-slate-500">Contact:</span> <span className="text-slate-700 font-medium">{supplier.ContactPerson}</span></div>
                                                )}
                                                {supplier.GSTNo && (
                                                    <div><span className="text-slate-500">GST:</span> <span className="text-slate-700 font-medium">{supplier.GSTNo}</span></div>
                                                )}
                                                {supplier.PanNumber && (
                                                    <div><span className="text-slate-500">PAN:</span> <span className="text-slate-700 font-medium">{supplier.PanNumber}</span></div>
                                                )}
                                                {supplier.Address && (
                                                    <div className="col-span-1 md:grid-cols-2 lg:col-span-3"><span className="text-slate-500">Address:</span> <span className="text-slate-700 font-medium">{supplier.Address}</span></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(supplier)}
                                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(supplier.AccCode)}
                                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {suppliers.length === 0 && !loading && (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Truck className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">No suppliers found</h3>
                                <p className="text-slate-500 mb-4">
                                    {activeFiltersCount > 0
                                        ? 'No suppliers match your current search and filter criteria.'
                                        : 'Add your first supplier to get started.'}
                                </p>
                                {activeFiltersCount > 0 && (
                                    <button
                                        onClick={handleResetFilters}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium inline-flex items-center gap-2"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        Clear Search & Filters
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pagination Bar */}
                    {pagination.total > 0 && (
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="text-sm text-slate-600 font-medium">
                                Showing <span className="text-slate-900 font-semibold">{startItem}</span> to{' '}
                                <span className="text-slate-900 font-semibold">{endItem}</span> of{' '}
                                <span className="text-slate-900 font-semibold">{pagination.total}</span> suppliers
                                {activeFiltersCount > 0 && <span className="text-blue-600 ml-1">(filtered)</span>}
                            </div>

                            <div className="flex items-center gap-1">
                                {/* First Page */}
                                <button
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1 || loading}
                                    className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    title="First Page"
                                >
                                    <ChevronsLeft className="w-4 h-4" />
                                </button>

                                {/* Previous Page */}
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1 || loading}
                                    className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    title="Previous Page"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                {/* Page Buttons */}
                                {getPageNumbers().map(pageNum => (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        disabled={loading}
                                        className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${currentPage === pageNum
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                ))}

                                {/* Next Page */}
                                <button
                                    onClick={() => setCurrentPage(pagination.totalPages)}
                                    disabled={currentPage === pagination.totalPages || pagination.totalPages === 0 || loading}
                                    className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    title="Next Page"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>

                                {/* Last Page */}
                                <button
                                    onClick={() => setCurrentPage(pagination.totalPages)}
                                    disabled={currentPage === pagination.totalPages || pagination.totalPages === 0 || loading}
                                    className="p-2 border border-slate-300 rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    title="Last Page"
                                >
                                    <ChevronsRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rightward Slide-Over Edit Window / Drawer */}
                {editDrawerOpen && (
                    <div className="fixed inset-0 z-50 overflow-hidden">
                        {/* Backdrop with Fade transition */}
                        <div
                            className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isDrawerVisible ? 'opacity-100' : 'opacity-0'
                                }`}
                            onClick={handleCloseEditDrawer}
                        />

                        {/* Slide-Over Drawer Container with Slide transition */}
                        <div
                            className={`fixed inset-y-0 right-0 max-w-2xl w-full bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 transition-transform duration-300 ease-out transform ${isDrawerVisible ? 'translate-x-0' : 'translate-x-full'
                                }`}
                        >
                            {/* Drawer Header */}
                            <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                                        <Edit2 className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">Edit Supplier</h2>
                                        <p className="text-blue-100 text-xs mt-0.5">Supplier Code: <span className="font-semibold text-white">{editingId}</span></p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCloseEditDrawer}
                                    className="p-2 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    title="Close Window"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Scrollable Form Body */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <form id="editSupplierForm" onSubmit={(e) => { e.preventDefault(); handleUpdate(editingId); }}>
                                    {renderFormFields(editFormData, true)}
                                </form>
                            </div>

                            {/* Sticky Drawer Footer */}
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseEditDrawer}
                                    className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-medium transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="editSupplierForm"
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/30 transition-all font-medium flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </button>
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