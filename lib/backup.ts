// Backup History Management
// Simple library for tracking and managing backup history

export interface BackupHistoryEntry {
  id: string;
  filename: string;
  importedAt: string;
  exportedAt: string;
  exportedBy?: string;
  businessName: string;
  dataSize: number;
  counts: {
    customers: number;
    products: number;
    transactions: number;
    users: number;
  };
}

export interface BackupData {
  version: string;
  exported_at: string;
  exported_by?: string;
  business_name: string;
  data: any;
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

// Backup history management
const BACKUP_HISTORY_KEY = 'jimwas_backup_history';
const MAX_BACKUP_HISTORY = 10;

export function addToBackupHistory(backup: BackupData, dataSize: number, filename: string): void {
  try {
    const history: BackupHistoryEntry[] = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || '[]');
    
    const entry: BackupHistoryEntry = {
      id: `backup_${Date.now()}`,
      filename,
      importedAt: new Date().toISOString(),
      exportedAt: backup.exported_at,
      exportedBy: backup.exported_by,
      businessName: backup.business_name,
      dataSize,
      counts: {
        customers: backup.counts.customers,
        products: backup.counts.products,
        transactions: backup.counts.transactions,
        users: backup.counts.users,
      },
    };

    // Add to beginning and keep only last 10
    history.unshift(entry);
    history.splice(MAX_BACKUP_HISTORY);

    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('[v0] Failed to save backup history:', error);
  }
}

export function getBackupHistory(): BackupHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function deleteBackupHistoryEntry(id: string): void {
  try {
    const history: BackupHistoryEntry[] = JSON.parse(localStorage.getItem(BACKUP_HISTORY_KEY) || '[]');
    const filtered = history.filter(entry => entry.id !== id);
    localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[v0] Failed to delete backup history entry:', error);
  }
}
