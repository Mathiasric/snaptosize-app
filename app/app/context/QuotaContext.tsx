"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface Quota {
  quick: number;
  batch: number;
}

interface QuotaContextValue {
  remaining: Quota | null;
  setRemaining: (q: Quota) => void;
}

const QuotaContext = createContext<QuotaContextValue>({
  remaining: null,
  setRemaining: () => {},
});

export function QuotaProvider({ children }: { children: React.ReactNode }) {
  const [remaining, setRemainingState] = useState<Quota | null>(null);
  const setRemaining = useCallback((q: Quota) => setRemainingState(q), []);
  return (
    <QuotaContext.Provider value={{ remaining, setRemaining }}>
      {children}
    </QuotaContext.Provider>
  );
}

export function useQuota() {
  return useContext(QuotaContext);
}
