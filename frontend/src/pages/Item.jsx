import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Plus, Edit2, Trash2, Save, X, Package2, AlertCircle, ArrowLeft,
    Search, Filter, RotateCcw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Upload, SlidersHorizontal
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import CustomSelect from '../components/CustomSelect';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const initialFormState = {
    ItemName: '',
    Category: '',
    Commodity: '',
    UnitRate: 0,
    MinStockLevel: 0,
    Quantity: 0,
    OpeningQty: 0,
    MaxStockLevel: 0,
    OpenValue: 0,
    Location: '',
    DepartmentId: '',
    HSNCode: '',
    SubHeadCode: '',
    UOM: ''
};

export default function Item() {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [subHeads, setSubHeads] = useState([]);
    const [uoms, setUoms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editingCode, setEditingCode] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [editFormData, setEditFormData] = useState(initialFormState);
    const [csvFile, setCsvFile] = useState(null);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({ total: 0, success: 0, failed: 0, errors: [] });
    const [bulkLoading, setBulkLoading] = useState(false);

    // Search, Filter & Pagination states
    const [search, setSearch] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('ALL');
    const [subHeadFilter, setSubHeadFilter] = useState('ALL');
    const [uomFilter, setUomFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('code_asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Rightward Slide-over Edit Drawer state
    const [editDrawerOpen, setEditDrawerOpen] = useState(false);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);

    // Body scroll lock when edit drawer is open
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

    const fetchDepartments = async () => {
        try {
            const response = await axios.get(`${API_URL}/departments`);
            if (response.data.success) {
                setDepartments(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    };

    const fetchSubHeads = async () => {
        try {
            const response = await axios.get(`${API_URL}/sub-heads`);
            if (response.data.success) {
                setSubHeads(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching sub heads:', error);
        }
    };

    const fetchUOMs = async () => {
        try {
            const response = await axios.get(`${API_URL}/uoms`);
            if (response.data.success) {
                setUoms(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching UOMs:', error);
        }
    };

    const fetchItems = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/items`, {
                params: {
                    page: currentPage,
                    limit: itemsPerPage,
                    search: search.trim() ? search.trim() : undefined,
                    department: departmentFilter !== 'ALL' ? departmentFilter : undefined,
                    subHead: subHeadFilter !== 'ALL' ? subHeadFilter : undefined,
                    uom: uomFilter !== 'ALL' ? uomFilter : undefined,
                    sortBy: sortBy !== 'code_asc' ? sortBy : undefined
                }
            });

            if (response.data.success) {
                setItems(response.data.data);
                if (response.data.pagination) {
                    setTotalItems(response.data.pagination.total);
                    setTotalPages(response.data.pagination.totalPages);
                } else {
                    setTotalItems(response.data.data.length);
                    setTotalPages(1);
                }
            }
        } catch (error) {
            setError('Error fetching items: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
        fetchSubHeads();
        fetchUOMs();
    }, []);

    useEffect(() => {
        fetchItems();
    }, [currentPage, itemsPerPage, search, departmentFilter, subHeadFilter, uomFilter, sortBy]);

    const handleSearchChange = (e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
    };

    const handleDepartmentFilterChange = (e) => {
        setDepartmentFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleSubHeadFilterChange = (e) => {
        setSubHeadFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleUomFilterChange = (e) => {
        setUomFilter(e.target.value);
        setCurrentPage(1);
    };

    const handleLimitChange = (e) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setSearch('');
        setDepartmentFilter('ALL');
        setSubHeadFilter('ALL');
        setUomFilter('ALL');
        setSortBy('code_asc');
        setCurrentPage(1);
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await axios.post(`${API_URL}/items`, formData);
            setFormData(initialFormState);
            setShowAddForm(false);
            fetchItems();
        } catch (error) {
            setError('Error adding item: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item) => {
        setEditingCode(item.ItemCode);
        const resolvedQuantity = item.Quantity !== undefined && item.Quantity !== null && Number(item.Quantity) !== 0
            ? item.Quantity
            : item.OpeningQty || 0;
        setEditFormData({
            ...item,
            DepartmentId: item.DepartmentId ? String(item.DepartmentId) : '',
            SubHeadCode: item.SubHeadCode || '',
            Quantity: resolvedQuantity,
            OpeningQty: resolvedQuantity
        });
        setEditDrawerOpen(true);
        setTimeout(() => {
            setIsDrawerVisible(true);
        }, 10);
    };

    const handleCloseEditDrawer = () => {
        setIsDrawerVisible(false);
        setTimeout(() => {
            setEditDrawerOpen(false);
            setEditingCode(null);
        }, 300);
    };

    const handleUpdate = async (e) => {
        if (e) e.preventDefault();
        if (!editingCode) return;

        try {
            setLoading(true);
            const updateData = {
                ItemName: editFormData.ItemName,
                Category: editFormData.Category,
                Commodity: editFormData.Commodity,
                UnitRate: editFormData.UnitRate,
                MinStockLevel: editFormData.MinStockLevel,
                Quantity: editFormData.Quantity,
                OpeningQty: editFormData.Quantity,
                MaxStockLevel: editFormData.MaxStockLevel,
                OpenValue: editFormData.OpenValue,
                Location: editFormData.Location,
                HSNCode: editFormData.HSNCode,
                UOM: editFormData.UOM,
                DepartmentId: editFormData.DepartmentId,
                SubHeadCode: editFormData.SubHeadCode
            };

            await axios.put(`${API_URL}/items/${editingCode}`, updateData);
            handleCloseEditDrawer();
            fetchItems();
        } catch (error) {
            setError('Error updating item: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (code) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        try {
            setLoading(true);
            await axios.delete(`${API_URL}/items/${code}`);
            fetchItems();
        } catch (error) {
            setError('Error deleting item: ' + error.message);
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

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCsvFile(file);
        }
    };

    const handleBulkUpload = async (e) => {
        e.preventDefault();
        if (!csvFile) {
            setError('Please select a CSV file');
            return;
        }

        setBulkLoading(true);
        try {
            Papa.parse(csvFile, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const parsedItems = results.data;

                    const validItems = parsedItems.map((row) => ({
                        ItemName: row.ItemName || row['Item Name'] || '',
                        DepartmentId: parseInt(row.DepartmentId || row['Department ID'] || 0),
                        SubHeadCode: row.SubHeadCode || row['SubHead Code'] || '',
                        Category: row.Category || '',
                        Commodity: row.Commodity || '',
                        UnitRate: parseFloat(row.UnitRate || row['Unit Rate'] || 0),
                        MinStockLevel: parseFloat(row.MinStockLevel || row['Min Stock Level'] || 0),
                        Quantity: parseFloat(row.Quantity || row['Quantity'] || row.OpeningQty || row['Opening Qty'] || 0),
                        OpeningQty: parseFloat(row.OpeningQty || row['Opening Qty'] || 0),
                        MaxStockLevel: parseFloat(row.MaxStockLevel || row['Max Stock Level'] || 0),
                        OpenValue: parseFloat(row.OpenValue || row['Open Value'] || 0),
                        Location: row.Location || '',
                        HSNCode: row.HSNCode || row['HSN Code'] || '',
                        UOM: row.UOM || ''
                    }));

                    try {
                        const response = await axios.post(`${API_URL}/items/bulk-upload`, {
                            items: validItems
                        });

                        if (response.data.success) {
                            setUploadProgress({
                                total: response.data.total,
                                success: response.data.uploaded,
                                failed: response.data.failed,
                                errors: response.data.errors || []
                            });
                            setCsvFile(null);
                            setShowBulkUpload(false);
                            fetchItems();
                            setError(null);
                        }
                    } catch (error) {
                        setError('Error uploading items: ' + error.message);
                    }
                },
                error: (error) => {
                    setError('Error parsing CSV: ' + error.message);
                }
            });
        } catch (error) {
            setError('Error processing file: ' + error.message);
        } finally {
            setBulkLoading(false);
        }
    };

    const getDepartmentName = (deptId) => {
        const dept = departments.find(d => d.dept_id === parseInt(deptId));
        return dept ? dept.dept_name : 'N/A';
    };

    const activeFiltersCount = (search.trim() ? 1 : 0) +
        (departmentFilter !== 'ALL' ? 1 : 0) +
        (subHeadFilter !== 'ALL' ? 1 : 0) +
        (uomFilter !== 'ALL' ? 1 : 0) +
        (sortBy !== 'code_asc' ? 1 : 0);

    const handleCustomSelectChange = (name, value, isEdit = false) => {
        if (isEdit) {
            setEditFormData(prev => ({ ...prev, [name]: value }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const renderFormFields = (data, isEdit = false) => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <CustomSelect
                        label="Department *"
                        value={data.DepartmentId}
                        onChange={(val) => handleCustomSelectChange('DepartmentId', val, isEdit)}
                        options={departments.map((dept) => ({ value: String(dept.dept_id), label: dept.dept_name }))}
                        placeholder="Select Department"
                        searchable={true}
                    />
                </div>
                <div>
                    <CustomSelect
                        label="Sub Head *"
                        value={data.SubHeadCode}
                        onChange={(val) => handleCustomSelectChange('SubHeadCode', val, isEdit)}
                        options={subHeads.map((subHead) => ({ value: subHead.code, label: subHead.sub_group_name }))}
                        placeholder="Select Sub Head"
                        searchable={true}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Item Name *</label>
                <input
                    type="text"
                    name="ItemName"
                    value={data.ItemName}
                    onChange={(e) => handleInputChange(e, isEdit)}
                    placeholder="Enter item name"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                    <input
                        type="text"
                        name="Category"
                        value={data.Category || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter category"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Commodity</label>
                    <input
                        type="text"
                        name="Commodity"
                        value={data.Commodity || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter commodity"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Unit Rate</label>
                    <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="UnitRate"
                        value={data.UnitRate}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter unit rate"
                        step="0.01"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Min. Stock Level</label>
                    <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="MinStockLevel"
                        value={data.MinStockLevel}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter min stock level"
                        step="1"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Quantity</label>
                    <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="Quantity"
                        value={data.Quantity}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter quantity"
                        step="1"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Max. Stock Level</label>
                    <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="MaxStockLevel"
                        value={data.MaxStockLevel}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter max stock level"
                        step="1"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Opening Value</label>
                    <input
                        type="number"
                        onWheel={(e) => e.target.blur()}
                        name="OpenValue"
                        value={data.OpenValue}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter opening value"
                        step="0.01"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                    <input
                        type="text"
                        name="Location"
                        value={data.Location || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter location"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">HSN Code</label>
                    <input
                        type="text"
                        name="HSNCode"
                        value={data.HSNCode || ''}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter HSN code"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <CustomSelect
                        label="UOM"
                        value={data.UOM || ''}
                        onChange={(val) => handleCustomSelectChange('UOM', val, isEdit)}
                        options={uoms.map((uom) => ({ value: uom.uom, label: uom.uom }))}
                        placeholder="Select UOM"
                        searchable={true}
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
                    title="Item Master"
                    subtitle="Manage inventory items, specifications, prices, and stock levels"
                    icon={Package2}
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

                {/* Action Buttons Section */}
                {!showAddForm && (
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center gap-2 font-medium cursor-pointer"
                        >
                            <Plus className="w-5 h-5" />
                            Add New Item
                        </button>

                        {!showBulkUpload && (
                            <button
                                onClick={() => setShowBulkUpload(true)}
                                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105 flex items-center gap-2 font-medium cursor-pointer"
                            >
                                <Upload className="w-5 h-5" />
                                Bulk Upload CSV
                            </button>
                        )}
                    </div>
                )}

                {/* Bulk Upload Section */}
                {showBulkUpload && (
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 mb-6 border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-700">Bulk Upload Items</h2>
                            <button
                                onClick={() => {
                                    setShowBulkUpload(false);
                                    setCsvFile(null);
                                    setUploadProgress({ total: 0, success: 0, failed: 0, errors: [] });
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleBulkUpload}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Select CSV File *
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={handleFileSelect}
                                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            required
                                        />
                                        {csvFile && (
                                            <span className="text-sm text-emerald-600 font-medium">
                                                {csvFile.name}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        CSV must have columns: ItemName, DepartmentId, SubHeadCode, and optional: Category, Commodity, UnitRate, MinStockLevel, Quantity, OpeningQty, MaxStockLevel, OpenValue, Location, HSNCode, UOM
                                    </p>
                                </div>

                                {uploadProgress.total > 0 && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h3 className="font-semibold text-blue-900 mb-3">Upload Summary</h3>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-white p-3 rounded border border-blue-100">
                                                <p className="text-sm text-slate-500">Total</p>
                                                <p className="text-2xl font-bold text-blue-600">{uploadProgress.total}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded border border-emerald-100">
                                                <p className="text-sm text-slate-500">Success</p>
                                                <p className="text-2xl font-bold text-emerald-600">{uploadProgress.success}</p>
                                            </div>
                                            <div className="bg-white p-3 rounded border border-red-100">
                                                <p className="text-sm text-slate-500">Failed</p>
                                                <p className="text-2xl font-bold text-red-600">{uploadProgress.failed}</p>
                                            </div>
                                        </div>

                                        {uploadProgress.errors.length > 0 && (
                                            <div className="mt-4 bg-red-50 border border-red-200 rounded p-3 max-h-40 overflow-y-auto">
                                                <p className="text-sm font-semibold text-red-800 mb-2">Errors:</p>
                                                <ul className="text-xs text-red-700 space-y-1">
                                                    {uploadProgress.errors.map((err, idx) => (
                                                        <li key={idx}>Row {err.row}: {err.message}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4 mt-6 border-t border-slate-200">
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                                    disabled={bulkLoading || !csvFile}
                                >
                                    <Upload className="w-5 h-5" />
                                    Upload Items
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowBulkUpload(false);
                                        setCsvFile(null);
                                        setUploadProgress({ total: 0, success: 0, failed: 0, errors: [] });
                                    }}
                                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition-all font-medium"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Add Item Form Modal */}
                {showAddForm && (
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 mb-6 border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-700">Add New Item</h2>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddItem}>
                            {renderFormFields(formData, false)}
                            <div className="flex gap-3 pt-4 mt-6 border-t border-slate-200">
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                                    disabled={loading || !formData.ItemName || !formData.DepartmentId || !formData.SubHeadCode}
                                >
                                    <Plus className="w-5 h-5" />
                                    Add Item
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
                                placeholder="Search by item name..."
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-100">
                        <div>
                            <CustomSelect
                                label="Department"
                                icon={SlidersHorizontal}
                                value={departmentFilter}
                                onChange={setDepartmentFilter}
                                options={[
                                    { value: 'ALL', label: 'All Departments' },
                                    ...departments.map(dept => ({ value: dept.dept_id, label: dept.dept_name }))
                                ]}
                            />
                        </div>

                        <div>
                            <CustomSelect
                                label="Sub Head"
                                icon={Filter}
                                value={subHeadFilter}
                                onChange={setSubHeadFilter}
                                options={[
                                    { value: 'ALL', label: 'All Sub Heads' },
                                    ...subHeads.map(sh => ({ value: sh.code, label: sh.sub_group_name }))
                                ]}
                                searchable={true}
                                searchPlaceholder="Search sub head..."
                            />
                        </div>

                        <div>
                            <CustomSelect
                                label="UOM"
                                icon={Filter}
                                value={uomFilter}
                                onChange={setUomFilter}
                                options={[
                                    { value: 'ALL', label: 'All UOMs' },
                                    ...uoms.map(u => ({ value: u.uom, label: u.uom }))
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

                        <div>
                            <CustomSelect
                                label="Sort By"
                                icon={SlidersHorizontal}
                                value={sortBy}
                                onChange={setSortBy}
                                options={[
                                    { value: 'code_asc', label: 'Item Code: Low to High' },
                                    { value: 'code_desc', label: 'Item Code: High to Low' },
                                    { value: 'quantity_desc', label: 'Quantity: High to Low' },
                                    { value: 'quantity_asc', label: 'Quantity: Low to High' }
                                ]}
                            />
                        </div>
                    </div>
                </div>

                {/* Items List Table/Cards */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-slate-700">All Items</h2>
                        <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">
                            Showing {totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
                        </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {items.map((item) => (
                            <div
                                key={item.ItemCode}
                                className="p-6 hover:bg-slate-50 transition-colors duration-200"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-semibold text-slate-800 text-lg">
                                                    {item.ItemName}
                                                </h3>
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                                    Code: {item.ItemCode}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm mt-4">
                                                {item.Category && (
                                                    <span><span className="text-slate-500">Category:</span> <span className="text-slate-700 font-medium">{item.Category}</span></span>
                                                )}
                                                {item.Commodity && (
                                                    <span><span className="text-slate-500">Commodity:</span> <span className="text-slate-700 font-medium">{item.Commodity}</span></span>
                                                )}
                                                {item.UnitRate !== null && (
                                                    <span><span className="text-slate-500">Unit Rate:</span> <span className="text-slate-700 font-medium">{item.UnitRate}</span></span>
                                                )}
                                                <span><span className="text-slate-500">Quantity:</span> <span className="text-slate-700 font-medium">{Number.isFinite(Number(item.Quantity)) && Number(item.Quantity) !== 0 ? item.Quantity : (item.OpeningQty ?? 0)}</span></span>
                                                {item.DepartmentId && (
                                                    <span><span className="text-slate-500">Dept:</span> <span className="text-slate-700 font-medium">{getDepartmentName(item.DepartmentId)}</span></span>
                                                )}
                                                {item.UOM && (
                                                    <span><span className="text-slate-500">UOM:</span> <span className="text-slate-700 font-medium">{item.UOM}</span></span>
                                                )}
                                                {item.HSNCode && (
                                                    <span><span className="text-slate-500">HSN:</span> <span className="text-slate-700 font-medium">{item.HSNCode}</span></span>
                                                )}
                                                {item.MinStockLevel !== null && (
                                                    <span><span className="text-slate-500">Min. Stock:</span> <span className="text-slate-700 font-medium">{item.MinStockLevel}</span></span>
                                                )}
                                                {item.MaxStockLevel !== null && (
                                                    <span><span className="text-slate-500">Max. Stock:</span> <span className="text-slate-700 font-medium">{item.MaxStockLevel}</span></span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium text-sm"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.ItemCode)}
                                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium text-sm"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {items.length === 0 && !loading && (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Package2 className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">
                                    {search || activeFiltersCount > 0 ? 'No matching items' : 'No items yet'}
                                </h3>
                                <p className="text-slate-500">
                                    {search || activeFiltersCount > 0 ? 'Try adjusting your search query or filters' : 'Add your first item to get started'}
                                </p>
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
                                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="First Page"
                                >
                                    <ChevronsLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="Previous Page"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                    .reduce((acc, p, idx, arr) => {
                                        if (idx > 0 && p - arr[idx - 1] > 1) {
                                            acc.push('...');
                                        }
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, idx) => (
                                        typeof p === 'number' ? (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${currentPage === p
                                                    ? 'bg-blue-600 text-white shadow'
                                                    : 'border border-slate-300 text-slate-700 hover:bg-slate-200'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        ) : (
                                            <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-xs">
                                                ...
                                            </span>
                                        )
                                    ))}

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="Next Page"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="Last Page"
                                >
                                    <ChevronsRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Rightward Slide-Over Edit Drawer Modal */}
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
                                            <Edit2 className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold">Edit Item</h2>
                                            <p className="text-xs text-blue-100">
                                                Code: {editingCode} | {editFormData.ItemName}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCloseEditDrawer}
                                        className="p-1.5 text-blue-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                {/* Drawer Scrollable Form Body */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    <form id="edit-item-form" onSubmit={handleUpdate}>
                                        {renderFormFields(editFormData, true)}
                                    </form>
                                </div>

                                {/* Drawer Footer */}
                                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCloseEditDrawer}
                                        className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-100 font-medium text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        form="edit-item-form"
                                        disabled={loading}
                                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium text-sm shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save Changes
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