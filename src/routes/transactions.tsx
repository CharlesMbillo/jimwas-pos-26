// Unified Transactions Dashboard - Real-time transaction tracking across all channels
// Consolidates: POS transactions, KCB BUNI payments, ledger entries into single view

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Download, Printer, Trash2, RefreshCw, TrendingUp, TrendingDown,
  Clock, CheckCircle2, XCircle, AlertCircle, Smartphone, DollarSign, Banknote, CreditCard
} from 'lucide-react';
import { getAllTransactions, getBusinessSettings, getReceiptSettings, getTransaction, getAllKCBPayments } from '../lib/db';
import { printReceipt } from '../lib/print';
import { hasPermission } from '../lib/permissions';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { VoidTransactionModal } from '../components/VoidTransactionModal';
import type { Transaction } from '../lib/types';
import type { KCBPaymentRecord } from '../lib/db';

interface UnifiedTransaction {
  id: string;
  type: 'sale' | 'kcb_payment' | 'void' | 'refund';
  amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  customer_name?: string;
  phone?: string;
  receipt_number?: string;
  cashier_name?: string;
  items?: number; // count of items
  reference_id?: string; // for KCB payment reference
}

export function TransactionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [unifiedTransactions, setUnifiedTransactions] = useState<UnifiedTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<UnifiedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [printingId, setPrintingId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'kcb_payment' | 'void' | 'refund'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'pending'>('all');
  const [filterMethod, setFilterMethod] = useState<'all' | 'cash' | 'kcb' | 'card' | 'bank_transfer'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Void modal
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [canVoid, setCanVoid] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalAmount: 0,
    successCount: 0,
    failedCount: 0,
    averageValue: 0,
  });

  // Load all transactions
  const loadTransactions = useCallback(async () => {
    try {
      const [posTransactions, kcbPayments] = await Promise.all([
        getAllTransactions(),
        getAllKCBPayments(),
      ]);

      // Convert POS transactions to unified format
      const posTxns: UnifiedTransaction[] = posTransactions.map(txn => ({
        id: txn.id,
        type: 'sale' as const,
        amount: txn.total_amount,
        payment_method: txn.payment_method,
        status: txn.status,
        created_at: txn.created_at,
        customer_name: txn.customer_name,
        phone: txn.customer_phone,
        receipt_number: txn.mpesa_receipt,
        cashier_name: txn.cashier_name,
        items: txn.items?.length || 0,
      }));

      // Convert KCB payments to unified format
      const kcbTxns: UnifiedTransaction[] = kcbPayments.map(payment => ({
        id: payment.id,
        type: 'kcb_payment' as const,
        amount: payment.amount,
        payment_method: 'kcb',
        status: payment.status,
        created_at: payment.created_at,
        phone: payment.phone,
        receipt_number: payment.mpesa_receipt_number,
        reference_id: payment.checkout_request_id,
      }));

      // Combine and sort by date (newest first)
      const combined = [...posTxns, ...kcbTxns].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setUnifiedTransactions(combined);
      calculateStats(combined);
    } catch (error) {
      console.error('[v0] Error loading transactions:', error);
      toast.show('Failed to load transactions', 'error');
    }
  }, [toast]);

  const calculateStats = (transactions: UnifiedTransaction[]) => {
    const stats = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
      successCount: transactions.filter(t => t.status === 'success').length,
      failedCount: transactions.filter(t => t.status === 'failed').length,
      averageValue: transactions.length > 0 
        ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length 
        : 0,
    };
    setStats(stats);
  };

  const filterTransactions = useCallback(() => {
    let filtered = unifiedTransactions;

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // Payment method filter
    if (filterMethod !== 'all') {
      filtered = filtered.filter(t => t.payment_method === filterMethod);
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.customer_name?.toLowerCase().includes(search) ||
        t.phone?.includes(search) ||
        t.receipt_number?.includes(search) ||
        t.reference_id?.includes(search)
      );
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      filtered = filtered.filter(t => new Date(t.created_at) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.created_at) <= to);
    }

    setFilteredTransactions(filtered);
  }, [unifiedTransactions, filterType, filterStatus, filterMethod, searchTerm, dateFrom, dateTo]);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    const initPage = async () => {
      await loadTransactions();
      // Check if user can void transactions based on role
      const userRole = user?.role_code;
      const allowed = userRole === 'admin' || userRole === 'manager';
      setCanVoid(allowed);
    };
    initPage().finally(() => setIsLoading(false));
  }, [user?.role_code, loadTransactions]);

  // Filter whenever inputs change
  useEffect(() => {
    filterTransactions();
  }, [filterTransactions]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setIsRefreshing(true);
      loadTransactions().finally(() => setIsRefreshing(false));
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadTransactions]);

  const handlePrintReceipt = async (transaction: UnifiedTransaction) => {
    setPrintingId(transaction.id);
    try {
      if (transaction.type === 'sale') {
        const txn = await getTransaction(transaction.id);
        if (!txn) {
          toast.show('Transaction not found', 'error');
          return;
        }

        const [business, receipt] = await Promise.all([
          getBusinessSettings(),
          getReceiptSettings(),
        ]);

        if (!business || !receipt) {
          toast.show('Could not load receipt settings', 'error');
          return;
        }

        printReceipt({
          business,
          receipt,
          transaction: {
            id: txn.id,
            items: txn.items,
            total_amount: txn.total_amount,
            amount_paid: txn.amount_paid,
            change_amount: txn.change_amount,
            payment_method: txn.payment_method,
            created_at: txn.created_at,
            customer_name: transaction.customer_name,
            customer_phone: transaction.phone,
            cashier_name: user?.name,
          },
        });

        toast.show('Receipt sent to printer', 'success');
      } else {
        toast.show('Print not available for this transaction type', 'info');
      }
    } catch (error) {
      console.error('[v0] Error printing receipt:', error);
      toast.show('Failed to print receipt', 'error');
    } finally {
      setPrintingId(null);
    }
  };

  const handleVoidClick = async (transaction: UnifiedTransaction) => {
    if (!canVoid || transaction.status !== 'success' || transaction.type !== 'sale') return;
    
    try {
      // Fetch the full transaction details
      const fullTransaction = await getTransaction(transaction.id);
      if (fullTransaction) {
        setSelectedTransaction(fullTransaction);
        setShowVoidModal(true);
      } else {
        toast.show('Failed to load transaction details', 'error');
      }
    } catch (error) {
      console.error('[v0] Error loading transaction:', error);
      toast.show('Error loading transaction details', 'error');
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <ShoppingCart className="w-4 h-4" />;
      case 'kcb_payment':
        return <Smartphone className="w-4 h-4" />;
      case 'void':
        return <AlertCircle className="w-4 h-4" />;
      case 'refund':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded font-medium">Success</span>;
      case 'failed':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded font-medium">Failed</span>;
      case 'pending':
      case 'processing':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded font-medium">Pending</span>;
      default:
        return <span className="px-2 py-1 bg-slate-500/20 text-slate-400 text-xs rounded font-medium">{status}</span>;
    }
  };

  const ShoppingCart = Banknote; // Placeholder for consistency

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-emerald-500/20">
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Transactions</h1>
                <p className="text-slate-400">Real-time transaction tracking across all channels</p>
              </div>
            </div>
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await loadTransactions();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-slate-300 disabled:opacity-50"
              title="Refresh transactions"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm font-medium">Total Transactions</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.totalTransactions}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm font-medium">Total Amount</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">KES {stats.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm font-medium">Success Rate</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats.totalTransactions > 0 ? ((stats.successCount / stats.totalTransactions) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm font-medium">Failed</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.failedCount}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm font-medium">Avg Value</p>
              <p className="text-2xl font-bold text-white mt-1">KES {Math.round(stats.averageValue).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, phone, receipt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Types</option>
              <option value="sale">Sales</option>
              <option value="kcb_payment">KCB BUNI Payments</option>
              <option value="void">Voids</option>
              <option value="refund">Refunds</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value as any)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="kcb">KCB BUNI STK</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
            />
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-600"
              />
              <span className="text-sm">Auto-refresh (30s)</span>
            </label>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700 border-b border-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300">Details</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-700/50 transition">
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {new Date(txn.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-300">
                          {getTransactionIcon(txn.type)}
                          <span className="capitalize">{txn.type.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {txn.customer_name && <p>{txn.customer_name}</p>}
                        {txn.phone && <p className="text-slate-500 text-xs">{txn.phone}</p>}
                        {txn.receipt_number && <p className="text-slate-500 text-xs">Ref: {txn.receipt_number}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-white">
                        KES {txn.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(txn.status)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          {txn.type === 'sale' && (
                            <button
                              onClick={() => handlePrintReceipt(txn)}
                              disabled={printingId === txn.id}
                              className="p-1 hover:bg-blue-900/30 rounded-lg transition text-blue-400 hover:text-blue-300 disabled:opacity-50"
                              title="Print receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {canVoid && txn.type === 'sale' && txn.status === 'success' && (
                            <button
                              onClick={() => handleVoidClick(txn)}
                              className="p-1 hover:bg-red-900/30 rounded-lg transition text-red-400 hover:text-red-300"
                              title="Void transaction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Void Transaction Modal */}
      <VoidTransactionModal
        transaction={selectedTransaction}
        isOpen={showVoidModal}
        onClose={() => {
          setShowVoidModal(false);
          setSelectedTransaction(null);
        }}
        onVoidComplete={() => {
          loadTransactions();
        }}
      />
    </div>
  );
}
