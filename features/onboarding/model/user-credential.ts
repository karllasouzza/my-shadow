/**
 * Onboarding: User credential domain model
 *
 * Defines the credential interface and password validation/hashing utilities
 * using expo-crypto for secure password storage.
 */

import * as Crypto from 'expo-crypto';

export interface UserCredential {
  passwordHash: string;
  passwordSalt: string;
  biometricEnabled: boolean;
  isFirstLaunch: boolean;
  createdAt: string;
  lastAuthenticatedAt: string | null;
}

/**
 * Validate password meets minimum requirements
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length === 0) {
    return { valid: false, error: 'A senha nao pode estar vazia.' };
  }

  if (password.length < 6) {
    return { valid: false, error: 'A senha deve ter no minimo 6 caracteres.' };
  }

  return { valid: true };
}

/**
 * Generate a random 16-character hex salt
 */
export function generateSalt(): string {
  const bytes = Crypto.getRandomBytes(8);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a password with the given salt using expo-crypto SHA-256
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const combined = `${salt}:${password}`;
  const hashBuffer = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    combined
  );
  return hashBuffer;
}
