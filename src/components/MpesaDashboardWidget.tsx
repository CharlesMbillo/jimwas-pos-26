import { useState, useEffect } from 'react';
import { Smartphone, TrendingUp, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { getKCBStatistics } from '../lib/db';
import type { KCBStatistics } from '../lib/db';

interface MpesaDashboardWidgetProps {
  timeRange: 'today' | 'week' | 'month';
}

export function MpesaDashboardWidget({ timeRange }: MpesaDashboardWidgetProps) {
  const [stats, setStats] = useState<KCBStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadStats();
  }, [timeRange]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const sinceDate = new Date();
      
      switch (timeRange) {
        case 'today':
          sinceDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          sinceDate.setDate(sinceDate.getDate() - 7);
          break;
        case 'month':
          sinceDate.setMonth(sinceDate.getMonth() - 1);
          break;
      }
      
      const data = await getKCBStatistics(sinceDate);
      setStats(data);
    } catch (error) {
      console.error('[v0] Error loading M-Pesa statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 col-span-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-green-900/30">
            <Smartphone className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">M-Pesa Payments</h3>
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        </div>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="h-4 bg-slate-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 col-span-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-green-900/30">
            <Smartphone className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">M-Pesa Payments</h3>
            <p className="text-sm text-slate-400">No data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 col-span-2">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-900/30">
            <Smartphone className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">M-Pesa Payments</h3>
            <p className="text-sm text-slate-400">Real-time transaction overview</p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="p-2 hover:bg-slate-700 rounded-lg transition text-slate-400 hover:text-white"
          title={showDetails ? 'Hide details' : 'Show details'}
        >
          {showDetails ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {/* Total Transactions */}
        <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
          <p className="text-xs text-slate-400 mb-1">Transactions</p>
          <p className="text-2xl font-bold text-white">{stats.totalTransactions}</p>
          <p className="text-xs text-slate-500 mt-1">total</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
          <p className="text-xs text-slate-400 mb-1">Revenue</p>
          <p className="text-2xl font-bold text-emerald-400">KES {(stats.totalRevenue / 1000).toFixed(1)}k</p>
          <p className="text-xs text-slate-500 mt-1">collected</p>
        </div>

        {/* Success Rate */}
        <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
          <p className="text-xs text-slate-400 mb-1">Success Rate</p>
          <p className="text-2xl font-bold text-blue-400">{stats.successRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">{stats.successfulTransactions} successful</p>
        </div>

        {/* Failed Transactions */}
        <div className="bg-slate-700 rounded-lg p-3 border border-slate-600">
          <p className="text-xs text-slate-400 mb-1">Failed</p>
          <p className="text-2xl font-bold text-red-400">{stats.failedTransactions}</p>
          <p className="text-xs text-slate-500 mt-1">need attention</p>
        </div>
      </div>

      {/* Recent Transactions - Collapsible */}
      {showDetails && stats.recentTransactions.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-sm font-semibold text-white mb-3">Recent Transactions</h4>
          <div className="space-y-2">
            {stats.recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between bg-slate-700 rounded-lg p-3 text-sm"
              >
                <div className="flex-1">
                  <p className="text-white font-medium">{transaction.phone}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(transaction.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">KES {transaction.amount.toLocaleString()}</p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    {transaction.status === 'success' && (
                      <>
                        <CheckCircle size={14} className="text-emerald-400" />
                        <span className="text-xs text-emerald-400">Success</span>
                      </>
                    )}
                    {transaction.status === 'failed' && (
                      <>
                        <XCircle size={14} className="text-red-400" />
                        <span className="text-xs text-red-400">Failed</span>
                      </>
                    )}
                    {transaction.status === 'pending' && (
                      <>
                        <TrendingUp size={14} className="text-yellow-400" />
                        <span className="text-xs text-yellow-400">Pending</span>
                      </>
                    )}
                    {transaction.status === 'processing' && (
                      <>
                        <TrendingUp size={14} className="text-blue-400" />
                        <span className="text-xs text-blue-400">Processing</span>
                      </>
                    )}
                    {!['success', 'failed', 'pending', 'processing'].includes(transaction.status) && (
                      <span className="text-xs text-slate-400 capitalize">{transaction.status}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!showDetails && stats.recentTransactions.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <p className="text-sm">No M-Pesa transactions in this period</p>
        </div>
      )}
    </div>
  );
}
