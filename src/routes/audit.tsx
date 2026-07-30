// Audit Page - View and filter audit logs

import { useState, useEffect } from 'react';
import { RoleGuard } from '../context/AuthContext';
import {
  FileText, Filter, Calendar, User, Package, ShoppingCart, Users as UsersIcon,
  Shield, RefreshCw, Download, Search, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';
import { getAuditLogs, getAuditSummary } from '../lib/audit';
import type { AuditLog, AuditEventType } from '../lib/security-types';

interface AuditLogFilters {
  dateFrom?: string;
  dateTo?: string;
  eventType?: AuditEventType;
}

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventType, setEventType] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLogs();
  }, [dateFrom, dateTo, eventType]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      if (eventType) filters.eventType = eventType as AuditEventType;

      const data = await getAuditLogs(filters);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        log.user_name.toLowerCase().includes(term) ||
        log.entity_id.toLowerCase().includes(term) ||
        log.entity_type.toLowerCase().includes(term) ||
        (log.reason && log.reason.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const getEventIcon = (type: string) => {
    if (type.includes('SALE')) return ShoppingCart;
    if (type.includes('PRODUCT') || type.includes('PRICE')) return Package;
    if (type.includes('CUSTOMER')) return UsersIcon;
    if (type.includes('USER') || type.includes('LOGIN')) return Shield;
    if (type.includes('STOCK')) return Package;
    return FileText;
  };

  const getEventColor = (type: string) => {
    if (type.includes('VOID') || type.includes('DELETE') || type.includes('FAILED')) {
      return 'text-red-400 bg-red-900/30';
    }
    if (type.includes('REFUND') || type.includes('DEACTIVATED')) {
      return 'text-amber-400 bg-amber-900/30';
    }
    if (type.includes('CREATE') || type.includes('APPROVED') || type.includes('SUCCESS')) {
      return 'text-emerald-400 bg-emerald-900/30';
    }
    if (type.includes('UPDATE') || type.includes('CHANGE')) {
      return 'text-blue-400 bg-blue-900/30';
    }
    return 'text-slate-400 bg-slate-700';
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

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const eventTypes = [
    'SALE_CREATED', 'SALE_COMPLETED', 'SALE_VOIDED', 'SALE_REFUNDED',
    'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'PRODUCT_DELETED', 'PRODUCT_PRICE_CHANGED',
    'STOCK_ADDED', 'STOCK_REMOVED', 'STOCK_ADJUSTED',
    'CUSTOMER_CREATED', 'CUSTOMER_UPDATED',
    'USER_CREATED', 'USER_DEACTIVATED', 'LOGIN_SUCCESS', 'LOGIN_FAILED',
    'APPROVAL_REQUESTED', 'APPROVAL_APPROVED', 'APPROVAL_REJECTED',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audit Trail</h1>
          <p className="text-slate-400">Complete history of all actions</p>
        </div>
        <button
          onClick={exportLogs}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition flex items-center gap-2"
        >
          <Download size={18} />
          Export
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
            <label className="block text-sm text-slate-400 mb-2">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Events</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-slate-400">
        Showing {filteredLogs.length} of {logs.length} entries
      </div>

      {/* Logs List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {filteredLogs.map((log) => {
              const Icon = getEventIcon(log.event_type);
              const colorClass = getEventColor(log.event_type);
              const isExpanded = expandedLog === log.id;

              return (
                <div
                  key={log.id}
                  className="hover:bg-slate-700/30"
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded ${colorClass}`}>
                            {log.event_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-slate-500">{log.entity_type}</span>
                        </div>
                        <p className="text-white text-sm">{log.user_name}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                          <span>{formatDate(log.created_at)}</span>
                          {log.reason && (
                            <span className="truncate max-w-xs">Reason: {log.reason}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-700/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-slate-400">User</p>
                          <p className="text-white">{log.user_name}</p>
                          <p className="text-xs text-slate-500">Role: {log.user_role}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Entity</p>
                          <p className="text-white">{log.entity_type}</p>
                          <p className="text-xs text-slate-500">ID: {log.entity_id}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Branch</p>
                          <p className="text-white">{log.branch_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Device</p>
                          <p className="text-white text-xs truncate">{log.device_info || 'N/A'}</p>
                        </div>
                      </div>

                      {(log.old_value || log.new_value) && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {log.old_value && (
                            <div>
                              <p className="text-slate-400 text-sm mb-1">Previous Value</p>
                              <pre className="bg-slate-800 rounded p-2 text-xs text-red-300 overflow-auto max-h-32">
                                {JSON.stringify(JSON.parse(log.old_value), null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_value && (
                            <div>
                              <p className="text-slate-400 text-sm mb-1">New Value</p>
                              <pre className="bg-slate-800 rounded p-2 text-xs text-emerald-300 overflow-auto max-h-32">
                                {JSON.stringify(JSON.parse(log.new_value), null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
