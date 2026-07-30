import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
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
import { LedgerPage } from './routes/ledger';
import { BackupPage } from './routes/backup';
import { MpesaPaymentsPage } from './routes/mpesa-payments';
import { PopulateDBPage } from './routes/populate-db';
import { VoidRequestsPage } from './routes/void-requests';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { initNetworkListeners, syncNow } from './lib/sync';

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
    switch (currentPage) {
      case 'pos':
        return <POSTerminal />;
      case 'customers':
        return <CustomersPage />;
      case 'products':
        return <ProductsPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'installments':
        return <InstallmentsPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'security':
        return <SecurityDashboardPage />;
      case 'settings':
        return <SettingsPage />;
      case 'audit':
        return <AuditPage />;
      case 'ledger':
        return <LedgerPage />;
      case 'backup':
        return <BackupPage />;
      case 'mpesa-payments':
        return <MpesaPaymentsPage />;
      case 'populate-db':
        return <PopulateDBPage />;
      case 'void-requests':
        return <VoidRequestsPage />;
      default:
        return <POSTerminal />;
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
