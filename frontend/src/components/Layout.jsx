// frontend/src/components/Layout.jsx
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  Cog,
  Wrench,
  Calendar,
  ClipboardList,
  FileText,
  LogOut,
  Menu,
  X,
  CheckCircle2,
  Info,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Moon,
  Settings,
  XCircle,
  FileCheck,
  KeyRound,
  Shield
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import ChangePasswordModal from './ChangePasswordModal';

function ToastContainer({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { transform: translate(-50%, -1rem); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-slide-in { animation: slideIn 0.3s ease-out forwards; }
        .animate-shrink-width { animation: shrinkWidth 4000ms linear forwards; }
      `}</style>
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none animate-slide-in">
        <div className="pointer-events-auto bg-white border border-gray-100 shadow-2xl rounded-xl p-4 min-w-[320px] max-w-[400px] flex gap-3 relative overflow-hidden transition-all duration-300 transform hover:scale-[1.02]">
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isSuccess ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-amber-500'
            }`} />

          <div className="flex-shrink-0 mt-0.5">
            {isSuccess ? (
              <CheckCircle2 className="text-emerald-500 w-5 h-5" />
            ) : isError ? (
              <AlertCircle className="text-rose-500 w-5 h-5" />
            ) : (
              <Info className="text-amber-500 w-5 h-5" />
            )}
          </div>

          <div className="flex-1 pr-6">
            <h4 className="font-semibold text-sm text-gray-900 capitalize">
              {toast.type}
            </h4>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{toast.message}</p>
          </div>

          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-0.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={14} />
          </button>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
            <div
              key={toast.id}
              className={`h-full ${isSuccess ? 'bg-emerald-500' : isError ? 'bg-rose-500' : 'bg-amber-500'} animate-shrink-width`}
            />
          </div>
        </div>
      </div>
    </>
  );
}

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Accordion open states
  const isMastersPath = [
    '/item', '/supplier', '/department', '/storemaster',
    '/prodheadmaster', '/subhead', '/uom', '/purchasetype', '/gppartymaster',
    '/gpitemmaster', '/state'
  ].includes(location.pathname);

  const isTransactionsPath = location.pathname.startsWith('/transaction');

  const [mastersOpen, setMastersOpen] = useState(() => isMastersPath);
  const [transactionsOpen, setTransactionsOpen] = useState(() => isTransactionsPath);

  useEffect(() => {
    if (isMastersPath) {
      setMastersOpen(true);
    }
  }, [location.pathname, isMastersPath]);

  useEffect(() => {
    if (isTransactionsPath) {
      setTransactionsOpen(true);
    }
  }, [location.pathname, isTransactionsPath]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toast = useToastStore(state => state.toast);
  const hideToast = useToastStore(state => state.hideToast);
  const { logout } = useAuthStore();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const mastersSubItems = [
    { name: 'Departments', path: '/department' },
    { name: 'Suppliers', path: '/supplier' },
    { name: 'Items', path: '/item' },
    { name: 'Store Master', path: '/storemaster' },
    { name: 'Prod Head', path: '/prodheadmaster' },
    { name: 'Sub Head', path: '/subhead' },
    { name: 'Purchase Type', path: '/purchasetype' },
    { name: 'UOM', path: '/uom' },
    { name: 'State', path: '/state' },
  ];

  const transactionsSubItems = [
    { name: 'Purchase Order', path: '/transaction/purchase-order' },
    { name: 'Gate Inward', path: '/transaction/gate-inward' },
    { name: 'Receipt', path: '/transaction/receipt' },
    { name: 'Bill Entry', path: '/transaction/bill-entry' },
    { name: 'Gate Pass Out', path: '/transaction/gate-pass-out' },
    { name: 'Gate Pass In', path: '/transaction/gate-pass-in' },
    { name: 'Item Issue', path: '/transaction/issue' },
  ];

  const renderSidebar = () => (
    <div className="w-64 bg-[#0b1021] text-slate-300 flex flex-col h-full border-r border-[#1e2746]/50 select-none">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Database size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <div className="font-bold text-white tracking-tight text-base flex items-center gap-1.5">
              StoreERP
            </div>
            <div className="text-[11px] font-medium text-slate-400 -mt-0.5">
              v2.4.1
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto sidebar-scrollbar">
        {/* Dashboard Link */}
        <button
          onClick={() => {
            navigate('/dashboard');
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${location.pathname === '/dashboard'
              ? 'bg-[#5b52f6] text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c36]'
            }`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </button>

        {/* Masters Accordion */}
        <div>
          <button
            onClick={() => setMastersOpen(!mastersOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${isMastersPath
                ? 'text-white bg-[#141b36]'
                : 'text-slate-300 hover:text-white hover:bg-[#161c36]'
              }`}
          >
            <div className="flex items-center gap-3">
              <Cog size={19} className="text-slate-400" />
              <span>Masters</span>
            </div>
            {mastersOpen ? (
              <ChevronDown size={18} className="text-slate-400" />
            ) : (
              <ChevronRight size={18} className="text-slate-400" />
            )}
          </button>

          {mastersOpen && (
            <div className="mt-1.5 ml-4 pl-3.5 border-l-2 border-[#1e294d] space-y-1.5 py-1">
              {mastersSubItems.map((sub) => {
                const isActive = location.pathname === sub.path;
                return (
                  <button
                    key={sub.path}
                    onClick={() => {
                      navigate(sub.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${isActive
                        ? 'text-indigo-300 bg-[#1e274c] font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-[#161c36]'
                      }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Transactions Accordion */}
        <div>
          <button
            onClick={() => setTransactionsOpen(!transactionsOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${isTransactionsPath
                ? 'text-white bg-[#141b36]'
                : 'text-slate-300 hover:text-white hover:bg-[#161c36]'
              }`}
          >
            <div className="flex items-center gap-3">
              <ClipboardList size={19} className="text-slate-400" />
              <span>Transactions</span>
            </div>
            {transactionsOpen ? (
              <ChevronDown size={18} className="text-slate-400" />
            ) : (
              <ChevronRight size={18} className="text-slate-400" />
            )}
          </button>

          {transactionsOpen && (
            <div className="mt-1.5 ml-4 pl-3.5 border-l-2 border-[#1e294d] space-y-1.5 py-1">
              {transactionsSubItems.map((sub) => {
                const isActive = location.pathname === sub.path;
                return (
                  <button
                    key={sub.path}
                    onClick={() => {
                      navigate(sub.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${isActive
                        ? 'text-indigo-300 bg-[#1e274c] font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-[#161c36]'
                      }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            navigate('/reports');
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${location.pathname === '/reports'
              ? 'bg-[#5b52f6] text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c36]'
            }`}
        >
          <FileText size={18} />
          <span>Reports</span>
        </button>

        {/* Cancel Order Link */}
        <button
          onClick={() => {
            navigate('/cancel-order');
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${location.pathname === '/cancel-order'
              ? 'bg-[#5b52f6] text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c36]'
            }`}
        >
          <XCircle size={18} />
          <span>Cancel Order</span>
        </button>

        {/* Bill Verify Link */}
        <button
          onClick={() => {
            navigate('/bill-verify');
            setSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${location.pathname === '/bill-verify'
              ? 'bg-[#5b52f6] text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c36]'
            }`}
        >
          <FileCheck size={18} />
          <span>Bill Verify</span>
        </button>
      </nav>

      {/* User Profile & Account Footer */}
      <div className="p-3 border-t border-[#1e2746]/60 bg-[#0d1326]">
        <div className="flex items-center justify-between px-2 py-1.5 mb-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
              {(user?.full_name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">
                {user?.full_name || user?.username || 'User'}
              </div>
              <div className="text-[10px] font-medium text-indigo-400 capitalize">
                {user?.role || 'Operator'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setIsChangePasswordOpen(true)}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#141b36] hover:bg-[#1e274c] text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            title="Change Password"
          >
            <KeyRound size={13} className="text-indigo-400" />
            <span>Password</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-medium transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut size={13} className="text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f4f6fb] overflow-hidden">
      {/* Mobile Toggle Bar */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-[#0b1021] text-white rounded-lg shadow-md"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-shrink-0 h-full">{renderSidebar()}</div>

      {/* Mobile Overlay Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-50 h-full">{renderSidebar()}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-[#f4f6fb]">
          {children}
        </main>
      </div>

      {toast && (
        <ToastContainer toast={toast} onClose={hideToast} />
      )}

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
};

export default Layout;