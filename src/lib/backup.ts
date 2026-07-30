// Backup and Restore functionality for Jimwas POS
// Export all data to JSON, import from backup file

import {
  getAllCustomers,
  getAllProducts,
  getAllTransactions,
  getAllInstallmentPlans,
  getAllInstallmentPayments,
  getAllLoyaltyTransactions,
  getAllStockMovements,
  getAllSuppliers,
  getAllDeliveries,
  getAllStockAdjustments,
  getAllUsers,
  getAllRoles,
  getAllAuditLogs,
  getAllApprovalRequests,
  getBusinessSettings,
  getKCBSettings,
  getAllPaymentMethods,
  getLoyaltySettings,
  getReceiptSettings,
  // Save functions
  saveCustomer,
  saveProduct,
  saveTransaction,
  saveInstallmentPlan,
  saveInstallmentPayment,
  saveLoyaltyTransaction,
  saveStockMovement,
  saveSupplier,
  saveDelivery,
  saveStockAdjustment,
  saveUser,
  saveRole,
  saveAuditLog,
  saveApprovalRequest,
  saveBusinessSettings,
  saveKCBSettings,
  savePaymentMethod,
  saveLoyaltySettings,
  saveReceiptSettings,
  clearSyncQueue,
  saveRestorePoint,
} from './db';

export interface BackupData {
  version: string;
  exported_at: string;
  exported_by?: string;
  business_name: string;
  data: {
    customers: unknown[];
    products: unknown[];
    transactions: unknown[];
    installment_plans: unknown[];
    installment_payments: unknown[];
    loyalty_transactions: unknown[];
    stock_movements: unknown[];
    suppliers: unknown[];
    deliveries: unknown[];
    stock_adjustments: unknown[];
    users: unknown[];
    roles: unknown[];
    audit_logs: unknown[];
    approval_requests: unknown[];
    business_settings: unknown | null;
    mpesa_settings: unknown | null;
    payment_methods: unknown[];
    loyalty_settings: unknown | null;
    receipt_settings: unknown | null;
  };
  counts: {
    customers: number;
    products: number;
    transactions: number;
    installment_plans: number;
    installment_payments: number;
    loyalty_transactions: number;
    stock_movements: number;
    suppliers: number;
    deliveries: number;
    stock_adjustments: number;
    users: number;
    roles: number;
    audit_logs: number;
    approval_requests: number;
  };
}

export async function exportBackup(exportedBy?: string): Promise<BackupData> {
  const [
    customers,
    products,
    transactions,
    installmentPlans,
    installmentPayments,
    loyaltyTransactions,
    stockMovements,
    suppliers,
    deliveries,
    stockAdjustments,
    users,
    roles,
    auditLogs,
    approvalRequests,
    businessSettings,
    mpesaSettings,
    paymentMethods,
    loyaltySettings,
    receiptSettings,
  ] = await Promise.all([
    getAllCustomers(),
    getAllProducts(),
    getAllTransactions(),
    getAllInstallmentPlans(),
    getAllInstallmentPayments(),
    getAllLoyaltyTransactions(),
    getAllStockMovements(),
    getAllSuppliers(),
    getAllDeliveries(),
    getAllStockAdjustments(),
    getAllUsers(),
    getAllRoles(),
    getAllAuditLogs(),
    getAllApprovalRequests(),
    getBusinessSettings(),
    getKCBSettings(),
    getAllPaymentMethods(),
    getLoyaltySettings(),
    getReceiptSettings(),
  ]);

  const backup: BackupData = {
    version: '2.0.0',
    exported_at: new Date().toISOString(),
    exported_by: exportedBy,
    business_name: businessSettings?.business_name || 'Jimwas POS',
    data: {
      customers,
      products,
      transactions,
      installment_plans: installmentPlans,
      installment_payments: installmentPayments,
      loyalty_transactions: loyaltyTransactions,
      stock_movements: stockMovements,
      suppliers,
      deliveries,
      stock_adjustments: stockAdjustments,
      users,
      roles,
      audit_logs: auditLogs,
      approval_requests: approvalRequests,
      business_settings: businessSettings,
      mpesa_settings: mpesaSettings,
      payment_methods: paymentMethods,
      loyalty_settings: loyaltySettings,
      receipt_settings: receiptSettings,
    },
    counts: {
      customers: customers.length,
      products: products.length,
      transactions: transactions.length,
      installment_plans: installmentPlans.length,
      installment_payments: installmentPayments.length,
      loyalty_transactions: loyaltyTransactions.length,
      stock_movements: stockMovements.length,
      suppliers: suppliers.length,
      deliveries: deliveries.length,
      stock_adjustments: stockAdjustments.length,
      users: users.length,
      roles: roles.length,
      audit_logs: auditLogs.length,
      approval_requests: approvalRequests.length,
    },
  };

  return backup;
}

