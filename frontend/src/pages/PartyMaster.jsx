import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Save, X, Users, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const initialFormState = {
    Code: '',
    AccountName: '',
    Place: '',
    Address: '',
    DeliveryAddress: '',
    TINNo: '',
    CSTNo: '',
    PhNo: '',
    Email: '',
    Fax: '',
    WebSite: '',
    AccountNo: '',
    ContactPerson: '',
    CellNo: '',
    ECCode: '',
    Range: '',
    Division: '',
    GSTNo: ''
};

export default function PartyMaster() {
    const navigate = useNavigate();
    const [parties, setParties] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editingCode, setEditingCode] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState(initialFormState);
    const [editFormData, setEditFormData] = useState(initialFormState);

    const fetchParties = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/parties`);
            if (response.data.success) {
                setParties(response.data.data);
            }
        } catch (error) {
            setError('Error fetching parties: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const response = await axios.get(`${API_URL}/parties/suppliers/all`);
            if (response.data.success) {
                setSuppliers(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };

    useEffect(() => {
        fetchParties();
        fetchSuppliers();
    }, []);

    const handleAccountNameChange = async (accountName, isEdit = false) => {
        if (!accountName) {
            if (isEdit) {
                setEditFormData(prev => ({
                    ...prev,
                    AccountName: '',
                    Place: '',
                    Address: '',
                    DeliveryAddress: '',
                    TINNo: '',
                    CSTNo: '',
                    PhNo: '',
                    Email: '',
                    Fax: '',
                    WebSite: '',
                    AccountNo: '',
                    ContactPerson: '',
                    CellNo: '',
                    ECCode: '',
                    Range: '',
                    Division: '',
                    GSTNo: ''
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    AccountName: '',
                    Place: '',
                    Address: '',
                    DeliveryAddress: '',
                    TINNo: '',
                    CSTNo: '',
                    PhNo: '',
                    Email: '',
                    Fax: '',
                    WebSite: '',
                    AccountNo: '',
                    ContactPerson: '',
                    CellNo: '',
                    ECCode: '',
                    Range: '',
                    Division: '',
                    GSTNo: ''
                }));
            }
            return;
        }

        try {
            const response = await axios.get(`${API_URL}/parties/supplier-details`, {
                params: { accountName }
            });

            if (response.data.success && response.data.data) {
                if (isEdit) {
                    setEditFormData(prev => ({
                        ...prev,
                        AccountName: accountName,
                        Place: response.data.data.Place || '',
                        Address: response.data.data.Address || '',
                        DeliveryAddress: response.data.data.DeliveryAddress || '',
                        TINNo: response.data.data.TINNo || '',
                        CSTNo: response.data.data.CSTNo || '',
                        PhNo: response.data.data.PhNo || '',
                        Email: response.data.data.Email || '',
                        Fax: response.data.data.Fax || '',
                        WebSite: response.data.data.WebSite || '',
                        AccountNo: response.data.data.AccountNo || '',
                        ContactPerson: response.data.data.ContactPerson || '',
                        CellNo: response.data.data.CellNo || '',
                        ECCode: response.data.data.ECCode || '',
                        Range: response.data.data.Range || '',
                        Division: response.data.data.Division || '',
                        GSTNo: response.data.data.GSTNo || ''
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        AccountName: accountName,
                        Place: response.data.data.Place || '',
                        Address: response.data.data.Address || '',
                        DeliveryAddress: response.data.data.DeliveryAddress || '',
                        TINNo: response.data.data.TINNo || '',
                        CSTNo: response.data.data.CSTNo || '',
                        PhNo: response.data.data.PhNo || '',
                        Email: response.data.data.Email || '',
                        Fax: response.data.data.Fax || '',
                        WebSite: response.data.data.WebSite || '',
                        AccountNo: response.data.data.AccountNo || '',
                        ContactPerson: response.data.data.ContactPerson || '',
                        CellNo: response.data.data.CellNo || '',
                        ECCode: response.data.data.ECCode || '',
                        Range: response.data.data.Range || '',
                        Division: response.data.data.Division || '',
                        GSTNo: response.data.data.GSTNo || ''
                    }));
                }
            }
        } catch (error) {
            console.error('Error fetching supplier details:', error);
        }
    };

    const handleAddParty = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await axios.post(`${API_URL}/parties`, formData);
            setFormData(initialFormState);
            setShowAddForm(false);
            fetchParties();
        } catch (error) {
            setError('Error adding party: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (party) => {
        setEditingCode(party.Code);
        setEditFormData(party);
    };

    const handleUpdate = async (code) => {
        try {
            setLoading(true);
            await axios.put(`${API_URL}/parties/${code}`, editFormData);
            setEditingCode(null);
            fetchParties();
        } catch (error) {
            setError('Error updating party: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (code) => {
        if (!window.confirm('Are you sure you want to delete this party?')) return;

        try {
            setLoading(true);
            await axios.delete(`${API_URL}/parties/${code}`);
            fetchParties();
        } catch (error) {
            setError('Error deleting party: ' + error.message);
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
                    <label className="block text-sm font-medium text-slate-700 mb-2">Code *</label>
                    <input
                        type="text"
                        name="Code"
                        value={data.Code}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter code"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isEdit}
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">TIN No.</label>
                    <input
                        type="text"
                        name="TINNo"
                        value={data.TINNo}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter TIN No."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Account Name *</label>
                    <select
                        name="AccountName"
                        value={data.AccountName}
                        onChange={(e) => {
                            handleInputChange(e, isEdit);
                            handleAccountNameChange(e.target.value, isEdit);
                        }}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required
                    >
                        <option value="">Select Account Name</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier.AccCode} value={supplier.AccountName}>
                                {supplier.AccountName}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">CST No.</label>
                    <input
                        type="text"
                        name="CSTNo"
                        value={data.CSTNo}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter CST No."
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
                        value={data.Place}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter place"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                        readOnly
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Ph. No.</label>
                    <input
                        type="text"
                        name="PhNo"
                        value={data.PhNo}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter phone number"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
                <textarea
                    name="Address"
                    value={data.Address}
                    onChange={(e) => handleInputChange(e, isEdit)}
                    placeholder="Enter address"
                    rows="2"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    readOnly
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <input
                        type="email"
                        name="Email"
                        value={data.Email}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter email"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Address</label>
                <textarea
                    name="DeliveryAddress"
                    value={data.DeliveryAddress}
                    onChange={(e) => handleInputChange(e, isEdit)}
                    placeholder="Enter delivery address"
                    rows="2"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                    readOnly
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Fax</label>
                    <input
                        type="text"
                        name="Fax"
                        value={data.Fax}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter fax"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">WebSite</label>
                    <input
                        type="text"
                        name="WebSite"
                        value={data.WebSite}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter website"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Account No.</label>
                    <input
                        type="text"
                        name="AccountNo"
                        value={data.AccountNo}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter account number"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Contact Person</label>
                    <input
                        type="text"
                        name="ContactPerson"
                        value={data.ContactPerson}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter contact person"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cell No.</label>
                    <input
                        type="text"
                        name="CellNo"
                        value={data.CellNo}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter cell number"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">E.C. Code</label>
                    <input
                        type="text"
                        name="ECCode"
                        value={data.ECCode}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter E.C. Code"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Range</label>
                    <input
                        type="text"
                        name="Range"
                        value={data.Range}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter range"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Division</label>
                    <input
                        type="text"
                        name="Division"
                        value={data.Division}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter division"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div></div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">GST No.</label>
                    <input
                        type="text"
                        name="GSTNo"
                        value={data.GSTNo}
                        onChange={(e) => handleInputChange(e, isEdit)}
                        placeholder="Enter GST No."
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="p-6 max-w-[1600px] mx-auto space-y-6">
                {/* Header Section */}
                <PageHeader
                    title="Party Master"
                    subtitle="Manage vendor and party account details"
                    icon={Users}
                    actionText="Add New Party"
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

                {/* Add Party Form */}
                {showAddForm && (
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 mb-6 border border-slate-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-700">Add New Party</h2>
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddParty}>
                            {renderFormFields(formData, false)}
                            <div className="flex gap-3 pt-4 mt-6 border-t border-slate-200">
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                                    disabled={loading}
                                >
                                    <Plus className="w-5 h-5" />
                                    Add Party
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

                {/* Parties List */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-700">All Parties</h2>
                        <p className="text-sm text-slate-500 mt-1">{parties.length} parties total</p>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {parties.map((party) => (
                            <div
                                key={party.Code}
                                className="p-6 hover:bg-slate-50 transition-colors duration-200"
                            >
                                {editingCode === party.Code ? (
                                    // Edit Mode
                                    <div className="space-y-4">
                                        {renderFormFields(editFormData, true)}
                                        <div className="flex gap-2 pt-4 mt-6 border-t border-slate-200">
                                            <button
                                                onClick={() => handleUpdate(party.Code)}
                                                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/30 flex items-center gap-2 font-medium"
                                            >
                                                <Save className="w-4 h-4" />
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingCode(null)}
                                                className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-all shadow-md flex items-center gap-2 font-medium"
                                            >
                                                <X className="w-4 h-4" />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // View Mode
                                    <div>
                                        <div className="flex items-start justify-between gap-4 mb-4">
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Users className="w-6 h-6 text-blue-700" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="font-semibold text-slate-800 text-lg">
                                                            {party.AccountName}
                                                        </h3>
                                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                                            {party.Code}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                                                        {party.Place && (
                                                            <div><span className="text-slate-500">Place:</span> <span className="text-slate-700 font-medium">{party.Place}</span></div>
                                                        )}
                                                        {party.PhNo && (
                                                            <div><span className="text-slate-500">Ph:</span> <span className="text-slate-700 font-medium">{party.PhNo}</span></div>
                                                        )}
                                                        {party.Email && (
                                                            <div><span className="text-slate-500">Email:</span> <span className="text-slate-700 font-medium">{party.Email}</span></div>
                                                        )}
                                                        {party.GSTNo && (
                                                            <div><span className="text-slate-500">GST:</span> <span className="text-slate-700 font-medium">{party.GSTNo}</span></div>
                                                        )}
                                                        {party.Address && (
                                                            <div className="col-span-2"><span className="text-slate-500">Address:</span> <span className="text-slate-700 font-medium">{party.Address}</span></div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(party)}
                                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-md shadow-blue-500/30 flex items-center gap-2 font-medium"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(party.Code)}
                                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md shadow-red-500/30 flex items-center gap-2 font-medium"
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

                        {parties.length === 0 && !loading && (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users className="w-8 h-8 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-600 mb-2">No parties yet</h3>
                                <p className="text-slate-500">Add your first party to get started</p>
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