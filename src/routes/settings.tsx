// Settings Page - Business settings, user management, and payment configuration

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleGuard } from '../context/AuthContext';
import {
  Settings, Users, CreditCard, Building, Save, Plus, Edit, Trash2, Eye, EyeOff,
  Check, X, Smartphone, ToggleLeft, ToggleRight, Shield, RefreshCw, AlertCircle, Clock, Printer, CheckCircle2,
  Loader2, Cloud, CloudOff, FlaskConical, Zap
} from 'lucide-react';
import {
  BusinessSettings,
  KCBSettings,
  PaymentMethodConfig,
  LoyaltySettings,
  ReceiptSettings,
  DEFAULT_BUSINESS_SETTINGS,
  DEFAULT_KCB_SETTINGS,
  DEFAULT_LOYALTY_SETTINGS,
  DEFAULT_RECEIPT_SETTINGS,
  DEFAULT_PAYMENT_METHODS,
} from '../lib/settings-types';
import {
  saveBusinessSettings,
  getBusinessSettings,
  saveKCBSettings,
  getKCBSettings,
  getAllPaymentMethods,
  savePaymentMethod,
  saveLoyaltySettings,
  getLoyaltySettings,
  saveReceiptSettings,
  getReceiptSettings,
  getAllUsers,
  saveUser,
  getUser,
} from '../lib/db';
import { getSupabase } from '../lib/sync';
import { testPrint } from '../lib/print';
import { createUser, updateUserRole, updateUserStatus } from '../lib/auth';
import type { User } from '../lib/security-types';

type SettingsTab = 'general' | 'users' | 'payments' | 'receipt' | 'loyalty';

