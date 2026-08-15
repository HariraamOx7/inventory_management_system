import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Save, X, Package2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const initialFormState = {
    ItemCode: '',
    ItemName: '',
    UnitRate: '',
    Department: '',
    DepartmentId: '',
    SubHeadCode: '',
    UOM: ''
};

export default function ItemMaster() {
    const navigate = useNavigate();
    const [itemMasters, setItemMasters] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [subHeads, setSubHeads] = useState([]);
    const [uoms, setUOMs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editingCode, setEditingCode] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [editFormData, setEditFormData] = useState(initialFormState);

    const fetchItemMasters = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/item-masters`);
            if (response.data.success) {
                setItemMasters(response.data.data);
            }
        } catch (error) {
            setError('Error fetching item masters: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const response = await axios.get(`${API_URL}/item-masters/departments/all`);
            if (response.data.success) {
                setDepartments(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    };

    const fetchSubHeadsByDepartment = async (departmentId) => {
        try {
            const response = await axios.get(`${API_URL}/item-masters/sub-heads-by-dept`, {
                params: { departmentId }
            });
            if (response.data.success) {
                setSubHeads(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching sub heads:', error);
            setSubHeads([]);
        }
    };

    const fetchUOMs = async () => {
        try {
            const response = await axios.get(`${API_URL}/item-masters/uoms/all`);
            if (response.data.success) {
                setUOMs(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching UOMs:', error);
        }
    };

    const generateItemCode = async (deptId, subHeadCode, deptName) => {
        try {
            const response = await axios.post(`${API_URL}/item-masters/generate-code`, {
                departmentId: deptId,
                subHeadCode: subHeadCode,
                departmentName: deptName
            });
            if (response.data.success) {
                setFormData(prev => ({ ...prev, ItemCode: response.data.data.itemCode }));
            }
        } catch (error) {
            console.error('Error generating item code:', error);
            setError('Error generating item code: ' + error.message);
        }
    };

    useEffect(() => {
        fetchItemMasters();
        fetchDepartments();
        fetchUOMs();
    }, []);

    const handleDepartmentChange = (e, isEdit = false) => {
        const selectedDeptId = e.target.value;
        const selectedDept = departments.find(d => d.dept_id.toString() === selectedDeptId);

        if (isEdit) {
            setEditFormData(prev => ({
                ...prev,
                DepartmentId: selectedDeptId,
                Department: selectedDept?.dept_name || ''
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                DepartmentId: selectedDeptId,
                Department: selectedDept?.dept_name || '',
                SubHeadCode: '',
                ItemCode: ''
            }));
            setSubHeads([]);
        }

        if (selectedDeptId) {
            fetchSubHeadsByDepartment(selectedDeptId);
        }
    };

    const handleSubHeadChange = (e, isEdit = false) => {
        const selectedCode = e.target.value;

        if (isEdit) {
            setEditFormData(prev => ({ ...prev, SubHeadCode: selectedCode }));
        } else {
            setFormData(prev => ({ ...prev, SubHeadCode: selectedCode }));

            // Auto-generate ItemCode
            if (formData.DepartmentId && selectedCode && formData.Department) {
                generateItemCode(formData.DepartmentId, selectedCode, formData.Department);
            }
        }
    };

    const handleAddItemMaster = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await axios.post(`${API_URL}/item-masters`, {
                ItemCode: formData.ItemCode,
                ItemName: formData.ItemName,
                UnitRate: formData.UnitRate,
                Department: formData.Department,
                UOM: formData.UOM
            });
            setFormData(initialFormState);
            setShowAddForm(false);
            setSubHeads([]);
            fetchItemMasters();
        } catch (error) {
            setError('Error adding item master: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (itemMaster) => {
        setEditingCode(itemMaster.ItemCode);
        setEditFormData(itemMaster);

        // Load sub heads for the department
        const dept = departments.find(d => d.dept_name === itemMaster.Department);
        if (dept) {
            fetchSubHeadsByDepartment(dept.dept_id);
        }
    };

    const handleUpdate = async (code) => {
        try {
            setLoading(true);
            await axios.put(`${API_URL}/item-masters/${code}`, {
                ItemName: editFormData.ItemName,
                UnitRate: editFormData.UnitRate,
                Department: editFormData.Department,
                UOM: editFormData.UOM
            });
            setEditingCode(null);
            fetchItemMasters();
        } catch (error) {
            setError('Error updating item master: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (code) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        try {
            setLoading(true);
            await axios.delete(`${API_URL}/item-masters/${code}`);
            fetchItemMasters();
        } catch (error) {
            setError('Error deleting item master: ' + error.message);
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

    const renderFormFields = (data, isEdit = false) => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Department *
                    </label>
                    <select
                        value={data.DepartmentId}
                        onChange={(e) => handleDepartmentChange(e, isEdit)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required
                    >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                            <option key={dept.dept_id} value={dept.dept_id}>
                                {dept.dept_id} - {dept.dept_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Sub Head *
                    </label>
                    <select
                        value={data.SubHeadCode}
                        onChange={(e) => handleSubHeadChange(e, isEdit)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required
                        disabled={!data.DepartmentId}
                    >
                        <option value="">Select Sub Head</option>
                        {subHeads.map((sh) => (
                            <option key={sh.code} value={sh.code}>
                                {sh.code} - {sh.sub_group_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Item Code (Auto-Generated)
                    </label>
                    <input
                        type="text"
                        value={data.ItemCode}
                        disabled
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Format: DeptID/SubHeadCode/DeptAbbr/0001
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Item Name *
                    </label>
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
                        step="any" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">UOM</label>
                    <select
                        name="UOM"
                        value={data.UOM}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="">Select UOM</option>
                        {uoms.map((uom) => (
                            <option key={uom.id} value={uom.uom}>
                                {uom.uom}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="p-6 max-w-[1600px] mx-auto space-y-6">
                {/* Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="mb-6 flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg transition-all group"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="font-medium">Back</span>
                </button>

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Package2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                                Item Master
                            </h1>
                            <p className="text-slate-500 text-sm">To Add, Modify G.P. item details</p>
                        </div>
                    </div>
                </div>

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

                {/* Add Item Master Button */}
                {!showAddForm && (
                    <div className="mb-6">
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 flex items-center gap-2 font-medium"
                        >
                            <Plus className="w-5 h-5" />
                            New
                        </button>
                    </div>
                )}

                {/* Add Item Master Form */}
                {showAddForm && (
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 mb-6 border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-700">To Add, Modify G.P. item details</h2>
                            <button
                                onClick={() => {
                                    setShowAddForm(false);
                                    setFormData(initialFormState);
                                    setSubHeads([]);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddItemMaster}>
                            {renderFormFields(formData, false)}
                            <div className="flex gap-3 pt-6 mt-6 border-t border-slate-200 justify-center">
                                <button
                                    type="submit"
                                    className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                                    disabled={loading || !formData.ItemCode || !formData.ItemName}
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Item
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddForm(false);
                                        setFormData(initialFormState);
                                        setSubHeads([]);
                                    }}
                                    className="px-8 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md font-medium flex items-center gap-2"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Item Masters List */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-700">Item List</h2>
                        <p className="text-sm text-slate-500 mt-1">{itemMasters.length} items total</p>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {itemMasters.map((item) => (
                            <div
                                key={item.ItemCode}
                                className="p-6 hover:bg-slate-50 transition-colors duration-200"
                            >
                                {editingCode === item.ItemCode ? (
                                    // Edit Mode
                                    <div className="space-y-4">
                                        {renderFormFields(editFormData, true)}
                                        <div className="flex gap-3 pt-6 mt-6 border-t border-slate-200 justify-center">
                                            <button
                                                onClick={() => handleUpdate(item.ItemCode)}
                                                className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium"
                                            >
                                                <Save className="w-4 h-4" />
                                                Update
                                            </button>
                                            <button
                                                onClick={() => setEditingCode(null)}
                                                className="px-8 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md flex items-center gap-2 font-medium"
                                            >
                                                <X className="w-4 h-4" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <div>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="font-semibold text-slate-800">
                                                            {item.ItemName}
                                                        </h3>
                                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                                            {item.ItemCode}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 flex-wrap text-sm">
                                                        {item.UnitRate !== null && item.UnitRate !== 0 && (
                                                            <p className="text-slate-600">
                                                                Unit Rate: <span className="font-medium text-slate-800">{item.UnitRate}</span>
                                                            </p>
                                                        )}
                                                        {item.Department && (
                                                            <p className="text-slate-600">
                                                                Department: <span className="font-medium text-slate-800">{item.Department}</span>
                                                            </p>
                                                        )}
                                                        {item.UOM && (
                                                            <p className="text-slate-600">
                                                                UOM: <span className="font-medium text-slate-800">{item.UOM}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.ItemCode)}
                                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {itemMasters.length === 0 && !loading && (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Package2 className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">No items yet</h3>
                                <p className="text-slate-500">Add your first item to get started</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Loading Overlay */}
                {loading && (
                    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 shadow-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-slate-700 font-medium">Processing...</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}