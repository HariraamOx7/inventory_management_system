import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Edit2 } from 'lucide-react';
import Layout from '../components/Layout';
import SearchSelect from '../components/SearchSelect';
import { useToastStore } from '../store/toastStore';

const BillVerify = () => {
  const showToast = useToastStore(state => state.showToast);
  const API_BASE_URL = 'http://localhost:5000/api';
  const [fromDate, setFromDate] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedBillNo, setSelectedBillNo] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [partyNames, setPartyNames] = useState([]);
  const [billRecords, setBillRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    PaymentStatus: 'Paid',
    Remarks: ''
  });

  // Fetch party names
  const fetchPartyNames = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/bill-verify/party-names`);
      if (response.data.success) {
        setPartyNames(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching party names:', error);
    }
  };

  // Load bill records based on filters
  const handleLoadRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (selectedParty) params.append('partyName', selectedParty);
      if (selectedBillNo) params.append('billNo', selectedBillNo);
      if (paymentStatus) params.append('paymentStatus', paymentStatus);

      const response = await axios.get(`${API_BASE_URL}/bill-verify?${params.toString()}`);
      if (response.data.success) {
        setBillRecords(response.data.data);
      }
    } catch (error) {
      console.error('Error loading bill records:', error);
      showToast('Error loading bill records', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingRecord(record);
    setEditFormData({
      PaymentStatus: record.PaymentStatus,
      Remarks: record.Remarks || ''
    });
    setShowEditForm(true);
  };

  // Handle update
  const handleUpdate = async () => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/bill-verify/${editingRecord.VerifyNo}`,
        editFormData
      );

      if (response.data.success) {
        showToast('Bill verify record updated successfully', 'success');
        setShowEditForm(false);
        handleLoadRecords();
      }
    } catch (error) {
      console.error('Error updating record:', error);
      showToast('Error updating record', 'error');
    }
  };

  // Handle delete
  const handleDelete = async (verifyNo) => {
    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/bill-verify/${verifyNo}`);

      if (response.data.success) {
        showToast('Bill verify record deleted successfully', 'success');
        handleLoadRecords();
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      showToast('Error deleting record', 'error');
    }
  };

  useEffect(() => {
    fetchPartyNames();
  }, []);

  return (
    <Layout>
      <div className="min-h-screen bg-blue-50 p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Bill Verify</h1>

            {/* Filter Section */}
            <div className="space-y-4">
              {/* Date Range and Status Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                {/* From Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* To Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Load Button */}
                <div>
                  <button
                    onClick={handleLoadRecords}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Load
                  </button>
                </div>

                {/* Status Radio Buttons */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="Paid"
                      checked={paymentStatus === 'Paid'}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Paid</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="UnPaid"
                      checked={paymentStatus === 'UnPaid'}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">UnPaid</span>
                  </label>
                </div>
              </div>

              {/* Party Name */}
              <SearchSelect
                label="Party"
                options={partyNames.map(p => ({ value: p, label: p }))}
                value={selectedParty}
                onChange={(val) => setSelectedParty(val)}
                placeholder="Search or select party name..."
              />

              {/* Bill Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bill Number</label>
                <input
                  type="text"
                  value={selectedBillNo}
                  onChange={(e) => setSelectedBillNo(e.target.value)}
                  placeholder="Enter bill number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Edit Modal */}
          {showEditForm && editingRecord && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Edit Bill Verify</h2>

                <div className="space-y-4">
                  {/* Bill No (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bill No</label>
                    <input
                      type="text"
                      value={editingRecord.BillNo}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    />
                  </div>

                  {/* Party Name (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Party Name</label>
                    <input
                      type="text"
                      value={editingRecord.PartyName}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    />
                  </div>

                  {/* Payment Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                    <select
                      value={editFormData.PaymentStatus}
                      onChange={(e) =>
                        setEditFormData(prev => ({ ...prev, PaymentStatus: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Paid">Paid</option>
                      <option value="UnPaid">UnPaid</option>
                    </select>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <textarea
                      value={editFormData.Remarks}
                      onChange={(e) =>
                        setEditFormData(prev => ({ ...prev, Remarks: e.target.value }))
                      }
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 mt-6 justify-end">
                  <button
                    onClick={() => setShowEditForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Table Section */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : billRecords.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No bill records found. Click "Load" to fetch data.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Bill No
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Bill Date
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                        Party Name
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                        Bill Amount
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                        GST Amount
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                        IGST Amount
                      </th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                        Paid
                      </th>
                      <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {billRecords.map(record => (
                      <tr key={record.VerifyNo} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">
                          {record.BillNo || record.VoucherNo}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-700">
                          {new Date(record.BillDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-700">
                          {record.PartyName}
                        </td>
                        <td className="px-6 py-3 text-sm text-right text-gray-700">
                          {Number(record.BillAmount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-sm text-right text-gray-700">
                          {Number(record.GSTAmount || record.GST || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-sm text-right text-gray-700">
                          {Number(record.IGSTAmount || record.IGST || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={record.PaymentStatus === 'Paid'}
                            onChange={() => handleEdit(record)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEdit(record)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Edit"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(record.VerifyNo)}
                              className="text-red-600 hover:text-red-800"
                              title="Delete"
                            >
                              <Trash2 size={18} />
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

          {/* Footer - Save and Cancel buttons */}
          <div className="flex justify-end gap-4 mt-6">
            <button className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Save
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BillVerify;