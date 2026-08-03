import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertCircle, Plus, Pencil, Trash2, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PageHeader from '../components/ui/PageHeader';
import PurchaseTypeModal from '../components/PurchaseTypeModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function PurchaseType() {
  const navigate = useNavigate();
  const [purchaseTypes, setPurchaseTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);

  const fetchPurchaseTypes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/purchase-types`);
      if (response.data.success) {
        setPurchaseTypes(response.data.data);
      } else {
        setError('Unable to load purchase types');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error fetching purchase types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseTypes();
  }, []);

  const handleAddNew = () => {
    setEditData(null);
    setError(null);
    setShowModal(true);
  };

  const handleEdit = (pt) => {
    setEditData(pt);
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (code) => {
    if (!confirm('Are you sure you want to delete this Purchase Type?')) return;
    try {
      setLoading(true);
      const res = await axios.delete(`${API_URL}/purchase-types/${code}`);
      if (res.data.success) {
        setSuccessMsg('Purchase Type deleted successfully');
        setTimeout(() => setSuccessMsg(''), 3000);
        await fetchPurchaseTypes();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting purchase type');
    } finally {
      setLoading(false);
    }
  };

  const handleSaved = (savedPT) => {
    setShowModal(false);
    setEditData(null);
    setSuccessMsg(editData ? 'Purchase Type updated successfully' : 'Purchase Type added successfully');
    setTimeout(() => setSuccessMsg(''), 3000);
    fetchPurchaseTypes();
  };

  return (
    <Layout>
      <div className="relative p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <PageHeader
          title="Purchase Type Master"
          subtitle="Manage purchase categories, tax types, and transaction definitions"
          icon={ShoppingBag}
          actionText="Add Purchase Type"
          onActionClick={handleAddNew}
        />

        {/* Messages */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
            <p className="font-medium">{successMsg}</p>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-100 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Purchase Types</h2>
            <span className="text-sm text-slate-500">{purchaseTypes.length} record(s)</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-600">Loading purchase types...</div>
          ) : purchaseTypes.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
              No purchase types found. Click "Add Purchase Type" to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Code</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Purchase Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Commodity</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">SGST Ledger</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">CGST Ledger</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">IGST Ledger</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {purchaseTypes.map((pt) => (
                    <tr key={pt.Code} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-700 font-medium">{pt.Code}</td>
                      <td className="px-4 py-3 text-slate-900 font-semibold">{pt.PurchaseType}</td>
                      <td className="px-4 py-3 text-slate-600">{pt.Description || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{pt.Commodity || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{pt.SGSTLedger || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{pt.CGSTLedger || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{pt.IGSTLedger || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(pt)}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(pt.Code)}
                            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Type Modal (shared component) */}
      <PurchaseTypeModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditData(null); }}
        onSaved={handleSaved}
        editData={editData}
      />
    </Layout>
  );
}
