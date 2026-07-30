// Security Monitoring - Detect and flag suspicious activities

import { generateId, saveSecurityEvent, getAllSecurityEvents, getSecurityEventsByUser, getUnresolvedSecurityEvents, getAllAuditLogs, getLoginHistoryByUser, getAllLoginHistory, getApprovalRequestsByStatus, getVoidRequestsByStatus, getRefundRequestsByStatus, getAllPriceChangeHistory, getAllStockAdjustments } from './db';
import type { SecurityEvent, SecurityEventType, SecurityEventSeverity } from './security-types';

function safeParseJson(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// Thresholds for detecting suspicious activity
const THRESHOLDS = {
  failedLoginsHour: 3,
  failedLoginsDay: 5,
  voidRequestsDay: 5,
  refundRequestsDay: 3,
  largeRefundAmount: 50000, // KES
  largeStockAdjustment: 100, // units
  priceChangesDay: 10,
  priceChangePercent: 50, // 50% change
};

// Log a security event
export async function logSecurityEvent(
  eventType: SecurityEventType,
  severity: SecurityEventSeverity,
  description: string,
  userId?: string,
  userName?: string,
  metadata?: Record<string, unknown>,
  branchId?: string,
  branchName?: string
): Promise<SecurityEvent> {
  const event: SecurityEvent = {
    id: generateId(),
    event_type: eventType,
    severity,
    user_id: userId,
    user_name: userName,
    description,
    metadata: metadata ? JSON.stringify(metadata) : '{}',
    branch_id: branchId,
    branch_name: branchName,
    is_resolved: false,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  await saveSecurityEvent(event);
  return event;
}

// Resolve a security event
export async function resolveSecurityEvent(
  eventId: string,
  resolvedBy: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const { getSecurityEvent, saveSecurityEvent, getUser } = await import('./db');

  const event = await getSecurityEvent(eventId);
  if (!event) {
    return { success: false, error: 'Event not found' };
  }

  if (event.is_resolved) {
    return { success: false, error: 'Event already resolved' };
  }

  const resolver = await getUser(resolvedBy);
  const now = new Date().toISOString();

  const updatedEvent: SecurityEvent = {
    ...event,
    is_resolved: true,
    resolved_by: resolvedBy,
    resolved_at: now,
    metadata: JSON.stringify({
      ...(safeParseJson(event.metadata)),
      resolved_by_name: resolver?.full_name,
      resolution_notes: notes,
    }),
  };

  await saveSecurityEvent(updatedEvent);
  return { success: true };
}

// Scan for suspicious activities
export async function scanForSuspiciousActivity(): Promise<SecurityEvent[]> {
  const events: SecurityEvent[] = [];
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();

  // Check for multiple failed logins
  const loginHistory = await getAllLoginHistory();
  const recentFailedLogins = loginHistory.filter(
    l => l.login_status === 'failed' && l.login_at >= oneHourAgo
  );

  // Group by user
  const failedLoginsByUser = new Map<string, typeof recentFailedLogins>();
  for (const login of recentFailedLogins) {
    const existing = failedLoginsByUser.get(login.user_id) || [];
    existing.push(login);
    failedLoginsByUser.set(login.user_id, existing);
  }

  // Flag users with multiple failed logins
  for (const [userId, logins] of failedLoginsByUser) {
    if (logins.length >= THRESHOLDS.failedLoginsHour) {
      const event = await logSecurityEvent(
        'MULTIPLE_FAILED_LOGINS',
        'medium',
        `${logins.length} failed login attempts in the last hour`,
        userId,
        logins[0].user_name,
        { attempts: logins.length, loginTimes: logins.map(l => l.login_at) }
      );
      events.push(event);
    }
  }

  // Check for suspicious void patterns
  const voidRequests = await getVoidRequestsByStatus('pending');
  const recentVoidRequests = voidRequests.filter(r => r.created_at >= oneDayAgo);

  // Group by requester
  const voidRequestsByUser = new Map<string, typeof recentVoidRequests>();
  for (const req of recentVoidRequests) {
    const existing = voidRequestsByUser.get(req.requester_id) || [];
    existing.push(req);
    voidRequestsByUser.set(req.requester_id, existing);
  }

  // Flag users with many void requests
  for (const [userId, requests] of voidRequestsByUser) {
    if (requests.length >= THRESHOLDS.voidRequestsDay) {
      const totalVoided = requests.reduce((sum, r) => sum + r.transaction_total, 0);
      const severity = totalVoided > THRESHOLDS.largeRefundAmount ? 'high' : 'medium';

      const event = await logSecurityEvent(
        'SUSPICIOUS_VOID_PATTERN',
        severity,
        `${requests.length} void requests in the last 24 hours totaling KES ${totalVoided.toLocaleString()}`,
        userId,
        requests[0].requester_name,
        { requestCount: requests.length, totalAmount: totalVoided }
      );
      events.push(event);
    }
  }

  // Check for large refund requests
  const refundRequests = await getRefundRequestsByStatus('pending');
  const recentRefundRequests = refundRequests.filter(r => r.created_at >= oneDayAgo);

  for (const req of recentRefundRequests) {
    if (req.refund_amount >= THRESHOLDS.largeRefundAmount) {
      const event = await logSecurityEvent(
        'LARGE_REFUND_AMOUNT',
        'high',
        `Large refund request of KES ${req.refund_amount.toLocaleString()} for transaction ${req.transaction_id}`,
        req.requester_id,
        req.requester_name,
        { refundAmount: req.refund_amount, transactionId: req.transaction_id }
      );
      events.push(event);
    }
  }

  // Check for frequent price changes
  const priceChanges = await getAllPriceChangeHistory();
  const recentPriceChanges = priceChanges.filter(p => p.created_at >= oneDayAgo);

  // Group by changer
  const priceChangesByUser = new Map<string, typeof recentPriceChanges>();
  for (const change of recentPriceChanges) {
    const existing = priceChangesByUser.get(change.changed_by_id) || [];
    existing.push(change);
    priceChangesByUser.set(change.changed_by_id, existing);
  }

  for (const [userId, changes] of priceChangesByUser) {
    if (changes.length >= THRESHOLDS.priceChangesDay) {
      const event = await logSecurityEvent(
        'FREQUENT_PRICE_CHANGES',
        'medium',
        `${changes.length} price changes in the last 24 hours`,
        userId,
        changes[0].changed_by_name,
        { changeCount: changes.length }
      );
      events.push(event);
    }

    // Check for large percentage price changes
    for (const change of changes) {
      const percentChange = Math.abs((change.new_price - change.old_price) / change.old_price * 100);
      if (percentChange >= THRESHOLDS.priceChangePercent) {
        const event = await logSecurityEvent(
          'FREQUENT_PRICE_CHANGES',
          'high',
          `Large price change of ${percentChange.toFixed(1)}% for ${change.product_name}`,
          userId,
          change.changed_by_name,
          {
            productId: change.product_id,
            oldPrice: change.old_price,
            newPrice: change.new_price,
            percentChange,
          }
        );
        events.push(event);
      }
    }
  }

  // Check for large stock adjustments
  const stockAdjustments = await getAllStockAdjustments();
  const recentAdjustments = stockAdjustments.filter(a => a.created_at >= oneDayAgo);

  for (const adj of recentAdjustments) {
    const delta = Math.abs(adj.new_stock - adj.previous_stock);
    if (delta >= THRESHOLDS.largeStockAdjustment) {
      const { getUser } = await import('./db');
      const user = await getUser(adj.created_by);

      const event = await logSecurityEvent(
        'LARGE_STOCK_ADJUSTMENT',
        'high',
        `Large stock adjustment of ${delta} units for product ${adj.product_id}`,
        adj.created_by,
        user?.full_name,
        {
          productId: adj.product_id,
          previousStock: adj.previous_stock,
          newStock: adj.new_stock,
          reason: adj.reason,
        }
      );
      events.push(event);
    }
  }

  return events;
}

// Get security dashboard summary
export interface SecurityDashboardSummary {
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

export async function getSecurityDashboardSummary(): Promise<SecurityDashboardSummary> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const allEvents = await getAllSecurityEvents();
  const loginHistory = await getAllLoginHistory();
  const voidRequests = await getVoidRequestsByStatus('pending');
  const refundRequests = await getRefundRequestsByStatus('pending');

  const unresolvedEvents = allEvents.filter(e => !e.is_resolved);
  const criticalEvents = unresolvedEvents.filter(e => e.severity === 'critical').length;
  const highSeverityEvents = unresolvedEvents.filter(e => e.severity === 'high').length;
  const mediumSeverityEvents = unresolvedEvents.filter(e => e.severity === 'medium').length;
  const lowSeverityEvents = unresolvedEvents.filter(e => e.severity === 'low').length;

  const failedLoginsToday = loginHistory.filter(
    l => l.login_status === 'failed' && l.login_at >= todayStart
  ).length;

  // Sort events by severity and created_at for recent alerts
  const recentAlerts = unresolvedEvents
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 10);

  return {
    unresolvedEvents: unresolvedEvents.length,
    criticalEvents,
    highSeverityEvents,
    mediumSeverityEvents,
    lowSeverityEvents,
    failedLoginsToday,
    pendingVoids: voidRequests.length,
    pendingRefunds: refundRequests.length,
    recentAlerts,
  };
}

// Get security events with filters
export interface SecurityEventFilters {
  severity?: SecurityEventSeverity;
  eventType?: SecurityEventType;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  unresolvedOnly?: boolean;
  limit?: number;
}

export async function getSecurityEvents(filters?: SecurityEventFilters): Promise<SecurityEvent[]> {
  let events = await getAllSecurityEvents();

  if (filters) {
    if (filters.severity) {
      events = events.filter(e => e.severity === filters.severity);
    }
    if (filters.eventType) {
      events = events.filter(e => e.event_type === filters.eventType);
    }
    if (filters.userId) {
      events = events.filter(e => e.user_id === filters.userId);
    }
    if (filters.dateFrom) {
      events = events.filter(e => e.created_at >= filters.dateFrom!);
    }
    if (filters.dateTo) {
      events = events.filter(e => e.created_at <= filters.dateTo!);
    }
    if (filters.unresolvedOnly) {
      events = events.filter(e => !e.is_resolved);
    }

    // Sort by created_at descending
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (filters.limit) {
      events = events.slice(0, filters.limit);
    }
  } else {
    // Default: most recent first
    events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return events;
}

// Check if action should trigger an alert
export function shouldTriggerAlert(
  actionType: string,
  data: Record<string, unknown>
): { shouldAlert: boolean; severity: SecurityEventSeverity } {
  switch (actionType) {
    case 'REFUND': {
      const refundAmount = data.refundAmount as number;
      if (refundAmount >= THRESHOLDS.largeRefundAmount) {
        return { shouldAlert: true, severity: 'high' };
      }
      if (refundAmount >= THRESHOLDS.largeRefundAmount / 2) {
        return { shouldAlert: true, severity: 'medium' };
      }
      return { shouldAlert: false, severity: 'low' };
    }

    case 'STOCK_ADJUSTMENT': {
      const adjustmentQty = Math.abs(data.delta as number);
      if (adjustmentQty >= THRESHOLDS.largeStockAdjustment) {
        return { shouldAlert: true, severity: 'high' };
      }
      if (adjustmentQty >= THRESHOLDS.largeStockAdjustment / 2) {
        return { shouldAlert: true, severity: 'medium' };
      }
      return { shouldAlert: false, severity: 'low' };
    }

    case 'PRICE_CHANGE': {
      const oldPrice = data.oldPrice as number;
      const newPrice = data.newPrice as number;
      const percentChange = Math.abs((newPrice - oldPrice) / oldPrice * 100);
      if (percentChange >= THRESHOLDS.priceChangePercent) {
        return { shouldAlert: true, severity: 'high' };
      }
      if (percentChange >= THRESHOLDS.priceChangePercent / 2) {
        return { shouldAlert: true, severity: 'medium' };
      }
      return { shouldAlert: false, severity: 'low' };
    }

    default:
      return { shouldAlert: false, severity: 'low' };
  }
}
