import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        window.dispatchEvent(new CustomEvent('local-storage', { detail: { key, value: valueToStore } }));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.key === key) {
        setStoredValue(customEvent.detail.value);
      }
    };
    const handleNativeStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch {
          setStoredValue(e.newValue as any);
        }
      }
    };
    window.addEventListener('local-storage', handleStorageChange);
    window.addEventListener('storage', handleNativeStorage);
    return () => {
      window.removeEventListener('local-storage', handleStorageChange);
      window.removeEventListener('storage', handleNativeStorage);
    };
  }, [key]);

  return [storedValue, setValue] as const;
}
