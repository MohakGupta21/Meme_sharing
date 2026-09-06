import { createContext, useContext, useMemo, useState } from "react";

interface ComposeState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const ComposeContext = createContext<ComposeState | undefined>(undefined);

/** Lets the sidebar / mobile FAB / feed all trigger the one upload modal. */
export function ComposeProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const value = useMemo<ComposeState>(
    () => ({ isOpen, open: () => setOpen(true), close: () => setOpen(false) }),
    [isOpen],
  );
  return <ComposeContext.Provider value={value}>{children}</ComposeContext.Provider>;
}

export function useCompose(): ComposeState {
  const ctx = useContext(ComposeContext);
  if (!ctx) throw new Error("useCompose must be used within <ComposeProvider>");
  return ctx;
}
