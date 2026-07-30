import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleGuard } from '../context/AuthContext';
import {
  Shield, AlertTriangle, Users, Activity, Clock, CheckCircle, XCircle,
  ArrowRight, FileWarning, DollarSign, Package, TrendingUp, Lock
} from 'lucide-react';
import { getSecurityDashboardSummary, resolveSecurityEvent } from '../lib/security-monitor';
import { getAuditSummary } from '../lib/audit';
import { getPendingApprovalsForUser } from '../lib/approvals';
import type { SecurityEvent, AuditLog, ApprovalRequest } from '../lib/security-types';

interface SecuritySummary {
  unresolvedEvents: number;
  criticalEvents: number;
  highSeverityEvents: number;
  mediumSeverityEvents: number;
  lowSeverityEvents: number;
  failedLoginsToday: number;
  pendingVoids: number;
  pendingRefunds: number;
  recentAlerts: SecurityEvent[];
}

interface AuditSummaryData {
  todayEvents: number;
  voidCount: number;
  refundCount: number;
  stockAdjustmentCount: number;
}

export function SecurityDashboardPage({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { user } = useAuth();
  const [securitySummary, setSecuritySummary] = useState<SecuritySummary | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditSummaryData | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const [security, audit, approvals] = await Promise.all([
        getSecurityDashboardSummary(),
        getAuditSummary(),
        getPendingApprovalsForUser(user.id),
      ]);

      setSecuritySummary(security);
      setAuditSummary(audit);
      setPendingApprovals(approvals);
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveEvent = async (eventId: string) => {
    if (!user) return;

    const result = await resolveSecurityEvent(eventId, user.id, 'Resolved from dashboard');
    if (result.success) {
      loadData();
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-900/30';
      case 'high': return 'text-orange-400 bg-orange-900/30';
      case 'medium': return 'text-amber-400 bg-amber-900/30';
      case 'low': return 'text-blue-400 bg-blue-900/30';
      default: return 'text-slate-400 bg-slate-700';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading security dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Dashboard</h1>
          <p className="text-slate-400">Monitor security events, approvals, and audit trail</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition flex items-center gap-2"
        >
          <Activity size={18} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Unresolved Security Events */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="text-red-400" size={24} />
            <span className="text-xs px-2 py-1 rounded bg-red-900/30 text-red-400">
              {securitySummary?.criticalEvents || 0} critical
            </span>
          </div>
          <p className="text-3xl font-bold text-white">{securitySummary?.unresolvedEvents || 0}</p>
          <p className="text-sm text-slate-400">Security Alerts</p>
        </div>

        {/* Failed Logins Today */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <Lock className="text-amber-400" size={24} />
          </div>
          <p className="text-3xl font-bold text-white">{securitySummary?.failedLoginsToday || 0}</p>
          <p className="text-sm text-slate-400">Failed Logins Today</p>
        </div>

        {/* Pending Void Requests */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="text-orange-400" size={24} />
          </div>
          <p className="text-3xl font-bold text-white">{securitySummary?.pendingVoids || 0}</p>
          <p className="text-sm text-slate-400">Pending Void Requests</p>
        </div>

        {/* Pending Refund Requests */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-emerald-400" size={24} />
          </div>
          <p className="text-3xl font-bold text-white">{securitySummary?.pendingRefunds || 0}</p>
          <p className="text-sm text-slate-400">Pending Refund Requests</p>
        </div>
      </div>

      {/* Audit Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <FileWarning className="text-slate-400" size={20} />
            <span className="text-slate-400">Today's Events</span>
          </div>
          <p className="text-2xl font-bold text-white">{auditSummary?.todayEvents || 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="text-red-400" size={20} />
            <span className="text-slate-400">Voided Sales</span>
          </div>
          <p className="text-2xl font-bold text-white">{auditSummary?.voidCount || 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-amber-400" size={20} />
            <span className="text-slate-400">Refunds</span>
          </div>
          <p className="text-2xl font-bold text-white">{auditSummary?.refundCount || 0}</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <Package className="text-blue-400" size={20} />
            <span className="text-slate-400">Stock Adjustments</span>
          </div>
          <p className="text-2xl font-bold text-white">{auditSummary?.stockAdjustmentCount || 0}</p>
        </div>
      </div>

      {/* Two Column Layout Below */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Security Alerts */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertTriangle size={20} className="text-amber-400" />
              Recent Security Alerts
            </h2>
            <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded">
              {securitySummary?.highSeverityEvents || 0} high priority
            </span>
          </div>
          <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto">
            {securitySummary?.recentAlerts.map((alert) => (
              <div key={alert.id} className="p-4 hover:bg-slate-700/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${getSeverityColor(alert.severity)}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">{alert.event_type}</span>
                    </div>
                    <p className="text-white text-sm">{alert.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      {alert.user_name && (
                        <span>User: {alert.user_name}</span>
                      )}
                      <span>{formatDate(alert.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResolveEvent(alert.id)}
                    className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition"
                  >
                    Resolve
                  </button>
                </div>
              </div>
            ))}
            {(!securitySummary?.recentAlerts || securitySummary.recentAlerts.length === 0) && (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle size={48} className="mx-auto mb-4 opacity-50" />
                <p>No unresolved security alerts</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Approval Requests */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock size={20} className="text-amber-400" />
              Pending Approvals
            </h2>
            <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-1 rounded">
              {pendingApprovals.length} pending
            </span>
          </div>
          <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto">
            {pendingApprovals.slice(0, 5).map((request) => (
              <div key={request.id} className="p-4 hover:bg-slate-700/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        request.request_type.includes('VOID') ? 'bg-red-900/30 text-red-400' :
                        request.request_type.includes('REFUND') ? 'bg-amber-900/30 text-amber-400' :
                        'bg-blue-900/30 text-blue-400'
                      }`}>
                        {request.request_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-white text-sm">{request.reason}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span>By: {request.requester_name}</span>
                      <span>{formatDate(request.created_at)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate?.('audit')}
                    className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition flex items-center gap-1"
                  >
                    Review <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
            {pendingApprovals.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle size={48} className="mx-auto mb-4 opacity-50" />
                <p>No pending approval requests</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <RoleGuard allowedRoles={['admin', 'manager']}>
            <button
              onClick={() => onNavigate?.('settings')}
              className="p-4 bg-slate-700 rounded-lg text-left hover:bg-slate-600 transition"
            >
              <Users size={24} className="text-emerald-400 mb-2" />
              <p className="text-white font-medium">Manage Users</p>
              <p className="text-xs text-slate-400">Add, edit, deactivate users</p>
            </button>
          </RoleGuard>

          <RoleGuard allowedRoles={['admin', 'manager']}>
            <button
              onClick={() => onNavigate?.('audit')}
              className="p-4 bg-slate-700 rounded-lg text-left hover:bg-slate-600 transition"
            >
              <Shield size={24} className="text-blue-400 mb-2" />
              <p className="text-white font-medium">Audit Logs</p>
              <p className="text-xs text-slate-400">View all activity logs</p>
            </button>
          </RoleGuard>

          <RoleGuard allowedRoles={['admin']}>
            <button
              onClick={() => onNavigate?.('settings')}
              className="p-4 bg-slate-700 rounded-lg text-left hover:bg-slate-600 transition"
            >
              <Lock size={24} className="text-amber-400 mb-2" />
              <p className="text-white font-medium">Roles & Permissions</p>
              <p className="text-xs text-slate-400">Configure access control</p>
            </button>
          </RoleGuard>

          <RoleGuard allowedRoles={['admin', 'manager']}>
            <button
              onClick={() => onNavigate?.('ledger')}
              className="p-4 bg-slate-700 rounded-lg text-left hover:bg-slate-600 transition"
            >
              <TrendingUp size={24} className="text-purple-400 mb-2" />
              <p className="text-white font-medium">Reports</p>
              <p className="text-xs text-slate-400">Export financial reports</p>
            </button>
          </RoleGuard>
        </div>
      </div>
    </div>
  );
}
