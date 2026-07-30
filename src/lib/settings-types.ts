// Settings Types for Jimwas POS

export interface BusinessSettings {
  id: string;
  business_name: string;
  business_phone: string;
  business_email?: string;
  business_address?: string;
  tax_id?: string;
  currency: string;
  currency_symbol: string;
  receipt_header?: string;
  receipt_footer?: string;
  show_tax_on_receipt: boolean;
  logo_url?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface KCBSettings {
  id: string;
  is_enabled: boolean;
  environment: 'sandbox' | 'production';
  client_id: string;
  client_secret: string;
  org_shortcode: string;
  org_passkey: string;
  callback_url?: string;
  timeout_url?: string;
  public_cert_path?: string;
  default_phone_country_code: string;
  last_updated: string;
  last_updated_by?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface PaymentMethodConfig {
  id: string;
  method_name: 'cash' | 'card' | 'kcb' | 'bank_transfer';
  is_enabled: boolean;
  display_name: string;
  requires_reference: boolean;
  icon?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SystemSettings {
  id: string;
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface LoyaltySettings {
  id: string;
  is_enabled: boolean;
  points_per_currency: number; // e.g., 100 KES = 1 point
  point_value: number; // Value of 1 point in currency
  minimum_points_to_redeem: number;
  signup_bonus_points: number;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface ReceiptSettings {
  id: string;
  show_customer_name: boolean;
  show_customer_phone: boolean;
  show_item_barcode: boolean;
  show_item_sku: boolean;
  show_cashier_name: boolean;
  show_branch_name: boolean;
  show_tax_breakdown: boolean;
  print_copy_for_customer: boolean;
  print_copy_for_merchant: boolean;
  paper_width: '58mm' | '80mm';
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

// Default settings
export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  id: 'business-settings',
  business_name: 'Jimwas Store',
  business_phone: '',
  business_email: '',
  business_address: '',
  tax_id: '',
  currency: 'KES',
  currency_symbol: 'KES',
  receipt_header: 'Thank you for shopping with us!',
  receipt_footer: 'See you next time!',
  show_tax_on_receipt: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sync_status: 'pending',
};

export const DEFAULT_KCB_SETTINGS: KCBSettings = {
  id: 'kcb-settings',
  is_enabled: false,
  environment: 'sandbox',
  client_id: '',
  client_secret: '',
  org_shortcode: '',
  org_passkey: '',
  default_phone_country_code: '254',
  callback_url: '',
  timeout_url: '',
  public_cert_path: '',
  last_updated: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sync_status: 'pending',
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  id: 'loyalty-settings',
  is_enabled: true,
  points_per_currency: 100, // 100 KES = 1 point
  point_value: 1, // 1 point = 1 KES value
  minimum_points_to_redeem: 10,
  signup_bonus_points: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sync_status: 'pending',
};

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  id: 'receipt-settings',
  show_customer_name: true,
  show_customer_phone: false,
  show_item_barcode: false,
  show_item_sku: false,
  show_cashier_name: true,
  show_branch_name: false,
  show_tax_breakdown: true,
  print_copy_for_customer: true,
  print_copy_for_merchant: false,
  paper_width: '58mm',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sync_status: 'pending',
};

export const DEFAULT_PAYMENT_METHODS: PaymentMethodConfig[] = [
  { id: 'pm-cash', method_name: 'cash', is_enabled: true, display_name: 'Cash', requires_reference: false, display_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'pm-kcb', method_name: 'kcb', is_enabled: true, display_name: 'KCB MpesaExpressAPI', requires_reference: true, display_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'pm-card', method_name: 'card', is_enabled: true, display_name: 'Card', requires_reference: false, display_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'pm-bank', method_name: 'bank_transfer', is_enabled: false, display_name: 'Bank Transfer', requires_reference: true, display_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];