export function downloadBackup(backup: BackupData): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jimwas-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface RestoreOptions {
  overwriteExisting: boolean;
  includeAuditLogs: boolean;
  includeUsers: boolean;
  includeSettings: boolean;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  imported: {
    customers: number;
    products: number;
    transactions: number;
    installment_plans: number;
    installment_payments: number;
    loyalty_transactions: number;
    stock_movements: number;
    suppliers: number;
    deliveries: number;
    stock_adjustments: number;
    users: number;
    roles: number;
    audit_logs: number;
    approval_requests: number;
    payment_methods: number;
  };
  errors: string[];
}

export async function importBackup(
  backup: BackupData,
  options: RestoreOptions
): Promise<RestoreResult> {
  const result: RestoreResult = {
    success: true,
    message: '',
    imported: {
      customers: 0,
      products: 0,
      transactions: 0,
      installment_plans: 0,
      installment_payments: 0,
      loyalty_transactions: 0,
      stock_movements: 0,
      suppliers: 0,
      deliveries: 0,
      stock_adjustments: 0,
      users: 0,
      roles: 0,
      audit_logs: 0,
      approval_requests: 0,
      payment_methods: 0,
    },
    errors: [],
  };

  try {
    // Clear sync queue before restore
    await clearSyncQueue();

    // Import customers - mark as 'synced' since backup is trusted source
    if (backup.data.customers && Array.isArray(backup.data.customers)) {
      for (const customer of backup.data.customers) {
        try {
          await saveCustomer({ ...customer, sync_status: 'synced' } as any);
          result.imported.customers++;
        } catch (e) {
          result.errors.push(`Customer: ${e}`);
        }
      }
    }

    // Import products - mark as 'synced'
    if (backup.data.products && Array.isArray(backup.data.products)) {
      for (const product of backup.data.products) {
        try {
          await saveProduct({ ...product, sync_status: 'synced' } as any);
          result.imported.products++;
        } catch (e) {
          result.errors.push(`Product: ${e}`);
        }
      }
    }

    // Import transactions - mark as 'synced'
    if (backup.data.transactions && Array.isArray(backup.data.transactions)) {
      for (const transaction of backup.data.transactions) {
        try {
          await saveTransaction({ ...transaction, sync_status: 'synced' } as any);
          result.imported.transactions++;
        } catch (e) {
          result.errors.push(`Transaction: ${e}`);
        }
      }
    }

    // Import installment plans - mark as 'synced'
    if (backup.data.installment_plans && Array.isArray(backup.data.installment_plans)) {
      for (const plan of backup.data.installment_plans) {
        try {
          await saveInstallmentPlan({ ...plan, sync_status: 'synced' } as any);
          result.imported.installment_plans++;
        } catch (e) {
          result.errors.push(`Installment plan: ${e}`);
        }
      }
    }

    // Import installment payments - mark as 'synced'
    if (backup.data.installment_payments && Array.isArray(backup.data.installment_payments)) {
      for (const payment of backup.data.installment_payments) {
        try {
          await saveInstallmentPayment({ ...payment, sync_status: 'synced' } as any);
          result.imported.installment_payments++;
        } catch (e) {
          result.errors.push(`Installment payment: ${e}`);
        }
      }
    }

    // Import loyalty transactions - mark as 'synced'
    if (backup.data.loyalty_transactions && Array.isArray(backup.data.loyalty_transactions)) {
      for (const loyaltyTx of backup.data.loyalty_transactions) {
        try {
          await saveLoyaltyTransaction({ ...loyaltyTx, sync_status: 'synced' } as any);
          result.imported.loyalty_transactions++;
        } catch (e) {
          result.errors.push(`Loyalty transaction: ${e}`);
        }
      }
    }

    // Import stock movements - mark as 'synced'
    if (backup.data.stock_movements && Array.isArray(backup.data.stock_movements)) {
      for (const movement of backup.data.stock_movements) {
        try {
          await saveStockMovement({ ...movement, sync_status: 'synced' } as any);
          result.imported.stock_movements++;
        } catch (e) {
          result.errors.push(`Stock movement: ${e}`);
        }
      }
    }

    // Import suppliers - mark as 'synced'
    if (backup.data.suppliers && Array.isArray(backup.data.suppliers)) {
      for (const supplier of backup.data.suppliers) {
        try {
          await saveSupplier({ ...supplier, sync_status: 'synced' } as any);
          result.imported.suppliers++;
        } catch (e) {
          result.errors.push(`Supplier: ${e}`);
        }
      }
    }

    // Import deliveries - mark as 'synced'
    if (backup.data.deliveries && Array.isArray(backup.data.deliveries)) {
      for (const delivery of backup.data.deliveries) {
        try {
          await saveDelivery({ ...delivery, sync_status: 'synced' } as any);
          result.imported.deliveries++;
        } catch (e) {
          result.errors.push(`Delivery: ${e}`);
        }
      }
    }

    // Import stock adjustments - mark as 'synced'
    if (backup.data.stock_adjustments && Array.isArray(backup.data.stock_adjustments)) {
      for (const adjustment of backup.data.stock_adjustments) {
        try {
          await saveStockAdjustment({ ...adjustment, sync_status: 'synced' } as any);
          result.imported.stock_adjustments++;
        } catch (e) {
          result.errors.push(`Stock adjustment: ${e}`);
        }
      }
    }

    // Import roles BEFORE users (roles are referenced by users via role_id foreign key) - mark as 'synced'
    if (backup.data.roles && Array.isArray(backup.data.roles)) {
      for (const role of backup.data.roles) {
        try {
          await saveRole({ ...role, sync_status: 'synced' } as any);
          result.imported.roles++;
        } catch (e) {
          result.errors.push(`Role: ${e}`);
        }
      }
    }

    // Import users (if option enabled) - must be after roles due to foreign key constraint - mark as 'synced'
    if (options.includeUsers && backup.data.users && Array.isArray(backup.data.users)) {
      for (const user of backup.data.users) {
        try {
          await saveUser({ ...user, sync_status: 'synced' } as any);
          result.imported.users++;
        } catch (e) {
          result.errors.push(`User: ${e}`);
        }
      }
    }

    // Import audit logs (if option enabled) - mark as 'synced'
    if (options.includeAuditLogs && backup.data.audit_logs && Array.isArray(backup.data.audit_logs)) {
      for (const log of backup.data.audit_logs) {
        try {
          await saveAuditLog({ ...log, sync_status: 'synced' } as any);
          result.imported.audit_logs++;
        } catch (e) {
          result.errors.push(`Audit log: ${e}`);
        }
      }
    }

    // Import approval requests - mark as 'synced'
    if (backup.data.approval_requests && Array.isArray(backup.data.approval_requests)) {
      for (const request of backup.data.approval_requests) {
        try {
          await saveApprovalRequest({ ...request, sync_status: 'synced' } as any);
          result.imported.approval_requests++;
        } catch (e) {
          result.errors.push(`Approval request: ${e}`);
        }
      }
    }

    // Import payment methods
    if (backup.data.payment_methods && Array.isArray(backup.data.payment_methods)) {
      for (const method of backup.data.payment_methods) {
        try {
          await savePaymentMethod(method as any);
          result.imported.payment_methods++;
        } catch (e) {
          result.errors.push(`Payment method: ${e}`);
        }
      }
    }

    // Import settings (if option enabled)
    if (options.includeSettings) {
      if (backup.data.business_settings) {
        try {
          await saveBusinessSettings({ ...backup.data.business_settings, sync_status: 'pending' } as any);
        } catch (e) {
          result.errors.push(`Business settings: ${e}`);
        }
      }
      if (backup.data.mpesa_settings) {
        try {
          await saveKCBSettings({ ...backup.data.mpesa_settings, sync_status: 'pending' } as any);
        } catch (e) {
          result.errors.push(`M-Pesa settings: ${e}`);
        }
      }
      if (backup.data.loyalty_settings) {
        try {
          await saveLoyaltySettings({ ...backup.data.loyalty_settings, sync_status: 'pending' } as any);
        } catch (e) {
          result.errors.push(`Loyalty settings: ${e}`);
        }
      }
      if (backup.data.receipt_settings) {
        try {
          await saveReceiptSettings({ ...backup.data.receipt_settings, sync_status: 'pending' } as any);
        } catch (e) {
          result.errors.push(`Receipt settings: ${e}`);
        }
      }
    }

    // Build summary message
    const totalImported = Object.values(result.imported).reduce((a, b) => a + b, 0);
    result.message = `Imported ${totalImported} records successfully`;

    if (result.errors.length > 0) {
      result.message += ` with ${result.errors.length} errors`;
    }

    // Save restore point for future auto-restore if data is lost
    if (result.success && totalImported > 0) {
      await saveRestorePoint(
        backup.exported_at,
        result.imported.products,
        result.imported.customers,
        result.imported.transactions
      );
      console.log('[v0] Backup restore point saved for auto-restore on future app loads');
    }
  } catch (error) {
    result.success = false;
    result.message = `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  return result;
}

export function validateBackup(data: unknown): { valid: boolean; error?: string; backup?: BackupData } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid backup file: not an object' };
  }

  const backup = data as BackupData;

  if (!backup.version) {
    return { valid: false, error: 'Invalid backup file: missing version' };
  }

  if (!backup.exported_at) {
    return { valid: false, error: 'Invalid backup file: missing export date' };
  }

  if (!backup.data || typeof backup.data !== 'object') {
    return { valid: false, error: 'Invalid backup file: missing data section' };
  }

  return { valid: true, backup };
}
