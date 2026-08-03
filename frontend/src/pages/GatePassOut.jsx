// frontend/src/pages/GatePassOut.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import SearchSelect from '../components/SearchSelect';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const initialFormState = {
  GpNo: '',
  PartyName: '',
  Address: '',
  Department: '',
  GpDate: new Date().toISOString().split('T')[0],
  DespatchThrough: '',
  Returnable: 'No',
  Remarks: '',
  GpRefNo: ''
};

const initialItemState = {
  ItemName: '',
  Qty: '',
  Reason: ''
};

export default function GatePassOut() {
  const [formData, setFormData] = useState(initialFormState);
  const [items, setItems] = useState([]);
  const [itemData, setItemData] = useState(initialItemState);
  const [parties, setParties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore(state => state.showToast);
  const [gatePassOuts, setGatePassOuts] = useState([]);
  const [editingGpNo, setEditingGpNo] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Get last GP number
        const gpRes = await axios.get(`${API_URL}/gate-pass-outs/last-gp-no`);
        if (gpRes.data.success) {
          setFormData(prev => ({
            ...prev,
            GpNo: (gpRes.data.data.lastGpNo + 1).toString()
          }));
        }

        // Get parties
        const partiesRes = await axios.get(`${API_URL}/gate-pass-outs/parties`);
        if (partiesRes.data.success) {
          setParties(partiesRes.data.data);
        }

        // Get departments
        const deptRes = await axios.get(`${API_URL}/gate-pass-outs/departments`);
        if (deptRes.data.success) {
          setDepartments(deptRes.data.data);
        }

        // Get items
        const itemsRes = await axios.get(`${API_URL}/gate-pass-outs/items`);
        if (itemsRes.data.success) {
          setItemsList(itemsRes.data.data);
        }

        // Get gate pass outs
        const gpsRes = await axios.get(`${API_URL}/gate-pass-outs`);
        if (gpsRes.data.success) {
          setGatePassOuts(gpsRes.data.data);
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

  // Handle party selection and auto-fill address
  const handlePartySelect = (partyName) => {
    const selectedParty = parties.find(p => p.name === partyName);
    if (selectedParty) {
      setFormData(prev => ({
        ...prev,
        PartyName: partyName,
        Address: selectedParty.address || ''
      }));
    }
  };

  const handleAddItem = () => {
    if (!itemData.ItemName || !itemData.Qty) {
      showToast('Item name and quantity are required', 'error');
      return;
    }

    const newItem = {
      ...itemData,
      Qty: parseFloat(itemData.Qty) || 0
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

      if (editingGpNo) {
        await axios.put(`${API_URL}/gate-pass-outs/${editingGpNo}`, payload);
        showToast('Gate Pass Out updated successfully!', 'success');
      } else {
        await axios.post(`${API_URL}/gate-pass-outs`, payload);
        showToast('Gate Pass Out created successfully!', 'success');
      }

      setFormData(initialFormState);
      setItems([]);
      setShowForm(false);
      setEditingGpNo(null);

      // Refresh gate pass outs
      const gpsRes = await axios.get(`${API_URL}/gate-pass-outs`);
      if (gpsRes.data.success) {
        setGatePassOuts(gpsRes.data.data);
      }
    } catch (error) {
      console.error('Error saving gate pass out:', error);
      showToast('Error saving gate pass out: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (gp) => {
    setFormData({
      GpNo: gp.GpNo,
      PartyName: gp.PartyName,
      Address: gp.Address || '',
      Department: gp.Department || '',
      GpDate: gp.GpDate,
      DespatchThrough: gp.DespatchThrough || '',
      Returnable: gp.Returnable || 'No',
      Remarks: gp.Remarks || '',
      GpRefNo: gp.GpRefNo || ''
    });

    if (gp.details) {
      setItems(gp.details.map(detail => ({
        ItemName: detail.ItemName,
        Qty: detail.Qty,
        Reason: detail.Reason || ''
      })));
    }

    setEditingGpNo(gp.GpNo);
    setShowForm(true);
  };

  const handleDelete = async (gpNo) => {
    if (!confirm('Are you sure you want to delete this Gate Pass Out?')) return;

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/gate-pass-outs/${gpNo}`);
      showToast('Gate Pass Out deleted successfully!', 'success');

      const gpsRes = await axios.get(`${API_URL}/gate-pass-outs`);
      if (gpsRes.data.success) {
        setGatePassOuts(gpsRes.data.data);
      }
    } catch (error) {
      console.error('Error deleting gate pass out:', error);
      showToast('Error deleting gate pass out', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormState);
    setItems([]);
    setShowForm(false);
    setEditingGpNo(null);
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Gate Pass Entry</h2>
                  <p className="text-sm text-gray-600">To Add, Modify Gate Pass details.</p>
                </div>
                <button
                  onClick={() => {
                    setShowForm(true);
                    setFormData(initialFormState);
                    setItems([]);
                    setEditingGpNo(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + New Gate Pass
                </button>
              </div>
            </div>



            {/* Gate Pass Outs List */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">GP No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Party Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Department</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">GP Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Returnable</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-900">Items</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gatePassOuts.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-4 text-center text-gray-500">
                          No Gate Pass Outs found
                        </td>
                      </tr>
                    ) : (
                      gatePassOuts.map(gp => (
                        <tr key={gp.GpNo} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{gp.GpNo}</td>
                          <td className="px-4 py-3">{gp.PartyName}</td>
                          <td className="px-4 py-3">{gp.Department || '-'}</td>
                          <td className="px-4 py-3">{new Date(gp.GpDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{gp.Returnable}</td>
                          <td className="px-4 py-3 text-center">{gp.details?.length || 0}</td>
                          <td className="px-4 py-3 text-center space-x-2 flex justify-center">
                            <button
                              onClick={() => handleEdit(gp)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(gp.GpNo)}
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
              <h2 className="text-2xl font-bold text-blue-900 mb-1">Gate Pass Entry</h2>
              <p className="text-sm text-blue-700">F3 : To add new item</p>
            </div>



            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gp No.</label>
                <input
                  type="text"
                  value={formData.GpNo}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              <SearchSelect
                label="Party Name"
                required
                options={parties.map(p => ({ value: p.name, label: p.name, sub: p.place || p.Place || '', address: p.address }))}
                value={formData.PartyName}
                onChange={(val, opt) => {
                  setFormData(prev => ({
                    ...prev,
                    PartyName: val,
                    Address: opt?.address || prev.Address
                  }));
                }}
                placeholder="Search party by name..."
              />

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.Address}
                  onChange={(e) => setFormData({ ...formData, Address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={formData.Department}
                  onChange={(e) => setFormData({ ...formData, Department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">G.P. Date</label>
                <input
                  type="date"
                  value={formData.GpDate}
                  onChange={(e) => setFormData({ ...formData, GpDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Despatch Through</label>
                <input
                  type="text"
                  value={formData.DespatchThrough}
                  onChange={(e) => setFormData({ ...formData, DespatchThrough: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Returnable</label>
                <select
                  value={formData.Returnable}
                  onChange={(e) => setFormData({ ...formData, Returnable: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GP Ref No</label>
                <input
                  type="text"
                  value={formData.GpRefNo}
                  onChange={(e) => setFormData({ ...formData, GpRefNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea
                  value={formData.Remarks}
                  onChange={(e) => setFormData({ ...formData, Remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-20"
                />
              </div>
            </div>

            {/* Add Item Section */}
            <div className="border rounded-lg p-4 bg-gray-50 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Add Items</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Qty</label>
                  <input
                    type="number"
                    onWheel={(e) => e.target.blur()}
                    step="0.01"
                    value={itemData.Qty}
                    onChange={(e) => setItemData({ ...itemData, Qty: e.target.value })}
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
                      <th className="px-4 py-2 text-right font-semibold">Qty</th>
                      <th className="px-4 py-2 text-left font-semibold">Reason</th>
                      <th className="px-4 py-2 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{item.ItemName}</td>
                        <td className="px-4 py-2 text-right">{item.Qty}</td>
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