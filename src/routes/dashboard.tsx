import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, DollarSign, ShoppingCart, Users, CreditCard, Star, Calendar } from 'lucide-react';
import { getAllTransactions, getAllCustomers, getAllInstallmentPlans, getAllProducts } from '../lib/db';
import { getTodaySummary, getWeekSummary, getMonthSummary, formatCurrency } from '../lib/ledger';
import { MpesaDashboardWidget } from '../components/MpesaDashboardWidget';
import type { Transaction, Customer, InstallmentPlan, Product } from '../lib/types';

export function DashboardPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [txData, custData, planData, prodData] = await Promise.all([
      getAllTransactions(),
      getAllCustomers(),
      getAllInstallmentPlans(),
      getAllProducts(),
    ]);
    setTransactions(txData);
    setCustomers(custData);
    setInstallmentPlans(planData);
    setProducts(prodData);
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timeRange) {
      case 'today':
        return { start: today, end: now };
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { start: weekAgo, end: now };
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { start: monthAgo, end: now };
      }
    }
  }, [timeRange]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.status === 'voided') return false;
      const txDate = new Date(tx.created_at);
      return txDate >= dateRange.start && txDate <= dateRange.end;
    });
  }, [transactions, dateRange]);

  const stats = useMemo(() => {
    const totalRevenue = filteredTransactions.reduce((sum, tx) => sum + tx.amount_paid, 0);
    const totalTransactions = filteredTransactions.length;
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    const uniqueCustomers = new Set(filteredTransactions.map((tx) => tx.customer_id).filter(Boolean)).size;

    const loyaltyPointsEarned = customers.reduce((sum, c) => sum + c.loyalty_points, 0);
    const activeInstallments = installmentPlans.filter((p) => p.status === 'active').length;
    const pendingInstallmentAmount = installmentPlans
      .filter((p) => p.status === 'active')
      .reduce((sum, p) => sum + (p.total_amount - p.amount_paid), 0);

    return {
      totalRevenue,
      totalTransactions,
      averageTransaction,
      uniqueCustomers,
      loyaltyPointsEarned,
      activeInstallments,
      pendingInstallmentAmount,
    };
  }, [filteredTransactions, customers, installmentPlans]);

  const topSellingProducts = useMemo(() => {
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

    filteredTransactions.forEach((tx) => {
      tx.items?.forEach((item) => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = { name: item.product_name, quantity: 0, revenue: 0 };
        }
        productSales[item.product_id].quantity += item.quantity;
        productSales[item.product_id].revenue += item.subtotal;
      });
    });

    return Object.entries(productSales)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredTransactions]);

  const recentTransactions = useMemo(() => {
    return [...filteredTransactions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [filteredTransactions]);

  const salesByDay = useMemo(() => {
    const dayStats: Record<string, { date: string; revenue: number; count: number }> = {};

    for (let d = new Date(dateRange.start); d <= dateRange.end; d = new Date(d.getTime() + 86400000)) {
      const dateStr = d.toISOString().split('T')[0];
      dayStats[dateStr] = { date: dateStr, revenue: 0, count: 0 };
    }

    filteredTransactions.forEach((tx) => {
      const dateStr = new Date(tx.created_at).toISOString().split('T')[0];
      if (dayStats[dateStr]) {
        dayStats[dateStr].revenue += tx.amount_paid;
        dayStats[dateStr].count += 1;
      }
    });

    return Object.values(dayStats).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions, dateRange]);

  const maxRevenue = Math.max(...salesByDay.map((d) => d.revenue), 1);

  const lowStockProducts = products.filter(
    (p) => p.stock > 0 && p.stock <= (p.low_stock_alert || 5)
  );
  const outOfStockProducts = products.filter((p) => p.stock === 0);

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                timeRange === range
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-emerald-400" />
            </div>
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-white">KES {stats.totalRevenue.toLocaleString()}</p>
          <p className="text-sm text-slate-400">Total Revenue</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <ShoppingCart size={20} className="text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats.totalTransactions}</p>
          <p className="text-sm text-slate-400">Transactions</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Users size={20} className="text-purple-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats.uniqueCustomers}</p>
          <p className="text-sm text-slate-400">Unique Customers</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-amber-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white">KES {Math.round(stats.averageTransaction).toLocaleString()}</p>
          <p className="text-sm text-slate-400">Avg. Transaction</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
              <Star size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.loyaltyPointsEarned.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Loyalty Points Issued</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <CreditCard size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.activeInstallments}</p>
              <p className="text-sm text-slate-400">Active Installment Plans</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">KES {stats.pendingInstallmentAmount.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Pending Installment Balance</p>
            </div>
          </div>
        </div>
      </div>

      {/* M-Pesa Dashboard Widget */}
      <MpesaDashboardWidget timeRange={timeRange} />

      {/* Charts and Tables */}
      <div className="grid grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-400" />
            Sales Overview
          </h3>
          <div className="h-64 flex items-end gap-2">
            {salesByDay.map((day, i) => {
              const height = (day.revenue / maxRevenue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-emerald-600 rounded-t transition-all hover:bg-emerald-500"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`KES ${day.revenue.toLocaleString()}`}
                  />
                  <span className="text-xs text-slate-400 transform -rotate-45 origin-center">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-400" />
            Top Selling Products
          </h3>
          {topSellingProducts.length > 0 ? (
            <div className="space-y-3">
              {topSellingProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-emerald-600/20 rounded flex items-center justify-center text-emerald-400 text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-white">{product.name}</p>
                    <p className="text-xs text-slate-400">{product.quantity} sold</p>
                  </div>
                  <p className="text-emerald-400 font-medium">KES {product.revenue.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">No sales data for this period</p>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <ShoppingCart size={18} className="text-emerald-400" />
          Recent Transactions
        </h3>
        {recentTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-slate-400 border-b border-slate-700">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Items</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {recentTransactions.map((tx) => {
                  const customer = customers.find((c) => c.id === tx.customer_id);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-700/50">
                      <td className="py-3 text-sm text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-white">{customer?.name || 'Walk-in'}</td>
                      <td className="py-3 text-slate-400">{tx.items?.length || 0} items</td>
                      <td className="py-3 text-right text-emerald-400 font-medium">
                        KES {tx.total_amount.toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                          {tx.payment_method}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-slate-400 py-8">No transactions for this period</p>
        )}
      </div>

      {/* Inventory Alerts */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-amber-400" />
          Inventory Alerts
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">Low Stock ({'<'}=10)</p>
            <div className="space-y-2">
              {products
                .filter((p) => p.stock > 0 && p.stock <= (p.low_stock_alert || 5))
                .slice(0, 5)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{p.name}</span>
                    <span className="text-amber-400">{p.stock} left</span>
                  </div>
                ))}
              {products.filter((p) => p.stock > 0 && p.stock <= 10).length === 0 && (
                <p className="text-sm text-slate-400">All products have adequate stock</p>
              )}
            </div>
          </div>
          <div className="bg-slate-700 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">Out of Stock</p>
            <div className="space-y-2">
              {products
                .filter((p) => p.stock === 0)
                .slice(0, 5)
                .map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{p.name}</span>
                    <span className="text-red-400">Out of stock</span>
                  </div>
                ))}
              {products.filter((p) => p.stock === 0).length === 0 && (
                <p className="text-sm text-slate-400">No products out of stock</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
