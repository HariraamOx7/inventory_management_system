import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Save, X, Building2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Department() {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [newDepartment, setNewDepartment] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const fetchDepartments = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/departments`);
            if (response.data.success) {
                setDepartments(response.data.data);
            }
        } catch (error) {
            setError('Error fetching departments: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    const handleAddDepartment = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await axios.post(`${API_URL}/departments`, {
                dept_name: newDepartment
            });
            setNewDepartment('');
            fetchDepartments();
        } catch (error) {
            setError('Duplicate Entry for Department');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (dept) => {
        setEditingId(dept.dept_id);
        setEditName(dept.dept_name);
    };

    const handleUpdate = async (id) => {
        try {
            setLoading(true);
            await axios.put(`${API_URL}/departments/${id}`, {
                dept_name: editName
            });
            setEditingId(null);
            fetchDepartments();
        } catch (error) {
            setError('Error updating department: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this department?')) return;

        try {
            setLoading(true);
            await axios.delete(`${API_URL}/departments/${id}`);
            fetchDepartments();
        } catch (error) {
            setError('Error deleting department: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
                {/* Header Section */}
                <PageHeader
                    title="Department Master"
                    subtitle="Manage store departments and organization units"
                    icon={Building2}
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

                {/* Add Department Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mb-8">
                    <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-indigo-600" />
                        Add New Department
                    </h2>
                    <form onSubmit={handleAddDepartment} className="flex gap-4">
                        <input
                            type="text"
                            value={newDepartment}
                            onChange={(e) => setNewDepartment(e.target.value)}
                            placeholder="Enter department name"
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                            required
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-[#5b52f6] hover:bg-[#4f46e5] text-white rounded-xl text-sm font-medium transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            Add Department
                        </button>
                    </form>
                </div>

                {/* Department List Card */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-base font-bold text-slate-900">
                            Department List ({departments.length})
                        </h2>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {departments.map((dept) => (
                            <div
                                key={dept.dept_id}
                                className="p-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                            >
                                {editingId === dept.dept_id ? (
                                    <div className="flex-1 flex items-center gap-3 mr-4">
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 px-3 py-1.5 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            autoFocus
                                        />
                                        <button
                                            onClick={() => handleUpdate(dept.dept_id)}
                                            className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                            title="Save"
                                        >
                                            <Save className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="p-1.5 bg-slate-300 text-slate-700 rounded-lg hover:bg-slate-400 transition-colors"
                                            title="Cancel"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center font-bold text-xs text-indigo-600">
                                                #{dept.dept_id}
                                            </div>
                                            <span className="font-semibold text-slate-800 text-sm">
                                                {dept.dept_name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(dept)}
                                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(dept.dept_id)}
                                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium text-sm cursor-pointer"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}

                        {departments.length === 0 && (
                            <div className="p-12 text-center">
                                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <h3 className="text-base font-semibold text-slate-600 mb-1">No departments yet</h3>
                                <p className="text-slate-400 text-xs">Add your first department to get started</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Scoped Loading Overlay */}
                {loading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-30 rounded-2xl min-h-[300px]">
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl flex items-center gap-3">
                            <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-slate-700 font-semibold text-xs tracking-wide">Loading data...</span>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}