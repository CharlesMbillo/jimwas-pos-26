import { useState, useEffect } from 'react';
import { useAuth, RoleGuard } from '../context/AuthContext';
import {
  Smartphone, Search, Filter, Download, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, 
  Loader2, ChevronDown, ChevronUp, Eye, Calendar, TrendingUp
} from 'lucide-react';
import { getAllKCBPayments, getKCBPaymentsByStatus } from '../lib/db';
import type { KCBPaymentRecord } from '../lib/db';
import { formatPhoneDisplay } from '../lib/mpesa';

type FilterStatus = 'all' | 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance';

const STATUS_COLORS: Record<KCBPaymentRecord['status'], string> = {
  'pending': 'bg-gray-100 text-gray-800',
  'processing': 'bg-blue-100 text-blue-800',
  'success': 'bg-green-100 text-green-800',
  'failed': 'bg-red-100 text-red-800',
  'cancelled': 'bg-yellow-100 text-yellow-800',
  'timeout': 'bg-orange-100 text-orange-800',
  'insufficient_balance': 'bg-purple-100 text-purple-800',
};

const STATUS_ICONS: Record<KCBPaymentRecord['status'], React.ReactNode> = {
  'pending': <Clock className="w-4 h-4" />,
  'processing': <Loader2 className="w-4 h-4 animate-spin" />,
  'success': <CheckCircle2 className="w-4 h-4" />,
  'failed': <XCircle className="w-4 h-4" />,
  'cancelled': <AlertCircle className="w-4 h-4" />,
  'timeout': <AlertCircle className="w-4 h-4" />,
  'insufficient_balance': <AlertCircle className="w-4 h-4" />,
};

export function MpesaPaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<KCBPaymentRecord[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<KCBPaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    filterPayments();
  }, [payments, searchTerm, filterStatus, dateRange]);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const data = await getAllKCBPayments();
      const sorted = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setPayments(sorted);
    } catch (error) {
      console.error('[v0] Failed to load M-Pesa payments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterPayments = () => {
    let result = [...payments];

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }

    // Filter by search term (phone or receipt number)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        formatPhoneDisplay(p.phone).toLowerCase().includes(term) ||
        p.mpesa_receipt_number?.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    }

    // Filter by date range
    if (dateRange.start) {
      const startDate = new Date(dateRange.start);
      result = result.filter(p => new Date(p.created_at) >= startDate);
    }
    if (dateRange.end) {
      const endDate = new Date(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      result = result.filter(p => new Date(p.created_at) <= endDate);
    }

    setFilteredPayments(result);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPayments();
    setIsRefreshing(false);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Phone', 'Amount', 'Status', 'Receipt Number', 'Created At', 'Completed At'];
    const rows = filteredPayments.map(p => [
      p.id,
      formatPhoneDisplay(p.phone),
      p.amount,
      p.status,
      p.mpesa_receipt_number || 'N/A',
      new Date(p.created_at).toLocaleString(),
      p.completed_at ? new Date(p.completed_at).toLocaleString() : 'N/A',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mpesa-payments-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const stats = {
    total: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
    successful: payments.filter(p => p.status === 'success').length,
    failed: payments.filter(p => p.status === 'failed').length,
    successRate: payments.length > 0 
      ? ((payments.filter(p => p.status === 'success').length / payments.length) * 100).toFixed(1)
      : '0',
  };

  return (
    <RoleGuard allowedRoles={['admin', 'cashier', 'manager']}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-lg bg-green-500/20">
                <Smartphone className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">M-Pesa Payment History</h1>
                <p className="text-slate-400">Track and manage all M-Pesa transactions</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <p className="text-slate-400 text-sm mb-1">Total Transactions</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <p className="text-slate-400 text-sm mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-green-400">KES {stats.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <p className="text-slate-400 text-sm mb-1">Successful</p>
              <p className="text-2xl font-bold text-emerald-400">{stats.successful}</p>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <p className="text-slate-400 text-sm mb-1">Success Rate</p>
              <p className="text-2xl font-bold text-blue-400">{stats.successRate}%</p>
            </div>
          </div>

          {/* Filter Section */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <div className="flex flex-col gap-4">
              {/* Search and Action Buttons */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by phone, receipt number, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-green-500"
                  />
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-white transition flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 border border-green-500 rounded-lg text-white transition flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="timeout">Timeout</option>
                  <option value="insufficient_balance">Insufficient Balance</option>
                </select>

                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
          </div>

          {/* Payments List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center">
                <Smartphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No M-Pesa payments found</p>
              </div>
            ) : (
              filteredPayments.map((payment) => (
                <div key={payment.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  {/* Main Row */}
                  <button
                    onClick={() => setExpandedId(expandedId === payment.id ? null : payment.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition"
                  >
                    <div className="flex items-center gap-4 flex-1 text-left">
                      <div className={`p-2 rounded-lg ${STATUS_COLORS[payment.status]}`}>
                        {STATUS_ICONS[payment.status]}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{formatPhoneDisplay(payment.phone)}</p>
                        <p className="text-sm text-slate-400">{new Date(payment.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">KES {payment.amount.toLocaleString()}</p>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status]}`}>
                          {payment.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      {expandedId === payment.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedId === payment.id && (
                    <div className="border-t border-slate-700 px-6 py-4 bg-slate-900/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-slate-400 text-xs mb-1">Payment ID</p>
                          <p className="text-white font-mono text-sm">{payment.id}</p>
                        </div>
                        {payment.transaction_id && (
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Transaction ID</p>
                            <p className="text-white font-mono text-sm">{payment.transaction_id}</p>
                          </div>
                        )}
                        {payment.mpesa_receipt_number && (
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Receipt Number</p>
                            <p className="text-green-400 font-mono text-sm">{payment.mpesa_receipt_number}</p>
                          </div>
                        )}
                        {payment.attempts > 0 && (
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Attempts</p>
                            <p className="text-white">{payment.attempts}</p>
                          </div>
                        )}
                        {payment.completed_at && (
                          <div>
                            <p className="text-slate-400 text-xs mb-1">Completed</p>
                            <p className="text-white text-sm">{new Date(payment.completed_at).toLocaleString()}</p>
                          </div>
                        )}
                        {payment.error_message && (
                          <div className="md:col-span-4">
                            <p className="text-slate-400 text-xs mb-1">Error</p>
                            <p className="text-red-400 text-sm">{payment.error_message}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
