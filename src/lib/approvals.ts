// Approval Workflow Engine - Handle approval requests for high-risk actions

import { generateId, saveApprovalRequest, getApprovalRequest, getAllApprovalRequests, getApprovalRequestsByStatus, getApprovalRequestsByRequester, saveApprovalHistory, saveVoidRequest, getVoidRequest, saveRefundRequest, getRefundRequest, getVoidRequestsByStatus, getRefundRequestsByStatus } from './db';
import { getCurrentUser } from './auth';
import { canPerformWithoutApproval } from './permissions';
import { logApprovalRequested, logApprovalApproved, logApprovalRejected, logSaleVoided, logSaleRefunded } from './audit';
import type { ApprovalRequest, ApprovalRequestStatus, ApprovalRequestType, RoleCode } from './security-types';

// Get applicable approver roles for an action type
export function getApproverRoles(actionType: ApprovalRequestType): RoleCode[] {
  const adminOnly: ApprovalRequestType[] = ['USER_DEACTIVATION', 'USER_ROLE_CHANGE'];

  if (adminOnly.includes(actionType)) {
    return ['admin'];
  }
  return ['admin', 'manager'];
}

// Create approval request
export interface CreateApprovalRequestParams {
  requestType: ApprovalRequestType;
  entityType: string;
  entityId: string;
  requestData: unknown;
  reason: string;
  userId?: string;
}

