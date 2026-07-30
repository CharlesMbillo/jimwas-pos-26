// Backup & Restore Page - Export and import data

import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { RoleGuard } from '../context/AuthContext';
import {
  Download, Upload, Database, AlertTriangle, Check, FileJson, Clock,
  HardDrive, RefreshCw, Trash2, Archive, Shield
} from 'lucide-react';
import {
  exportBackup,
  downloadBackup,
  importBackup,
  validateBackup,
} from '../lib/backup';
import { syncNow, getSyncState, subscribeToSyncState, resyncAllLocalProducts } from '../lib/sync';
import type { BackupData, RestoreOptions, RestoreResult } from '../lib/backup';
import type { SyncState } from '../lib/sync';

export function BackupPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [resyncResult, setResyncResult] = useState<{ synced: number; skipped: number; errors: string[] } | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    overwriteExisting: true,
    includeAuditLogs: true,
    includeUsers: false,
    includeSettings: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());

  // Subscribe to sync state
  useState(() => {
    const unsubscribe = subscribeToSyncState(setSyncState);
    return unsubscribe;
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const backup = await exportBackup(user?.full_name);
      downloadBackup(backup);

      // Brief success indication
      setTimeout(() => setIsExporting(false), 500);
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setBackupPreview(null);
    setValidationError(null);
    setRestoreResult(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const validation = validateBackup(data);

      if (validation.valid && validation.backup) {
        setBackupPreview(validation.backup);
      } else {
        setValidationError(validation.error || 'Invalid backup file');
      }
    } catch (error) {
      setValidationError('Failed to read backup file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRestore = async () => {
    if (!backupPreview) return;

    setIsImporting(true);
    setRestoreResult(null);

    try {
      const result = await importBackup(backupPreview, restoreOptions);
      setRestoreResult(result);
      setShowConfirmRestore(false);

      // Trigger sync after restore
      await syncNow();
    } catch (error) {
      setRestoreResult({
        success: false,
        message: 'Restore failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        imported: {
          customers: 0, products: 0, transactions: 0, installment_plans: 0,
          installment_payments: 0, loyalty_transactions: 0, stock_movements: 0,
          suppliers: 0, deliveries: 0, stock_adjustments: 0, users: 0, roles: 0,
          audit_logs: 0, approval_requests: 0, payment_methods: 0,
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Backup & Restore</h1>
        <p className="text-slate-400">Export and import your POS data</p>
      </div>

      {/* Resync Local Products */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <RefreshCw size={24} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Resync Local Products</h2>
              <p className="text-sm text-slate-400">Push all local products to cloud database</p>
            </div>
          </div>
          <button
            onClick={async () => {
              setIsResyncing(true);
              setResyncResult(null);
              try {
                const result = await resyncAllLocalProducts();
                setResyncResult(result);
              } catch (err) {
                setResyncResult({ synced: 0, skipped: 0, errors: [err instanceof Error ? err.message : 'Unknown error'] });
              } finally {
                setIsResyncing(false);
              }
            }}
            disabled={isResyncing || syncState.status === 'offline'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isResyncing ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Resyncing...
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Resync Products
              </>
            )}
          </button>
        </div>
        {resyncResult && (
          <div className={`rounded-lg p-4 ${
            resyncResult.errors.length === 0
              ? 'bg-emerald-900/20 border border-emerald-700'
              : 'bg-amber-900/20 border border-amber-700'
          }`}>
            <div className="grid grid-cols-3 gap-4 text-center mb-2">
              <div>
                <p className="text-2xl font-bold text-emerald-400">{resyncResult.synced}</p>
                <p className="text-xs text-slate-400">Synced</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-400">{resyncResult.skipped}</p>
                <p className="text-xs text-slate-400">Skipped (already synced)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{resyncResult.errors.length}</p>
                <p className="text-xs text-slate-400">Errors</p>
              </div>
            </div>
            {resyncResult.errors.length > 0 && (
              <div className="text-xs text-red-400 mt-2">
                {resyncResult.errors.slice(0, 3).join('\n')}
                {resyncResult.errors.length > 3 && `\n... +${resyncResult.errors.length - 3} more`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sync Status */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              syncState.status === 'synced' ? 'bg-emerald-900/30' :
              syncState.status === 'syncing' ? 'bg-blue-900/30' :
              syncState.status === 'pending' ? 'bg-amber-900/30' :
              syncState.status === 'offline' ? 'bg-slate-700' :
              'bg-red-900/30'
            }`}>
              {syncState.status === 'syncing' ? (
                <RefreshCw size={20} className="text-blue-400 animate-spin" />
              ) : syncState.status === 'synced' ? (
                <Check size={20} className="text-emerald-400" />
              ) : syncState.status === 'offline' ? (
                <HardDrive size={20} className="text-slate-400" />
              ) : (
                <AlertTriangle size={20} className="text-amber-400" />
              )}
            </div>
            <div>
              <p className="text-white font-medium">
                {syncState.status === 'synced' ? 'Synced' :
                 syncState.status === 'syncing' ? 'Syncing...' :
                 syncState.status === 'pending' ? `${syncState.pendingCount} pending` :
                 syncState.status === 'offline' ? 'Offline' :
                 'Sync Error'}
              </p>
              {syncState.lastSync && (
                <p className="text-xs text-slate-400">
                  Last sync: {new Date(syncState.lastSync).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => syncNow()}
            disabled={syncState.status === 'syncing' || syncState.status === 'offline'}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {syncState.status === 'syncing' ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Sync Now
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-emerald-900/30">
              <Download size={24} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Export Backup</h2>
              <p className="text-sm text-slate-400">Download all your data as a JSON file</p>
            </div>
          </div>

          <div className="bg-slate-700 rounded-lg p-4 mb-4">
            <p className="text-sm text-slate-300 mb-2">This will export:</p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Products & Customers</li>
              <li>• Transactions & Installments</li>
              <li>• Stock movements & Suppliers</li>
              <li>• Users & Roles</li>
              <li>• Audit logs & Settings</li>
            </ul>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExporting ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download size={18} />
                Export Backup
              </>
            )}
          </button>
        </div>

        {/* Import Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-900/30">
              <Upload size={24} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Import Backup</h2>
              <p className="text-sm text-slate-400">Restore from a backup file</p>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-emerald-500 transition mb-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload size={32} className="mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-300">
              {selectedFile ? selectedFile.name : 'Click to select backup file'}
            </p>
            {selectedFile && (
              <p className="text-xs text-slate-500 mt-1">{formatSize(selectedFile.size)}</p>
            )}
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={16} />
                <p className="text-sm">{validationError}</p>
              </div>
            </div>
          )}

          {/* Backup Preview */}
          {backupPreview && !showConfirmRestore && (
            <div className="bg-slate-700 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <FileJson size={18} className="text-emerald-400" />
                <span className="text-white font-medium">Backup Contents</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Version:</span>
                  <span className="text-white">{backupPreview.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Exported:</span>
                  <span className="text-white">{new Date(backupPreview.exported_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Products:</span>
                  <span className="text-white">{backupPreview.counts.products}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Customers:</span>
                  <span className="text-white">{backupPreview.counts.customers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transactions:</span>
                  <span className="text-white">{backupPreview.counts.transactions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Users:</span>
                  <span className="text-white">{backupPreview.counts.users}</span>
                </div>
              </div>

              {/* Options */}
              <div className="mt-4 pt-4 border-t border-slate-600 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreOptions.includeUsers}
                    onChange={(e) => setRestoreOptions({ ...restoreOptions, includeUsers: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-emerald-500"
                  />
                  <span className="text-sm text-slate-300">Include users (may affect login)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreOptions.includeAuditLogs}
                    onChange={(e) => setRestoreOptions({ ...restoreOptions, includeAuditLogs: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-emerald-500"
                  />
                  <span className="text-sm text-slate-300">Include audit logs</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={restoreOptions.includeSettings}
                    onChange={(e) => setRestoreOptions({ ...restoreOptions, includeSettings: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-emerald-500"
                  />
                  <span className="text-sm text-slate-300">Include settings</span>
                </label>
              </div>

              <button
                onClick={() => setShowConfirmRestore(true)}
                className="w-full mt-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center justify-center gap-2"
              >
                <Upload size={18} />
                Restore Backup
              </button>
            </div>
          )}

          {/* Confirm Restore Modal */}
          {showConfirmRestore && (
            <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3 text-amber-400">
                <AlertTriangle size={20} />
                <span className="font-medium">Warning</span>
              </div>
              <p className="text-sm text-slate-300 mb-4">
                This will add {backupPreview?.counts.products || 0} products,{' '}
                {backupPreview?.counts.customers || 0} customers, and{' '}
                {backupPreview?.counts.transactions || 0} transactions to your database.
                Existing data may be duplicated.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmRestore(false)}
                  className="flex-1 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-500 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  disabled={isImporting}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Confirm Restore
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Restore Result */}
          {restoreResult && (
            <div className={`rounded-lg p-4 ${
              restoreResult.success
                ? 'bg-emerald-900/20 border border-emerald-700'
                : 'bg-red-900/20 border border-red-700'
            }`}>
              <div className={`flex items-center gap-2 mb-2 ${
                restoreResult.success ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {restoreResult.success ? <Check size={20} /> : <AlertTriangle size={20} />}
                <span className="font-medium">{restoreResult.message}</span>
              </div>
              <div className="text-xs text-slate-400 grid grid-cols-2 gap-1">
                <span>Products: {restoreResult.imported.products}</span>
                <span>Customers: {restoreResult.imported.customers}</span>
                <span>Transactions: {restoreResult.imported.transactions}</span>
                <span>Stock movements: {restoreResult.imported.stock_movements}</span>
                <span>Users: {restoreResult.imported.users}</span>
                <span>Audit logs: {restoreResult.imported.audit_logs}</span>
              </div>
              {restoreResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-400">
                  Errors: {restoreResult.errors.slice(0, 3).join(', ')}
                  {restoreResult.errors.length > 3 && `... +${restoreResult.errors.length - 3} more`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Data Management */}
      <RoleGuard allowedRoles={['admin']}>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Database size={20} className="text-slate-400" />
            Data Management
          </h2>
          <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <AlertTriangle size={16} />
              <span className="font-medium">Offline Storage</span>
            </div>
            <p className="text-xs text-slate-300">
              Your data is stored locally in your browser. Regular backups are recommended.
              Clearing browser data will remove all offline data.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400">Storage Type</p>
              <p className="text-white font-medium">IndexedDB</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400">Sync Status</p>
              <p className="text-white font-medium capitalize">{syncState.status}</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400">Pending Items</p>
              <p className="text-white font-medium">{syncState.pendingCount}</p>
            </div>
            <div className="bg-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400">Last Backup</p>
              <p className="text-white font-medium">Manual</p>
            </div>
          </div>
        </div>
      </RoleGuard>
    </div>
  );
}
