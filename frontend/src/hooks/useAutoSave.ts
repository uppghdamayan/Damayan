import { useEffect, useRef } from 'react';

export function useAutoSave<T>(
  formValues: T,
  patchFn: (data: T) => void,
  draftKey: string,
  delay: number = 30000
) {
  const isInitialMount = useRef(true);

  // Auto-save timer
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    const timer = setTimeout(() => {
      patchFn(formValues);
    }, delay);

    return () => clearTimeout(timer);
  }, [formValues, delay, patchFn]);

  // Offline fallback
  useEffect(() => {
    const handleSaveOffline = () => {
      localStorage.setItem(draftKey, JSON.stringify(formValues));
    };

    window.addEventListener('beforeunload', handleSaveOffline);
    return () => {
      window.removeEventListener('beforeunload', handleSaveOffline);
    };
  }, [formValues, draftKey]);
}
