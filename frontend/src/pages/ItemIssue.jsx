// frontend/src/pages/ItemIssue.jsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  PackageCheck,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  FileText,
  Building2,
  Calendar,
  User,
  Hash,
  FileSpreadsheet,
  Loader2,
  Printer,
  AlertTriangle,
  Inbox,
  Tag
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import Layout from '../components/Layout';
import CustomSelect from '../components/CustomSelect';
import PageHeader from '../components/ui/PageHeader';
import FilterPanel from '../components/ui/FilterPanel';
import PaginationBar from '../components/ui/PaginationBar';
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

export default function ItemIssue() {
  const showToast = useToastStore((state) => state.showToast);

  // Form & Drawer State
  const [formData, setFormData] = useState(initialFormState);
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [departments, setDepartments] = useState([]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDeptItems, setLoadingDeptItems] = useState(false);

  // Slide-over Drawer states
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [editingIssueNo, setEditingIssueNo] = useState(null);

  // Filters, Search & Pagination
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch initial data on mount
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [issueRes, deptRes, issuesRes] = await Promise.all([
        axios.get(`${API_URL}/item-issues/last-issue-no`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/item-issues/departments`).catch(() => ({ data: { success: false } })),
        axios.get(`${API_URL}/item-issues`).catch(() => ({ data: { success: false } }))
      ]);

      if (issueRes.data?.success) {
        setFormData((prev) => ({
          ...prev,
          IssueNo: (issueRes.data.data.lastIssueNo + 1).toString()
        }));
      }

      if (deptRes.data?.success) {
        setDepartments(deptRes.data.data || []);
      }

      if (issuesRes.data?.success) {
        setIssues(issuesRes.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      showToast('Error loading item issues data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch items belonging to a selected department
  const fetchDepartmentItems = async (departmentName) => {
    if (!departmentName) {
      setItems([]);
      return;
    }
    try {
      setLoadingDeptItems(true);
      const res = await axios.get(`${API_URL}/item-issues/items-by-department`, {
        params: { department: departmentName }
      });

      if (res.data?.success) {
        setItems(
          (res.data.data || []).map((row) => ({
            ItemCode: row.ItemCode,
            ItemName: row.ItemName,
            CatNo: '',
            DrawNo: '',
            Qty: row.Qty || 0,
            OpeningQty: row.OpeningQty || 0,
            UOM: row.UOM || ''
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching department items:', err);
      showToast('Error fetching items for selected department', 'error');
      setItems([]);
    } finally {
      setLoadingDeptItems(false);
    }
  };

  const handleDepartmentChange = (departmentName) => {
    setFormData((prev) => ({ ...prev, Department: departmentName }));
    if (!editingIssueNo) {
      fetchDepartmentItems(departmentName);
    }
  };

  // Drawer Open / Close helpers with smooth slide animation
  const handleOpenNewIssue = async () => {
    try {
      const issueRes = await axios.get(`${API_URL}/item-issues/last-issue-no`);
      const nextIssueNo = issueRes.data?.success
        ? (issueRes.data.data.lastIssueNo + 1).toString()
        : '1';

      setFormData({
        ...initialFormState,
        IssueNo: nextIssueNo,
        IssueDate: new Date().toISOString().split('T')[0]
      });
      setItems([]);
      setItemSearch('');
      setEditingIssueNo(null);
      setEditDrawerOpen(true);
      setTimeout(() => setIsDrawerVisible(true), 20);
    } catch (err) {
      console.error('Error getting next issue number:', err);
      setFormData({
        ...initialFormState,
        IssueNo: '1',
        IssueDate: new Date().toISOString().split('T')[0]
      });
      setItems([]);
      setItemSearch('');
      setEditingIssueNo(null);
      setEditDrawerOpen(true);
      setTimeout(() => setIsDrawerVisible(true), 20);
    }
  };

  const handleEdit = async (issue) => {
    const issueDateStr = issue.IssueDate
      ? new Date(issue.IssueDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    setFormData({
      IssueNo: issue.IssueNo,
      IssueDate: issueDateStr,
      IndentNo: issue.IndentNo || '',
      Department: issue.Department || '',
      Approval: issue.Approval || '',
      Remarks: issue.Remarks || ''
    });

    setItemSearch('');
    setEditingIssueNo(issue.IssueNo);
    setEditDrawerOpen(true);
    setTimeout(() => setIsDrawerVisible(true), 20);

    if (issue.Department) {
      try {
        setLoadingDeptItems(true);
        const res = await axios.get(`${API_URL}/item-issues/items-by-department`, {
          params: { department: issue.Department }
        });

        if (res.data?.success) {
          const deptItems = res.data.data || [];
          const issueDetailsMap = new Map();
          (issue.details || []).forEach((d) => {
            issueDetailsMap.set(d.ItemName, d);
          });

          // Merge live department stock with this issue's issued quantities
          const merged = deptItems.map((row) => {
            const existingDetail = issueDetailsMap.get(row.ItemName);
            const issuedQty = existingDetail ? Number(existingDetail.Qty || 0) : 0;
            // Since backend update restores old Qty before re-deducting,
            // the effective available stock in this edit session is:
            // current warehouse stock + already issued quantity in this voucher
            const effectiveStock = Number(row.OpeningQty || 0) + issuedQty;

            return {
              ItemCode: row.ItemCode,
              ItemName: row.ItemName,
              CatNo: existingDetail?.CatNo || '',
              DrawNo: existingDetail?.DrawNo || '',
              Qty: issuedQty > 0 ? issuedQty : 0,
              OpeningQty: effectiveStock,
              UOM: row.UOM || existingDetail?.UOM || ''
            };
          });

          // Include any existing issue details if not in deptItems
          (issue.details || []).forEach((d) => {
            if (!deptItems.some((it) => it.ItemName === d.ItemName)) {
              const issuedQty = Number(d.Qty || 0);
              const baseStock = Number(d.OpeningQty || d.Stock || 0);
              merged.push({
                ItemCode: '',
                ItemName: d.ItemName,
                CatNo: d.CatNo || '',
                DrawNo: d.DrawNo || '',
                Qty: issuedQty,
                OpeningQty: baseStock > 0 ? baseStock : issuedQty + 1,
                UOM: d.UOM || ''
              });
            }
          });

          setItems(merged);
        }
      } catch (err) {
        console.error('Error fetching department items for edit:', err);
        if (issue.details && Array.isArray(issue.details)) {
          setItems(
            issue.details.map((detail) => ({
              ItemName: detail.ItemName,
              CatNo: detail.CatNo || '',
              DrawNo: detail.DrawNo || '',
              Qty: Number(detail.Qty || 0),
              OpeningQty: Number(detail.OpeningQty || detail.Stock || 0) || (Number(detail.Qty || 0) + 1),
              UOM: detail.UOM || ''
            }))
          );
        }
      } finally {
        setLoadingDeptItems(false);
      }
    }
  };

  const handleCloseDrawer = () => {
    setIsDrawerVisible(false);
    setTimeout(() => {
      setEditDrawerOpen(false);
      setFormData(initialFormState);
      setItems([]);
      setItemSearch('');
      setEditingIssueNo(null);
    }, 300);
  };

  // Item quantity change handler
  const handleItemRowChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        if (field === 'Qty') {
          const qty = value === '' ? '' : Number(value);
          if (qty < 0) return { ...row, Qty: 0 };
          return { ...row, Qty: qty };
        }

        return row;
      })
    );
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();

    if (!formData.Department) {
      showToast('Please select a department', 'error');
      return;
    }

    const issueItems = items.filter((i) => Number(i.Qty) > 0);

    if (issueItems.length === 0) {
      showToast('Please enter Quantity (> 0) for at least one item', 'error');
      return;
    }

    // Validate that Qty < OpeningQty
    const invalid = issueItems.find(
      (i) => Number(i.Qty) >= Number(i.OpeningQty)
    );
    if (invalid) {
      showToast(
        `Quantity (${invalid.Qty}) must be less than current stock (${invalid.OpeningQty}) for "${invalid.ItemName}"`,
        'error'
      );
      return;
    }

    try {
      setSaving(true);
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

      handleCloseDrawer();

      // Refresh list
      const issuesRes = await axios.get(`${API_URL}/item-issues`);
      if (issuesRes.data?.success) {
        setIssues(issuesRes.data.data || []);
      }
    } catch (error) {
      console.error('Error saving item issue:', error);
      const errorMsg =
        error.response?.data?.message || error.message || 'Error saving item issue';
      showToast(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (issueNo) => {
    if (!window.confirm(`Are you sure you want to delete Item Issue #${issueNo}? Stock will be restored.`)) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_URL}/item-issues/${issueNo}`);
      showToast(`Item Issue #${issueNo} deleted successfully`, 'success');

      const issuesRes = await axios.get(`${API_URL}/item-issues`);
      if (issuesRes.data?.success) {
        setIssues(issuesRes.data.data || []);
      }
    } catch (error) {
      console.error('Error deleting item issue:', error);
      showToast('Error deleting item issue', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF Issue Voucher
  const handlePrintSlip = (issue) => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let y = 18;

      const drawLine = (yPos) => {
        doc.setLineWidth(0.2);
        doc.line(margin, yPos, pageWidth - margin, yPos);
      };

      // Header Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('STORE ITEM ISSUE SLIP', pageWidth / 2, y, { align: 'center' });
      y += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Internal Store Issue Voucher', pageWidth / 2, y, { align: 'center' });
      y += 5;
      drawLine(y);
      y += 6;

      // Metadata Grid
      doc.setFontSize(9);
      const col1 = margin + 2;
      const col2 = margin + contentWidth * 0.52;

      // Row 1
      doc.setFont('helvetica', 'bold');
      doc.text('Issue No:', col1, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`ISS-${String(issue.IssueNo).padStart(4, '0')}`, col1 + 22, y);

      doc.setFont('helvetica', 'bold');
      doc.text('Issue Date:', col2, y);
      doc.setFont('helvetica', 'normal');
      const issueDateStr = issue.IssueDate
        ? new Date(issue.IssueDate).toLocaleDateString('en-GB')
        : '-';
      doc.text(issueDateStr, col2 + 25, y);
      y += 6;

      // Row 2
      doc.setFont('helvetica', 'bold');
      doc.text('Department:', col1, y);
      doc.setFont('helvetica', 'normal');
      doc.text(issue.Department || '-', col1 + 22, y);

      doc.setFont('helvetica', 'bold');
      doc.text('Indent No:', col2, y);
      doc.setFont('helvetica', 'normal');
      doc.text(issue.IndentNo || '-', col2 + 25, y);
      y += 6;

      // Row 3
      doc.setFont('helvetica', 'bold');
      doc.text('Approved By:', col1, y);
      doc.setFont('helvetica', 'normal');
      doc.text(issue.Approval || '-', col1 + 22, y);

      doc.setFont('helvetica', 'bold');
      doc.text('Remarks:', col2, y);
      doc.setFont('helvetica', 'normal');
      doc.text(issue.Remarks || '-', col2 + 25, y);
      y += 6;

      drawLine(y);
      y += 6;

      // Table Header
      doc.setFillColor(243, 244, 246);
      doc.rect(margin, y - 4, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);

      const cSNo = margin + 4;
      const cItem = margin + 20;
      const cQty = margin + contentWidth * 0.72;
      const cUOM = margin + contentWidth * 0.88;

      doc.text('S.No', cSNo, y);
      doc.text('Item Description', cItem, y);
      doc.text('Qty Issued', cQty, y, { align: 'right' });
      doc.text('UOM', cUOM, y);
      y += 5;
      drawLine(y);
      y += 5;

      // Items Rows
      doc.setFont('helvetica', 'normal');
      let totalQty = 0;
      const details = issue.details || [];

      details.forEach((item, index) => {
        const qtyNum = parseFloat(item.Qty) || 0;
        totalQty += qtyNum;

        doc.text(String(index + 1), cSNo, y);
        doc.text(item.ItemName || '-', cItem, y);
        doc.text(qtyNum.toLocaleString('en-IN'), cQty, y, { align: 'right' });
        doc.text(item.UOM || '-', cUOM, y);

        y += 6;

        // Page break safety
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
      });

      y += 2;
      drawLine(y);
      y += 5;

      // Summary Row
      doc.setFont('helvetica', 'bold');
      doc.text('Total Items Issued:', cItem, y);
      doc.text(totalQty.toLocaleString('en-IN'), cQty, y, { align: 'right' });
      doc.text(`${details.length} Line item(s)`, cUOM, y);
      y += 4;
      drawLine(y);
      y += 22;

      // Signatures
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Prepared By', margin + 15, y);
      doc.text('Store Incharge / Issued By', pageWidth / 2, y, { align: 'center' });
      doc.text('Authorized Signatory', pageWidth - margin - 20, y, { align: 'right' });

      doc.save(`Issue_Slip_ISS_${String(issue.IssueNo).padStart(4, '0')}.pdf`);
      showToast(`Issue Slip #${issue.IssueNo} downloaded successfully!`, 'success');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Failed to generate Issue Slip PDF', 'error');
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalIssuesCount = issues.length;
    const uniqueDepts = new Set(issues.map((i) => i.Department).filter(Boolean)).size;
    const totalLineItems = issues.reduce(
      (acc, iss) => acc + (iss.details?.length || 0),
      0
    );
    const totalUnits = issues.reduce((acc, iss) => {
      const sub = (iss.details || []).reduce(
        (subAcc, item) => subAcc + (Number(item.Qty) || 0),
        0
      );
      return acc + sub;
    }, 0);

    return {
      totalIssuesCount,
      uniqueDepts,
      totalLineItems,
      totalUnits
    };
  }, [issues]);

  // Filtering & Sorting
  const filteredAndSortedIssues = useMemo(() => {
    let result = [...issues];

    // Department Filter
    if (departmentFilter && departmentFilter !== 'ALL') {
      result = result.filter((i) => i.Department === departmentFilter);
    }

    // Search Query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((issue) => {
        const issueNoMatch = String(issue.IssueNo || '').toLowerCase().includes(q);
        const indentMatch = String(issue.IndentNo || '').toLowerCase().includes(q);
        const deptMatch = String(issue.Department || '').toLowerCase().includes(q);
        const approvalMatch = String(issue.Approval || '').toLowerCase().includes(q);
        const remarksMatch = String(issue.Remarks || '').toLowerCase().includes(q);

        const itemsMatch = (issue.details || []).some(
          (d) => String(d.ItemName || '').toLowerCase().includes(q)
        );

        return (
          issueNoMatch ||
          indentMatch ||
          deptMatch ||
          approvalMatch ||
          remarksMatch ||
          itemsMatch
        );
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return Number(b.IssueNo) - Number(a.IssueNo);
      }
      if (sortBy === 'oldest') {
        return Number(a.IssueNo) - Number(b.IssueNo);
      }
      if (sortBy === 'dateDesc') {
        return new Date(b.IssueDate || 0) - new Date(a.IssueDate || 0);
      }
      if (sortBy === 'dateAsc') {
        return new Date(a.IssueDate || 0) - new Date(b.IssueDate || 0);
      }
      if (sortBy === 'deptAsc') {
        return (a.Department || '').localeCompare(b.Department || '');
      }
      return 0;
    });

    return result;
  }, [issues, search, departmentFilter, sortBy]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedIssues.length / itemsPerPage) || 1;
  const paginatedIssues = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedIssues.slice(start, start + itemsPerPage);
  }, [filteredAndSortedIssues, currentPage, itemsPerPage]);

  // Filter department items within the drawer search
  const filteredDrawerItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = itemSearch.toLowerCase().trim();
    return items.filter(
      (item) =>
        String(item.ItemName || '').toLowerCase().includes(q) ||
        String(item.ItemCode || '').toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  const activeIssueCount = items.filter((i) => Number(i.Qty) > 0).length;
  const activeIssueUnits = items.reduce((acc, i) => acc + (Number(i.Qty) || 0), 0);

  // Department filter options
  const departmentOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'All Departments' },
      ...departments.map((d) => ({ value: d.name, label: d.name }))
    ];
  }, [departments]);

  const sortOptions = [
    { value: 'newest', label: 'Issue No (High to Low)' },
    { value: 'oldest', label: 'Issue No (Low to High)' },
    { value: 'dateDesc', label: 'Issue Date (Latest First)' },
    { value: 'dateAsc', label: 'Issue Date (Oldest First)' },
    { value: 'deptAsc', label: 'Department (A - Z)' }
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50/60 p-4 sm:p-6 space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Item Issue"
          subtitle="Manage store inventory issues, department allocations, and stock deductions."
          icon={PackageCheck}
          actionText="New Issue"
          onActionClick={handleOpenNewIssue}
        />

        {/* Top KPI Stats Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Issues */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Issues
              </p>
              <h3 className="text-2xl font-bold text-slate-800">
                {stats.totalIssuesCount}
              </h3>
              <p className="text-xs text-slate-400">Total issue vouchers recorded</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Layers className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Active Departments */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Departments
              </p>
              <h3 className="text-2xl font-bold text-slate-800">
                {stats.uniqueDepts}
              </h3>
              <p className="text-xs text-slate-400">Receiving store items</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Total Line Items */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Line Items
              </p>
              <h3 className="text-2xl font-bold text-slate-800">
                {stats.totalLineItems}
              </h3>
              <p className="text-xs text-slate-400">Issued across all entries</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Tag className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Total Units Issued */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Units
              </p>
              <h3 className="text-2xl font-bold text-slate-800">
                {stats.totalUnits.toLocaleString('en-IN')}
              </h3>
              <p className="text-xs text-slate-400">Quantity dispatched</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <FilterPanel
          search={search}
          onSearchChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by Issue No, Indent, Department, Approval or Item..."
          filters={[
            {
              label: 'Department',
              icon: Building2,
              value: departmentFilter,
              onChange: (val) => {
                setDepartmentFilter(val);
                setCurrentPage(1);
              },
              options: departmentOptions,
              searchable: true
            }
          ]}
          sortOptions={sortOptions}
          sortBy={sortBy}
          onSortChange={(val) => {
            setSortBy(val);
            setCurrentPage(1);
          }}
        />

        {/* Item Issues List Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-800">Item Issue Records</h2>
              <p className="text-xs text-slate-500">
                Showing {filteredAndSortedIssues.length} issue voucher
                {filteredAndSortedIssues.length === 1 ? '' : 's'}
              </p>
            </div>

            {(search || (departmentFilter && departmentFilter !== 'ALL')) && (
              <button
                onClick={() => {
                  setSearch('');
                  setDepartmentFilter('ALL');
                  setCurrentPage(1);
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Issue No</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Indent No</th>
                  <th className="py-3.5 px-4">Issued Items</th>
                  <th className="py-3.5 px-4 text-center">Total Qty</th>
                  <th className="py-3.5 px-4">Approved By</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                        <p className="text-sm font-medium text-slate-600">Loading issue records...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedIssues.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                          <Inbox className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold text-slate-700">No Item Issues Found</h3>
                        <p className="text-xs text-slate-500">
                          {search || departmentFilter !== 'ALL'
                            ? 'No records match your active search or filters.'
                            : 'No item issues have been recorded yet. Click "+ New Issue" to record one.'}
                        </p>
                        {search || departmentFilter !== 'ALL' ? (
                          <button
                            onClick={() => {
                              setSearch('');
                              setDepartmentFilter('ALL');
                            }}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Reset Search
                          </button>
                        ) : (
                          <button
                            onClick={handleOpenNewIssue}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                          >
                            Create First Issue
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedIssues.map((issue) => {
                    const totalUnits = (issue.details || []).reduce(
                      (acc, item) => acc + (Number(item.Qty) || 0),
                      0
                    );

                    return (
                      <tr key={issue.IssueNo} className="hover:bg-slate-50/70 transition-colors">
                        {/* Issue No */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                            ISS-{String(issue.IssueNo).padStart(4, '0')}
                          </span>
                        </td>

                        {/* Issue Date */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {issue.IssueDate
                            ? new Date(issue.IssueDate).toLocaleDateString('en-GB')
                            : '-'}
                        </td>

                        {/* Department */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            {issue.Department}
                          </span>
                        </td>

                        {/* Indent No */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {issue.IndentNo ? (
                            <span className="font-mono text-xs text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              {issue.IndentNo}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Issued Items - Direct on Table */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 max-w-sm">
                            {(issue.details || []).map((d, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200"
                              >
                                <span className="font-medium text-slate-800 truncate mr-3" title={d.ItemName}>
                                  {d.ItemName}
                                </span>
                                <span className="font-bold text-blue-600 flex-shrink-0">
                                  {d.Qty} {d.UOM || ''}
                                </span>
                              </div>
                            ))}
                            {(!issue.details || issue.details.length === 0) && (
                              <span className="text-xs text-slate-400 italic">No items recorded</span>
                            )}
                          </div>
                        </td>

                        {/* Total Units */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {totalUnits} unit{totalUnits === 1 ? '' : 's'}
                          </span>
                        </td>

                        {/* Approved By */}
                        <td className="py-3.5 px-4 text-slate-600">
                          {issue.Approval ? (
                            <div className="flex items-center gap-1 text-xs text-slate-700">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{issue.Approval}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Remarks */}
                        <td className="py-3.5 px-4 text-slate-600 text-xs max-w-[150px] truncate" title={issue.Remarks || ''}>
                          {issue.Remarks || <span className="text-slate-400">-</span>}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Print / Download Slip */}
                            <button
                              onClick={() => handlePrintSlip(issue)}
                              title="Print / Download Issue Slip"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleEdit(issue)}
                              title="Edit Issue"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDelete(issue.IssueNo)}
                              title="Delete Issue"
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <PaginationBar
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>

        {/* Slide-over Drawer for Add / Edit Item Issue */}
        {editDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 ${
                isDrawerVisible ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={handleCloseDrawer}
            />

            {/* Slide-over Container */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
              <div
                className={`w-screen max-w-3xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
                  isDrawerVisible ? 'translate-x-0' : 'translate-x-full'
                }`}
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
                      <PackageCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">
                        {editingIssueNo ? 'Edit Item Issue' : 'Create New Item Issue'}
                      </h2>
                      <p className="text-xs text-blue-100">
                        Issue Voucher No: ISS-{String(formData.IssueNo).padStart(4, '0')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseDrawer}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Content */}
                <form
                  onSubmit={handleSave}
                  className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
                >
                  {/* Section 1: Issue Overview & Metadata */}
                  <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Issue Header Details
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {/* Issue No (Read only) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5 text-blue-500" />
                          Issue No
                        </label>
                        <input
                          type="text"
                          value={`ISS-${String(formData.IssueNo).padStart(4, '0')}`}
                          disabled
                          className="w-full px-3 py-2 bg-slate-200/70 border border-slate-300 rounded-lg text-slate-700 font-mono text-sm font-semibold cursor-not-allowed"
                        />
                      </div>

                      {/* Issue Date */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          Issue Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.IssueDate}
                          onChange={(e) =>
                            setFormData({ ...formData, IssueDate: e.target.value })
                          }
                          required
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Department Select */}
                      <div>
                        <CustomSelect
                          label="Department *"
                          icon={Building2}
                          value={formData.Department}
                          onChange={handleDepartmentChange}
                          options={departments.map((d) => ({
                            value: d.name,
                            label: d.name
                          }))}
                          placeholder="Select Department"
                          searchable={true}
                          required={true}
                        />
                      </div>

                      {/* Indent No */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Hash className="w-3.5 h-3.5 text-blue-500" />
                          Indent No
                        </label>
                        <input
                          type="text"
                          value={formData.IndentNo}
                          onChange={(e) =>
                            setFormData({ ...formData, IndentNo: e.target.value })
                          }
                          placeholder="e.g. IND-2026-001"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Approval */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-blue-500" />
                          Approval / Issued By
                        </label>
                        <input
                          type="text"
                          value={formData.Approval}
                          onChange={(e) =>
                            setFormData({ ...formData, Approval: e.target.value })
                          }
                          placeholder="Approver name"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>

                      {/* Remarks */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          Remarks
                        </label>
                        <input
                          type="text"
                          value={formData.Remarks}
                          onChange={(e) =>
                            setFormData({ ...formData, Remarks: e.target.value })
                          }
                          placeholder="Purpose / Notes"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Department Items & Allocation */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <PackageCheck className="w-4 h-4 text-blue-600" />
                          Department Items & Allocation
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Enter quantity for the items to issue (Qty must be less than stock).
                        </p>
                      </div>

                      {/* Item Search Input */}
                      {items.length > 0 && (
                        <div className="relative w-full sm:w-64">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            placeholder="Filter items..."
                            className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {itemSearch && (
                            <button
                              type="button"
                              onClick={() => setItemSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Department Items Table */}
                    {loadingDeptItems ? (
                      <div className="p-12 text-center text-slate-500 space-y-2">
                        <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto" />
                        <p className="text-sm font-medium">Loading department inventory items...</p>
                      </div>
                    ) : !formData.Department ? (
                      <div className="p-12 text-center text-slate-400 space-y-2">
                        <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-sm font-semibold text-slate-600">No Department Selected</p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                          Please select a department above to view available store inventory items.
                        </p>
                      </div>
                    ) : items.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 space-y-2">
                        <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-sm font-semibold text-slate-600">
                          No Items Available in &quot;{formData.Department}&quot;
                        </p>
                        <p className="text-xs text-slate-400">
                          No items have been assigned to this department yet.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/60 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                              <th className="py-3 px-4">Item Name</th>
                              <th className="py-3 px-4 text-center">Available Stock</th>
                              <th className="py-3 px-4">Issue Qty</th>
                              <th className="py-3 px-4 text-center">UOM</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredDrawerItems.map((item) => {
                              const originalIdx = items.findIndex(
                                (it) =>
                                  it.ItemName === item.ItemName &&
                                  it.ItemCode === item.ItemCode
                              );
                              const openingQty = Number(item.OpeningQty || 0);
                              const issueQty = item.Qty === '' ? '' : Number(item.Qty || 0);
                              const isInvalidQty =
                                issueQty !== '' &&
                                issueQty > 0 &&
                                issueQty >= openingQty;
                              const isSelected = issueQty > 0 && !isInvalidQty;

                              // Stock badge color
                              let stockBadge = (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {openingQty} In Stock
                                </span>
                              );
                              if (openingQty === 0) {
                                stockBadge = (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                    0 Out of Stock
                                  </span>
                                );
                              } else if (openingQty <= 10) {
                                stockBadge = (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    {openingQty} Low Stock
                                  </span>
                                );
                              }

                              return (
                                <tr
                                  key={item.ItemCode || item.ItemName}
                                  className={`transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50/40'
                                      : isInvalidQty
                                      ? 'bg-red-50/40'
                                      : 'hover:bg-slate-50/60'
                                  }`}
                                >
                                  {/* Item Details */}
                                  <td className="py-3 px-4 font-medium text-slate-800">
                                    <div className="space-y-0.5">
                                      <p className="font-semibold text-slate-800">
                                        {item.ItemName}
                                      </p>
                                      {item.ItemCode && (
                                        <p className="text-[11px] font-mono text-slate-400">
                                          Code: {item.ItemCode}
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  {/* Available Stock */}
                                  <td className="py-3 px-4 text-center">
                                    {stockBadge}
                                  </td>

                                  {/* Issue Qty */}
                                  <td className="py-3 px-4">
                                    <div className="space-y-1">
                                      <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        max={Math.max(0, openingQty - 1)}
                                        value={item.Qty}
                                        onChange={(e) =>
                                          handleItemRowChange(
                                            originalIdx,
                                            'Qty',
                                            e.target.value
                                          )
                                        }
                                        placeholder="0"
                                        className={`w-32 px-2.5 py-1.5 border rounded-lg text-sm font-semibold focus:outline-none transition-all ${
                                          isInvalidQty
                                            ? 'border-red-500 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-400'
                                            : isSelected
                                            ? 'border-blue-500 bg-blue-50/60 text-blue-900 focus:ring-2 focus:ring-blue-400'
                                            : 'border-slate-300 bg-white text-slate-800 focus:ring-2 focus:ring-blue-400'
                                        }`}
                                      />
                                      {isInvalidQty && (
                                        <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                          Must be &lt; {openingQty}
                                        </p>
                                      )}
                                      {isSelected && (
                                        <p className="text-[11px] text-emerald-600 font-medium">
                                          Remaining: {openingQty - issueQty}
                                        </p>
                                      )}
                                    </div>
                                  </td>

                                  {/* UOM */}
                                  <td className="py-3 px-4 text-center font-medium text-slate-600">
                                    {item.UOM || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </form>

                {/* Drawer Sticky Footer */}
                <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg flex-shrink-0">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">
                      {activeIssueCount} item{activeIssueCount === 1 ? '' : 's'} selected
                    </span>
                    <span>•</span>
                    <span>Total {activeIssueUnits} unit(s) to issue</span>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleCloseDrawer}
                      className="flex-1 sm:flex-none px-5 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || activeIssueCount === 0}
                      className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          {editingIssueNo ? 'Update Issue' : 'Confirm & Save Issue'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}