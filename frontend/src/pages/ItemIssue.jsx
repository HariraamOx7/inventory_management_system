// frontend/src/pages/ItemIssue.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, X, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Layout from '../components/Layout';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const initialFormState = {
  IssueNo: '',
  IssueDate: new Date().toISOString().split('T')[0],
  IndentNo: '',
  Department: '',
  Approval: '',
  Remarks: ''
};

const initialItemState = {
  ItemName: '',
  CatNo: '',
  DrawNo: '',
  Qty: '',
  OpeningQty: '',
  UOM: '',
  EmpName: ''
};

export default function ItemIssue() {
  const [formData, setFormData] = useState(initialFormState);
  const [items, setItems] = useState([]);
  const [loadingDeptItems, setLoadingDeptItems] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore(state => state.showToast);
  const [issues, setIssues] = useState([]);
  const [editingIssueNo, setEditingIssueNo] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Get last issue number
        const issueRes = await axios.get(`${API_URL}/item-issues/last-issue-no`);
        if (issueRes.data.success) {
          setFormData(prev => ({
            ...prev,
            IssueNo: (issueRes.data.data.lastIssueNo + 1).toString()
          }));
        }

        // Get departments
        const deptRes = await axios.get(`${API_URL}/item-issues/departments`);
        if (deptRes.data.success) {
          setDepartments(deptRes.data.data);
        }



        // Get issues
        const issuesRes = await axios.get(`${API_URL}/item-issues`);
        if (issuesRes.data.success) {
          setIssues(issuesRes.data.data);
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


  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const issueItems = items.filter(i => Number(i.Qty) > 0);

    if (!formData.Department || issueItems.length === 0) {
      showToast('Please select a department and enter Qty for at least one item', 'error');
      return;
    }

    const invalid = issueItems.find(i => Number(i.Qty) >= Number(i.OpeningQty));
    if (invalid) {
      showToast('Qty must be less than OpeningQty for ' + invalid.ItemName, 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        items: issueItems
      };

      if (editingIssueNo) {
        await axios.put(`${API_URL}/item-issues/${editingIssueNo}`, payload);
        showToast('Item Issue updated successfully!', 'success');
      } else {
        await axios.post(`${API_URL}/item-issues`, payload);
        showToast('Item Issue created successfully!', 'success');
      }

      setFormData(initialFormState);
      setItems([]);
      setShowForm(false);
      setEditingIssueNo(null);

      // Refresh issues
      const issuesRes = await axios.get(`${API_URL}/item-issues`);
      if (issuesRes.data.success) {
        setIssues(issuesRes.data.data);
      }
    } catch (error) {
      console.error('Error saving item issue:', error);
      showToast('Error saving item issue: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (issue) => {
    setFormData({
      IssueNo: issue.IssueNo,
      IssueDate: issue.IssueDate,
      IndentNo: issue.IndentNo || '',
      Department: issue.Department,
      Approval: issue.Approval || '',
      Remarks: issue.Remarks || ''
    });

    if (issue.details) {
      setItems(issue.details.map(detail => ({
        ItemName: detail.ItemName,
        CatNo: detail.CatNo || '',
        DrawNo: detail.DrawNo || '',
        Qty: detail.Qty,
        OpeningQty: detail.OpeningQty || 0,
        UOM: detail.UOM || '',
        EmpName: detail.EmpName || ''
      })));
    }

    setEditingIssueNo(issue.IssueNo);
    setShowForm(true);
  };

  const handleDelete = async (issueNo) => {
    if (!confirm('Are you sure you want to delete this Item Issue?')) return;

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/item-issues/${issueNo}`);
      showToast('Item Issue deleted successfully!', 'success');

      const issuesRes = await axios.get(`${API_URL}/item-issues`);
      if (issuesRes.data.success) {
        setIssues(issuesRes.data.data);
      }
    } catch (error) {
      console.error('Error deleting item issue:', error);
      showToast('Error deleting item issue', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormState);
    setItems([]);
    setShowForm(false);
    setEditingIssueNo(null);
  };

  const fetchDepartmentItems = async (departmentName) => {
    try {
      setLoadingDeptItems(true);
      const res = await axios.get(API_URL + '/item-issues/items-by-department', {
        params: { department: departmentName }
      });

      if (res.data.success) {
        setItems((res.data.data || []).map(row => ({
          ItemCode: row.ItemCode,
          ItemName: row.ItemName,
          CatNo: '',
          DrawNo: '',
          Qty: row.Qty || 0,
          OpeningQty: row.OpeningQty || 0,
          UOM: row.UOM || '',
          EmpName: row.EmpName || ''
        })));
      }
    } catch (err) {
      console.error('Error fetching department items:', err);
      showToast('Error fetching department items', 'error');
      setItems([]);
    } finally {
      setLoadingDeptItems(false);
    }
  };

  const handleDepartmentChange = (departmentName) => {
    setFormData({ ...formData, Department: departmentName });

    if (!departmentName) {
      setItems([]);
      return;
    }

    // For edit mode, keep loaded issue rows; for new issue, load fresh department items
    if (!editingIssueNo) {
      fetchDepartmentItems(departmentName);
    }
  };

  const handleItemRowChange = (index, field, value) => {
    setItems(prev =>
      prev.map((row, i) => {
        if (i !== index) return row;

        if (field === 'Qty') {
          const qty = Number(value || 0);
          const stock = Number(row.OpeningQty || 0);

          if (qty < 0) return { ...row, Qty: 0 };
          if (qty >= stock) {
            showToast('Qty must be less than OpeningQty for ' + row.ItemName, 'error');
            return row;
          }

          return { ...row, Qty: qty };
        }

        if (field === 'EmpName') {
          return { ...row, EmpName: value };
        }

        return row;
      })
    );
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
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Item Issue</h2>
                  <p className="text-sm text-gray-600">To add, modify, delete issue details.</p>
                </div>
                <button
                  onClick={() => {
                    setShowForm(true);
                    setFormData(initialFormState);
                    setItems([]);
                    setEditingIssueNo(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + New Issue
                </button>
              </div>
            </div>



            {/* Issues List */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Issue No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Issue Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Indent No</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-900">Department</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-900">Items</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-4 text-center text-gray-500">
                          No Issues found
                        </td>
                      </tr>
                    ) : (
                      issues.map(issue => (
                        <tr key={issue.IssueNo} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{issue.IssueNo}</td>
                          <td className="px-4 py-3">{new Date(issue.IssueDate).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{issue.IndentNo || '-'}</td>
                          <td className="px-4 py-3">{issue.Department}</td>
                          <td className="px-4 py-3 text-center">{issue.details?.length || 0}</td>
                          <td className="px-4 py-3 text-center space-x-2 flex justify-center">
                            <button
                              onClick={() => handleEdit(issue)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(issue.IssueNo)}
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
              <h2 className="text-2xl font-bold text-blue-900 mb-1">Item Issue</h2>
              <p className="text-sm text-blue-700">To add, modify, delete issue details.</p>
            </div>



            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue No</label>
                <input
                  type="text"
                  value={formData.IssueNo}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={formData.IssueDate}
                  onChange={(e) => setFormData({ ...formData, IssueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indent No</label>
                <input
                  type="text"
                  value={formData.IndentNo}
                  onChange={(e) => setFormData({ ...formData, IndentNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.Department}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Approval</label>
                <input
                  type="text"
                  value={formData.Approval}
                  onChange={(e) => setFormData({ ...formData, Approval: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={formData.Remarks}
                  onChange={(e) => setFormData({ ...formData, Remarks: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Add Item Section */}
            <div className='border rounded-lg p-4 bg-gray-50 mb-6'>
              <h3 className='font-semibold text-gray-900 mb-4'>Department Items</h3>

              {loadingDeptItems ? (
                <p className='text-sm text-gray-600'>Loading items...</p>
              ) : items.length === 0 ? (
                <p className='text-sm text-gray-600'>Select a department to load items.</p>
              ) : (
                <div className='overflow-x-auto border rounded-lg bg-white'>
                  <table className='w-full text-sm'>
                    <thead className='bg-gray-100 border-b'>
                      <tr>
                        <th className='px-4 py-2 text-left font-semibold text-gray-900'>Item Name</th>
                        <th className='px-4 py-2 text-left font-semibold text-gray-900'>Qty</th>
                        <th className='px-4 py-2 text-left font-semibold text-gray-900'>OpeningQty</th>
                        <th className='px-4 py-2 text-left font-semibold text-gray-900'>UOM</th>
                        <th className='px-4 py-2 text-left font-semibold text-gray-900'>Emp Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row, idx) => (
                        <tr key={row.ItemCode || idx} className='border-b hover:bg-gray-50'>
                          <td className='px-4 py-2'>{row.ItemName}</td>
                          <td className='px-4 py-2'>
                            <input
                              type='number'
                              onWheel={(e) => e.target.blur()}
                              step='1'
                              min='0'
                              value={row.Qty}
                              onChange={(e) => handleItemRowChange(idx, 'Qty', e.target.value)}
                              className='w-28 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500'
                            />
                          </td>
                          <td className='px-4 py-2'>{row.OpeningQty}</td>
                          <td className='px-4 py-2'>{row.UOM}</td>
                          <td className='px-4 py-2'>
                            <input
                              type='text'
                              value={row.EmpName || ''}
                              onChange={(e) => handleItemRowChange(idx, 'EmpName', e.target.value)}
                              className='w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500'
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Items Table */}
            {items.length > 0 && (
              <div className="mb-6 border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold">Item Name</th>
                      <th className="px-4 py-2 text-left font-semibold">Cat No</th>
                      <th className="px-4 py-2 text-left font-semibold">Draw No</th>
                      <th className="px-4 py-2 text-right font-semibold">Qty</th>
                      <th className="px-4 py-2 text-right font-semibold">OpeningQty</th>
                      <th className="px-4 py-2 text-center font-semibold">UOM</th>
                      <th className="px-4 py-2 text-left font-semibold">Emp Name</th>
                      <th className="px-4 py-2 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{item.ItemName}</td>
                        <td className="px-4 py-2">{item.CatNo}</td>
                        <td className="px-4 py-2">{item.DrawNo}</td>
                        <td className="px-4 py-2 text-right">{item.Qty}</td>
                        <td className="px-4 py-2 text-right">{item.OpeningQty}</td>
                        <td className="px-4 py-2 text-center">{item.UOM}</td>
                        <td className="px-4 py-2">{item.EmpName}</td>
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

            {/* No. of Items */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <label className="text-sm font-medium text-gray-700">No. of items: {items.length}</label>
            </div>

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