import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, CreditCard, CheckCircle, AlertCircle, Clock, X, User, Package, DollarSign, Calendar } from 'lucide-react';
import {
  getAllInstallmentPlans,
  saveInstallmentPlan,
  getInstallmentPaymentsByPlan,
  saveInstallmentPayment,
  getAllCustomers,
  getAllProducts,
  generateId,
  saveCustomer,
} from '../lib/db';
import {
  syncInsertInstallmentPlan,
  syncUpdateInstallmentPlan,
  syncInsertInstallmentPayment,
  syncInsertCustomer,
  syncUpdateCustomer,
} from '../lib/sync';
import type { InstallmentPlan, InstallmentPayment, Customer, Product } from '../lib/types';
import { useToast } from '../components/Toast';

export function InstallmentsPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showPayment, setShowPayment] = useState<InstallmentPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<InstallmentPlan | null>(null);
  const [payments, setPayments] = useState<InstallmentPayment[]>([]);
  const [newPlan, setNewPlan] = useState({
    customerId: '',
    productId: '',
    totalAmount: '',
    notes: '',
  });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [plansData, customersData, productsData] = await Promise.all([
      getAllInstallmentPlans(),
      getAllCustomers(),
      getAllProducts(),
    ]);
    setPlans(plansData);
    setCustomers(customersData);
    setProducts(productsData.filter(p => p.is_active));
  };

  const filteredPlans = useMemo(() => {
    return plans.filter((plan) => {
      const matchesSearch =
        plan.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customers.find(c => c.id === plan.customer_id)?.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || plan.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [plans, searchTerm, filterStatus, customers]);

  const stats = useMemo(() => {
    const activePlans = plans.filter(p => p.status === 'active');
    const completedPlans = plans.filter(p => p.status === 'completed');
    const totalInInstallments = activePlans.reduce((sum, p) => sum + (p.total_amount - p.amount_paid), 0);
    const collectedThisMonth = plans
      .filter(p => new Date(p.updated_at).getMonth() === new Date().getMonth())
      .reduce((sum, p) => sum + p.amount_paid, 0);

    return {
      active: activePlans.length,
      completed: completedPlans.length,
      pending: totalInInstallments,
      collected: collectedThisMonth,
    };
  }, [plans]);

  const handleCreatePlan = async () => {
    if (!newPlan.customerId || !newPlan.productId || !newPlan.totalAmount) return;

    const product = products.find(p => p.id === newPlan.productId);
    const now = new Date().toISOString();

    const plan: InstallmentPlan = {
      id: generateId(),
      customer_id: newPlan.customerId,
      product_id: newPlan.productId,
      product_name: product?.name || 'Unknown Product',
      total_amount: parseFloat(newPlan.totalAmount),
      amount_paid: 0,
      installment_count: 1,
      status: 'active',
      product_released: false,
      notes: newPlan.notes || undefined,
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
    };

    await saveInstallmentPlan(plan);
    syncInsertInstallmentPlan(plan);
    setNewPlan({ customerId: '', productId: '', totalAmount: '', notes: '' });
    setShowNewPlan(false);
    loadData();
  };

  const handlePayment = async () => {
    if (!showPayment || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    const newAmountPaid = showPayment.amount_paid + amount;
    const isComplete = newAmountPaid >= showPayment.total_amount;
    const now = new Date().toISOString();

    const payment: InstallmentPayment = {
      id: generateId(),
      plan_id: showPayment.id,
      amount,
      payment_method: paymentMethod,
      created_at: now,
      sync_status: 'pending',
    };

    await saveInstallmentPayment(payment);
    syncInsertInstallmentPayment(payment);

    const updatedPlan: InstallmentPlan = {
      ...showPayment,
      amount_paid: newAmountPaid,
      status: isComplete ? 'completed' : 'active',
      product_released: isComplete,
      release_date: isComplete ? now : undefined,
      updated_at: now,
      sync_status: 'pending',
    };

    await saveInstallmentPlan(updatedPlan);
    syncUpdateInstallmentPlan(updatedPlan);

    // Update customer total spent
    const customer = customers.find(c => c.id === showPayment.customer_id);
    if (customer) {
      const updatedCustomer = {
        ...customer,
        total_spent: customer.total_spent + amount,
        updated_at: now,
        sync_status: 'pending' as const,
      };
      await saveCustomer(updatedCustomer);
      syncUpdateCustomer(updatedCustomer);
    }

    setPaymentAmount('');
    setShowPayment(null);
    loadData();

    if (isComplete) {
      toast.show('Payment complete! Product can now be released to the customer.');
    }
  };

  const handleViewPlan = async (plan: InstallmentPlan) => {
    setSelectedPlan(plan);
    const planPayments = await getInstallmentPaymentsByPlan(plan.id);
    setPayments(planPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name) return;

    const customer: Customer = {
      id: generateId(),
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email,
      loyalty_points: 0,
      total_spent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await saveCustomer(customer);
    syncInsertCustomer(customer);
    setCustomers(prev => [...prev, customer]);
    setNewPlan(prev => ({ ...prev, customerId: customer.id }));
    setNewCustomer({ name: '', phone: '', email: '' });
    setShowNewCustomer(false);
  };

  const getProgress = (plan: InstallmentPlan) => {
    return Math.min(100, (plan.amount_paid / plan.total_amount) * 100);
  };

  const getRemainingAmount = (plan: InstallmentPlan) => {
    return Math.max(0, plan.total_amount - plan.amount_paid);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
              <p className="text-sm text-slate-400">Active Plans</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <CheckCircle size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.completed}</p>
              <p className="text-sm text-slate-400">Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">KES {stats.pending.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Pending Balance</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <DollarSign size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">KES {stats.collected.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Collected This Month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by customer or product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'active', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterStatus === status
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewPlan(true)}
          className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
        >
          <Plus size={20} />
          New Plan
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredPlans.map((plan) => {
          const customer = customers.find(c => c.id === plan.customer_id);
          const progress = getProgress(plan);
          const remaining = getRemainingAmount(plan);

          return (
            <div
              key={plan.id}
              className="bg-slate-800 rounded-xl p-4 hover:ring-2 hover:ring-emerald-500 transition cursor-pointer"
              onClick={() => handleViewPlan(plan)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-medium text-white flex items-center gap-2">
                    <Package size={18} className="text-slate-400" />
                    {plan.product_name}
                  </h3>
                  <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                    <User size={14} />
                    {customer?.name || 'Unknown Customer'}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    plan.status === 'completed'
                      ? 'bg-emerald-600/20 text-emerald-400'
                      : plan.status === 'active'
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'bg-red-600/20 text-red-400'
                  }`}
                >
                  {plan.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Payment Progress</span>
                  <span className="text-white font-medium">{progress.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      plan.status === 'completed'
                        ? 'bg-emerald-500'
                        : plan.status === 'active'
                        ? 'bg-blue-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Total</p>
                  <p className="text-white font-medium">KES {plan.total_amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400">Paid</p>
                  <p className="text-emerald-400 font-medium">KES {plan.amount_paid.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-slate-400">Remaining</p>
                  <p className="text-amber-400 font-medium">KES {remaining.toLocaleString()}</p>
                </div>
              </div>

              {/* Action Button */}
              {plan.status === 'active' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPayment(plan);
                  }}
                  className="w-full mt-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
                >
                  Add Payment
                </button>
              )}

              {plan.product_released && (
                <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle size={16} />
                  Product Released
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
          <p>No installment plans found</p>
        </div>
      )}

      {/* New Plan Modal */}
      {showNewPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">New Lipa Mdogo Mdogo Plan</h3>
              <button onClick={() => setShowNewPlan(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Customer *</label>
                <div className="flex items-center gap-2">
                  <select
                    value={newPlan.customerId}
                    onChange={(e) => setNewPlan({ ...newPlan, customerId: e.target.value })}
                    className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowNewCustomer(true)}
                    className="px-4 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Product *</label>
                <select
                  value={newPlan.productId}
                  onChange={(e) => {
                    const product = products.find(p => p.id === e.target.value);
                    setNewPlan({
                      ...newPlan,
                      productId: e.target.value,
                      totalAmount: product ? product.price.toString() : newPlan.totalAmount,
                    });
                  }}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - KES {product.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Total Amount (KES) *</label>
                <input
                  type="number"
                  value={newPlan.totalAmount}
                  onChange={(e) => setNewPlan({ ...newPlan, totalAmount: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Notes</label>
                <textarea
                  value={newPlan.notes}
                  onChange={(e) => setNewPlan({ ...newPlan, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="bg-amber-600/10 border border-amber-600/30 rounded-lg p-3 text-sm text-amber-400">
                <AlertCircle size={16} className="inline mr-2" />
                Product will be released to the customer only after full payment is completed.
              </div>

              <button
                onClick={handleCreatePlan}
                disabled={!newPlan.customerId || !newPlan.productId || !newPlan.totalAmount}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add Payment</h3>
              <button onClick={() => setShowPayment(null)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-700 rounded-lg p-4">
                <p className="text-sm text-slate-400">Customer</p>
                <p className="text-white font-medium">
                  {customers.find(c => c.id === showPayment.customer_id)?.name}
                </p>
                <p className="text-sm text-slate-400 mt-2">Product</p>
                <p className="text-white font-medium">{showPayment.product_name}</p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-lg font-bold text-white">
                    KES {showPayment.total_amount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Paid</p>
                  <p className="text-lg font-bold text-emerald-400">
                    KES {showPayment.amount_paid.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Remaining</p>
                  <p className="text-lg font-bold text-amber-400">
                    KES {getRemainingAmount(showPayment).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Payment Amount (KES) *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={getRemainingAmount(showPayment).toString()}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-lg"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 block mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'card', label: 'Card' },
                    { id: 'mpesa', label: 'M-Pesa' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setPaymentMethod(id as 'cash' | 'card' | 'mpesa')}
                      className={`py-3 rounded-lg border-2 text-sm font-medium transition ${
                        paymentMethod === id
                          ? 'border-emerald-500 bg-emerald-600/20 text-emerald-400'
                          : 'border-slate-600 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {parseFloat(paymentAmount) >= getRemainingAmount(showPayment) && (
                <div className="bg-emerald-600/10 border border-emerald-600/30 rounded-lg p-3 text-sm text-emerald-400">
                  <CheckCircle size={16} className="inline mr-2" />
                  This payment will complete the plan. Product can be released!
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Details Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Installment Plan Details</h3>
              <button onClick={() => setSelectedPlan(null)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Plan Info */}
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <Package size={24} className="text-emerald-400" />
                  <div>
                    <h4 className="text-lg font-medium text-white">{selectedPlan.product_name}</h4>
                    <p className="text-sm text-slate-400">
                      Customer: {customers.find(c => c.id === selectedPlan.customer_id)?.name}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400">Status</p>
                    <span
                      className={`inline-block px-2 py-1 rounded text-sm font-medium mt-1 ${
                        selectedPlan.status === 'completed'
                          ? 'bg-emerald-600/20 text-emerald-400'
                          : selectedPlan.status === 'active'
                          ? 'bg-blue-600/20 text-blue-400'
                          : 'bg-red-600/20 text-red-400'
                      }`}
                    >
                      {selectedPlan.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Created</p>
                    <p className="text-white flex items-center gap-1">
                      <Calendar size={14} />
                      {new Date(selectedPlan.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {selectedPlan.product_released && (
                  <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm bg-emerald-600/10 rounded-lg p-2">
                    <CheckCircle size={16} />
                    Product released on {new Date(selectedPlan.release_date || selectedPlan.updated_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Payment Progress */}
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Payment Progress</span>
                  <span className="text-white font-medium">{getProgress(selectedPlan).toFixed(0)}%</span>
                </div>
                <div className="h-4 bg-slate-600 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${getProgress(selectedPlan)}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="text-lg font-bold text-white">KES {selectedPlan.total_amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Paid</p>
                    <p className="text-lg font-bold text-emerald-400">KES {selectedPlan.amount_paid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Remaining</p>
                    <p className="text-lg font-bold text-amber-400">KES {getRemainingAmount(selectedPlan).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Payment History */}
              <div className="bg-slate-700 rounded-lg p-4">
                <h4 className="font-medium text-white mb-4 flex items-center gap-2">
                  <DollarSign size={18} />
                  Payment History ({payments.length} payments)
                </h4>
                {payments.length > 0 ? (
                  <div className="space-y-2">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between py-2 border-b border-slate-600 last:border-0">
                        <div>
                          <p className="text-sm text-white">KES {payment.amount.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(payment.created_at).toLocaleDateString()} via {payment.payment_method}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-slate-600">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Paid</span>
                        <span className="text-emerald-400 font-bold">
                          KES {payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-slate-400 py-4">No payments yet</p>
                )}
              </div>

              {/* Actions */}
              {selectedPlan.status === 'active' && (
                <button
                  onClick={() => {
                    setSelectedPlan(null);
                    setShowPayment(selectedPlan);
                  }}
                  className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition"
                >
                  Add Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">New Customer</h3>
              <button onClick={() => setShowNewCustomer(false)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Name *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Phone</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleCreateCustomer}
                disabled={!newCustomer.name}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
