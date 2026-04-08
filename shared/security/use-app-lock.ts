/**
 * T010: React hook for app lock integration
 * 
 * Provides useAppLock hook for components to manage lock state and verify access.
 */

import { useCallback, useEffect, useState } from "react";
import { AppError } from "../utils/app-error";
import { getAppLockGateway } from "./app-lock";

export interface UseAppLockResult {
  isLocked: boolean;
  lockToken: string | null;
  unlock: (pin: string) => Promise<AppError | null>;
  lock: () => Promise<AppError | null>;
  resetPin: (currentPin: string, newPin: string) => Promise<AppError | null>;
  verifyToken: (token: string) => boolean;
}

/**
 * Hook for managing app lock state
 */
export const useAppLock = (): UseAppLockResult => {
  const [isLocked, setIsLocked] = useState(true);
  const [lockToken, setLockToken] = useState<string | null>(null);
  const gateway = getAppLockGateway();

  // Check lock state on mount
  useEffect(() => {
    setIsLocked(gateway.isLocked());
  }, [gateway]);

  const unlock = useCallback(
    async (pin: string): Promise<AppError | null> => {
      const result = await gateway.unlock(pin);
      if (result.success) {
        setIsLocked(false);
        setLockToken(result.data);
        return null;
      }
      return result.error;
    },
    [gateway]
  );

  const lock = useCallback(async (): Promise<AppError | null> => {
    const result = await gateway.lock();
    if (result.success) {
      setIsLocked(true);
      setLockToken(null);
      return null;
    }
    return result.error;
  }, [gateway]);

  const resetPin = useCallback(
    async (currentPin: string, newPin: string): Promise<AppError | null> => {
      const result = await gateway.resetPin(currentPin, newPin);
      if (result.success) {
        return null;
      }
      return result.error;
    },
    [gateway]
  );

  const verifyToken = useCallback(
    (token: string): boolean => {
      return gateway.verifyToken(token);
    },
    [gateway]
  );

  return {
    isLocked,
    lockToken,
    unlock,
    lock,
    resetPin,
    verifyToken,
  };
};
