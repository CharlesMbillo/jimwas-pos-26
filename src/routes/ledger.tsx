// Ledger Page - Financial tracking and reporting

import { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, CreditCard, Package,
  Download, Filter, Plus, X, Save, Receipt, ArrowRightLeft, Wallet, Banknote
} from 'lucide-react';
import {
  getLedgerEntries,
  getDailySummary,
  getPeriodSummary,
  getTodaySummary,
  getWeekSummary,
  getMonthSummary,
  formatCurrency,
  getPaymentMethodLabel,
  getEntryTypeLabel,
  createManualEntry,
  getExpenseCategories,
  exportLedgerToCSV,
} from '../lib/ledger';
import type { LedgerEntry, DailySummary, PeriodSummary } from '../lib/ledger';
import type { ExpenseCategoryRecord } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

type ViewMode = 'entries' | 'daily' | 'period';
type ManualEntryType = 'income' | 'expense' | 'adjustment' | 'cash_draw' | 'transfer';

export function LedgerPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailySummary | null>(null);
  const [weekSummary, setWeekSummary] = useState<PeriodSummary | null>(null);
  const [monthSummary, setMonthSummary] = useState<PeriodSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('entries');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entryType, setEntryType] = useState<string>('');

  // Manual entry modal
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [newEntry, setNewEntry] = useState<{
    entry_type: ManualEntryType;
    description: string;
    amount: string;
    payment_method: string;
    category: string;
    notes: string;
  }>({
    entry_type: 'income',
    description: '',
    amount: '',
    payment_method: 'cash',
    category: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const categories = await getExpenseCategories();
    setExpenseCategories(categories);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [today, week, month] = await Promise.all([
        getTodaySummary(),
        getWeekSummary(),
        getMonthSummary(),
      ]);

      setTodaySummary(today);
      setWeekSummary(week);
      setMonthSummary(month);

      // Load recent entries (last 50)
      const recent = await getLedgerEntries();
      setEntries(recent.slice(0, 50));
    } catch (error) {
      console.error('Failed to load ledger data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = async () => {
    setIsLoading(true);
    try {
      const filtered = await getLedgerEntries(dateFrom, dateTo, entryType || undefined);
      setEntries(filtered.slice(0, 100));

      if (dateFrom && dateTo) {
        const period = await getPeriodSummary(dateFrom, dateTo);
        setWeekSummary(period);
      }
    } catch (error) {
      console.error('Failed to apply filters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sale': return TrendingUp;
      case 'refund': return TrendingDown;
      case 'void': return TrendingDown;
      case 'installment_payment': return CreditCard;
      case 'loyalty_redemption': return Package;
      case 'income': return TrendingUp;
      case 'expense': return Receipt;
      case 'adjustment': return ArrowRightLeft;
      case 'cash_draw': return Wallet;
      case 'transfer': return ArrowRightLeft;
      default: return DollarSign;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'text-emerald-400 bg-emerald-900/30';
      case 'refund': return 'text-amber-400 bg-amber-900/30';
      case 'void': return 'text-red-400 bg-red-900/30';
      case 'installment_payment': return 'text-blue-400 bg-blue-900/30';
      case 'loyalty_redemption': return 'text-purple-400 bg-purple-900/30';
      case 'income': return 'text-emerald-400 bg-emerald-900/30';
      case 'expense': return 'text-red-400 bg-red-900/30';
      case 'adjustment': return 'text-blue-400 bg-blue-900/30';
      case 'cash_draw': return 'text-amber-400 bg-amber-900/30';
      case 'transfer': return 'text-slate-400 bg-slate-700';
      default: return 'text-slate-400 bg-slate-700';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const exportLedger = () => {
    const data = {
      exported_at: new Date().toISOString(),
      today: todaySummary,
      week: weekSummary,
      month: monthSummary,
      entries,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const csv = exportLedgerToCSV(entries);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateEntry = async () => {
    if (!newEntry.description.trim()) {
      toast.show('Description is required', 'error');
      return;
    }
    if (!newEntry.amount || parseFloat(newEntry.amount) <= 0) {
      toast.show('Amount must be greater than 0', 'error');
      return;
    }

    try {
      await createManualEntry(
        {
          entry_type: newEntry.entry_type,
          description: newEntry.description.trim(),
          amount: parseFloat(newEntry.amount),
          payment_method: newEntry.payment_method,
          category: newEntry.category || undefined,
          notes: newEntry.notes.trim() || undefined,
          cashier_id: user?.id,
          cashier_name: user?.name,
        },
        user?.id
      );

      toast.show('Entry created successfully');
      setShowEntryModal(false);
      setNewEntry({
        entry_type: 'income',
        description: '',
        amount: '',
        payment_method: 'cash',
        category: '',
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Failed to create entry:', error);
      toast.show('Failed to create entry', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ledger</h1>
          <p className="text-slate-400">Financial transactions and reporting</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEntryModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
          >
            <Plus size={18} />
            Add Entry
          </button>
          <div className="relative">
            <button
              onClick={exportLedger}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition flex items-center gap-2"
            >
              <Download size={18} />
              Export JSON
            </button>
          </div>
          <button
            onClick={exportCSV}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition flex items-center gap-2"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={18} className="text-emerald-400" />
            <span className="text-slate-400 text-sm">Today</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(todaySummary?.net_revenue || 0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {todaySummary?.transaction_count || 0} transactions
          </p>
        </div>

        {/* This Week */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-blue-400" />
            <span className="text-slate-400 text-sm">This Week</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(weekSummary?.net_revenue || 0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Avg: {formatCurrency(weekSummary?.average_daily || 0)}/day
          </p>
        </div>

        {/* This Month */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={18} className="text-amber-400" />
            <span className="text-slate-400 text-sm">This Month</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(monthSummary?.net_revenue || 0)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {monthSummary?.transaction_count || 0} transactions
          </p>
        </div>

        {/* Payment Methods */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={18} className="text-purple-400" />
            <span className="text-slate-400 text-sm">By Method</span>
          </div>
          <div className="space-y-1">
            {todaySummary && Object.entries(todaySummary.by_payment_method).slice(0, 3).map(([method, amount]) => (
              <div key={method} className="flex justify-between text-xs">
                <span className="text-slate-400">{getPaymentMethodLabel(method)}</span>
                <span className="text-white">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('entries')}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === 'entries'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          Entries
        </button>
        <button
         onClick={() => setViewMode('daily')}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === 'daily'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          Daily Summary
        </button>
        <button
          onClick={() => setViewMode('period')}
          className={`px-4 py-2 rounded-lg transition ${
            viewMode === 'period'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          Period Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Type</label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="sale">Sales</option>
              <option value="refund">Refunds</option>
              <option value="void">Voids</option>
              <option value="installment_payment">Installment Payments</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
              <option value="adjustment">Adjustments</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={applyFilters}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2"
            >
              <Filter size={18} />
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading ledger data...</div>
        </div>
      ) : viewMode === 'entries' ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="divide-y divide-slate-700">
            {entries.map((entry) => {
              const Icon = getTypeIcon(entry.type);
              const colorClass = getTypeColor(entry.type);

              return (
                <div key={entry.id} className="p-4 hover:bg-slate-700/30">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${colorClass}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${colorClass}`}>
                          {getEntryTypeLabel(entry.type)}
                        </span>
                        {entry.category && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-600 text-slate-300">
                            {entry.category}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">via {getPaymentMethodLabel(entry.payment_method)}</span>
                      </div>
                      <p className="text-white text-sm">{entry.description}</p>
                      <p className="text-xs text-slate-400">{formatDate(entry.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${
                        entry.type === 'sale' || entry.type === 'installment_payment' || entry.type === 'income'
                          ? 'text-emerald-400'
                          : entry.type === 'refund'
                          ? 'text-amber-400'
                          : entry.type === 'expense' || entry.type === 'void'
                          ? 'text-red-400'
                          : 'text-slate-400'
                      }`}>
                        {entry.type === 'sale' || entry.type === 'installment_payment' || entry.type === 'income' ? '+' : entry.type === 'refund' || entry.type === 'expense' || entry.type === 'void' ? '-' : ''}
                        {formatCurrency(entry.amount)}
                      </p>
                      {entry.cashier_name && (
                        <p className="text-xs text-slate-500">by {entry.cashier_name}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {entries.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <DollarSign size={48} className="mx-auto mb-4 opacity-50" />
              <p>No entries found</p>
            </div>
          )}
        </div>
      ) : viewMode === 'daily' ? (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-700">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Date</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">Sales</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">Refunds</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">Net</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">Trans.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {monthSummary?.daily_breakdown.map((day) => (
                <tr key={day.date} className="hover:bg-slate-700/30">
                  <td className="py-3 px-4 text-white">{day.date}</td>
                  <td className="py-3 px-4 text-right text-emerald-400">{formatCurrency(day.total_sales)}</td>
                  <td className="py-3 px-4 text-right text-amber-400">{formatCurrency(day.total_refunds)}</td>
                  <td className={`py-3 px-4 text-right font-bold ${day.net_revenue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(day.net_revenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">{day.transaction_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Period Summary</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-400">Total Sales</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(monthSummary?.total_sales || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Refunds</p>
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(monthSummary?.total_refunds || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Installment Payments</p>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(monthSummary?.total_installment_payments || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Other Income</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(monthSummary?.total_income || 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
            <div>
              <p className="text-sm text-slate-400">Total Expenses</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(monthSummary?.total_expenses || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Adjustments</p>
              <p className="text-2xl font-bold text-blue-400">{formatCurrency(monthSummary?.total_adjustments || 0)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Net Revenue</p>
              <p className={`text-2xl font-bold ${(monthSummary?.net_revenue || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatCurrency(monthSummary?.net_revenue || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Avg. Daily</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(monthSummary?.average_daily || 0)}</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <h4 className="text-sm font-medium text-slate-300 mb-3">By Payment Method</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {monthSummary && Object.entries(monthSummary.by_payment_method).map(([method, amount]) => (
                <div key={method} className="bg-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">{getPaymentMethodLabel(method)}</p>
                  <p className="text-lg font-bold text-white">{formatCurrency(amount)}</p>
                </div>
              ))}
            </div>
          </div>

          {monthSummary && Object.keys(monthSummary.by_category).length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h4 className="text-sm font-medium text-slate-300 mb-3">By Category</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(monthSummary.by_category).map(([cat, amount]) => (
                  <div key={cat} className="bg-slate-700 rounded-lg p-3">
                    <p className="text-xs text-slate-400">{cat}</p>
                    <p className="text-lg font-bold text-white">{formatCurrency(amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add Manual Entry</h3>
              <button
                onClick={() => setShowEntryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Entry Type</label>
                <select
                  value={newEntry.entry_type}
                  onChange={(e) => setNewEntry({ ...newEntry, entry_type: e.target.value as ManualEntryType })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="cash_draw">Cash Draw</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description *</label>
                <input
                  type="text"
                  value={newEntry.description}
                  onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Enter description"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Amount (KES) *</label>
                <input
                  type="number"
                  value={newEntry.amount}
                  onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>

              {newEntry.entry_type === 'expense' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Category</label>
                  <select
                    value={newEntry.category}
                    onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select category...</option>
                    {expenseCategories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Payment Method</label>
                <select
                  value={newEntry.payment_method}
                  onChange={(e) => setNewEntry({ ...newEntry, payment_method: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes (optional)</label>
                <textarea
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Additional details..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEntryModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEntry}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Save Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
