// frontend/src/pages/GatePassIn.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import SearchSelect from '../components/SearchSelect';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const initialFormState = {
  InNo: '',
  PartyName: '',
  GiDate: new Date().toISOString().split('T')[0],
  DcNo: '',
  DcDate: new Date().toISOString().split('T')[0],
  InvoiceNo: '',
  InvoiceDate: new Date().toISOString().split('T')[0],
  LrcNo: ''
};

const initialItemState = {
  ItemName: '',
  PendingQty: '',
  RecQty: '',
  GpNo: '',
  Reason: ''
};

export default function GatePassIn() {
  const [formData, setFormData] = useState(initialFormState);
  const [items, setItems] = useState([]);
  const [itemData, setItemData] = useState(initialItemState);
  const [parties, setParties] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore(state => state.showToast);
  const [gatePassIns, setGatePassIns] = useState([]);
  const [editingInNo, setEditingInNo] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Get last IN number
        const inRes = await axios.get(`${API_URL}/gate-pass-ins/last-in-no`);
        if (inRes.data.success) {
          setFormData(prev => ({
            ...prev,
            InNo: (inRes.data.data.lastInNo + 1).toString()
          }));
        }

        // Get parties
        const partiesRes = await axios.get(`${API_URL}/gate-pass-ins/parties`);
        if (partiesRes.data.success) {
          setParties(partiesRes.data.data);
        }

        // Get items
        const itemsRes = await axios.get(`${API_URL}/gate-pass-ins/items`);
        if (itemsRes.data.success) {
          setItemsList(itemsRes.data.data);
        }

        // Get gate pass ins
        const gpisRes = await axios.get(`${API_URL}/gate-pass-ins`);
        if (gpisRes.data.success) {
          setGatePassIns(gpisRes.data.data);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        showToast('Error loading data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const handleAddItem = () => {
    if (!itemData.ItemName || !itemData.RecQty) {
      showToast('Item name and received quantity are required', 'error');
      return;
    }

    const newItem = {
      ...itemData,
      PendingQty: parseFloat(itemData.PendingQty) || 0,
      RecQty: parseFloat(itemData.RecQty) || 0
    };

    setItems([...items, newItem]);
    setItemData(initialItemState);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formData.PartyName || items.length === 0) {
      showToast('Please select a party name and add at least one item', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        items: items
      };

      if (editingInNo) {
        await axios.put(`${API_URL}/gate-pass-ins/${editingInNo}`, payload);
        showToast('Gate Pass In updated successfully!', 'success');
      } else {
        await axios.post(`${API_URL}/gate-pass-ins`, payload);
        showToast('Gate Pass In created successfully!', 'success');
      }

      setFormData(initialFormState);
      setItems([]);
      setShowForm(false);
      setEditingInNo(null);

      // Refresh gate pass ins
      const gpisRes = await axios.get(`${API_URL}/gate-pass-ins`);
      if (gpisRes.data.success) {
        setGatePassIns(gpisRes.data.data);
      }
    } catch (error) {
      console.error('Error saving gate pass in:', error);
      showToast('Error saving gate pass in: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (gpi) => {
    setFormData({
      InNo: gpi.InNo,
      PartyName: gpi.PartyName,
      GiDate: gpi.GiDate,
      DcNo: gpi.DcNo || '',
      DcDate: gpi.DcDate || new Date().toISOString().split('T')[0],
      InvoiceNo: gpi.InvoiceNo || '',
      InvoiceDate: gpi.InvoiceDate || new Date().toISOString().split('T')[0],
      LrcNo: gpi.LrcNo || ''
    });

    if (gpi.details) {
      setItems(gpi.details.map(detail => ({
        ItemName: detail.ItemName,
        PendingQty: detail.PendingQty,
        RecQty: detail.RecQty,
        GpNo: detail.GpNo || '',
        Reason: detail.Reason || ''
      })));
    }

    setEditingInNo(gpi.InNo);
    setShowForm(true);
  };

  const handleDelete = async (inNo) => {
    if (!confirm('Are you sure you want to delete this Gate Pass In?')) return;

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/gate-pass-ins/${inNo}`);
      showToast('Gate Pass In deleted successfully!', 'success');

      const gpisRes = await axios.get(`${API_URL}/gate-pass-ins`);
      if (gpisRes.data.success) {
        setGatePassIns(gpisRes.data.data);
      }
    } catch (error) {
      console.error('Error deleting gate pass in:', error);
      showToast('Error deleting gate pass in', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormState);
    setItems([]);
    setShowForm(false);
    setEditingInNo(null);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
        {!showForm ? (
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Gate Income Entry</h2>
                  <p className="text-sm text-gray-600">To Add, Modify Gate Income details.</p>
                </div>
                <button
                  onClick={() => {
                    setShowForm(true);
                    setFormData(initialFormState);
                    setItems([]);
                    setEditingInNo(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + New Gate Income
                </button>
              </div>
            </div>



            {/* Gate Pass Ins List */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">In No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Party Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">G.I. Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">DC No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Invoice No</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-900">Items</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gatePassIns.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-4 text-center text-gray-500">
                          No Gate Income entries found
                        </td>
                      </tr>
                    ) : (
                      gatePassIns.map(gpi => (
                        <tr key={gpi.InNo} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{gpi.InNo}</td>
                          <td className="px-4 py-3">{gpi.PartyName}</td>
                          <td className="px-4 py-3">{new Date(gpi.GiDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{gpi.DcNo || '-'}</td>
                          <td className="px-4 py-3">{gpi.InvoiceNo || '-'}</td>
                          <td className="px-4 py-3 text-center">{gpi.details?.length || 0}</td>
                          <td className="px-4 py-3 text-center space-x-2 flex justify-center">
                            <button
                              onClick={() => handleEdit(gpi)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(gpi.InNo)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          // Form View
          <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6">
            <div className="bg-blue-100 border-l-4 border-blue-500 p-4 mb-6">
              <h2 className="text-2xl font-bold text-blue-900 mb-1">Gate Income Entry</h2>
              <p className="text-sm text-blue-700">To Add, Modify Gate Income details.</p>
            </div>



            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">In. No.</label>
                <input
                  type="text"
                  value={formData.InNo}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              <SearchSelect
                label="Party Name"
                required
                options={parties.map(p => ({ value: p.name, label: p.name, sub: p.place || p.Place || '' }))}
                value={formData.PartyName}
                onChange={(val) => setFormData(prev => ({ ...prev, PartyName: val }))}
                placeholder="Search party by name..."
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">G.I. Date</label>
                <input
                  type="date"
                  value={formData.GiDate}
                  onChange={(e) => setFormData({ ...formData, GiDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DC No.</label>
                <input
                  type="text"
                  value={formData.DcNo}
                  onChange={(e) => setFormData({ ...formData, DcNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">D.C. Date</label>
                <input
                  type="date"
                  value={formData.DcDate}
                  onChange={(e) => setFormData({ ...formData, DcDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice No.</label>
                <input
                  type="text"
                  value={formData.InvoiceNo}
                  onChange={(e) => setFormData({ ...formData, InvoiceNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={formData.InvoiceDate}
                  onChange={(e) => setFormData({ ...formData, InvoiceDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LRC No.</label>
                <input
                  type="text"
                  value={formData.LrcNo}
                  onChange={(e) => setFormData({ ...formData, LrcNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Add Item Section */}
            <div className="border rounded-lg p-4 bg-gray-50 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Add Items</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Item Name</label>
                  <select
                    value={itemData.ItemName}
                    onChange={(e) => setItemData({ ...itemData, ItemName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Item</option>
                    {itemsList.map((item) => (
                      <option key={item.code} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Pending Qty</label>
                  <input
                    type="number"
                    onWheel={(e) => e.target.blur()}
                    step="any"
                    value={itemData.PendingQty}
                    onChange={(e) => setItemData({ ...itemData, PendingQty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Rec. Qty</label>
                  <input
                    type="number"
                    onWheel={(e) => e.target.blur()}
                    step="any"
                    value={itemData.RecQty}
                    onChange={(e) => setItemData({ ...itemData, RecQty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">G.P. No</label>
                  <input
                    type="text"
                    value={itemData.GpNo}
                    onChange={(e) => setItemData({ ...itemData, GpNo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Reason</label>
                  <input
                    type="text"
                    value={itemData.Reason}
                    onChange={(e) => setItemData({ ...itemData, Reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleAddItem}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Items Table */}
            {items.length > 0 && (
              <div className="mb-6 border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Item Name</th>
                      <th className="px-4 py-2 text-right font-semibold">Pending Qty</th>
                      <th className="px-4 py-2 text-right font-semibold">Rec. Qty</th>
                      <th className="px-4 py-2 text-left font-semibold">G.P. No</th>
                      <th className="px-4 py-2 text-left font-semibold">Reason</th>
                      <th className="px-4 py-2 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{item.ItemName}</td>
                        <td className="px-4 py-2 text-right">{item.PendingQty}</td>
                        <td className="px-4 py-2 text-right">{item.RecQty}</td>
                        <td className="px-4 py-2">{item.GpNo}</td>
                        <td className="px-4 py-2">{item.Reason}</td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <button
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <X size={18} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
              >
                <Save size={18} />
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}