export function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [isLoading, setIsLoading] = useState(true);

  // Settings state
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [kcbSettings, setKCBSettings] = useState<KCBSettings>(DEFAULT_KCB_SETTINGS);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>(DEFAULT_PAYMENT_METHODS);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY_SETTINGS);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);
  const [users, setUsers] = useState<User[]>([]);

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showKCBSecret, setShowKCBSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadAllSettings();
  }, []);

  // Auto-save KCB settings with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Only auto-save if settings have changed and are not in default state
      if (kcbSettings.sync_status === 'pending' && (kcbSettings.client_id || kcbSettings.client_secret || kcbSettings.org_shortcode)) {
        try {
          setAutoSaving(true);
          await saveKCBSettings({
            ...kcbSettings,
            last_updated: new Date().toISOString(),
            last_updated_by: user?.id,
            updated_at: new Date().toISOString(),
            sync_status: 'pending' as const,
          });
        } catch (error) {
          console.error('[v0] Auto-save failed for KCB settings:', error);
        } finally {
          setAutoSaving(false);
        }
      }
    }, 3000); // 3 second debounce

    return () => clearTimeout(timer);
  }, [kcbSettings, user?.id]);

  const loadAllSettings = async () => {
    setIsLoading(true);
    try {
      // Try Supabase first (authoritative), fall back to IDB
      const supabase = getSupabase();
      let loadedBusiness: BusinessSettings | undefined,
          loadedMpesa: KCBSettings | undefined,
          loadedPayments: PaymentMethodConfig[] = [],
          loadedLoyalty: LoyaltySettings | undefined,
          loadedReceipt: ReceiptSettings | undefined;

      if (supabase) {
        const [biz, mpesa, payments, loyalty, receipt] = await Promise.all([
          supabase.from('business_settings').select('*').eq('id', 'business-settings').maybeSingle(),
          supabase.from('kcb_settings').select('*').eq('id', 'kcb-settings').maybeSingle(),
          supabase.from('payment_methods').select('*').order('display_order'),
          supabase.from('loyalty_settings').select('*').eq('id', 'loyalty-settings').maybeSingle(),
          supabase.from('receipt_settings').select('*').eq('id', 'receipt-settings').maybeSingle(),
        ]);
        loadedBusiness = biz.data ? { ...biz.data, sync_status: 'synced' as const } : undefined;
        loadedMpesa = mpesa.data ? { ...mpesa.data, sync_status: 'synced' as const } : undefined;
        loadedPayments = (payments.data ?? []) as PaymentMethodConfig[];
        loadedLoyalty = loyalty.data ? { ...loyalty.data, sync_status: 'synced' as const } : undefined;
        loadedReceipt = receipt.data ? { ...receipt.data, sync_status: 'synced' as const } : undefined;
      }

      // Fall back to IDB if Supabase returned nothing
      const [idbBusiness, idbMpesa, idbPayments, idbLoyalty, idbReceipt, idbUsers] = await Promise.all([
        getBusinessSettings(),
        getKCBSettings(),
        getAllPaymentMethods(),
        getLoyaltySettings(),
        getReceiptSettings(),
        getAllUsers(),
      ]);

      if (loadedBusiness ?? idbBusiness) setBusinessSettings((loadedBusiness ?? idbBusiness)!);
      {
        // Merge loaded settings with defaults to ensure all fields are present
        const merged = { ...DEFAULT_KCB_SETTINGS, ...(loadedMpesa ?? idbMpesa) };
        setKCBSettings(merged);
      }
      const finalPayments = loadedPayments.length ? loadedPayments : idbPayments;
      if (finalPayments.length > 0) setPaymentMethods(finalPayments);
      if (loadedLoyalty ?? idbLoyalty) setLoyaltySettings((loadedLoyalty ?? idbLoyalty)!);
      if (loadedReceipt ?? idbReceipt) setReceiptSettings((loadedReceipt ?? idbReceipt)!);
      setUsers(idbUsers);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const saveBusiness = async () => {
    setSaving(true);
    try {
      const saved = await saveBusinessSettings({
        ...businessSettings,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      });
      if (saved) setBusinessSettings(saved);
      showMessage('success', 'Business settings saved successfully');
    } catch (error) {
      showMessage('error', 'Failed to save business settings');
    } finally {
      setSaving(false);
    }
  };

  const saveMpesa = async () => {
    setSaving(true);
    try {
      const settingsToSave = {
        ...kcbSettings,
        last_updated: new Date().toISOString(),
        last_updated_by: user?.id,
        updated_at: new Date().toISOString(),
        sync_status: 'pending' as const,
      };
      const saved = await saveKCBSettings(settingsToSave);
      if (saved) {
        setKCBSettings(saved);
        showMessage('success', 'KCB STK settings saved to IndexedDB and syncing to cloud');
      } else {
        setKCBSettings(settingsToSave);
        showMessage('success', 'KCB STK settings saved locally (sync pending)');
      }
    } catch (error) {
      console.error('[v0] Save error:', error);
      showMessage('error', error instanceof Error ? error.message : 'Failed to save KCB settings');
    } finally {
      setSaving(false);
    }
  };

  const togglePaymentMethod = async (method: PaymentMethodConfig) => {
    const updated = { ...method, is_enabled: !method.is_enabled, updated_at: new Date().toISOString() };
    await savePaymentMethod(updated);
    setPaymentMethods(prev => prev.map(m => m.id === method.id ? updated : m));
    showMessage('success', `${method.display_name} ${updated.is_enabled ? 'enabled' : 'disabled'}`);
  };

  const saveLoyalty = async () => {
    setSaving(true);
    try {
      const saved = await saveLoyaltySettings({
        ...loyaltySettings,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      });
      if (saved) setLoyaltySettings(saved);
      showMessage('success', 'Loyalty settings saved successfully');
    } catch (error) {
      showMessage('error', 'Failed to save loyalty settings');
    } finally {
      setSaving(false);
    }
  };

  const saveReceipt = async () => {
    setSaving(true);
    try {
      const saved = await saveReceiptSettings({
        ...receiptSettings,
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
      });
      if (saved) setReceiptSettings(saved);
      showMessage('success', 'Receipt settings saved successfully');
    } catch (error) {
      showMessage('error', 'Failed to save receipt settings');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Building },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'receipt', label: 'Receipt', icon: Settings },
    { id: 'loyalty', label: 'Loyalty', icon: RefreshCw },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400">Configure your POS system</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700' : 'bg-red-900/30 text-red-400 border border-red-700'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 overflow-y-auto flex-1 min-h-0">
        {activeTab === 'general' && (
          <GeneralSettingsTab
            settings={businessSettings}
            onChange={setBusinessSettings}
            onSave={saveBusiness}
            saving={saving}
          />
        )}

        {activeTab === 'users' && (
          <RoleGuard allowedRoles={['admin']}>
            <UsersTab
              users={users}
              currentUser={user}
              onRefresh={loadAllSettings}
              onEdit={(u) => { setEditingUser(u); setShowUserModal(true); }}
            />
            <div className="text-slate-400 p-4">Only admins can manage users.</div>
          </RoleGuard>
        )}

        {activeTab === 'payments' && (
          <PaymentsTab
            kcbSettings={kcbSettings}
            paymentMethods={paymentMethods}
            onMpesaChange={setKCBSettings}
            onTogglePayment={togglePaymentMethod}
            onSaveMpesa={saveMpesa}
            saving={saving}
            autoSaving={autoSaving}
            showSecret={showKCBSecret}
            onToggleSecret={() => setShowKCBSecret(!showKCBSecret)}
          />
        )}

        {activeTab === 'receipt' && (
          <ReceiptSettingsTab
            settings={receiptSettings}
            businessSettings={businessSettings}
            onChange={setReceiptSettings}
            onSave={saveReceipt}
            saving={saving}
          />
        )}

        {activeTab === 'loyalty' && (
          <LoyaltySettingsTab
            settings={loyaltySettings}
            onChange={setLoyaltySettings}
            onSave={saveLoyalty}
            saving={saving}
          />
        )}
      </div>

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          user={editingUser}
          currentUserId={user?.id}
          onClose={() => { setShowUserModal(false); setEditingUser(null); }}
          onSaved={loadAllSettings}
        />
      )}
    </div>
  );
}

