import { ReactNode, useState, useRef, useEffect } from 'react';
import { ShoppingCart, Users, Package, CreditCard, BarChart3, Wifi, WifiOff, RefreshCw, Warehouse, Shield, LogOut, User, ChevronDown, Settings, FileText, DollarSign, Archive, Menu, X, Smartphone, Database, AlertCircle } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useKeyboardScroll } from '../hooks/useKeyboardScroll';
import { syncNow, getSyncState, subscribeToSyncState, type SyncState } from '../lib/sync';
import { useAuth } from '../context/AuthContext';
import type { User as UserType } from '../lib/security-types';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
  user?: UserType | null;
}

export function Layout({ children, currentPage, onNavigate, user }: LayoutProps) {
  const isOnline = useOnlineStatus();
  const { logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());

  // Enable keyboard scrolling on main content area
  useKeyboardScroll(mainContentRef, { scrollAmount: 80, enabled: true });

  // Subscribe to sync state
  useEffect(() => {
    const unsubscribe = subscribeToSyncState(setSyncState);
    return unsubscribe;
  }, []);

  // Primary navigation items (always visible)
  const primaryNavItems = [
    { id: 'pos', label: 'Sell', icon: ShoppingCart },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: Warehouse },
    { id: 'installments', label: 'Lipa Mdogo', icon: CreditCard },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  ];

  // Admin/Manager navigation items (in "More" dropdown)
  const adminNavItems = user && (user.role_code === 'admin' || user.role_code === 'manager' || user.role_code === 'cashier') ? [
    { id: 'transactions', label: 'Transactions', icon: DollarSign },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'audit', label: 'Audit Trail', icon: FileText },
  ] : [];

  // Manager/Admin approval items
  const approvalItems = user && (user.role_code === 'admin' || user.role_code === 'manager') ? [
    { id: 'void-requests', label: 'Void Approvals', icon: AlertCircle },
  ] : [];

  // Admin only navigation items
  const adminOnlyItems = user && user.role_code === 'admin' ? [
    { id: 'populate-db', label: 'Populate DB', icon: Database },
    { id: 'backup', label: 'Backup', icon: Archive },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] : [];

  const allSecondaryItems = [...adminNavItems, ...approvalItems, ...adminOnlyItems];

  const handleSync = async () => {
    const result = await syncNow();
    console.log(result.message);
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    setShowMobileMenu(false);
    await logout();
  };

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setShowMobileMenu(false);
    setShowMoreMenu(false);
  };

  const getRoleLabel = (roleCode: string) => {
    switch (roleCode) {
      case 'admin': return 'Administrator';
      case 'manager': return 'Manager';
      case 'cashier': return 'Cashier';
      default: return roleCode;
    }
  };

  const allItems = [...primaryNavItems, ...allSecondaryItems];
  const currentPageLabel = allItems.find((item) => item.id === currentPage)?.label || 'Jimwas';

  return (
    <div className="h-screen bg-slate-900 flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <ShoppingCart size={18} className="text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-emerald-400 leading-tight">Jimwas POS</h1>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* More Dropdown - Admin/Manager */}
            {allSecondaryItems.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    allSecondaryItems.some(item => item.id === currentPage)
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>More</span>
                  <ChevronDown size={16} />
                </button>

                {showMoreMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowMoreMenu(false)}
                    />
                    <div className="absolute top-full right-0 mt-1 w-44 bg-slate-700 rounded-lg shadow-lg border border-slate-600 py-1 z-50">
                      {allSecondaryItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPage === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleNavigate(item.id)}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition ${
                              isActive
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-300 hover:bg-slate-600 hover:text-white'
                            }`}
                          >
                            <Icon size={18} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>

          {/* Right Side: Sync Status + User Menu */}
          <div className="flex items-center gap-2">
            {/* Sync Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50">
              <div className="flex items-center gap-1.5">
                {isOnline ? (
                  <>
                    {syncState.status === 'syncing' ? (
                      <RefreshCw size={16} className="text-blue-400 animate-spin" />
                    ) : syncState.status === 'pending' ? (
                      <div className="relative">
                        <Wifi size={16} className="text-amber-400" />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full text-[8px] text-white flex items-center justify-center">
                          {syncState.pendingCount}
                        </span>
                      </div>
                    ) : (
                      <Wifi size={16} className="text-emerald-400" />
                    )}
                    <span className={`text-xs hidden sm:inline ${
                      syncState.status === 'syncing' ? 'text-blue-400' :
                      syncState.status === 'pending' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>
                      {syncState.status === 'syncing' ? 'Syncing...' :
                       syncState.status === 'pending' ? 'Pending' :
                       'Online'}
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff size={16} className="text-amber-400" />
                    <span className="text-xs text-amber-400 hidden sm:inline">Offline</span>
                  </>
                )}
              </div>
              <button
                onClick={handleSync}
                disabled={!isOnline || syncState.status === 'syncing'}
                className={`p-1 rounded transition-colors ${
                  isOnline && syncState.status !== 'syncing'
                    ? 'text-slate-400 hover:text-white hover:bg-slate-600'
                    : 'text-slate-600 cursor-not-allowed'
                }`}
                title="Sync now"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 py-1.5 bg-slate-700 rounded-lg hover:bg-slate-600 transition"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center">
                    <User size={14} className="text-white" />
                  </div>
                  <span className="text-white text-sm hidden md:inline max-w-[120px] truncate">{user.full_name}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-48 bg-slate-700 rounded-lg shadow-lg border border-slate-600 py-1 z-50">
                      <div className="px-4 py-2 border-b border-slate-600">
                        <p className="text-white font-medium truncate">{user.full_name}</p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                          user.role_code === 'admin' ? 'bg-red-900/30 text-red-400' :
                          user.role_code === 'manager' ? 'bg-amber-900/30 text-amber-400' :
                          'bg-blue-900/30 text-blue-400'
                        }`}>
                          {getRoleLabel(user.role_code)}
                        </span>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-red-400 hover:bg-slate-600 transition"
                      >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition"
            >
              {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {showMobileMenu && (
          <nav className="lg:hidden border-t border-slate-700 bg-slate-800">
            <div className="p-2 space-y-1 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
              {primaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Separator for admin items */}
              {allSecondaryItems.length > 0 && (
                <div className="border-t border-slate-600 my-2" />
              )}

              {/* Admin/Manager Items */}
              {allSecondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : item.id === 'security'
                        ? 'text-amber-400 hover:bg-amber-900/20'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Page Title Bar */}
        <div className="bg-slate-800/50 border-b border-slate-700 px-4 lg:px-6 py-3 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">{currentPageLabel}</h2>
        </div>

        {/* Scrollable content area with keyboard navigation */}
        <div
          ref={mainContentRef}
          tabIndex={0}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 scroll-smooth focus:outline-none min-h-0"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
