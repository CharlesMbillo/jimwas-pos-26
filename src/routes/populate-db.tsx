import { useState, useRef } from 'react';
import { Upload, Database, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { restoreFromBackup, type BackupData } from '../lib/db';

export function PopulateDBPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ synced: number; skipped: number; errors: string[] } | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handlePopulateFromJSON = async () => {
    setIsLoading(true);
    setStatus('idle');
    try {
      const response = await fetch('/data/jimwas-backup-2026-07-14.json');
      if (!response.ok) {
        throw new Error(`Failed to load backup: ${response.statusText}`);
      }
      const backup = (await response.json()) as BackupData;
      const restoreResult = await restoreFromBackup(backup);
      setResult(restoreResult);
      setStatus(restoreResult.errors.length === 0 ? 'success' : 'error');
    } catch (error) {
      setResult({ synced: 0, skipped: 0, errors: [String(error)] });
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatus('idle');
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupData;
      const restoreResult = await restoreFromBackup(backup);
      setResult(restoreResult);
      setStatus(restoreResult.errors.length === 0 ? 'success' : 'error');
    } catch (error) {
      setResult({ synced: 0, skipped: 0, errors: [String(error)] });
      setStatus('error');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Database size={32} className="text-blue-400" />
            Populate Database
          </h1>
          <p className="text-slate-400">Import backup data into your local database</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Populate from Default Backup */}
          <div
            className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-blue-500 cursor-pointer transition"
            onClick={handlePopulateFromJSON}
          >
            <div className="flex items-center gap-3 mb-4">
              <Database size={24} className="text-blue-400" />
              <h2 className="text-lg font-semibold">Load Default Backup</h2>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Restore from jimwas-backup-2026-07-14.json
            </p>
            <button
              onClick={handlePopulateFromJSON}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium py-2 px-4 rounded transition"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size={16} className="animate-spin" />
                  Loading...
                </span>
              ) : (
                'Load Backup'
              )}
            </button>
          </div>

          {/* Upload Custom Backup */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-green-500 cursor-pointer transition">
            <div className="flex items-center gap-3 mb-4">
              <Upload size={24} className="text-green-400" />
              <h2 className="text-lg font-semibold">Upload Backup File</h2>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              Upload a custom backup JSON file
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-medium py-2 px-4 rounded transition"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader size={16} className="animate-spin" />
                  Loading...
                </span>
              ) : (
                'Choose File'
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Results */}
        {result && (
          <div
            className={`rounded-lg p-6 border ${
              status === 'success'
                ? 'bg-green-900/30 border-green-700'
                : 'bg-red-900/30 border-red-700'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {status === 'success' ? (
                <CheckCircle size={24} className="text-green-400" />
              ) : (
                <AlertCircle size={24} className="text-red-400" />
              )}
              <h3 className="text-xl font-semibold">
                {status === 'success' ? 'Restore Successful' : 'Restore Completed with Issues'}
              </h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm">Synced Records</p>
                  <p className="text-2xl font-bold text-green-400">{result.synced}</p>
                </div>
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm">Skipped Records</p>
                  <p className="text-2xl font-bold text-yellow-400">{result.skipped}</p>
                </div>
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-slate-400 text-sm">Errors</p>
                  <p className="text-2xl font-bold text-red-400">{result.errors.length}</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-slate-700 rounded p-4">
                  <p className="text-sm font-semibold text-red-400 mb-2">Errors:</p>
                  <ul className="text-sm text-slate-300 space-y-1 max-h-64 overflow-y-auto">
                    {result.errors.slice(0, 10).map((error, i) => (
                      <li key={i} className="text-red-300">
                        • {error}
                      </li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-slate-400">
                        ... and {result.errors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setResult(null);
                setStatus('idle');
              }}
              className="mt-4 w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded transition"
            >
              Clear Results
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3 text-blue-400">About Database Population</h3>
          <ul className="text-slate-400 space-y-2 text-sm">
            <li>• Data is stored in browser IndexedDB (local storage)</li>
            <li>• Products, customers, and transactions will be imported</li>
            <li>• Data will sync to Supabase cloud when online</li>
            <li>• This is useful for populating demo data or restoring backups</li>
            <li>• Total records in default backup: ~40+ products</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
