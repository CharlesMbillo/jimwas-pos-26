import { useState, useEffect, useRef } from 'react';
import FocusTrap from 'focus-trap-react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { createApprovalRequest } from '../lib/approvals';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import type { Transaction } from '../lib/types';

interface VoidTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onVoidComplete: () => void;
}

export function VoidTransactionModal({ transaction, isOpen, onClose, onVoidComplete }: VoidTransactionModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Prevent background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Announce modal opened for screen readers
    setLiveMessage('Void transaction dialog opened');

    // Auto-focus after a short delay to accommodate mobile browsers' UI
    const focusTimeout = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // ensure it's visible on small screens
        textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (modalRef.current) {
        modalRef.current.focus();
      }
    }, 120);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      clearTimeout(focusTimeout);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus?.();
      setLiveMessage('');
    };
  }, [isOpen, onClose]);

  if (!isOpen || !transaction || !user) return null;

  const handleVoid = async () => {
    if (!reason.trim()) {
      toast.show('Please provide a reason for voiding this transaction', 'error');
      return;
    }

    setIsLoading(true);
    setLiveMessage('Submitting void request');
    try {
      const result = await createApprovalRequest({
        requestType: 'SALE_VOID',
        entityType: 'transaction',
        entityId: transaction.id,
        requestData: {
          transaction_id: transaction.id,
          amount: transaction.total_amount,
          payment_method: transaction.payment_method,
          original_timestamp: transaction.created_at,
        },
        reason: reason,
        userId: user.id,
      });

      if (result.success) {
        toast.show('Void request submitted for approval', 'success');
        setReason('');
        setLiveMessage('Void request submitted');
        onClose();
        onVoidComplete();
      } else {
        toast.show(result.error || 'Failed to submit void request', 'error');
        setLiveMessage('Failed to submit void request');
      }
    } catch (error) {
      console.error('[v0] Void error:', error);
      toast.show('Error submitting void request', 'error');
      setLiveMessage('Error submitting void request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      {/* ARIA live region for announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>

      <FocusTrap focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: true }}>
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-transaction-title"
          tabIndex={-1}
          className="bg-slate-800 rounded-lg border border-red-500/50 max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        >
          {/* Header (non-scrolling) */}
          <div className="bg-red-900/30 px-6 py-4 border-b border-red-500/30 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 id="void-transaction-title" className="text-lg font-semibold text-red-400">
                Void Transaction
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-red-900/30 rounded-lg transition"
              disabled={isLoading}
              aria-label="Close void modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content (scrolling area) */}
          <div className="px-6 py-4 space-y-4 overflow-y-auto">
            {/* Transaction Details */}
            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID:</span>
                <span className="font-mono text-white">{transaction.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-semibold text-white">KES {transaction.total_amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Method:</span>
                <span className="text-white capitalize">{transaction.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Time:</span>
                <span className="text-white">{new Date(transaction.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              <p>This action will:</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-red-300/90">
                <li>Reverse the transaction in the system</li>
                <li>Restore inventory levels</li>
                <li>Refund customer loyalty points if applicable</li>
                <li>Require manager/admin approval</li>
                <li>Be logged in the audit trail</li>
              </ul>
            </div>

            {/* Reason Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reason for Void <span className="text-red-400">*</span>
              </label>
              <textarea
                ref={textareaRef}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this transaction is being voided..."
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-red-500/50 resize-none"
                rows={3}
                disabled={isLoading}
              />
              <p className="text-xs text-slate-400 mt-1">This reason will be visible to approvers and in audit logs.</p>
            </div>
          </div>

          {/* Footer (non-scrolling) */}
          <div className="border-t border-slate-700 px-6 py-4 flex gap-3 justify-end bg-slate-700/30 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleVoid}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              disabled={isLoading || !reason.trim()}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Void Request
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
