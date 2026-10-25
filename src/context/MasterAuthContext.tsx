import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  fetchMasterConfig,
  verifyMasterPin,
  saveMasterPin,
  changeMasterPin,
  clearMasterSession,
  checkHasActiveSession,
  type MasterConfig,
} from "@/lib/master-auth";

interface MasterAuthContextType {
  isMaster: boolean;
  isConfigured: boolean | null;
  isLoading: boolean;
  config: MasterConfig | null;
  unlock: (pin: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  lock: () => void;
  setupPin: (pin: string, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  changePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

const MasterAuthContext = createContext<MasterAuthContextType | undefined>(undefined);

export function MasterAuthProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<MasterConfig | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const cfg = await fetchMasterConfig();
      setConfig(cfg);
      if (cfg.configured && cfg.hash) {
        const hasSession = checkHasActiveSession(cfg.hash);
        setIsMaster(hasSession);
      } else {
        setIsMaster(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const unlock = async (pin: string, remember = false) => {
    if (!config || !config.configured) {
      return { success: false, error: "Sistema do mestre não inicializado." };
    }
    const res = await verifyMasterPin(pin, config, remember);
    if (res.success) {
      setIsMaster(true);
    }
    return res;
  };

  const lock = () => {
    clearMasterSession();
    setIsMaster(false);
  };

  const setupPin = async (pin: string, remember = true) => {
    const res = await saveMasterPin(pin);
    if (res.success) {
      setIsMaster(true);
      await loadConfig();
    }
    return res;
  };

  const handleChangePin = async (currentPin: string, newPin: string) => {
    if (!config || !config.configured) {
      return { success: false, error: "Configuração não encontrada." };
    }
    const res = await changeMasterPin(currentPin, newPin, config);
    if (res.success) {
      await loadConfig();
    }
    return res;
  };

  return (
    <MasterAuthContext.Provider
      value={{
        isMaster,
        isConfigured: config ? config.configured : null,
        isLoading,
        config,
        unlock,
        lock,
        setupPin,
        changePin: handleChangePin,
        refresh: loadConfig,
      }}
    >
      {children}
    </MasterAuthContext.Provider>
  );
}

export function useMasterAuth() {
  const context = useContext(MasterAuthContext);
  if (!context) {
    throw new Error("useMasterAuth deve ser utilizado dentro de um MasterAuthProvider");
  }
  return context;
}
