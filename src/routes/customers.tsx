import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Star, TrendingUp, Phone, Mail, X, Edit2, Gift } from 'lucide-react';
import { getAllCustomers, saveCustomer, generateId, getLoyaltyTransactionsByCustomer, saveLoyaltyTransaction } from '../lib/db';
import { syncInsertCustomer, syncUpdateCustomer, syncInsertLoyaltyTransaction } from '../lib/sync';
import { logCustomerCreated, logCustomerUpdated } from '../lib/audit';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import type { Customer, LoyaltyTransaction } from '../lib/types';

export function CustomersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetails, setShowDetails] = useState<Customer | null>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [showRedeem, setShowRedeem] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const data = await getAllCustomers();
    setCustomers(data.sort((a, b) => b.total_spent - a.total_spent));
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.includes(searchTerm) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  const handleAddCustomer = async () => {
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
    await logCustomerCreated(customer.id, customer, user?.id);
    toast.show('Customer added successfully');
    setNewCustomer({ name: '', phone: '', email: '' });
    setShowAddModal(false);
    loadCustomers();
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer) return;

    const oldCustomer = customers.find(c => c.id === editingCustomer.id);
    const updated = {
      ...editingCustomer,
      updated_at: new Date().toISOString(),
      sync_status: 'pending' as const,
    };

    await saveCustomer(updated);
    syncUpdateCustomer(updated);
    await logCustomerUpdated(updated.id, oldCustomer, updated, user?.id);
    toast.show('Customer updated successfully');
    setEditingCustomer(null);
    loadCustomers();
  };

  const handleViewCustomer = async (customer: Customer) => {
    setShowDetails(customer);
    const history = await getLoyaltyTransactionsByCustomer(customer.id);
    setLoyaltyHistory(history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const handleRedeemPoints = async () => {
    if (!showDetails || !redeemPoints) return;

    const points = parseInt(redeemPoints);
    if (points > showDetails.loyalty_points) {
      toast.show('Not enough points', 'error');
      return;
    }

    const now = new Date().toISOString();
    const updated = {
      ...showDetails,
      loyalty_points: showDetails.loyalty_points - points,
      updated_at: now,
      sync_status: 'pending' as const,
    };

    await saveCustomer(updated);
    syncUpdateCustomer(updated);

    const loyaltyTx: LoyaltyTransaction = {
      id: generateId(),
      customer_id: showDetails.id,
      points: points,
      transaction_type: 'redeemed',
      source: 'redemption',
      created_at: now,
      sync_status: 'pending',
    };

    await saveLoyaltyTransaction(loyaltyTx);
    syncInsertLoyaltyTransaction(loyaltyTx);

    setShowDetails(updated);
    setRedeemPoints('');
    setShowRedeem(false);

    const history = await getLoyaltyTransactionsByCustomer(showDetails.id);
    setLoyaltyHistory(history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    loadCustomers();
  };

  const topCustomers = useMemo(() => {
    return [...customers].sort((a, b) => b.loyalty_points - a.loyalty_points).slice(0, 5);
  }, [customers]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <Plus size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{customers.length}</p>
              <p className="text-sm text-slate-400">Total Customers</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {customers.filter(c => {
                  const monthAgo = new Date();
                  monthAgo.setMonth(monthAgo.getMonth() - 1);
                  return new Date(c.updated_at) > monthAgo;
                }).length}
              </p>
              <p className="text-sm text-slate-400">Active This Month</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/20 rounded-lg flex items-center justify-center">
              <Star size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {customers.reduce((sum, c) => sum + c.loyalty_points, 0).toLocaleString()}
              </p>
              <p className="text-sm text-slate-400">Total Points Issued</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <Gift size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                KES {customers.reduce((sum, c) => sum + c.total_spent, 0).toLocaleString()}
              </p>
              <p className="text-sm text-slate-400">Total Revenue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Add */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
        >
          <Plus size={20} />
          Add Customer
        </button>
      </div>

      {/* Top Customers */}
      {topCustomers.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Star className="text-amber-400" size={20} />
            Top Loyal Customers
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {topCustomers.map((customer, index) => (
              <div
                key={customer.id}
                onClick={() => handleViewCustomer(customer)}
                className="flex-shrink-0 w-48 bg-slate-700 rounded-lg p-4 cursor-pointer hover:bg-slate-600 transition"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-white">{customer.name}</p>
                    <p className="text-xs text-slate-400">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  <Star size={14} />
                  <span className="font-medium">{customer.loyalty_points.toLocaleString()} points</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div
            key={customer.id}
            className="bg-slate-800 rounded-xl p-4 hover:ring-2 hover:ring-emerald-500 transition cursor-pointer"
            onClick={() => handleViewCustomer(customer)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-medium text-white">{customer.name}</h3>
                  {customer.phone && (
                    <p className="text-sm text-slate-400 flex items-center gap-1">
                      <Phone size={12} />
                      {customer.phone}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCustomer(customer);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <Edit2 size={16} />
              </button>
            </div>

            {customer.email && (
              <p className="text-sm text-slate-400 flex items-center gap-1 mb-3">
                <Mail size={12} />
                {customer.email}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-700">
              <div>
                <p className="text-xs text-slate-400">Loyalty Points</p>
                <p className="text-lg font-bold text-amber-400 flex items-center gap-1">
                  <Star size={14} />
                  {customer.loyalty_points.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total Spent</p>
                <p className="text-lg font-bold text-emerald-400">
                  KES {customer.total_spent.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Search size={48} className="mx-auto mb-4 opacity-50" />
          <p>No customers found</p>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Add Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
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
                onClick={handleAddCustomer}
                disabled={!newCustomer.name}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Edit Customer</h3>
              <button onClick={() => setEditingCustomer(null)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 block mb-2">Name *</label>
                <input
                  type="text"
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Phone</label>
                <input
                  type="tel"
                  value={editingCustomer.phone || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-2">Email</label>
                <input
                  type="email"
                  value={editingCustomer.email || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleUpdateCustomer}
                disabled={!editingCustomer.name}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
              >
                Update Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                  {showDetails.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">{showDetails.name}</h3>
                  {showDetails.phone && (
                    <p className="text-slate-400 flex items-center gap-1">
                      <Phone size={14} />
                      {showDetails.phone}
                    </p>
                  )}
                  {showDetails.email && (
                    <p className="text-slate-400 flex items-center gap-1">
                      <Mail size={14} />
                      {showDetails.email}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setShowDetails(null)} className="text-slate-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Loyalty Points</p>
                    <p className="text-3xl font-bold text-amber-400">{showDetails.loyalty_points.toLocaleString()}</p>
                  </div>
                  <Star className="text-amber-400" size={32} />
                </div>
                {!showRedeem ? (
                  <button
                    onClick={() => setShowRedeem(true)}
                    disabled={showDetails.loyalty_points === 0}
                    className="w-full mt-3 py-2 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/30 transition disabled:opacity-50 text-sm"
                  >
                    Redeem Points
                  </button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <input
                      type="number"
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(e.target.value)}
                      placeholder="Points to redeem"
                      className="w-full px-3 py-2 bg-slate-600 text-white rounded text-sm"
                      max={showDetails.loyalty_points}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleRedeemPoints}
                        className="flex-1 py-2 bg-amber-600 text-white rounded text-sm"
                      >
                        Redeem
                      </button>
                      <button
                        onClick={() => {
                          setShowRedeem(false);
                          setRedeemPoints('');
                        }}
                        className="px-3 py-2 bg-slate-600 text-white rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-slate-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total Spent</p>
                    <p className="text-3xl font-bold text-emerald-400">
                      KES {showDetails.total_spent.toLocaleString()}
                    </p>
                  </div>
                  <TrendingUp className="text-emerald-400" size={32} />
                </div>
              </div>
            </div>

            {/* Loyalty History */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="font-medium text-white mb-4">Loyalty Points History</h4>
              {loyaltyHistory.length > 0 ? (
                <div className="space-y-2">
                  {loyaltyHistory.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-600 last:border-0">
                      <div>
                        <p className="text-sm text-white">
                          {tx.transaction_type === 'earned' ? 'Points Earned' : 'Points Redeemed'}
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <span className={`font-bold ${tx.transaction_type === 'earned' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {tx.transaction_type === 'earned' ? '+' : '-'}{tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-4">No loyalty history yet</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
