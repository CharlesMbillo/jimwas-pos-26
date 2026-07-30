'use client';

import { useState, useRef } from 'react';
import {
  Download, Upload, Database, AlertTriangle, Check, FileJson, Clock,
  HardDrive, RefreshCw, Trash2, Archive, Shield
} from 'lucide-react';
import {
  addToBackupHistory,
  getBackupHistory,
  deleteBackupHistoryEntry,
} from '@/lib/backup';
import type { BackupHistoryEntry } from '@/lib/backup';

export function BackupPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load backup history on mount
  useState(() => {
    setBackupHistory(getBackupHistory());
    setIsLoading(false);
  });

  const handleCreateDemoBackup = () => {
    const demoBackup = {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      exported_by: 'Demo User',
      business_name: 'Jimwas POS',
      data: {
        customers: [],
        products: [],
        transactions: [],
        installment_plans: [],
        installment_payments: [],
        loyalty_transactions: [],
        stock_movements: [],
        suppliers: [],
        deliveries: [],
        stock_adjustments: [],
        users: [],
        roles: [],
        audit_logs: [],
        approval_requests: [],
        business_settings: null,
        mpesa_settings: null,
        payment_methods: [],
        loyalty_settings: null,
        receipt_settings: null,
      },
      counts: {
        customers: 5,
        products: 12,
        transactions: 24,
        installment_plans: 3,
        installment_payments: 8,
        loyalty_transactions: 15,
        stock_movements: 10,
        suppliers: 4,
        deliveries: 6,
        stock_adjustments: 2,
        users: 3,
        roles: 2,
        audit_logs: 50,
        approval_requests: 1,
      },
    };

    addToBackupHistory(demoBackup as any, 45000, `jimwas-backup-${new Date().toISOString().split('T')[0]}.json`);
    setBackupHistory(getBackupHistory());
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDeleteEntry = (id: string) => {
    deleteBackupHistoryEntry(id);
    setBackupHistory(getBackupHistory());
    setSelectedHistoryId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Backup Management System</h1>
          <p className="text-slate-400">View and manage your previously imported backups</p>
        </div>

        {/* Demo Button */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-4">
          <button
            onClick={handleCreateDemoBackup}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
          >
            <Database size={18} />
            Create Demo Backup Entry
          </button>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Click to add a sample backup to history to see how it displays
          </p>
        </div>

        {/* Backup History Section */}
        {backupHistory.length > 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-900/30">
                <Archive size={24} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Backup History</h2>
                <p className="text-sm text-slate-400">
                  {backupHistory.length} backup{backupHistory.length !== 1 ? 's' : ''} available
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {backupHistory.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedHistoryId(selectedHistoryId === entry.id ? null : entry.id)}
                  className="bg-slate-700 rounded-lg p-4 cursor-pointer hover:bg-slate-600 transition border border-slate-600 hover:border-purple-500"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileJson size={16} className="text-emerald-400 flex-shrink-0" />
                        <p className="text-white font-medium truncate">{entry.filename}</p>
                      </div>
                      <p className="text-xs text-slate-400">
                        Imported: {new Date(entry.importedAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-400">
                        Exported: {new Date(entry.exportedAt).toLocaleString()} by {entry.exportedBy || 'Unknown'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEntry(entry.id);
                      }}
                      className="p-2 hover:bg-red-900/30 rounded-lg transition text-red-400 ml-2 flex-shrink-0"
                      title="Delete from history"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {selectedHistoryId === entry.id && (
                    <div className="mt-3 pt-3 border-t border-slate-600">
                      <div className="grid grid-cols-4 gap-3 text-center text-xs">
                        <div>
                          <p className="text-slate-400 mb-1">Products</p>
                          <p className="text-emerald-400 font-bold text-lg">{entry.counts.products}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-1">Customers</p>
                          <p className="text-emerald-400 font-bold text-lg">{entry.counts.customers}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-1">Transactions</p>
                          <p className="text-emerald-400 font-bold text-lg">{entry.counts.transactions}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 mb-1">Size</p>
                          <p className="text-emerald-400 font-bold text-lg">{formatSize(entry.dataSize)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button className="flex-1 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition text-sm font-medium border border-emerald-600">
                          Restore
                        </button>
                        <button className="flex-1 py-2 bg-sky-600/20 text-sky-400 rounded-lg hover:bg-sky-600/30 transition text-sm font-medium border border-sky-600">
                          View Details
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <Archive size={48} className="text-slate-600 mx-auto mb-4" />
            <h3 className="text-slate-300 font-medium mb-2">No Backups Yet</h3>
            <p className="text-slate-400 text-sm mb-4">
              When you import backups, they will appear here for easy access and restoration.
            </p>
            <button
              onClick={handleCreateDemoBackup}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              <Plus size={16} />
              Create First Backup
            </button>
          </div>
        )}

        {/* Information Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-start gap-3">
              <Check size={20} className="text-emerald-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-medium mb-1">Automatic Tracking</h3>
                <p className="text-sm text-slate-400">
                  Every backup you import is automatically tracked with timestamps and data summaries.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-start gap-3">
              <Shield size={20} className="text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-medium mb-1">Local Storage</h3>
                <p className="text-sm text-slate-400">
                  Backup history is stored in your browser and persists between sessions.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-start gap-3">
              <RefreshCw size={20} className="text-amber-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-medium mb-1">Quick Restore</h3>
                <p className="text-sm text-slate-400">
                  One-click restore from any backup in your history without re-uploading.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-start gap-3">
              <Trash2 size={20} className="text-red-400 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-white font-medium mb-1">Easy Management</h3>
                <p className="text-sm text-slate-400">
                  Delete old backups from history to keep your list organized and recent.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component - Import at top if needed
function Plus({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
