import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`pointer-events-auto min-w-[300px] max-w-sm w-full p-4 rounded-xl shadow-2xl backdrop-blur-md border flex items-center gap-3 ${
                toast.type === 'success' ? 'bg-white/90 dark:bg-emerald-950/80 border-green-200 dark:border-emerald-800 text-green-800 dark:text-emerald-200' :
                toast.type === 'error' ? 'bg-white/90 dark:bg-red-950/80 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' :
                'bg-white/90 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
              }`}
            >
              <div className={`p-1 rounded-full ${
                  toast.type === 'success' ? 'bg-green-100 dark:bg-emerald-900 text-green-600 dark:text-emerald-300' :
                  toast.type === 'error' ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300' :
                  'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
              }`}>
                {toast.type === 'success' && <CheckCircle size={16} />}
                {toast.type === 'error' && <AlertCircle size={16} />}
                {toast.type === 'info' && <Info size={16} />}
              </div>
              <p className="flex-1 text-sm font-bold">{toast.message}</p>
              <button 
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
