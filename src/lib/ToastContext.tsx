// ToastContext - Global state management for toast notifications
// Provides showToast function that can be called from anywhere in the app

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Toast, type ToastVariant } from '../components/Toast';

/**
 * Toast state
 */
interface ToastState {
  message: string;
  variant: ToastVariant;
  isVisible: boolean;
}

/**
 * Toast context value
 */
interface ToastContextValue {
  /** Show a toast notification */
  showToast: (message: string, variant?: ToastVariant) => void;
  /** Show an error toast (convenience method) */
  showError: (message: string) => void;
  /** Show a success toast (convenience method) */
  showSuccess: (message: string) => void;
  /** Show an info toast (convenience method) */
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Provider component for toast notifications
 * Wrap your app with this to enable toast functionality
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    variant: 'info',
    isVisible: false,
  });

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    setToast({ message, variant, isVisible: true });
  }, []);

  const showError = useCallback((message: string) => {
    showToast(message, 'error');
  }, [showToast]);

  const showSuccess = useCallback((message: string) => {
    showToast(message, 'success');
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast(message, 'info');
  }, [showToast]);

  const handleDismiss = useCallback(() => {
    setToast(prev => ({ ...prev, isVisible: false }));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showInfo }}>
      {children}
      <Toast
        message={toast.message}
        variant={toast.variant}
        isVisible={toast.isVisible}
        onDismiss={handleDismiss}
      />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast functionality
 * Must be used within a ToastProvider
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
