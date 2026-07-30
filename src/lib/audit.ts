// Audit Trail Engine - Immutable logging for all critical actions

import { generateId, saveAuditLog, getAllAuditLogs, getAuditLogsByUser, getAuditLogsByEntity, getAuditLogsByEventType } from './db';
import { getCurrentUser } from './auth';
import type { AuditLog, AuditEventType, RoleCode } from './security-types';

// Audit event types for type safety
export const AUDIT_EVENTS = {
  // Sales
  SALE_CREATED: 'SALE_CREATED',
  SALE_COMPLETED: 'SALE_COMPLETED',
  SALE_VOIDED: 'SALE_VOIDED',
  SALE_REFUNDED: 'SALE_REFUNDED',
  SALE_UPDATED: 'SALE_UPDATED',
  // Products
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  PRODUCT_DELETED: 'PRODUCT_DELETED',
  PRODUCT_PRICE_CHANGED: 'PRODUCT_PRICE_CHANGED',
  PRODUCT_ACTIVATED: 'PRODUCT_ACTIVATED',
  PRODUCT_DEACTIVATED: 'PRODUCT_DEACTIVATED',
  // Stock
  STOCK_ADDED: 'STOCK_ADDED',
  STOCK_REMOVED: 'STOCK_REMOVED',
  STOCK_ADJUSTED: 'STOCK_ADJUSTED',
  STOCK_TRANSFERRED: 'STOCK_TRANSFERRED',
  // Customers
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  CUSTOMER_DELETED: 'CUSTOMER_DELETED',
  // Users
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_PASSWORD_CHANGED: 'USER_PASSWORD_CHANGED',
  // Security
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  // Approvals
  APPROVAL_REQUESTED: 'APPROVAL_REQUESTED',
  APPROVAL_APPROVED: 'APPROVAL_APPROVED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  // Settings
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
} as const;

export interface AuditLogParams {
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  userId?: string; // Optional - will use current user if not provided
  branchId?: string;
  branchName?: string;
}

// Log an audit event
export async function logAuditEvent(params: AuditLogParams): Promise<AuditLog> {
  // Get current user if not provided
  let user = null;
  let userId = params.userId;

  if (!userId) {
    user = await getCurrentUser();
    userId = user?.id;
  } else {
    const { getUser } = await import('./db');
    user = await getUser(userId);
  }

  const now = new Date().toISOString();
  const userAgent = navigator.userAgent;
  const ip = ''; // Would need backend to capture real IP

  const auditLog: AuditLog = {
    id: generateId(),
    event_type: params.eventType,
    user_id: userId || 'system',
    user_name: user?.full_name || user?.username || 'System',
    user_role: user?.role_code || 'cashier' as RoleCode,
    entity_type: params.entityType,
    entity_id: params.entityId,
    old_value: params.oldValue ? JSON.stringify(params.oldValue) : undefined,
    new_value: params.newValue ? JSON.stringify(params.newValue) : undefined,
    reason: params.reason,
    branch_id: params.branchId || user?.branch_id,
    branch_name: params.branchName || user?.branch_name,
    device_info: userAgent,
    ip_address: ip,
    created_at: now,
    sync_status: 'pending',
  };

  await saveAuditLog(auditLog);
  return auditLog;
}

// Get all audit logs with optional filters
export interface AuditLogFilters {
  userId?: string;
  eventType?: AuditEventType;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(filters?: AuditLogFilters): Promise<AuditLog[]> {
  let logs = await getAllAuditLogs();

  // Apply filters
  if (filters) {
    if (filters.userId) {
      logs = logs.filter(l => l.user_id === filters.userId);
    }
    if (filters.eventType) {
      logs = logs.filter(l => l.event_type === filters.eventType);
    }
    if (filters.entityType) {
      logs = logs.filter(l => l.entity_type === filters.entityType);
    }
    if (filters.entityId) {
      logs = logs.filter(l => l.entity_id === filters.entityId);
    }
    if (filters.dateFrom) {
      const fromTime = new Date(filters.dateFrom).getTime();
      logs = logs.filter(l => new Date(l.created_at).getTime() >= fromTime);
    }
    if (filters.dateTo) {
      const toTime = new Date(filters.dateTo).getTime();
      logs = logs.filter(l => new Date(l.created_at).getTime() <= toTime);
    }

    // Sort by created_at descending
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Apply pagination
    if (filters.offset !== undefined) {
      logs = logs.slice(filters.offset);
    }
    if (filters.limit !== undefined) {
      logs = logs.slice(0, filters.limit);
    }
  } else {
    // Default: most recent first
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return logs;
}

// Get audit summary for dashboard
export interface AuditSummary {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByUser: Record<string, number>;
  todayEvents: number;
  voidCount: number;
  refundCount: number;
  stockAdjustmentCount: number;
  priceChangeCount: number;
}

export async function getAuditSummary(dateFrom?: string, dateTo?: string): Promise<AuditSummary> {
  const logs = await getAuditLogs({ dateFrom, dateTo });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayLogs = logs.filter(l => l.created_at >= todayStart);

  const eventsByType: Record<string, number> = {};
  const eventsByUser: Record<string, number> = {};

  for (const log of logs) {
    eventsByType[log.event_type] = (eventsByType[log.event_type] || 0) + 1;
    eventsByUser[log.user_name] = (eventsByUser[log.user_name] || 0) + 1;
  }

  return {
    totalEvents: logs.length,
    eventsByType,
    eventsByUser,
    todayEvents: todayLogs.length,
    voidCount: eventsByType['SALE_VOIDED'] || 0,
    refundCount: eventsByType['SALE_REFUNDED'] || 0,
    stockAdjustmentCount: eventsByType['STOCK_ADJUSTED'] || 0,
    priceChangeCount: eventsByType['PRODUCT_PRICE_CHANGED'] || 0,
  };
}

// Log sale events
export async function logSaleCreated(saleId: string, saleData: unknown, userId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'SALE_CREATED',
    entityType: 'sale',
    entityId: saleId,
    newValue: saleData,
    userId,
  });
}

