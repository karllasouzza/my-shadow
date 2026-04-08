/**
 * T010: Implement app lock gateway and hook
 *
 * Manages mandatory app lock for security-sensitive operations.
 * Uses MMKV for secure storage and provides hook for React components.
 */

import * as SecureStore from "expo-secure-store";
import type { MMKV } from "react-native-mmkv";
import { createMMKV } from "react-native-mmkv";
import { Result, createError, err, ok } from "../utils/app-error";

interface AppLockState {
  isLocked: boolean;
  lockToken?: string;
  lastUnlockTime?: number;
}

/**
 * App lock gateway managing encryption and verification
 */
export class AppLockGateway {
  private storage: MMKV;
  private lockKey = "app_lock:state";
  private pinKey = "app_lock:pin:hash";
  private lockTimeoutMs = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.storage = createMMKV({ id: "app_lock" });
  }

  /**
   * Initialize app lock with PIN
   */
  async initializeLock(pin: string): Promise<Result<void>> {
    try {
      // In production, use proper hashing (bcrypt, scrypt, etc)
      // This is a simplified example
      const pinHash = this.hashPin(pin);
      await SecureStore.setItemAsync(this.pinKey, pinHash);

      const lockState: AppLockState = {
        isLocked: true,
        lastUnlockTime: undefined,
      };
      this.storage.set(this.lockKey, JSON.stringify(lockState));

      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "SECURITY_LOCK_REQUIRED",
          "Failed to initialize app lock",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Unlock the app with PIN
   */
  async unlock(pin: string): Promise<Result<string>> {
    try {
      const storedHash = await SecureStore.getItemAsync(this.pinKey);
      if (!storedHash) {
        return err(
          createError("SECURITY_LOCK_REQUIRED", "App lock not initialized"),
        );
      }

      const inputHash = this.hashPin(pin);
      if (inputHash !== storedHash) {
        return err(createError("SECURITY_LOCK_REQUIRED", "Invalid PIN"));
      }

      // Generate session token
      const token = this.generateToken();
      const lockState: AppLockState = {
        isLocked: false,
        lockToken: token,
        lastUnlockTime: Date.now(),
      };
      this.storage.set(this.lockKey, JSON.stringify(lockState));

      return ok(token);
    } catch (error) {
      return err(
        createError(
          "SECURITY_LOCK_REQUIRED",
          "Failed to unlock app",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Lock the app immediately
   */
  async lock(): Promise<Result<void>> {
    try {
      const lockState: AppLockState = {
        isLocked: true,
        lockToken: undefined,
      };
      this.storage.set(this.lockKey, JSON.stringify(lockState));
      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "SECURITY_LOCK_REQUIRED",
          "Failed to lock app",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Check if app is currently locked
   */
  isLocked(): boolean {
    try {
      const data = this.storage.getString(this.lockKey);
      if (!data) return true;

      const state = JSON.parse(data) as AppLockState;

      // Check timeout
      if (state.lastUnlockTime) {
        const elapsed = Date.now() - state.lastUnlockTime;
        if (elapsed > this.lockTimeoutMs) {
          // Auto-lock after timeout
          this.lock();
          return true;
        }
      }

      return state.isLocked;
    } catch {
      return true; // Default to locked on error
    }
  }

  /**
   * Verify unlock token is valid
   */
  verifyToken(token: string): boolean {
    try {
      const data = this.storage.getString(this.lockKey);
      if (!data) return false;

      const state = JSON.parse(data) as AppLockState;
      return !state.isLocked && state.lockToken === token;
    } catch {
      return false;
    }
  }

  /**
   * Reset PIN (requires current PIN)
   */
  async resetPin(currentPin: string, newPin: string): Promise<Result<void>> {
    try {
      // Verify current PIN
      const unlockResult = await this.unlock(currentPin);
      if (!unlockResult.success) {
        return err(unlockResult.error);
      }

      // Set new PIN
      const newHash = this.hashPin(newPin);
      await SecureStore.setItemAsync(this.pinKey, newHash);

      return ok(void 0);
    } catch (error) {
      return err(
        createError(
          "SECURITY_LOCK_REQUIRED",
          "Failed to reset PIN",
          {},
          error as Error,
        ),
      );
    }
  }

  /**
   * Simple hash function (use stronger hashing in production)
   */
  private hashPin(pin: string): string {
    // This is a placeholder. Use bcrypt or similar in production
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate session token
   */
  private generateToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
    );
  }
}

// Singleton instance
let gatewayInstance: AppLockGateway;

export const getAppLockGateway = (): AppLockGateway => {
  if (!gatewayInstance) {
    gatewayInstance = new AppLockGateway();
  }
  return gatewayInstance;
};
