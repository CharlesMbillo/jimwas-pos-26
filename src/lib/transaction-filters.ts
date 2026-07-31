// Unified transaction filtering utilities - consolidates filtering logic
// Used across all transaction displays to avoid redundancy

interface TransactionFilterParams {
  transactions: any[];
  searchTerm?: string;
  filterType?: string;
  filterStatus?: string;
  filterMethod?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function filterTransactions({
  transactions,
  searchTerm = '',
  filterType = 'all',
  filterStatus = 'all',
  filterMethod = 'all',
  dateFrom = '',
  dateTo = '',
}: TransactionFilterParams): any[] {
  let filtered = transactions;

  // Type filter
  if (filterType !== 'all' && filterType) {
    filtered = filtered.filter(t => t.type === filterType);
  }

  // Status filter
  if (filterStatus !== 'all' && filterStatus) {
    filtered = filtered.filter(t => t.status === filterStatus);
  }

  // Payment method filter
  if (filterMethod !== 'all' && filterMethod) {
    filtered = filtered.filter(t => t.payment_method === filterMethod);
  }

  // Search filter (searches multiple fields)
  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filtered = filtered.filter(t =>
      t.customer_name?.toLowerCase().includes(search) ||
      t.phone?.includes(search) ||
      t.receipt_number?.includes(search) ||
      t.reference_id?.includes(search) ||
      t.description?.toLowerCase().includes(search) ||
      t.cashier_name?.toLowerCase().includes(search)
    );
  }

  // Date range filter
  if (dateFrom) {
    const from = new Date(dateFrom);
    filtered = filtered.filter(t => new Date(t.created_at) >= from);
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(t => new Date(t.created_at) <= to);
  }

  return filtered;
}

// Calculate transaction statistics
export interface TransactionStats {
  totalTransactions: number;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  averageValue: number;
  pendingCount: number;
  byType: Record<string, number>;
  byMethod: Record<string, number>;
}

export function calculateTransactionStats(transactions: any[]): TransactionStats {
  return {
    totalTransactions: transactions.length,
    totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
    successCount: transactions.filter(t => t.status === 'success' || t.status === 'completed').length,
    failedCount: transactions.filter(t => t.status === 'failed').length,
    pendingCount: transactions.filter(t => t.status === 'pending' || t.status === 'processing').length,
    averageValue: transactions.length > 0
      ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length
      : 0,
    byType: transactions.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byMethod: transactions.reduce((acc, t) => {
      acc[t.payment_method] = (acc[t.payment_method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

// Format transaction type for display
export function formatTransactionType(type: string): string {
  return type.replace(/_/g, ' ').charAt(0).toUpperCase() + type.replace(/_/g, ' ').slice(1);
}

// Format payment method for display
export function formatPaymentMethod(method: string): string {
  const methods: Record<string, string> = {
    'cash': 'Cash',
    'kcb': 'KCB BUNI STK',
    'card': 'Card',
    'bank_transfer': 'Bank Transfer',
    'mpesa': 'KCB BUNI STK',
  };
  return methods[method] || method;
}

// Get status badge styling
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'success':
    case 'completed':
      return 'bg-emerald-500/20 text-emerald-400';
    case 'failed':
      return 'bg-red-500/20 text-red-400';
    case 'pending':
    case 'processing':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'cancelled':
      return 'bg-orange-500/20 text-orange-400';
    default:
      return 'bg-slate-500/20 text-slate-400';
  }
}