// ============ GENERAL SETTINGS TAB ============
function GeneralSettingsTab({
  settings,
  onChange,
  onSave,
  saving,
}: {
  settings: BusinessSettings;
  onChange: (s: BusinessSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Building size={20} />
        Business Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Business Name</label>
          <input
            type="text"
            value={settings.business_name}
            onChange={(e) => onChange({ ...settings, business_name: e.target.value })}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Phone Number</label>
          <input
            type="tel"
            value={settings.business_phone}
            onChange={(e) => onChange({ ...settings, business_phone: e.target.value })}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Email</label>
          <input
            type="email"
            value={settings.business_email || ''}
            onChange={(e) => onChange({ ...settings, business_email: e.target.value })}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Address</label>
          <input
            type="text"
            value={settings.business_address || ''}
            onChange={(e) => onChange({ ...settings, business_address: e.target.value })}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Tax ID (PIN)</label>
          <input
            type="text"
            value={settings.tax_id || ''}
            onChange={(e) => onChange({ ...settings, tax_id: e.target.value })}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Currency</label>
          <select
            value={settings.currency}
            onChange={(e) => onChange({ ...settings, currency: e.target.value, currency_symbol: e.target.value })}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          >
            <option value="KES">KES - Kenyan Shilling</option>
            <option value="USD">USD - US Dollar</option>
            <option value="UGX">UGX - Ugandan Shilling</option>
            <option value="TZS">TZS - Tanzanian Shilling</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-2">Receipt Header Message</label>
          <input
            type="text"
            value={settings.receipt_header || ''}
            onChange={(e) => onChange({ ...settings, receipt_header: e.target.value })}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Receipt Footer Message</label>
          <input
            type="text"
            value={settings.receipt_footer || ''}
            onChange={(e) => onChange({ ...settings, receipt_footer: e.target.value })}
            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.show_tax_on_receipt}
            onChange={(e) => onChange({ ...settings, show_tax_on_receipt: e.target.checked })}
            className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
          />
          <span className="text-white">Show tax breakdown on receipts</span>
        </label>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-700">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============ USERS TAB ============
function UsersTab({
  users,
  currentUser,
  onRefresh,
  onEdit,
}: {
  users: User[];
  currentUser?: User | null;
  onRefresh: () => void;
  onEdit: (user: User) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-900/30 text-red-400';
      case 'manager': return 'bg-amber-900/30 text-amber-400';
      case 'cashier': return 'bg-blue-900/30 text-blue-400';
      default: return 'bg-slate-700 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users size={20} />
          User Management
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
        >
          <Plus size={18} />
          Add User
        </button>
      </div>

      <div className="divide-y divide-slate-700">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                <Users size={24} className="text-slate-400" />
              </div>
              <div>
                <p className="text-white font-medium">{u.full_name}</p>
                <p className="text-sm text-slate-400">@{u.username}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded-full text-xs ${getRoleColor(u.role_code)}`}>
                {u.role_code.charAt(0).toUpperCase() + u.role_code.slice(1)}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs ${u.is_active ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                {u.is_active ? 'Active' : 'Inactive'}
              </span>
              {currentUser?.id !== u.id && (
                <button
                  onClick={() => onEdit(u)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                >
                  <Edit size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <UserModal
          user={null}
          currentUserId={currentUser?.id}
          onClose={() => setShowModal(false)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}

// ============ PAYMENTS TAB ============
function PaymentsTab({
  kcbSettings,
  paymentMethods,
  onMpesaChange,
  onTogglePayment,
  onSaveMpesa,
  saving,
  autoSaving,
  showSecret,
  onToggleSecret,
}: {
  kcbSettings: KCBSettings;
  paymentMethods: PaymentMethodConfig[];
  onMpesaChange: (s: KCBSettings) => void;
  onTogglePayment: (m: PaymentMethodConfig) => void;
  onSaveMpesa: () => void;
  saving: boolean;
  autoSaving: boolean;
  showSecret: boolean;
  onToggleSecret: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Payment Methods */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <CreditCard size={20} />
          Payment Methods
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 bg-slate-700 rounded-lg"
            >
              <div>
                <p className="text-white font-medium">{method.display_name}</p>
                <p className="text-xs text-slate-400">
                  {method.requires_reference ? 'Requires reference number' : 'No reference required'}
                </p>
              </div>
              <button
                onClick={() => onTogglePayment(method)}
                className={`p-2 rounded-lg transition ${
                  method.is_enabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-slate-400'
                }`}
              >
                {method.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* KCB MpesaExpressAPI STK Push Settings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Smartphone size={20} />
            KCB MpesaExpressAPI STK Push Settings
          </h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-slate-400">Enabled</span>
            <button
              onClick={() => onMpesaChange({ ...kcbSettings, is_enabled: !kcbSettings.is_enabled })}
              className={`p-1 rounded-lg transition ${
                kcbSettings.is_enabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-600 text-slate-400'
              }`}
            >
              {kcbSettings.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
            </button>
          </label>
        </div>

        {/* KCB Sandbox quick-fill banner */}
        {kcbSettings.environment === 'sandbox' && (
          <div className="mb-4 bg-blue-950/60 border border-blue-700 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FlaskConical size={15} className="text-blue-400" />
                  <span className="text-blue-300 text-sm font-semibold">KCB MpesaExpressAPI STK Push (BUNI)</span>
                  <span className="bg-blue-700 text-blue-100 text-[10px] px-2 py-0.5 rounded-full font-medium">SANDBOX TESTING</span>
                </div>
                <p className="text-blue-400/80 text-xs mb-3">
                  Use KCB's sandbox credentials for UAT testing. No real money moves.
                  Test phone: <span className="font-mono text-blue-300">254700000000</span> (any 4-digit PIN).
                </p>
                <button
                  type="button"
                  onClick={() => onMpesaChange({
                    ...kcbSettings,
                    is_enabled: true,
                    environment: 'sandbox',
                    org_shortcode: 'JIMWAS',
                    org_passkey: '',
                    client_id: '',
                    client_secret: '',
                  })}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition"
                >
                  <Zap size={13} />
                  Setup KCB Sandbox (BUNI) Testing
                </button>
              </div>
              <div className="hidden md:block text-right shrink-0">
                <p className="text-blue-500 text-[10px] font-mono space-y-0.5">
                  <span className="block">Environment: Sandbox</span>
                  <span className="block">API: KCB BUNI</span>
                  <span className="block">Mode: STK Push</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Setup status banner */}
        {kcbSettings.is_enabled && (() => {
          const missing = [];
          if (!kcbSettings.client_id) missing.push('Consumer Key');
          if (!kcbSettings.client_secret) missing.push('Consumer Secret');
          if (!kcbSettings.org_passkey) missing.push('Organization Pass Key');
          if (!kcbSettings.org_shortcode) missing.push('Short Code or Till Number');
          if (missing.length > 0) {
            return (
              <div className="mb-4 flex items-start gap-3 bg-amber-900/30 border border-amber-700 rounded-lg p-3">
                <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 text-sm font-medium">Required fields missing</p>
                  <p className="text-amber-400/80 text-xs mt-0.5">Fill in: {missing.join(', ')}</p>
                </div>
              </div>
            );
          }
          return (
            <div className="mb-4 flex items-center gap-2 bg-emerald-900/20 border border-emerald-700 rounded-lg p-3">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <p className="text-emerald-300 text-sm">
                All required fields configured
                {kcbSettings.environment === 'sandbox' && (
                  <span className="ml-2 bg-blue-700 text-blue-100 text-[10px] px-2 py-0.5 rounded-full">SANDBOX</span>
                )}
              </p>
            </div>
          );
        })()}

        {kcbSettings.is_enabled && (
          <div className="space-y-4">

            {/* SECTION 1: Core credentials */}
            <div className="space-y-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield size={15} className="text-emerald-400" />
                KCB API Credentials (BUNI)
                <span className="text-[10px] text-red-400 font-normal ml-1">* required</span>
              </h3>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Client ID (App Key) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={kcbSettings.client_id}
                  onChange={(e) => onMpesaChange({ ...kcbSettings, client_id: e.target.value })}
                  className={`w-full px-4 py-3 bg-slate-700 text-white rounded-lg border focus:border-emerald-500 focus:outline-none font-mono text-sm ${
                    !kcbSettings.client_id ? 'border-amber-600' : 'border-slate-600'
                  }`}
                  placeholder="Get from KCB Developer Portal - App Settings"
                />
                <p className="text-xs text-slate-500 mt-1">{"Login to KCB portal > Apps > View Details > App Key"}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Client Secret (App Secret) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={kcbSettings.client_secret}
                    onChange={(e) => onMpesaChange({ ...kcbSettings, client_secret: e.target.value })}
                    className={`w-full px-4 py-3 pr-12 bg-slate-700 text-white rounded-lg border focus:border-emerald-500 focus:outline-none font-mono text-sm ${
                      !kcbSettings.client_secret ? 'border-amber-600' : 'border-slate-600'
                    }`}
                    placeholder="Get from KCB Developer Portal - App Settings"
                  />
                  <button type="button" onClick={onToggleSecret} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showSecret ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">{"Login to KCB portal > Apps > View Details > App Secret"}</p>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Organization Pass Key <span className="text-red-400">*</span>
                </label>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={kcbSettings.org_passkey || ''}
                  onChange={(e) => onMpesaChange({ ...kcbSettings, org_passkey: e.target.value })}
                  className={`w-full px-4 py-3 bg-slate-700 text-white rounded-lg border focus:border-emerald-500 focus:outline-none font-mono text-sm ${
                    !kcbSettings.org_passkey ? 'border-amber-600' : 'border-slate-600'
                  }`}
                  placeholder="KCB Organization Pass Key for BUNI (STK Push authentication)"
                />
                <p className="text-xs text-slate-500 mt-1">{"From KCB portal: Settings > Security > Organization BUNI Pass Key"}</p>
              </div>


            </div>

            {/* SECTION 2: KCB Business Details */}
            <div className="space-y-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-white">KCB Business Configuration</h3>
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  <strong>Organization Shortcode:</strong> Your KCB organization identifier (e.g., JIMWAS, BUSINESS).<br />
                  <strong>Merchant Code:</strong> Your KCB merchant/business code from the portal.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Organization Shortcode <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={kcbSettings.org_shortcode}
                    onChange={(e) => onMpesaChange({ ...kcbSettings, org_shortcode: e.target.value })}
                    className={`w-full px-4 py-3 bg-slate-700 text-white rounded-lg border focus:border-emerald-500 focus:outline-none ${
                      !kcbSettings.org_shortcode ? 'border-amber-600' : 'border-slate-600'
                    }`}
                    placeholder="e.g. JIMWAS, MYSTORE"
                  />
                    <p className="text-xs text-slate-500 mt-1">{"From KCB portal: Business Settings > Organization Code"}</p>
                </div>
              </div>
            </div>

            {/* SECTION 3: Testing Environment */}
            <div className="space-y-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-white">Testing & Deployment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Environment Mode</label>
                  <select
                    value={kcbSettings.environment}
                    onChange={(e) => onMpesaChange({ ...kcbSettings, environment: e.target.value as 'sandbox' | 'production' })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="sandbox">Sandbox (KCB Testing - No Real Money)</option>
                    <option value="production">Production (Live - Real Transactions)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Always use Sandbox for testing. Switch to Production only after KCB approval.</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Default Country Code</label>
                  <input
                    type="text"
                    value={kcbSettings.default_phone_country_code}
                    onChange={(e) => onMpesaChange({ ...kcbSettings, default_phone_country_code: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                    placeholder="254"
                  />
                  <p className="text-xs text-slate-500 mt-1">Kenya country code: 254</p>
                </div>
              </div>
            </div>

            {/* SECTION 4: KCB IPN Callback URLs */}
            <div className="space-y-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-sm font-semibold text-white">KCB IPN (Instant Payment Notification) URLs</h3>
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3 text-xs text-blue-300">
                Configure these in KCB portal for payment status callbacks:
                <div className="mt-2 font-mono text-blue-400/80 break-all space-y-1">
                  <div><span className="text-emerald-400">IPN Endpoint:</span> {import.meta.env.VITE_SUPABASE_URL}/functions/v1/kcb-ipn</div>
                  <div><span className="text-slate-500 text-[11px]">KCB will POST payment status here after STK Push</span></div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Custom IPN Callback URL</label>
                  <input
                    type="url"
                    value={kcbSettings.callback_url || ''}
                    onChange={(e) => onMpesaChange({ ...kcbSettings, callback_url: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"
                    placeholder="Leave empty to use Supabase default IPN handler"
                  />
                  <p className="text-xs text-slate-500 mt-1">Leave blank to use auto-generated Supabase IPN URL (recommended)</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Custom Timeout URL</label>
                  <input
                    type="url"
                    value={kcbSettings.timeout_url || ''}
                    onChange={(e) => onMpesaChange({ ...kcbSettings, timeout_url: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"
                    placeholder="Leave empty to use Supabase default"
                  />
                </div>
              </div>
            </div>

            {/* Go Live checklist */}
            {kcbSettings.environment === 'production' && (
              <div className="bg-emerald-900/20 border border-emerald-700 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  Production Go-Live Checklist
                </h3>
                <ul className="space-y-2 text-xs text-emerald-400/80">
                  {[
                    { done: !!kcbSettings.client_id, text: 'Production Consumer Key set' },
                    { done: !!kcbSettings.client_secret, text: 'Production Consumer Secret set' },
                    { done: !!(kcbSettings.org_shortcode || kcbSettings.org_passkey), text: 'Real Paybill or Till Number set' },
                    { done: true, text: 'Callback URL uses HTTPS (Supabase Edge Functions are HTTPS by default)' },
                    { done: true, text: 'Go Live approved on Daraja portal' },
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {item.done
                        ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        : <AlertCircle size={13} className="text-amber-400 shrink-0" />
                      }
                      <span className={item.done ? 'text-emerald-300' : 'text-amber-300'}>{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Save Button with Status */}
            <div className="pt-4 border-t border-slate-600">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1.5">
                  {/* Auto-save Status */}
                  {autoSaving && (
                    <div className="flex items-center gap-1 text-xs text-blue-400">
                      <Loader2 size={12} className="animate-spin" />
                      Auto-saving...
                    </div>
                  )}
                  {/* Sync Status */}
                  <div className="flex items-center gap-2">
                    {kcbSettings.sync_status === 'synced' ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 size={14} />
                        Synced to cloud
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <CloudOff size={14} />
                        Pending sync
                      </span>
                    )}
                  </div>
                  {/* Last Updated */}
                  {kcbSettings.last_updated && (
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={12} />
                      <span>
                        Last saved: {new Date(kcbSettings.last_updated).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={onSaveMpesa}
                  disabled={saving}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Cloud size={18} />
                      Save & Sync to Cloud
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ RECEIPT SETTINGS TAB ============
function ReceiptSettingsTab({
  settings,
  businessSettings,
  onChange,
  onSave,
  saving,
}: {
  settings: ReceiptSettings;
  businessSettings: BusinessSettings;
  onChange: (s: ReceiptSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const checkboxes = [
    { key: 'show_customer_name', label: 'Show customer name' },
    { key: 'show_customer_phone', label: 'Show customer phone' },
    { key: 'show_item_barcode', label: 'Show item barcode' },
    { key: 'show_item_sku', label: 'Show item SKU' },
    { key: 'show_cashier_name', label: 'Show cashier name' },
    { key: 'show_branch_name', label: 'Show branch name' },
    { key: 'show_tax_breakdown', label: 'Show tax breakdown' },
    { key: 'print_copy_for_customer', label: 'Print copy for customer' },
    { key: 'print_copy_for_merchant', label: 'Print copy for merchant' },
  ] as const;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Settings size={20} />
        Receipt Settings
      </h2>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Paper Width</label>
        <select
          value={settings.paper_width}
          onChange={(e) => onChange({ ...settings, paper_width: e.target.value as '58mm' | '80mm' })}
          className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
        >
          <option value="58mm">58mm (Small)</option>
          <option value="80mm">80mm (Standard)</option>
        </select>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-300">Display Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checkboxes.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => onChange({ ...settings, [key]: e.target.checked })}
                className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-white">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-700">
        <button
          onClick={() => testPrint(businessSettings, settings)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 mr-3"
        >
          <Printer size={18} />
          Test Print
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Receipt Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============ LOYALTY SETTINGS TAB ============
function LoyaltySettingsTab({
  settings,
  onChange,
  onSave,
  saving,
}: {
  settings: LoyaltySettings;
  onChange: (s: LoyaltySettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <RefreshCw size={20} />
          Loyalty Program Settings
        </h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-slate-400">Enabled</span>
          <button
            onClick={() => onChange({ ...settings, is_enabled: !settings.is_enabled })}
            className={`p-1 rounded-lg transition ${
              settings.is_enabled
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-600 text-slate-400'
            }`}
          >
            {settings.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </button>
        </label>
      </div>

      {settings.is_enabled && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Points per Currency</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.points_per_currency}
                  onChange={(e) => onChange({ ...settings, points_per_currency: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  min="1"
                />
                <span className="text-slate-400 whitespace-nowrap">KES = 1 point</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Point Value (KES)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={settings.point_value}
                  onChange={(e) => onChange({ ...settings, point_value: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  min="0"
                  step="0.5"
                />
                <span className="text-slate-400 whitespace-nowrap">KES per point</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Minimum Points to Redeem</label>
              <input
                type="number"
                value={settings.minimum_points_to_redeem}
                onChange={(e) => onChange({ ...settings, minimum_points_to_redeem: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Signup Bonus Points</label>
              <input
                type="number"
                value={settings.signup_bonus_points}
                onChange={(e) => onChange({ ...settings, signup_bonus_points: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                min="0"
              />
            </div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-white mb-2">Current Setup Summary</h3>
            <p className="text-sm text-slate-400">
              Customers earn <span className="text-emerald-400">1 point</span> for every{' '}
              <span className="text-white">{settings.points_per_currency} KES</span> spent.
            </p>
            <p className="text-sm text-slate-400">
              Each <span className="text-emerald-400">point</span> is worth{' '}
              <span className="text-white">{settings.point_value} KES</span>.
            </p>
            <p className="text-sm text-slate-400">
              Minimum <span className="text-white">{settings.minimum_points_to_redeem} points</span> required to redeem.
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-700">
            <button
              onClick={onSave}
              disabled={saving}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Loyalty Settings
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ USER MODAL ============
function UserModal({
  user,
  currentUserId,
  onClose,
  onSaved,
}: {
  user: User | null;
  currentUserId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    full_name: user?.full_name || '',
    password: '',
    confirm_password: '',
    role_code: user?.role_code || 'cashier',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!user;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (isEditing) {
        // Update existing user
        if (formData.role_code !== user.role_code) {
          await updateUserRole(user.id, formData.role_code as any, currentUserId!);
        }
      } else {
        // Create new user
        if (formData.password !== formData.confirm_password) {
          setError('Passwords do not match');
          setSaving(false);
          return;
        }

        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setSaving(false);
          return;
        }

        console.log('[v0] Creating user with:', { username: formData.username, email: formData.email, role: formData.role_code });
        const result = await createUser(
          formData.username,
          formData.email,
          formData.password,
          formData.full_name,
          formData.role_code as 'admin' | 'manager' | 'cashier',
          currentUserId!
        );

        console.log('[v0] createUser result:', result);
        if (!result.success) {
          setError(result.error || 'Failed to create user');
          setSaving(false);
          return;
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('[v0] Error in save handler:', err);
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-hidden">
      <div className="bg-slate-800 rounded-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <h3 className="text-xl font-bold text-white">
            {isEditing ? 'Edit User' : 'Add New User'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 min-h-0">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Full Name</label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              required
              disabled={isEditing}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              required
              disabled={isEditing}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              required
              disabled={isEditing}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Role</label>
            <select
              value={formData.role_code}
              onChange={(e) => setFormData({ ...formData, role_code: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              required
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          {!isEditing && (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </>
          )}

          </form>
        </div>

        <div className="border-t border-slate-700 p-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={saving}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
