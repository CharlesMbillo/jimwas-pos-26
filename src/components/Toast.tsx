import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl backdrop-blur-sm border min-w-[300px] max-w-md animate-[slideIn_0.3s_ease-out] ${
              toast.type === 'success'
                ? 'bg-emerald-900/95 border-emerald-700'
                : toast.type === 'error'
                ? 'bg-red-900/95 border-red-700'
                : 'bg-slate-800/95 border-slate-600'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={22} className="text-emerald-400 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={22} className="text-red-400 flex-shrink-0" />}
            {toast.type === 'info' && <Info size={22} className="text-blue-400 flex-shrink-0" />}
            <span className="text-white text-sm font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-slate-400 hover:text-white transition flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