export async function createApprovalRequest(params: CreateApprovalRequestParams): Promise<{ success: boolean; error?: string; request?: ApprovalRequest }> {
  // Get current user
  const user = params.userId ? await (await import('./db')).getUser(params.userId) : await getCurrentUser();

  if (!user) {
    return { success: false, error: 'User not authenticated' };
  }

  // Check if user can perform without approval
  const checkResult = await canPerformWithoutApproval(user.id, params.requestType);

  if (checkResult.canPerform && !checkResult.requiresApproval) {
    return { success: false, error: 'Action does not require approval for this user' };
  }

  // Check if there's already a pending request for this entity
  const pendingRequests = await getApprovalRequestsByStatus('pending');
  const existingRequest = pendingRequests.find(r =>
    r.entity_type === params.entityType &&
    r.entity_id === params.entityId &&
    r.request_type === params.requestType
  );

  if (existingRequest) {
    return { success: false, error: 'A pending approval request already exists for this action' };
  }

  const now = new Date().toISOString();
  const requestId = generateId();

  const request: ApprovalRequest = {
    id: requestId,
    request_type: params.requestType,
    requester_id: user.id,
    requester_name: user.full_name,
    requester_role: user.role_code,
    entity_type: params.entityType,
    entity_id: params.entityId,
    request_data: JSON.stringify(params.requestData),
    reason: params.reason,
    status: 'pending',
    branch_id: user.branch_id,
    branch_name: user.branch_name,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveApprovalRequest(request);

  // Create approval history entry
  await saveApprovalHistory({
    id: generateId(),
    request_id: requestId,
    action: 'created',
    actor_id: user.id,
    actor_name: user.full_name,
    actor_role: user.role_code,
    comment: params.reason,
    created_at: now,
  });

  // Log audit event
  await logApprovalRequested(requestId, params.requestType, user.id);

  return { success: true, request };
}

// Approve request
export async function approveRequest(
  requestId: string,
  approverId: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  const request = await getApprovalRequest(requestId);
  if (!request) {
    return { success: false, error: 'Request not found' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: `Request already ${request.status}` };
  }

  // Get approver
  const { getUser } = await import('./db');
  const approver = await getUser(approverId);
  if (!approver) {
    return { success: false, error: 'Approver not found' };
  }

  // Check if approver has permission to approve this type
  const allowedRoles = getApproverRoles(request.request_type);
  if (!allowedRoles.includes(approver.role_code)) {
    return { success: false, error: 'You do not have permission to approve this request' };
  }

  // Approver cannot approve their own request
  if (request.requester_id === approverId) {
    return { success: false, error: 'You cannot approve your own request' };
  }

  const now = new Date().toISOString();

  // Update request
  const updatedRequest: ApprovalRequest = {
    ...request,
    status: 'approved',
    approver_id: approverId,
    approver_name: approver.full_name,
    approved_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveApprovalRequest(updatedRequest);

  // Create approval history entry
  await saveApprovalHistory({
    id: generateId(),
    request_id: requestId,
    action: 'approved',
    actor_id: approverId,
    actor_name: approver.full_name,
    actor_role: approver.role_code,
    comment,
    created_at: now,
  });

  // Log audit
  await logApprovalApproved(requestId, approverId);

  // Execute the approved action
  await executeApprovedAction(updatedRequest);

  return { success: true };
}

// Reject request
export async function rejectRequest(
  requestId: string,
  approverId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  const request = await getApprovalRequest(requestId);
  if (!request) {
    return { success: false, error: 'Request not found' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: `Request already ${request.status}` };
  }

  // Get approver
  const { getUser } = await import('./db');
  const approver = await getUser(approverId);
  if (!approver) {
    return { success: false, error: 'Approver not found' };
  }

  // Check if approver has permission
  const allowedRoles = getApproverRoles(request.request_type);
  if (!allowedRoles.includes(approver.role_code)) {
    return { success: false, error: 'You do not have permission to reject this request' };
  }

  const now = new Date().toISOString();

  // Update request
  const updatedRequest: ApprovalRequest = {
    ...request,
    status: 'rejected',
    approver_id: approverId,
    approver_name: approver.full_name,
    approved_at: now,
    rejection_reason: rejectionReason,
    updated_at: now,
    sync_status: 'pending',
  };

  await saveApprovalRequest(updatedRequest);

  // Create approval history entry
  await saveApprovalHistory({
    id: generateId(),
    request_id: requestId,
    action: 'rejected',
    actor_id: approverId,
    actor_name: approver.full_name,
    actor_role: approver.role_code,
    comment: rejectionReason,
    created_at: now,
  });

  // Log audit
  await logApprovalRejected(requestId, rejectionReason, approverId);

  return { success: true };
}

// Cancel request (by requester)
export async function cancelRequest(
  requestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const request = await getApprovalRequest(requestId);
  if (!request) {
    return { success: false, error: 'Request not found' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: `Request already ${request.status}` };
  }

  // Only requester can cancel
  if (request.requester_id !== userId) {
    return { success: false, error: 'Only the requester can cancel' };
  }

  const now = new Date().toISOString();

  const updatedRequest: ApprovalRequest = {
    ...request,
    status: 'cancelled',
    updated_at: now,
    sync_status: 'pending',
  };

  await saveApprovalRequest(updatedRequest);

  // Create approval history entry
  const { getUser } = await import('./db');
  const user = await getUser(userId);

  await saveApprovalHistory({
    id: generateId(),
    request_id: requestId,
    action: 'cancelled',
    actor_id: userId,
    actor_name: user?.full_name || 'Unknown',
    actor_role: user?.role_code || 'cashier',
    created_at: now,
  });

  return { success: true };
}

// Execute the approved action
async function executeApprovedAction(request: ApprovalRequest): Promise<void> {
  const data = JSON.parse(request.request_data);

  switch (request.request_type) {
    case 'SALE_VOID':
      await executeVoid(request, data);
      break;
    case 'SALE_REFUND':
      await executeRefund(request, data);
      break;
    case 'PRICE_CHANGE':
      await executePriceChange(request, data);
      break;
    case 'STOCK_ADJUSTMENT':
      await executeStockAdjustment(request, data);
      break;
    // Add more action types as needed
  }
}

// Execute void
async function executeVoid(request: ApprovalRequest, data: Record<string, unknown>): Promise<void> {
  const transactionId = request.entity_id;
  const { getTransaction, saveTransaction, getAllProducts, saveProduct } = await import('./db');

  const transaction = await getTransaction(transactionId);
  if (!transaction || transaction.status === 'voided') return;

  // Get products to restore stock
  const products = await getAllProducts();
  const productMap = new Map(products.map(p => [p.id, p]));

  // Restore stock for each item
  for (const item of transaction.items) {
    const product = productMap.get(item.product_id);
    if (product) {
      const updatedProduct = {
        ...product,
        stock: product.stock + item.quantity,
        updated_at: new Date().toISOString(),
        sync_status: 'pending' as const,
      };
      await saveProduct(updatedProduct);
    }
  }

  // Update transaction status
  const voidedTransaction = {
    ...transaction,
    status: 'voided',
    notes: `Voided: ${request.reason}`,
    sync_status: 'pending' as const,
  };
  await saveTransaction(voidedTransaction);

  // Log void in audit
  await logSaleVoided(transactionId, request.reason, request.approver_id, transaction);

  // Update void request status
  const voidRequest = await getVoidRequestByTransactionId(transactionId);
  if (voidRequest) {
    await saveVoidRequest({
      ...voidRequest,
      status: 'completed',
      approver_id: request.approver_id,
      approver_name: request.approver_name,
      approved_at: request.approved_at,
      approval_request_id: request.id,
      updated_at: new Date().toISOString(),
    });
  }
}

// Execute refund
async function executeRefund(request: ApprovalRequest, data: Record<string, unknown>): Promise<void> {
  const transactionId = request.entity_id;
  const refundAmount = data.refundAmount as number;
  const { getTransaction, saveTransaction } = await import('./db');

  const transaction = await getTransaction(transactionId);
  if (!transaction || transaction.status === 'refunded') return;

  // Update transaction status
  const refundedTransaction = {
    ...transaction,
    status: 'refunded',
    notes: `Refunded KES ${refundAmount}: ${request.reason}`,
    sync_status: 'pending' as const,
  };
  await saveTransaction(refundedTransaction);

  // Log refund in audit
  await logSaleRefunded(transactionId, { refundAmount, reason: request.reason }, request.reason, request.approver_id);

  // Update refund request status
  const refundRequest = await getRefundRequestByTransactionId(transactionId);
  if (refundRequest) {
    await saveRefundRequest({
      ...refundRequest,
      status: 'completed',
      approver_id: request.approver_id,
      approver_name: request.approver_name,
      approved_at: request.approved_at,
      approval_request_id: request.id,
      updated_at: new Date().toISOString(),
    });
  }
}

// Execute price change
async function executePriceChange(request: ApprovalRequest, data: Record<string, unknown>): Promise<void> {
  const productId = request.entity_id;
  const newPrice = data.newPrice as number;
  const oldPrice = data.oldPrice as number;
  const { getProduct, saveProduct } = await import('./db');

  const product = await getProduct(productId);
  if (!product) return;

  const now = new Date().toISOString();
  const updatedProduct = {
    ...product,
    price: newPrice,
    updated_at: now,
    sync_status: 'pending' as const,
  };
  await saveProduct(updatedProduct);

  // Log in price change history with approver
  const { savePriceChangeHistory } = await import('./db');
  await savePriceChangeHistory({
    id: generateId(),
    product_id: productId,
    product_name: product.name,
    old_price: oldPrice,
    new_price: newPrice,
    changed_by_id: request.requester_id,
    changed_by_name: request.requester_name,
    approved_by_id: request.approver_id,
    approved_by_name: request.approver_name,
    reason: request.reason,
    approval_request_id: request.id,
    created_at: now,
    sync_status: 'pending',
  });
}

// Execute stock adjustment
async function executeStockAdjustment(request: ApprovalRequest, data: Record<string, unknown>): Promise<void> {
  const productId = request.entity_id;
  const newStock = data.newStock as number;
  const oldStock = data.oldStock as number;
  const { getProduct, saveProduct, saveStockMovement } = await import('./db');

  const product = await getProduct(productId);
  if (!product) return;

  const now = new Date().toISOString();
  const updatedProduct = {
    ...product,
    stock: newStock,
    updated_at: now,
    sync_status: 'pending' as const,
  };
  await saveProduct(updatedProduct);

  // Create stock movement record
  await saveStockMovement({
    id: generateId(),
    product_id: productId,
    qty_delta: newStock - oldStock,
    reason: 'adjustment',
    note: `Adjustment approved: ${request.reason}`,
    balance_after: newStock,
    reference_type: 'adjustment',
    reference_id: request.id,
    branch_id: request.branch_id,
    created_at: now,
    created_by: request.approver_id!,
    sync_status: 'pending',
  });
}

// Helper to get void request by transaction ID
async function getVoidRequestByTransactionId(transactionId: string) {
  const requests = await getVoidRequestsByStatus('pending');
  return requests.find(r => r.transaction_id === transactionId);
}

// Helper to get refund request by transaction ID
async function getRefundRequestByTransactionId(transactionId: string) {
  const requests = await getRefundRequestsByStatus('pending');
  return requests.find(r => r.transaction_id === transactionId);
}

// Get pending approvals for a user (based on their role)
export async function getPendingApprovalsForUser(userId: string): Promise<ApprovalRequest[]> {
  const { getUser } = await import('./db');
  const user = await getUser(userId);
  if (!user) return [];

  const pending = await getApprovalRequestsByStatus('pending');

  // Filter based on user's role
  const pendingForUser: ApprovalRequest[] = [];
  for (const request of pending) {
    const allowedRoles = getApproverRoles(request.request_type);
    if (allowedRoles.includes(user.role_code)) {
      pendingForUser.push(request);
    }
  }

  return pendingForUser;
}

// Get my approval requests
export async function getMyApprovalRequests(userId: string): Promise<ApprovalRequest[]> {
  return getApprovalRequestsByRequester(userId);
}

// Request void sale
export async function requestVoidSale(
  transactionId: string,
  transactionData: unknown,
  reason: string,
  userId?: string
): Promise<{ success: boolean; error?: string; request?: ApprovalRequest }> {
  // Create void request record
  const user = userId ? await (await import('./db')).getUser(userId) : await getCurrentUser();
  if (!user) return { success: false, error: 'User not authenticated' };

  const now = new Date().toISOString();

  const voidRequest = {
    id: generateId(),
    transaction_id: transactionId,
    transaction_total: (transactionData as any).total_amount || 0,
    requester_id: user.id,
    requester_name: user.full_name,
    reason,
    status: 'pending' as const,
    branch_id: user.branch_id,
    branch_name: user.branch_name,
    created_at: now,
    updated_at: now,
    sync_status: 'pending' as const,
  };
  await saveVoidRequest(voidRequest);

  // Create approval request
  const result = await createApprovalRequest({
    requestType: 'SALE_VOID',
    entityType: 'transaction',
    entityId: transactionId,
    requestData: { transactionTotal: voidRequest.transaction_total },
    reason,
    userId: user.id,
  });

  if (result.success && result.request) {
    // Link approval request to void request
    await saveVoidRequest({
      ...voidRequest,
      approval_request_id: result.request.id,
    });
  }

  return result;
}

// Request refund
export async function requestRefund(
  transactionId: string,
  refundAmount: number,
  reason: string,
  userId?: string
): Promise<{ success: boolean; error?: string; request?: ApprovalRequest }> {
  const user = userId ? await (await import('./db')).getUser(userId) : await getCurrentUser();
  if (!user) return { success: false, error: 'User not authenticated' };

  const now = new Date().toISOString();

  const refundRequest = {
    id: generateId(),
    transaction_id: transactionId,
    refund_amount: refundAmount,
    requester_id: user.id,
    requester_name: user.full_name,
    reason,
    status: 'pending' as const,
    branch_id: user.branch_id,
    branch_name: user.branch_name,
    created_at: now,
    updated_at: now,
    sync_status: 'pending' as const,
  };
  await saveRefundRequest(refundRequest);

  // Create approval request
  const result = await createApprovalRequest({
    requestType: 'SALE_REFUND',
    entityType: 'transaction',
    entityId: transactionId,
    requestData: { refundAmount },
    reason,
    userId: user.id,
  });

  if (result.success && result.request) {
    // Link approval request to refund request
    await saveRefundRequest({
      ...refundRequest,
      approval_request_id: result.request.id,
    });
  }

  return result;
}

// Request price change
export async function requestPriceChange(
  productId: string,
  productName: string,
  oldPrice: number,
  newPrice: number,
  reason: string,
  userId?: string
): Promise<{ success: boolean; error?: string; request?: ApprovalRequest }> {
  return createApprovalRequest({
    requestType: 'PRICE_CHANGE',
    entityType: 'product',
    entityId: productId,
    requestData: { productName, oldPrice, newPrice },
    reason,
    userId,
  });
}

// Request stock adjustment
export async function requestStockAdjustment(
  productId: string,
  productName: string,
  oldStock: number,
  newStock: number,
  reason: string,
  userId?: string
): Promise<{ success: boolean; error?: string; request?: ApprovalRequest }> {
  return createApprovalRequest({
    requestType: 'STOCK_ADJUSTMENT',
    entityType: 'product',
    entityId: productId,
    requestData: { productName, oldStock, newStock },
    reason,
    userId,
  });
}