export async function logSaleCompleted(saleId: string, saleData: unknown, userId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'SALE_COMPLETED',
    entityType: 'sale',
    entityId: saleId,
    newValue: saleData,
    userId,
  });
}

export async function logSaleVoided(saleId: string, reason: string, userId?: string, oldData?: unknown): Promise<void> {
  await logAuditEvent({
    eventType: 'SALE_VOIDED',
    entityType: 'sale',
    entityId: saleId,
    oldValue: oldData,
    reason,
    userId,
  });
}

export async function logSaleRefunded(saleId: string, refundData: unknown, reason: string, userId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'SALE_REFUNDED',
    entityType: 'sale',
    entityId: saleId,
    newValue: refundData,
    reason,
    userId,
  });
}

// Log product events
export async function logProductCreated(productId: string, productData: unknown, userId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'PRODUCT_CREATED',
    entityType: 'product',
    entityId: productId,
    newValue: productData,
    userId,
  });
}

export async function logProductUpdated(productId: string, oldData: unknown, newData: unknown, userId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'PRODUCT_UPDATED',
    entityType: 'product',
    entityId: productId,
    oldValue: oldData,
    newValue: newData,
    userId,
  });
}

export async function logPriceChanged(
  productId: string,
  oldPrice: number,
  newPrice: number,
  reason: string,
  userId?: string,
  productName?: string
): Promise<void> {
  await logAuditEvent({
    eventType: 'PRODUCT_PRICE_CHANGED',
    entityType: 'product',
    entityId: productId,
    oldValue: { price: oldPrice },
    newValue: { price: newPrice },
    reason,
    userId,
  });

  const { savePriceChangeHistory, getUser } = await import('./db');
  const user = userId ? await getUser(userId) : await getCurrentUser();

  if (user) {
    await savePriceChangeHistory({
      id: generateId(),
      product_id: productId,
      product_name: productName || '',
      old_price: oldPrice,
      new_price: newPrice,
      changed_by_id: user.id,
      changed_by_name: user.full_name,
      reason,
      created_at: new Date().toISOString(),
      sync_status: 'pending',
    });
  }
}

// Log stock events
export async function logStockAdjusted(
  productId: string,
  oldStock: number,
  newStock: number,
  reason: string,
  userId?: string
): Promise<void> {
  await logAuditEvent({
    eventType: 'STOCK_ADJUSTED',
    entityType: 'product',
    entityId: productId,
    oldValue: { stock: oldStock },
    newValue: { stock: newStock },
    reason,
    userId,
  });
}

export async function logStockTransferred(
  productId: string,
  qty: number,
  fromBranch: string,
  toBranch: string,
  userId?: string
): Promise<void> {
  await logAuditEvent({
    eventType: 'STOCK_TRANSFERRED',
    entityType: 'product',
    entityId: productId,
    newValue: { qty, fromBranch, toBranch },
    reason: `Transfer ${qty} units from ${fromBranch} to ${toBranch}`,
    userId,
  });
}

// Log customer events
export async function logCustomerCreated(customerId: string, customerData: unknown, userId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'CUSTOMER_CREATED',
    entityType: 'customer',
    entityId: customerId,
    newValue: customerData,
    userId,
  });
}

export async function logCustomerUpdated(customerId: string, oldData: unknown, newData: unknown, userId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'CUSTOMER_UPDATED',
    entityType: 'customer',
    entityId: customerId,
    oldValue: oldData,
    newValue: newData,
    userId,
  });
}

// Log user events (for auth.ts operations)
export async function logUserCreated(userId: string, userData: unknown, createdByUserId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'USER_CREATED',
    entityType: 'user',
    entityId: userId,
    newValue: userData,
    userId: createdByUserId,
  });
}

export async function logUserDeactivated(userId: string, reason: string, actorUserId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'USER_DEACTIVATED',
    entityType: 'user',
    entityId: userId,
    reason,
    userId: actorUserId,
  });
}

export async function logUserReactivated(userId: string, actorUserId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'USER_REACTIVATED',
    entityType: 'user',
    entityId: userId,
    userId: actorUserId,
  });
}

export async function logUserRoleChanged(userId: string, oldRole: string, newRole: string, reason: string, actorUserId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'USER_ROLE_CHANGED',
    entityType: 'user',
    entityId: userId,
    oldValue: { role: oldRole },
    newValue: { role: newRole },
    reason,
    userId: actorUserId,
  });
}

// Log approval events
export async function logApprovalRequested(requestId: string, requestType: string, userId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'APPROVAL_REQUESTED',
    entityType: 'approval_request',
    entityId: requestId,
    newValue: { requestType },
    userId,
  });
}

export async function logApprovalApproved(requestId: string, approverUserId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'APPROVAL_APPROVED',
    entityType: 'approval_request',
    entityId: requestId,
    userId: approverUserId,
  });
}

export async function logApprovalRejected(requestId: string, reason: string, approverUserId?: string): Promise<void> {
  await logAuditEvent({
    eventType: 'APPROVAL_REJECTED',
    entityType: 'approval_request',
    entityId: requestId,
    reason,
    userId: approverUserId,
  });
}
