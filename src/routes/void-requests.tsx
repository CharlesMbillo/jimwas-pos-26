import { useState, useEffect } from 'react';
import { Trash2, CheckCircle2, XCircle, Clock, AlertCircle, Loader2, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { RoleGuard } from '../context/AuthContext';
import { getVoidRequestsByStatus, getApprovalRequest } from '../lib/db';
import { approveRequest, rejectRequest } from '../lib/approvals';
import { hasPermission } from '../lib/permissions';
import type { VoidRequest, ApprovalRequest } from '../lib/security-types';

interface VoidRequestWithApproval extends VoidRequest {
  approvalDetails?: ApprovalRequest;
}

export function VoidRequestsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [voidRequests, setVoidRequests] = useState<VoidRequestWithApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canApprove, setCanApprove] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VoidRequestWithApproval | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
    checkPermissions();
  }, [user]);

  const checkPermissions = async () => {
    if (!user) return;
    const canApproveCheck = await hasPermission(user.id, 'approval.approve');
    setCanApprove(canApproveCheck);
  };

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const pending = await getVoidRequestsByStatus('pending');
      
      // Fetch approval details for each void request
      const requestsWithDetails = await Promise.all(
        pending.map(async (vr) => {
          const approval = await getApprovalRequest(vr.approval_request_id);
          return {
            ...vr,
            approvalDetails: approval || undefined,
          };
        })
      );
      
      setVoidRequests(
        requestsWithDetails.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
    } catch (error) {
      console.error('[v0] Error loading void requests:', error);
      toast.show('Failed to load void requests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request: VoidRequestWithApproval) => {
    if (!request.approvalDetails) return;
    
    setIsProcessing(true);
    try {
      const result = await approveRequest(request.approvalDetails.id, approvalNotes);
      if (result.success) {
        toast.show('Void request approved', 'success');
        setSelectedRequest(null);
        setApprovalNotes('');
        loadRequests();
      } else {
        toast.show(result.error || 'Failed to approve request', 'error');
      }
    } catch (error) {
      console.error('[v0] Error approving:', error);
      toast.show('Error approving request', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (request: VoidRequestWithApproval) => {
    if (!request.approvalDetails) return;
    
    if (!confirm('Are you sure you want to reject this void request?')) return;
    
    setIsProcessing(true);
    try {
      const result = await rejectRequest(request.approvalDetails.id, approvalNotes || 'Rejected');
      if (result.success) {
        toast.show('Void request rejected', 'success');
        setSelectedRequest(null);
        setApprovalNotes('');
        loadRequests();
      } else {
        toast.show(result.error || 'Failed to reject request', 'error');
      }
    } catch (error) {
      console.error('[v0] Error rejecting:', error);
      toast.show('Error rejecting request', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Void Requests</h1>
                <p className="text-sm text-slate-400">Manage pending transaction voids</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Pending</div>
              <div className="text-3xl font-bold text-yellow-400 mt-1">
                {voidRequests.filter(r => r.status === 'pending').length}
              </div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Approved</div>
              <div className="text-3xl font-bold text-green-400 mt-1">
                {voidRequests.filter(r => r.status === 'approved').length}
              </div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="text-slate-400 text-sm">Rejected</div>
              <div className="text-3xl font-bold text-red-400 mt-1">
                {voidRequests.filter(r => r.status === 'rejected').length}
              </div>
            </div>
          </div>

          {/* Requests List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : voidRequests.length === 0 ? (
            <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-lg">
              <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No void requests</p>
            </div>
          ) : (
            <div className="space-y-4">
              {voidRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {/* Details */}
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-1">Transaction</div>
                      <div className="font-mono text-white text-sm">{request.transaction_id.substring(0, 12)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-1">Amount</div>
                      <div className="text-white text-lg font-bold">KES {request.transaction_amount.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs font-medium mb-1">Requested By</div>
                      <div className="text-white text-sm">{request.requester_name}</div>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="mb-4 p-3 bg-slate-700/50 rounded-lg border-l-2 border-yellow-500">
                    <div className="text-slate-400 text-xs font-medium mb-1">Reason</div>
                    <p className="text-slate-300 text-sm">{request.reason}</p>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {request.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/30 text-yellow-300">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {request.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-300">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      )}
                      {request.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-900/30 text-red-300">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </div>

                    {canApprove && request.status === 'pending' && (
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition text-sm"
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Modal */}
        {selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white">Review Void Request</h3>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction ID:</span>
                    <span className="font-mono text-white">{selectedRequest.transaction_id.substring(0, 12)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount:</span>
                    <span className="font-semibold text-white">KES {selectedRequest.transaction_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Requested By:</span>
                    <span className="text-white">{selectedRequest.requester_name}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Reason</label>
                  <p className="text-slate-400 text-sm bg-slate-700/50 p-3 rounded-lg">{selectedRequest.reason}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Your Notes</label>
                  <textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Add comments about this decision..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 resize-none"
                    rows={3}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <div className="border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setSelectedRequest(null);
                    setApprovalNotes('');
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(selectedRequest)}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
                  disabled={isProcessing}
                >
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedRequest)}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                  disabled={isProcessing}
                >
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Send className="w-4 h-4" /> Approve
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
