// frontend/src/pages/CancelOrder.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';
import Layout from '../components/Layout';
import SearchSelect from '../components/SearchSelect';
import { useToastStore } from '../store/toastStore';

const CancelOrder = () => {
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://krexports.org/krest';
  const showToast = useToastStore(state => state.showToast);
  const [formView, setFormView] = useState(false);
  const [cancelOrders, setCancelOrders] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    CancelNo: '',
    OrderNo: '',
    PartyName: '',
    CancelDate: new Date().toISOString().split('T')[0],
    Reason: ''
  });

  const [editingId, setEditingId] = useState(null);

  // Fetch cancel orders
  const fetchCancelOrders = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/cancel-orders`);
      if (response.data.success) {
        setCancelOrders(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching cancel orders:', error);
      showToast('Error fetching cancel orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchase orders for dropdown
  const fetchPurchaseOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cancel-orders/purchase-orders`);
      if (response.data.success) {
        setPurchaseOrders(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    }
  };

  // Get last cancel number
  const getLastCancelNo = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/cancel-orders/last-cancel-no`);
      if (response.data.success) {
        setFormData(prev => ({
          ...prev,
          CancelNo: (response.data.data.lastCancelNo + 1).toString()
        }));
      }
    } catch (error) {
      console.error('Error fetching last cancel number:', error);
    }
  };

  // Fetch party name when order is selected
  const handleOrderSelect = async (selectedOrderNo) => {
    setFormData(prev => ({
      ...prev,
      OrderNo: selectedOrderNo,
      PartyName: selectedOrderNo ? prev.PartyName : ''
    }));

    if (selectedOrderNo) {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/cancel-orders/purchase-order-details?orderNo=${selectedOrderNo}`
        );
        if (response.data.success) {
          setFormData(prev => ({
            ...prev,
            PartyName: response.data.data.PartyName
          }));
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
        showToast('Error fetching order details', 'error');
      }
    }
  };

  // Initialize form
  const initializeForm = async () => {
    await getLastCancelNo();
    setFormData(prev => ({
      ...prev,
      CancelDate: new Date().toISOString().split('T')[0],
      Reason: ''
    }));
    setEditingId(null);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.OrderNo || !formData.PartyName) {
      showToast('Please select an order number', 'error');
      return;
    }

    try {
      if (editingId) {
        // Update
        const response = await axios.put(
          `${API_BASE_URL}/cancel-orders/${editingId}`,
          formData
        );
        if (response.data.success) {
          showToast('Cancel order updated successfully', 'success');
          fetchCancelOrders();
          setFormView(false);
        }
      } else {
        // Create
        const response = await axios.post(`${API_BASE_URL}/cancel-orders`, formData);
        if (response.data.success) {
          showToast('Cancel order created successfully', 'success');
          fetchCancelOrders();
          setFormView(false);
        }
      }
    } catch (error) {
      console.error('Error saving cancel order:', error);
      showToast('Error saving cancel order: ' + (error.response?.data?.message || error.message), 'error');
    }
  };

  // Edit cancel order
  const handleEdit = (cancelOrder) => {
    setFormData(cancelOrder);
    setEditingId(cancelOrder.CancelNo);
    setFormView(true);
    window.scrollTo(0, 0);
  };

  // Delete cancel order
  const handleDelete = async (cancelNo) => {
    if (!window.confirm('Are you sure you want to delete this cancel order?')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/cancel-orders/${cancelNo}`);
      if (response.data.success) {
        showToast('Cancel order deleted successfully', 'success');
        fetchCancelOrders();
      }
    } catch (error) {
      console.error('Error deleting cancel order:', error);
      showToast('Error deleting cancel order', 'error');
    }
  };

  // Cancel form
  const handleCancel = () => {
    setFormView(false);
    setEditingId(null);
  };

  // Toggle between form and list
  const handleAddNew = async () => {
    setFormView(true);
    setEditingId(null);
    await initializeForm();
  };

  useEffect(() => {
    fetchCancelOrders();
    fetchPurchaseOrders();
  }, []);

  if (loading && !formView) {
    return (
      <Layout>
        <div className="p-6 text-center">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-blue-600 text-white rounded-t-lg p-6 mb-0">
            <h2 className="text-2xl font-bold">Cancel Order</h2>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-b-lg shadow-lg p-6 border-t-4 border-blue-600">
            {/* Form View */}
            {formView ? (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-6">
                  {editingId ? 'Edit Cancel Order' : 'Create Cancel Order'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Cancel No and Order No Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cancel No (Read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cancel No.
                      </label>
                      <input
                        type="text"
                        value={formData.CancelNo}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      />
                    </div>

                    <SearchSelect
                      label="Order No."
                      required
                      disabled={editingId !== null}
                      options={purchaseOrders.map(order => ({
                        value: String(order.OrderNo),
                        label: `${order.OrderNo} - ${order.PartyName}`,
                        sub: order.PartyName
                      }))}
                      value={formData.OrderNo}
                      onChange={(val) => handleOrderSelect(val)}
                      placeholder="Search order number..."
                    />
                  </div>

                  {/* Cancel Date and Party Name Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cancel Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cancel Date
                      </label>
                      <input
                        type="date"
                        value={formData.CancelDate}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, CancelDate: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Party Name (Read-only) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Party Name
                      </label>
                      <input
                        type="text"
                        value={formData.PartyName}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason
                    </label>
                    <textarea
                      value={formData.Reason}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, Reason: e.target.value }))
                      }
                      rows="4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter reason for cancellation"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-4 pt-6 border-t">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* List View */
              <div className="space-y-6">
                {/* Header with Add New Button */}
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">Cancel Order List</h3>
                  <button
                    onClick={handleAddNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium"
                  >
                    <Plus size={20} /> Add New
                  </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-blue-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                          Cancel No.
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                          Order No.
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                          Party Name
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                          Cancel Date
                        </th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                          Reason
                        </th>
                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {cancelOrders.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                            No cancel orders found. Click "Add New" to create one.
                          </td>
                        </tr>
                      ) : (
                        cancelOrders.map(cancelOrder => (
                          <tr key={cancelOrder.CancelNo} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 text-sm font-medium text-gray-900">
                              {cancelOrder.CancelNo}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700">
                              {cancelOrder.OrderNo}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700">
                              {cancelOrder.PartyName}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700">
                              {new Date(cancelOrder.CancelDate).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-700">
                              {cancelOrder.Reason || '-'}
                            </td>
                            <td className="px-6 py-3 text-center">
                              <div className="flex justify-center gap-3">
                                <button
                                  onClick={() => handleEdit(cancelOrder)}
                                  className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(cancelOrder.CancelNo)}
                                  className="text-red-600 hover:text-red-800 font-medium transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CancelOrder;