import { generateId, saveProduct, saveTransaction, saveLoyaltyTransaction, saveStockMovement, saveCustomer } from './db';
import { syncInsertTransaction, syncUpdateProduct, syncInsertStockMovement, syncUpdateCustomer, syncInsertLoyaltyTransaction } from './sync';
import type { Product, Customer, CartItem, SaleType } from './types';

const LOYALTY_POINTS_PER_SHILLING = 100;

export interface CompleteSaleParams {
  cart: CartItem[];
  cartTotal: number;
  products: Product[];
  selectedCustomer: Customer | null;
  paymentMethod: 'cash' | 'card' | 'mpesa';
  amountPaid: number;
  change: number;
  userId: string;
  mpesaReceipt?: string;
  saleType?: SaleType;
  depositAmount?: number;
  balanceAmount?: number;
}

export interface CompleteSaleResult {
  success: boolean;
  transactionId: string;
  error?: string;
}

export async function completeSale({
  cart,
  cartTotal,
  products,
  selectedCustomer,
  paymentMethod: method,
  amountPaid,
  change,
  userId,
  mpesaReceipt,
  saleType = 'standard',
  depositAmount = 0,
  balanceAmount = 0,
}: CompleteSaleParams): Promise<CompleteSaleResult> {
  const now = new Date().toISOString();

  // Build transaction items
  const items = cart.map(item => ({
    id: generateId(),
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal,
  }));

  // Create transaction record
  const transaction = {
    id: generateId(),
    customer_id: selectedCustomer?.id,
    total_amount: cartTotal,
    amount_paid: amountPaid,
    change_amount: change,
    payment_method: method,
    status: 'completed' as const,
    created_at: now,
    sync_status: 'pending' as const,
    items,
    sale_type: saleType,
    deposit_amount: depositAmount,
    balance_amount: balanceAmount,
  };

  // Save transaction locally and queue for sync
  await saveTransaction(transaction);
  syncInsertTransaction(transaction, items);

  // Update product stock and create stock movements
  for (const item of cart) {
    const product = products.find(p => p.id === item.product_id);
    if (product) {
      const newStock = Math.max(0, product.stock - item.quantity);
      const updated = {
        ...product,
        stock: newStock,
        updated_at: now,
        sync_status: 'pending' as const,
      };
      await saveProduct(updated);
      syncUpdateProduct(updated);

      const noteSuffix = mpesaReceipt ? ` - MPESA:${mpesaReceipt}` : '';
      const movement = {
        id: generateId(),
        product_id: product.id,
        qty_delta: -item.quantity,
        reason: 'sale' as const,
        note: `Sale ${transaction.id}${noteSuffix}`,
        balance_after: newStock,
        reference_type: 'sale' as const,
        reference_id: transaction.id,
        created_at: now,
        created_by: userId || 'system',
        sync_status: 'pending' as const,
      };
      await saveStockMovement(movement);
      syncInsertStockMovement(movement);
    }
  }

  // Update customer loyalty if applicable
  const loyaltyPointsToEarn = Math.floor(cartTotal / LOYALTY_POINTS_PER_SHILLING);
  if (selectedCustomer && loyaltyPointsToEarn > 0) {
    const updatedCustomer = {
      ...selectedCustomer,
      loyalty_points: selectedCustomer.loyalty_points + loyaltyPointsToEarn,
      total_spent: selectedCustomer.total_spent + cartTotal,
      updated_at: now,
      sync_status: 'pending' as const,
    };
    await saveCustomer(updatedCustomer);
    syncUpdateCustomer(updatedCustomer);

    const loyaltyTx = {
      id: generateId(),
      customer_id: selectedCustomer.id,
      points: loyaltyPointsToEarn,
      transaction_type: 'earned' as const,
      source: 'purchase',
      reference_id: transaction.id,
      created_at: now,
      sync_status: 'pending' as const,
    };
    await saveLoyaltyTransaction(loyaltyTx);
    syncInsertLoyaltyTransaction(loyaltyTx);
  }

  return { success: true, transactionId: transaction.id };
}

// Validation helpers
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  const cleaned = phone.replace(/\D/g, '');
  
  // Valid Kenyan mobile prefixes (9 digits after country code 254)
  // Format: 0 + [2-digit prefix] + [7-digit subscriber number] = 10 total digits
  // Safaricom: 100-108 (older), 110-119, 700-729, 740-743, 745-746, 748, 757-759, 768-769, 790-799
  // Airtel: 100-108, 730-739, 750-756, 762, 767, 780-789
  // Other carriers: 010-019, 050-059, 070-079, 080-089
  // Including all 01X and 05X prefixes for other carriers
  const validPrefixPattern = /^0(?:1[0-9]|5[0-9]|7[0-9]{2}|8[0-9]{2})\d{7}$/;
  const validIntlPrefixPattern = /^254(?:1[0-9]|5[0-9]|7[0-9]{2}|8[0-9]{2})\d{7}$/;
  
  // Local format: 0XXXXXXXXX (10 digits)
  if (cleaned.length === 10) {
    if (!validPrefixPattern.test(cleaned)) {
      return { valid: false, error: 'Invalid Kenyan phone number' };
    }
    return { valid: true };
  }
  
  // International format: 254XXXXXXXXX (12 digits)
  if (cleaned.length === 12) {
    if (!validIntlPrefixPattern.test(cleaned)) {
      return { valid: false, error: 'Invalid Kenyan phone number' };
    }
    return { valid: true };
  }
  
  // Support +254 format (count without the +)
  if (phone.startsWith('+254') && cleaned.length === 12) {
    if (!validIntlPrefixPattern.test(cleaned)) {
      return { valid: false, error: 'Invalid Kenyan phone number' };
    }
    return { valid: true };
  }
  
  return { valid: false, error: 'Phone must be 10 digits (0XXXXXXXXX) or 12 digits (254XXXXXXXXX)' };
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) return { valid: true }; // Email is optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

export function validatePrice(price: string): { valid: boolean; value?: number; error?: string } {
  const value = parseFloat(price);
  if (isNaN(value) || value < 0) {
    return { valid: false, error: 'Price must be a positive number' };
  }
  return { valid: true, value };
}

export function validateStock(stock: string): { valid: boolean; value?: number; error?: string } {
  const value = parseInt(stock, 10);
  if (isNaN(value) || value < 0) {
    return { valid: false, error: 'Stock must be a non-negative integer' };
  }
  return { valid: true, value };
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

// Debounce helper for search inputs
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
