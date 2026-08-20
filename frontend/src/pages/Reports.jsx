// frontend/src/pages/Reports.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useToastStore } from '../store/toastStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const reportOptions = {
  Purchase: [
    { label: 'Supplier Wise Order Details', key: 'supplier-wise' },
    { label: 'Department Wise Order Details', key: 'department-wise' }
  ],
  Receipt: [
    { label: 'Date Wise Receipt Register', key: 'date-wise' },
    { label: 'Party Wise Receipt Register', key: 'party-wise' },
    { label: 'Department Wise Receipt Register', key: 'department-wise' },
    { label: 'Item Wise Receipt Register', key: 'item-wise' }
  ],
  Issue: [
    { label: 'Date Wise Issue Register', key: 'date-wise' },
    { label: 'Item Wise Issue Register', key: 'item-wise' },
    { label: 'Department Wise Issue Register', key: 'department-wise' }
  ],
  Stock: [
    { label: 'Item Wise Stock', key: 'item-wise' },
    { label: 'Department Wise Stock Abstract', key: 'department-wise' }
  ]
};

const categoryApiPrefix = {
  Purchase: 'purchase',
  Receipt: 'receipt',
  Issue: 'issue',
  Stock: 'stock'
};

const Reports = () => {
  const navigate = useNavigate();
  const showToast = useToastStore(state => state.showToast);
  const [selectedCategory, setSelectedCategory] = useState('Purchase');
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReportKey, setSelectedReportKey] = useState('');

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setSelectedReportKey('');
  };

  const handleViewReport = () => {
    if (!selectedReportKey) {
      showToast('Please select a report', 'error');
      return;
    }

    // Special case: Stock -> Item Wise Stock => download Excel
    if (selectedCategory === 'Stock' && selectedReportKey === 'item-wise') {
      handleExcelDownload();
      return;
    }

    const prefix = categoryApiPrefix[selectedCategory];
    const params = new URLSearchParams({
      category: prefix,
      report: selectedReportKey,
      fromDate,
      toDate,
      title: currentReports.find(r => r.key === selectedReportKey)?.label || ''
    });

    window.open(`/reports/view?${params.toString()}`, '_blank');
  };

  const handleExcelDownload = async () => {
    try {
      const response = await axios.get(`${API_URL}/reports/stock/item-wise`, {
        responseType: 'blob',
        params: { fromDate, toDate }
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ItemWiseStock_${fromDate}_to_${toDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating item wise stock report:', error);
      showToast('Failed to generate Item Wise Stock report', 'error');
    }
  };

  const currentReports = reportOptions[selectedCategory] || [];

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft size={20} />
          <span>Back to Dashboard</span>
        </button>

        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-blue-600 text-white rounded-t-lg p-6 mb-0">
            <h2 className="text-2xl font-bold">Reports</h2>
          </div>

          {/* Main Content */}
          <div className="bg-white rounded-b-lg shadow-lg p-6 border-t-4 border-blue-600">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {/* Left Sidebar - Categories */}
              <div className="md:col-span-1">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-gray-800 mb-4">Report Category</h3>
                  <div className="space-y-3">
                    {Object.keys(reportOptions).map(category => (
                      <label key={category} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="category"
                          value={category}
                          checked={selectedCategory === category}
                          onChange={() => handleCategoryChange(category)}
                          className="w-4 h-4"
                        />
                        <span className="text-gray-700 font-medium">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Content Area */}
              <div className="md:col-span-4 space-y-6">
                {/* Date Range Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2" />
                  </div>
                </div>

                {/* Report Selection Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Report</label>
                  <select
                    value={selectedReportKey}
                    onChange={(e) => setSelectedReportKey(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Select Report --</option>
                    {currentReports.map((report) => (
                      <option key={report.key} value={report.key}>
                        {report.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Empty State */}
                {!selectedReportKey && (
                  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-8 text-center">
                    <p className="text-gray-600">Select a report to view options</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 mt-8 pt-6 border-t">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Exit
              </button>
              <button
                onClick={handleViewReport}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
              >
                <Eye size={18} />
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Reports;