/**
 * Onboarding: Security Gate ViewModel
 *
 * Manages authentication state and actions for the security gate screen.
 * Handles first-time password creation and returning user authentication.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getCredentialRepository,
} from '../repository/credential-repository';
import {
  generateSalt,
  hashPassword,
  validatePassword,
} from '../model/user-credential';

export type SecurityGateMode = 'firstTime' | 'returning';

export interface SecurityGateState {
  mode: SecurityGateMode;
  passwordInput: string;
  confirmPassword: string;
  isLoading: boolean;
  error: string | null;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  biometricEnrolled: boolean;
  showBiometricToggle: boolean;
  success: boolean;
}

export interface UseSecurityGateVm {
  state: SecurityGateState;
  actions: {
    setPasswordInput: (value: string) => void;
    setConfirmPassword: (value: string) => void;
    createPassword: () => Promise<void>;
    authenticatePassword: () => Promise<void>;
    authenticateBiometric: () => Promise<boolean>;
    enableBiometric: () => Promise<void>;
    clearError: () => void;
  };
}

export const useSecurityGateVm = (): UseSecurityGateVm => {
  const credentialRepo = getCredentialRepository();

  const [state, setState] = useState<SecurityGateState>({
    mode: 'firstTime',
    passwordInput: '',
    confirmPassword: '',
    isLoading: true,
    error: null,
    biometricEnabled: false,
    biometricAvailable: false,
    biometricEnrolled: false,
    showBiometricToggle: false,
    success: false,
  });

  // Initialize: determine mode and biometric capabilities
  useEffect(() => {
    const init = async () => {
      const isFirstLaunch = credentialRepo.isFirstLaunch();
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const isBiometricEnabled = credentialRepo.isBiometricEnabled();

      setState((s) => ({
        ...s,
        mode: isFirstLaunch ? 'firstTime' : 'returning',
        biometricAvailable: hasHardware,
        biometricEnrolled: isEnrolled,
        biometricEnabled: isBiometricEnabled,
        showBiometricToggle: hasHardware && isEnrolled,
        isLoading: false,
      }));
    };

    init();
  }, []);

  const setPasswordInput = useCallback((value: string) => {
    setState((s) => ({ ...s, passwordInput: value, error: null }));
  }, []);

  const setConfirmPassword = useCallback((value: string) => {
    setState((s) => ({ ...s, confirmPassword: value, error: null }));
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const createPassword = useCallback(async () => {
    const { passwordInput, confirmPassword } = state;

    // Validate password
    const validation = validatePassword(passwordInput);
    if (!validation.valid) {
      setState((s) => ({ ...s, error: validation.error ?? 'Senha invalida.' }));
      return;
    }

    // Check confirmation match
    if (passwordInput !== confirmPassword) {
      setState((s) => ({ ...s, error: 'As senhas nao coincidem.' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const salt = generateSalt();
      const passwordHash = await hashPassword(passwordInput, salt);

      const credential = {
        passwordHash,
        passwordSalt: salt,
        biometricEnabled: false,
        isFirstLaunch: false,
        createdAt: new Date().toISOString(),
        lastAuthenticatedAt: new Date().toISOString(),
      };

      credentialRepo.save(credential);
      credentialRepo.setFirstLaunchComplete();

      setState((s) => ({
        ...s,
        isLoading: false,
        success: true,
        mode: 'returning',
      }));
    } catch {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Erro ao criar senha. Tente novamente.',
      }));
    }
  }, [state.passwordInput, state.confirmPassword]);

  const authenticatePassword = useCallback(async () => {
    const { passwordInput } = state;

    if (!passwordInput) {
      setState((s) => ({ ...s, error: 'Digite sua senha.' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const credential = credentialRepo.get();
      if (!credential) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: 'Nenhuma senha configurada. Reinicie o aplicativo.',
        }));
        return;
      }

      const salt = credential.passwordSalt;
      const inputHash = await hashPassword(passwordInput, salt);
      const isValid = await credentialRepo.verifyPassword(inputHash);

      if (isValid) {
        credentialRepo.updateLastAuthenticatedAt();
        setState((s) => ({ ...s, isLoading: false, success: true }));
      } else {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: 'Senha incorreta. Tente novamente.',
        }));
      }
    } catch {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Erro ao autenticar. Tente novamente.',
      }));
    }
  }, [state.passwordInput]);

  const authenticateBiometric = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Autenticar com biometria',
        fallbackLabel: 'Usar senha',
        disableDeviceFallback: true,
      });

      if (result.success) {
        credentialRepo.updateLastAuthenticatedAt();
        setState((s) => ({ ...s, isLoading: false, success: true }));
        return true;
      }

      if (result.error === 'user_cancel' || result.error === 'lockout') {
        setState((s) => ({
          ...s,
          isLoading: false,
          error:
            result.error === 'lockout'
              ? 'Muitas tentativas falhas. Tente novamente mais tarde.'
              : 'Autenticacao cancelada.',
        }));
      } else {
        setState((s) => ({ ...s, isLoading: false }));
      }

      return result.success;
    } catch {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Erro ao autenticar com biometria.',
      }));
      return false;
    }
  }, []);

  const enableBiometric = useCallback(async () => {
    if (!state.biometricAvailable || !state.biometricEnrolled) {
      setState((s) => ({
        ...s,
        error: 'Biometria nao disponivel neste dispositivo.',
      }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      // Require biometric auth to enable the feature
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Ativar autenticacao biometrica',
        fallbackLabel: 'Cancelar',
        disableDeviceFallback: true,
      });

      if (result.success) {
        credentialRepo.setBiometricEnabled(true);
        setState((s) => ({
          ...s,
          isLoading: false,
          biometricEnabled: true,
        }));
      } else {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: 'Autenticacao necessaria para ativar biometria.',
        }));
      }
    } catch {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: 'Erro ao ativar biometria.',
      }));
    }
  }, [state.biometricAvailable, state.biometricEnrolled]);

  return {
    state,
    actions: {
      setPasswordInput,
      setConfirmPassword,
      createPassword,
      authenticatePassword,
      authenticateBiometric,
      enableBiometric,
      clearError,
    },
  };
};
