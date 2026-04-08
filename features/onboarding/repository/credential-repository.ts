/**
 * Onboarding: Credential repository
 *
 * Manages user credential persistence using MMKV with encryption.
 * Singleton pattern with getRepository() accessor.
 */

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { MMKV, createMMKV } from "react-native-mmkv";
import { UserCredential } from "../model/user-credential";

const CREDENTIAL_KEY = "user_credential";
const FIRST_LAUNCH_KEY = "is_first_launch";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";
const ENCRYPTION_KEY_STORAGE_KEY = "mmkv_encryption_key";

async function getOrCreateEncryptionKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE_KEY);
  if (!key) {
    const randomBytes = Crypto.getRandomBytes(16);
    key = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, key);
  }
  return key;
}

export class CredentialRepository {
  private storage: MMKV;

  private constructor() {
    this.storage = createMMKV({ id: "auth_credentials" });
  }

  static async create(): Promise<CredentialRepository> {
    const repo = new CredentialRepository();
    // Ensure encryption key exists in SecureStore and encrypt MMKV
    const key = await getOrCreateEncryptionKey();
    if (!repo.storage.isEncrypted) {
      repo.storage.encrypt(key);
    }
    return repo;
  }

  /**
   * Save user credential
   */
  save(credential: UserCredential): void {
    this.storage.set(CREDENTIAL_KEY, JSON.stringify(credential));
    this.storage.set(FIRST_LAUNCH_KEY, false);
  }

  /**
   * Get stored user credential, or null if not found
   */
  get(): UserCredential | null {
    const raw = this.storage.getString(CREDENTIAL_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserCredential;
    } catch {
      return null;
    }
  }

  /**
   * Check if this is the first launch
   */
  isFirstLaunch(): boolean {
    return this.storage.getBoolean(FIRST_LAUNCH_KEY) !== false;
  }

  /**
   * Mark first launch as complete
   */
  setFirstLaunchComplete(): void {
    this.storage.set(FIRST_LAUNCH_KEY, false);
  }

  /**
   * Check if biometric authentication is enabled
   */
  isBiometricEnabled(): boolean {
    return this.storage.getBoolean(BIOMETRIC_ENABLED_KEY) || false;
  }

  /**
   * Enable or disable biometric authentication
   */
  setBiometricEnabled(enabled: boolean): void {
    this.storage.set(BIOMETRIC_ENABLED_KEY, enabled);
  }

  /**
   * Verify a password against the stored hash
   * Returns true if the password matches
   */
  async verifyPassword(passwordHash: string): Promise<boolean> {
    const credential = this.get();
    if (!credential) return false;
    return credential.passwordHash === passwordHash;
  }

  /**
   * Update last authenticated timestamp
   */
  updateLastAuthenticatedAt(): void {
    const credential = this.get();
    if (credential) {
      credential.lastAuthenticatedAt = new Date().toISOString();
      this.save(credential);
    }
  }

  /**
   * Clear all stored credentials
   */
  clear(): void {
    this.storage.remove(CREDENTIAL_KEY);
    this.storage.remove(BIOMETRIC_ENABLED_KEY);
  }
}

// Singleton
let instance: CredentialRepository | null = null;

/**
 * Initialize credential repository with encryption.
 * Call once at app startup before using credentials.
 */
export const initCredentialRepository =
  async (): Promise<CredentialRepository> => {
    if (instance) return instance;
    instance = await CredentialRepository.create();
    return instance;
  };

export const getCredentialRepository = (): CredentialRepository => {
  if (!instance) {
    throw new Error(
      "CredentialRepository not initialized. Call initCredentialRepository() first.",
    );
  }
  return instance;
};
