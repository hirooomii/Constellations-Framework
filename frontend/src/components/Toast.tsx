'use client';
import { useEffect, useState, createContext, useContext, useCallback, ReactNode } from 'react';

interface ToastContextValue {
  showToast: (msg: string, dur?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = { current: 0 as unknown as ReturnType<typeof setTimeout> };

  const showToast = useCallback((msg: string, dur = 2800) => {
    setMessage(msg);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), dur);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast ${visible ? 'show' : 'hide'}`}>{message}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
