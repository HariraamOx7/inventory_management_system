// frontend/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import {
  ShoppingCart,
  Boxes,
  Truck,
  AlertCircle,
  Download,
  Plus,
  ArrowUpRight,
  RefreshCw,
  Inbox,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Eye
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeChartMonth, setActiveChartMonth] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'awaiting-pos' | 'low-stock' | 'pending-verifications' | null
  const [modalSearch, setModalSearch] = useState('');

  const [stats, setStats] = useState({
    activePurchaseOrders: 0,
    awaitingApprovalPOs: 0,
    poTrendText: '0 vs last month',
    itemsInStock: 0,
    lowStockItemsCount: 0,
    fillRatePercent: '0.0% fill rate',
    gatePassesOutward: 0,
    gatePassTrendText: '0 vs last month',
    pendingVerifications: 0,
    statusOverview: {
      posVerified: 0,
      posTotal: 0,
      gateVerified: 0,
      gateTotal: 0,
      itemsHealthy: 0,
      itemsTotal: 0
    },
    topCategories: [],
    monthlyTransactions: [],
    recentGateLogs: [],
    awaitingApprovalPOsList: [],
    lowStockItemsList: [],
    pendingVerificationsList: []
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/dashboard/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.data && response.data.success) {
        setStats(response.data.data);
        if (response.data.data.monthlyTransactions?.length > 0) {
          const lastMonth = response.data.data.monthlyTransactions[response.data.data.monthlyTransactions.length - 1].month;
          setActiveChartMonth(lastMonth);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard stats from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'inwardcreated':
      case 'inward created':
      case 'verified':
      case 'approved':
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'pending':
      case 'draft':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'cancelled':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  // Helper to calculate bar max height for monthly chart scaling
  const maxValInChart = Math.max(
    10,
    ...stats.monthlyTransactions.map(d => Math.max(d.pos || 0, d.gateIn || 0, d.gateOut || 0))
  );

  return (
    <Layout>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardStats}
              title="Refresh Real DB Data"
              className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2.5 border border-slate-200/80 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh DB</span>
            </button>

            <button
              onClick={() => navigate('/transaction/gate-inward')}
              className="bg-[#5b52f6] hover:bg-[#4f46e5] text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>New Gate Entry</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: ACTIVE PURCHASE ORDERS */}
          <div
            onClick={() => { setActiveModal('awaiting-pos'); setModalSearch(''); }}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:border-indigo-300 hover:shadow-lg transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
            title="Click to view Purchase Orders awaiting approval"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
                  ACTIVE PURCHASE ORDERS
                </span>
                <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">
                  {stats.activePurchaseOrders}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md group-hover:bg-indigo-100 transition-colors">
                  <Eye size={12} />
                  <span>{stats.awaitingApprovalPOs} awaiting approval</span>
                </div>
              </div>
              <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 flex-shrink-0 group-hover:scale-110 transition-transform">
                <ShoppingCart size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-1 text-emerald-600">
                <ArrowUpRight size={14} />
                <span>{stats.poTrendText}</span>
              </div>
              <span className="text-[11px] text-indigo-600 underline font-medium opacity-0 group-hover:opacity-100 transition-opacity">View List &rarr;</span>
            </div>
          </div>

          {/* Card 2: ITEMS IN STOCK */}
          <div
            onClick={() => { setActiveModal('low-stock'); setModalSearch(''); }}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:border-cyan-300 hover:shadow-lg transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
            title="Click to view low stock and out-of-stock items"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-cyan-600 transition-colors">
                  ITEMS IN STOCK
                </span>
                <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">
                  {stats.itemsInStock.toLocaleString()}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md group-hover:bg-rose-100 transition-colors">
                  <Eye size={12} />
                  <span>{stats.lowStockItemsCount} items low / out</span>
                </div>
              </div>
              <div className="w-11 h-11 bg-cyan-50 rounded-xl flex items-center justify-center text-cyan-600 flex-shrink-0 group-hover:scale-110 transition-transform">
                <Boxes size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-1 text-emerald-600">
                <ArrowUpRight size={14} />
                <span>{stats.fillRatePercent}</span>
              </div>
              <span className="text-[11px] text-cyan-600 underline font-medium opacity-0 group-hover:opacity-100 transition-opacity">View List &rarr;</span>
            </div>
          </div>

          {/* Card 3: GATE PASSES OUTWARD */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  GATE PASSES OUTWARD
                </span>
                <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">
                  {stats.gatePassesOutward}
                </div>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">Total registered</p>
              </div>
              <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                <Truck size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <ArrowUpRight size={14} />
              <span>{stats.gatePassTrendText}</span>
            </div>
          </div>

          {/* Card 4: PENDING VERIFICATIONS */}
          <div
            onClick={() => { setActiveModal('pending-verifications'); setModalSearch(''); }}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:border-amber-300 hover:shadow-lg transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group"
            title="Click to view pending verifications list"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
                  PENDING VERIFICATIONS
                </span>
                <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">
                  {stats.pendingVerifications}
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md group-hover:bg-amber-100 transition-colors">
                  <Eye size={12} />
                  <span>Across gate & bill entries</span>
                </div>
              </div>
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0 group-hover:scale-110 transition-transform">
                <AlertCircle size={20} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-semibold">
              <span className="text-amber-600 font-medium">Action Required</span>
              <span className="text-[11px] text-amber-700 underline font-medium opacity-0 group-hover:opacity-100 transition-opacity">View List &rarr;</span>
            </div>
          </div>
        </div>

        {/* Middle Section: Chart (Left 2/3) + Status Overview (Right 1/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Monthly Transactions Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">Monthly Transactions</h2>
                <p className="text-xs text-slate-400 font-medium">Real-time 7 month trend</p>
              </div>
              {/* Legends */}
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#5b52f6]"></span>
                  <span>POs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#06b6d4]"></span>
                  <span>Gate In</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#10b981]"></span>
                  <span>Gate Out</span>
                </div>
              </div>
            </div>

            {/* Custom Dynamic Bar Chart Canvas */}
            <div className="relative h-64 w-full pt-4">
              {/* Grid Y lines */}
              <div className="absolute inset-0 flex flex-col justify-between text-xs text-slate-300 pointer-events-none pb-6">
                <div className="border-b border-dashed border-slate-100 w-full flex justify-between"><span>{maxValInChart}</span></div>
                <div className="border-b border-dashed border-slate-100 w-full flex justify-between"><span>{Math.round(maxValInChart * 0.75)}</span></div>
                <div className="border-b border-dashed border-slate-100 w-full flex justify-between"><span>{Math.round(maxValInChart * 0.5)}</span></div>
                <div className="border-b border-dashed border-slate-100 w-full flex justify-between"><span>{Math.round(maxValInChart * 0.25)}</span></div>
                <div className="border-b border-slate-200 w-full flex justify-between"><span>0</span></div>
              </div>

              {/* Bars Column */}
              <div className="relative h-full flex items-end justify-between px-6 pb-6 pt-2">
                {stats.monthlyTransactions.map((d) => {
                  const isActive = activeChartMonth === d.month;
                  const poHeightPct = Math.min(100, Math.round(((d.pos || 0) / maxValInChart) * 100));
                  const gateInHeightPct = Math.min(100, Math.round(((d.gateIn || 0) / maxValInChart) * 100));
                  const gateOutHeightPct = Math.min(100, Math.round(((d.gateOut || 0) / maxValInChart) * 100));

                  return (
                    <div
                      key={d.month}
                      onMouseEnter={() => setActiveChartMonth(d.month)}
                      className={`relative flex flex-col items-center flex-1 max-w-[80px] h-full justify-end group cursor-pointer transition-colors rounded-xl px-1 ${isActive ? 'bg-slate-100/70' : 'hover:bg-slate-50'
                        }`}
                    >
                      {/* Tooltip Card for active month */}
                      {isActive && (
                        <div className="absolute -top-16 z-20 bg-white border border-slate-100 shadow-xl rounded-xl p-2.5 text-[11px] min-w-[100px] pointer-events-none animate-fade-in">
                          <div className="font-bold text-slate-800 mb-1 border-b border-slate-100 pb-0.5">{d.month}</div>
                          <div className="text-slate-600 flex justify-between"><span>orders :</span> <span className="font-semibold text-slate-800 ml-2">{d.pos || 0}</span></div>
                          <div className="text-slate-600 flex justify-between"><span>gateIn :</span> <span className="font-semibold text-slate-800 ml-2">{d.gateIn || 0}</span></div>
                          <div className="text-slate-600 flex justify-between"><span>gateOut :</span> <span className="font-semibold text-slate-800 ml-2">{d.gateOut || 0}</span></div>
                        </div>
                      )}

                      {/* Grouped Bar Columns */}
                      <div className="flex items-end gap-1 w-full justify-center h-full pb-2">
                        <div
                          style={{ height: `${poHeightPct > 0 ? Math.max(poHeightPct, 4) : 0}%` }}
                          className="w-2.5 sm:w-3 bg-[#5b52f6] rounded-t-sm transition-all duration-300"
                        />
                        <div
                          style={{ height: `${gateInHeightPct > 0 ? Math.max(gateInHeightPct, 4) : 0}%` }}
                          className="w-2.5 sm:w-3 bg-[#06b6d4] rounded-t-sm transition-all duration-300"
                        />
                        <div
                          style={{ height: `${gateOutHeightPct > 0 ? Math.max(gateOutHeightPct, 4) : 0}%` }}
                          className="w-2.5 sm:w-3 bg-[#10b981] rounded-t-sm transition-all duration-300"
                        />
                      </div>

                      {/* X Label */}
                      <span className={`text-xs font-semibold mt-1 ${isActive ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                        {d.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Status Overview & Top Categories */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-5">Status Overview</h2>

              {/* Progress items */}
              <div className="space-y-4">
                {/* POs Inward Created */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                    <span className="text-slate-600">POs Inward Created</span>
                    <span className="font-bold text-slate-800">
                      {stats.statusOverview.posVerified} / {stats.statusOverview.posTotal}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#5b52f6] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.statusOverview.posTotal > 0
                          ? Math.min(100, Math.round((stats.statusOverview.posVerified / stats.statusOverview.posTotal) * 100))
                          : 0}%`
                      }}
                    />
                  </div>
                </div>

                {/* Gate Entries Created */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                    <span className="text-slate-600">Gate Entries Created</span>
                    <span className="font-bold text-slate-800">
                      {stats.statusOverview.gateVerified} / {stats.statusOverview.gateTotal}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#10b981] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.statusOverview.gateTotal > 0
                          ? Math.min(100, Math.round((stats.statusOverview.gateVerified / stats.statusOverview.gateTotal) * 100))
                          : 0}%`
                      }}
                    />
                  </div>
                </div>

                {/* Items Healthy Stock */}
                <div>
                  <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                    <span className="text-slate-600">Items Healthy Stock</span>
                    <span className="font-bold text-slate-800">
                      {stats.statusOverview.itemsHealthy.toLocaleString()} / {stats.statusOverview.itemsTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#06b6d4] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.statusOverview.itemsTotal > 0
                          ? Math.min(100, Math.round((stats.statusOverview.itemsHealthy / stats.statusOverview.itemsTotal) * 100))
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 my-6" />

              {/* TOP CATEGORIES */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-3">
                  TOP CATEGORIES
                </span>
                <div className="space-y-3">
                  {stats.topCategories && stats.topCategories.length > 0 ? (
                    stats.topCategories.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{cat.name}</span>
                        <span className="font-bold text-slate-800">{cat.amount}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-400 italic">No categories found in DB</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent Gate Inward Log */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Gate Inward Log</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {stats.recentGateLogs.length > 0 ? `Last ${stats.recentGateLogs.length} DB records` : 'Live Gate Inward Records'}
              </p>
            </div>
            <button
              onClick={() => navigate('/transaction/gate-inward')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            {stats.recentGateLogs.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-6">Entry No.</th>
                    <th className="py-3.5 px-6">Date</th>
                    <th className="py-3.5 px-6">Supplier</th>
                    <th className="py-3.5 px-6">Vehicle No.</th>
                    <th className="py-3.5 px-6 text-center">Items</th>
                    <th className="py-3.5 px-6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {stats.recentGateLogs.map((log, idx) => (
                    <tr key={log.entryNo || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td
                        onClick={() => navigate('/transaction/gate-inward')}
                        className="py-4 px-6 font-semibold text-[#5b52f6] cursor-pointer hover:underline"
                      >
                        {log.entryNo}
                      </td>
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {log.date}
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-800">
                        {log.supplier}
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-600">
                        {log.vehicleNo}
                      </td>
                      <td className="py-4 px-6 text-center font-semibold text-slate-700">
                        {log.items}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold inline-block ${getStatusBadgeClass(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 px-6 text-center">
                <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No Gate Inward entries found in Database</p>
                <p className="text-xs text-slate-400 mt-1">Create a new gate entry under Transactions to see live logs here.</p>
                <button
                  onClick={() => navigate('/transaction/gate-inward')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Create Gate Inward</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Popup Viewer for KPI Card Lists */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md ${activeModal === 'awaiting-pos' ? 'bg-indigo-600 shadow-indigo-500/20' :
                  activeModal === 'low-stock' ? 'bg-cyan-600 shadow-cyan-500/20' :
                    'bg-amber-600 shadow-amber-500/20'
                  }`}>
                  {activeModal === 'awaiting-pos' && <ShoppingCart size={22} />}
                  {activeModal === 'low-stock' && <Boxes size={22} />}
                  {activeModal === 'pending-verifications' && <AlertCircle size={22} />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {activeModal === 'awaiting-pos' && 'Purchase Orders Awaiting Approval'}
                    {activeModal === 'low-stock' && 'Low Stock & Out of Stock Items'}
                    {activeModal === 'pending-verifications' && 'Pending Gate & Bill Verifications'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {activeModal === 'awaiting-pos' && `Showing ${stats.awaitingApprovalPOsList.length} orders pending review`}
                    {activeModal === 'low-stock' && `Showing ${stats.lowStockItemsList.length} items below minimum reorder level`}
                    {activeModal === 'pending-verifications' && `Showing ${stats.pendingVerificationsList.length} records awaiting verification`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Toolbar with Search */}
            <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search records by name, code, or supplier..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              {activeModal === 'awaiting-pos' && (
                <button
                  type="button"
                  onClick={() => { setActiveModal(null); navigate('/transaction/purchase-order'); }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <span>Go to PO Manager</span>
                  <ExternalLink size={14} />
                </button>
              )}

              {activeModal === 'low-stock' && (
                <button
                  type="button"
                  onClick={() => { setActiveModal(null); navigate('/item'); }}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <span>Go to Item Master</span>
                  <ExternalLink size={14} />
                </button>
              )}

              {activeModal === 'pending-verifications' && (
                <button
                  type="button"
                  onClick={() => { setActiveModal(null); navigate('/transaction/gate-inward'); }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <span>Go to Gate Inward</span>
                  <ExternalLink size={14} />
                </button>
              )}
            </div>

            {/* Modal Body / Table Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* VIEW 1: Awaiting Purchase Orders */}
              {activeModal === 'awaiting-pos' && (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Order No</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Supplier / Party</th>
                        <th className="py-3 px-4">Ref No</th>
                        <th className="py-3 px-4 text-right">Grand Total (₹)</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {stats.awaitingApprovalPOsList
                        .filter(po =>
                          !modalSearch ||
                          String(po.orderNo).includes(modalSearch) ||
                          po.partyName?.toLowerCase().includes(modalSearch.toLowerCase()) ||
                          po.refNo?.toLowerCase().includes(modalSearch.toLowerCase())
                        )
                        .map((po, idx) => (
                          <tr key={po.orderNo || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-bold text-indigo-600">
                              PO-{String(po.orderNo).padStart(3, '0')}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-500">{po.orderDate}</td>
                            <td className="py-3 px-4 font-semibold text-slate-900">{po.partyName}</td>
                            <td className="py-3 px-4 text-slate-500">{po.refNo}</td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900">
                              ₹{(parseFloat(po.grandTotal) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[11px] font-semibold">
                                {po.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => { setActiveModal(null); navigate('/transaction/purchase-order'); }}
                                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                View PO
                              </button>
                            </td>
                          </tr>
                        ))}

                      {stats.awaitingApprovalPOsList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No Purchase Orders awaiting approval found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW 2: Low Stock Items */}
              {activeModal === 'low-stock' && (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Item Code</th>
                        <th className="py-3 px-4">Item Name</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">Current Stock</th>
                        <th className="py-3 px-4 text-right">Min Reorder Level</th>
                        <th className="py-3 px-4 text-right">Unit Rate (₹)</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {stats.lowStockItemsList
                        .filter(item =>
                          !modalSearch ||
                          String(item.itemCode).includes(modalSearch) ||
                          item.itemName?.toLowerCase().includes(modalSearch.toLowerCase()) ||
                          item.category?.toLowerCase().includes(modalSearch.toLowerCase())
                        )
                        .map((item, idx) => {
                          const qty = parseFloat(item.openingQty) || 0;
                          const minLvl = parseFloat(item.minStockLevel) || 0;
                          const isOutOfStock = qty <= 0;
                          return (
                            <tr key={item.itemCode || idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 font-bold text-cyan-600">
                                ITEM-{String(item.itemCode).padStart(3, '0')}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-900">{item.itemName}</td>
                              <td className="py-3 px-4 text-slate-500">{item.category}</td>
                              <td className="py-3 px-4 text-right">
                                <span className={`px-2.5 py-1 rounded-md font-bold text-xs inline-block ${isOutOfStock
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                  {qty} {isOutOfStock ? '(OUT OF STOCK)' : '(LOW)'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-slate-600">{minLvl}</td>
                              <td className="py-3 px-4 text-right font-bold text-slate-800">
                                ₹{(parseFloat(item.unitRate) || 0).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => { setActiveModal(null); navigate('/item'); }}
                                  className="px-3 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                                >
                                  Manage Item
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                      {stats.lowStockItemsList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No low stock items found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW 3: Pending Verifications */}
              {activeModal === 'pending-verifications' && (
                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Record ID</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Supplier / Party</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Reference</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {stats.pendingVerificationsList
                        .filter(v =>
                          !modalSearch ||
                          v.id?.toLowerCase().includes(modalSearch.toLowerCase()) ||
                          v.partyName?.toLowerCase().includes(modalSearch.toLowerCase()) ||
                          v.refNo?.toLowerCase().includes(modalSearch.toLowerCase())
                        )
                        .map((v, idx) => (
                          <tr key={v.id || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-bold text-amber-600">{v.id}</td>
                            <td className="py-3 px-4 font-semibold text-slate-800">{v.type}</td>
                            <td className="py-3 px-4 font-semibold text-slate-900">{v.partyName}</td>
                            <td className="py-3 px-4 text-slate-500 font-medium">{v.date}</td>
                            <td className="py-3 px-4 text-slate-500">{v.refNo}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[11px] font-semibold">
                                {v.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => { setActiveModal(null); navigate('/transaction/gate-inward'); }}
                                className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                              >
                                Verify Entry
                              </button>
                            </td>
                          </tr>
                        ))}

                      {stats.pendingVerificationsList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No pending verifications found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Dashboard;
