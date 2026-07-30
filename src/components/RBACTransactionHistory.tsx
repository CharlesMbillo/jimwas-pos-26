import { useState, useEffect } from 'react';
import { Eye, Trash2, AlertCircle, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllTransactions } from '../lib/db';
import { hasPermission } from '../lib/permissions';
import { VoidTransactionModal } from './VoidTransactionModal';
import type { Transaction } from '../lib/types';

export function RBACTransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [canVoid, setCanVoid] = useState(false);

  useEffect(() => {
    loadTransactions();
    checkPermissions();
  }, [user]);

  const checkPermissions = async () => {
    if (!user) return;
    const canVoidCheck = await hasPermission(user.id, 'sales.void');
    setCanVoid(canVoidCheck);
  };

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const txns = await getAllTransactions();
      setTransactions(txns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoidClick = (transaction: Transaction) => {
    if (!canVoid) return;
    setSelectedTransaction(transaction);
    setShowVoidModal(true);
  };

  if (!user) return null;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Transaction History
          </h2>
          {canVoid && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-900/30 text-green-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Can void
            </span>
          )}
          {!canVoid && (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-900/30 text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> View only
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-slate-400">No transactions yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700 sticky top-0 bg-slate-800">
                <tr className="text-slate-300">
                  <th className="text-left px-4 py-2">Transaction ID</th>
                  <th className="text-right px-4 py-2">Amount</th>
                  <th className="text-left px-4 py-2">Payment Method</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-center px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-700/50 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-300">{txn.id.substring(0, 8)}</span>
                    </td>
                    <td className="text-right px-4 py-3 font-semibold text-white">
                      KES {txn.total_amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 capitalize">
                        {txn.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {txn.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-green-400">
                          <CheckCircle2 className="w-4 h-4" /> Completed
                        </span>
                      ) : txn.status === 'voided' ? (
                        <span className="inline-flex items-center gap-1 text-red-400">
                          <XCircle className="w-4 h-4" /> Voided
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-400">
                          <AlertCircle className="w-4 h-4" /> {txn.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(txn.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        {canVoid && txn.status === 'completed' && (
                          <button
                            onClick={() => handleVoidClick(txn)}
                            className="p-1 hover:bg-red-900/30 rounded-lg transition text-red-400 hover:text-red-300"
                            title="Void transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {(!canVoid || txn.status !== 'completed') && (
                          <span className="text-slate-600">—</span>
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

      <VoidTransactionModal
        transaction={selectedTransaction}
        isOpen={showVoidModal}
        onClose={() => setShowVoidModal(false)}
        onVoidComplete={() => {
          setShowVoidModal(false);
          loadTransactions();
        }}
      />
    </>
  );
}
