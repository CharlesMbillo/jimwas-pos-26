import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { POSTerminal } from './routes/pos';
import { CustomersPage } from './routes/customers';
import { ProductsPage } from './routes/products';
import { InventoryPage } from './routes/inventory';
import { InstallmentsPage } from './routes/installments';
import { DashboardPage } from './routes/dashboard';
import { LoginPage } from './routes/login';
import { SecurityDashboardPage } from './routes/security';
import { SettingsPage } from './routes/settings';
import { AuditPage } from './routes/audit';
import { TransactionsPage } from './routes/transactions';
import { BackupPage } from './routes/backup';
import { PopulateDBPage } from './routes/populate-db';
import { VoidRequestsPage } from './routes/void-requests';
import { EnterpriseOperationsPage } from './routes/enterprise';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { initNetworkListeners } from './lib/sync';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('pos');
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    initNetworkListeners();

    // Delay initial sync to avoid blocking UI
    const syncTimer = setTimeout(() => {
      import('./lib/sync').then(({ syncNow }) => {
        syncNow().then((result) => {
          console.log('Initial sync:', result.message);
        }).catch(err => {
          console.error('Initial sync failed:', err);
        });
      });
    }, 2000);

    return () => clearTimeout(syncTimer);
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderPage = () => {
    const accessDenied = (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-8 max-w-md">
          <h1 className="text-xl font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-red-300">You don&apos;t have permission to access this page.</p>
        </div>
      </div>
    );

    switch (currentPage) {
      case 'pos':
        return <ProtectedRoute routePath="/pos" fallback={accessDenied}><POSTerminal /></ProtectedRoute>;
      case 'customers':
        return <ProtectedRoute routePath="/customers" fallback={accessDenied}><CustomersPage /></ProtectedRoute>;
      case 'products':
        return <ProtectedRoute routePath="/products" fallback={accessDenied}><ProductsPage /></ProtectedRoute>;
      case 'inventory':
        return <ProtectedRoute routePath="/inventory" fallback={accessDenied}><InventoryPage /></ProtectedRoute>;
      case 'installments':
        return <ProtectedRoute routePath="/installments" fallback={accessDenied}><InstallmentsPage /></ProtectedRoute>;
      case 'dashboard':
        return <ProtectedRoute routePath="/dashboard" fallback={accessDenied}><DashboardPage /></ProtectedRoute>;
      case 'security':
        return <ProtectedRoute routePath="/security" fallback={accessDenied}><SecurityDashboardPage /></ProtectedRoute>;
      case 'settings':
        return <ProtectedRoute routePath="/settings" fallback={accessDenied}><SettingsPage /></ProtectedRoute>;
      case 'audit':
        return <ProtectedRoute routePath="/audit" fallback={accessDenied}><AuditPage /></ProtectedRoute>;
      case 'transactions':
        return <ProtectedRoute routePath="/transactions" fallback={accessDenied}><TransactionsPage /></ProtectedRoute>;
      case 'backup':
        return <ProtectedRoute routePath="/backup" fallback={accessDenied}><BackupPage /></ProtectedRoute>;
      case 'populate-db':
        return <ProtectedRoute routePath="/populate-db" fallback={accessDenied}><PopulateDBPage /></ProtectedRoute>;
      case 'void-requests':
        return <ProtectedRoute routePath="/void-requests" fallback={accessDenied}><VoidRequestsPage /></ProtectedRoute>;
      case 'reports':
        return <ProtectedRoute routePath="/reports" fallback={accessDenied}><EnterpriseOperationsPage section="reports" /></ProtectedRoute>;
      case 'reconciliation':
        return <ProtectedRoute routePath="/reconciliation" fallback={accessDenied}><EnterpriseOperationsPage section="reconciliation" /></ProtectedRoute>;
      case 'outbound-deliveries':
        return <ProtectedRoute routePath="/outbound-deliveries" fallback={accessDenied}><EnterpriseOperationsPage section="deliveries" /></ProtectedRoute>;
      case 'shifts':
        return <ProtectedRoute routePath="/shifts" fallback={accessDenied}><EnterpriseOperationsPage section="shifts" /></ProtectedRoute>;
      default:
        return <ProtectedRoute routePath="/pos" fallback={accessDenied}><POSTerminal /></ProtectedRoute>;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage} user={user}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
