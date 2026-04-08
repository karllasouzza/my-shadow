/**
 * Onboarding: Security Gate Screen
 *
 * Shadow Jung themed authentication screen (dark purple/gold).
 * First-time: password creation + confirm + biometric enrollment toggle.
 * Returning: password input OR biometric prompt button.
 * All text in Brazilian Portuguese.
 */

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { RelativePathString } from "expo-router";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSecurityGateVm } from "../view-model/use-security-gate-vm";

export const SecurityGateScreen: React.FC = () => {
  const { state, actions } = useSecurityGateVm();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [returningPasswordVisible, setReturningPasswordVisible] =
    useState(false);

  // Navigate when authentication succeeds
  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        router.replace("/onboarding" as RelativePathString);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  const handleCreatePassword = async () => {
    await actions.createPassword();
  };

  const handleAuthenticatePassword = async () => {
    await actions.authenticatePassword();
  };

  const handleBiometricAuth = async () => {
    await actions.authenticateBiometric();
  };

  const handleEnableBiometric = async () => {
    await actions.enableBiometric();
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      await handleEnableBiometric();
    }
  };

  if (
    state.isLoading &&
    state.mode === "firstTime" &&
    !state.error &&
    !state.success
  ) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="hsl(277, 65%, 48%)" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <View
        className="flex-1 justify-center px-6"
        style={{
          paddingBottom: insets.bottom + 24,
          paddingTop: insets.top + 48,
        }}
      >
        {/* Header */}
        <View className="items-center mb-10">
          <Text className="text-3xl font-bold text-accent tracking-wide">
            My Shadow
          </Text>
          <Text className="text-muted-foreground text-sm mt-2 text-center">
            {state.mode === "firstTime"
              ? "Configure sua senha para proteger suas reflexoes"
              : "Insira sua senha para continuar"}
          </Text>
        </View>

        {/* Error Display */}
        {state.error && (
          <View className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
            <Text className="text-destructive text-sm text-center">
              {state.error}
            </Text>
          </View>
        )}

        {/* Success - redirect handled by parent */}

        {state.mode === "firstTime" ? (
          /* FIRST TIME: Create Password */
          <View className="gap-4">
            {/* Password Input */}
            <View>
              <Text className="text-foreground text-sm font-medium mb-2">
                Senha
              </Text>
              <View className="flex-row items-center bg-card border border-border rounded-lg px-4">
                <TextInput
                  value={state.passwordInput}
                  onChangeText={actions.setPasswordInput}
                  placeholder="Minimo 6 caracteres"
                  placeholderTextColor="hsl(240, 5%, 60%)"
                  secureTextEntry={!passwordVisible}
                  className="flex-1 text-foreground py-3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onPress={() => setPasswordVisible(!passwordVisible)}
                  className="ml-1"
                >
                  <Text className="text-muted-foreground text-xs">
                    {passwordVisible ? "Ocultar" : "Exibir"}
                  </Text>
                </Button>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View>
              <Text className="text-foreground text-sm font-medium mb-2">
                Confirmar Senha
              </Text>
              <View className="flex-row items-center bg-card border border-border rounded-lg px-4">
                <TextInput
                  value={state.confirmPassword}
                  onChangeText={actions.setConfirmPassword}
                  placeholder="Digite a senha novamente"
                  placeholderTextColor="hsl(240, 5%, 60%)"
                  secureTextEntry={!confirmVisible}
                  className="flex-1 text-foreground py-3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onPress={() => setConfirmVisible(!confirmVisible)}
                  className="ml-1"
                >
                  <Text className="text-muted-foreground text-xs">
                    {confirmVisible ? "Ocultar" : "Exibir"}
                  </Text>
                </Button>
              </View>
            </View>

            {/* Biometric Toggle */}
            {state.showBiometricToggle && (
              <View className="flex-row items-center justify-between bg-card border border-border rounded-lg p-4 mt-2">
                <View className="flex-1 mr-4">
                  <Text className="text-foreground text-sm font-medium">
                    Autenticacao Biometrica
                  </Text>
                  <Text className="text-muted-foreground text-xs mt-1">
                    Use sua digital ou rosto para acessar
                  </Text>
                </View>
                <Switch
                  value={state.biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{
                    false: "hsl(240, 4%, 16%)",
                    true: "hsl(277, 65%, 48%)",
                  }}
                  thumbColor={
                    state.biometricEnabled
                      ? "hsl(40, 65%, 58%)"
                      : "hsl(240, 5%, 60%)"
                  }
                />
              </View>
            )}

            {/* Create Button */}
            <Button
              onPress={handleCreatePassword}
              disabled={state.isLoading}
              className="mt-6 bg-primary"
              size="lg"
            >
              {state.isLoading ? (
                <ActivityIndicator size="small" color="hsl(0, 0%, 100%)" />
              ) : (
                <Text className="text-primary-foreground font-semibold text-base">
                  Criar Senha
                </Text>
              )}
            </Button>
          </View>
        ) : (
          /* RETURNING: Authenticate */
          <View className="gap-4">
            {/* Password Input */}
            <View>
              <Text className="text-foreground text-sm font-medium mb-2">
                Senha
              </Text>
              <View className="flex-row items-center bg-card border border-border rounded-lg px-4">
                <TextInput
                  value={state.passwordInput}
                  onChangeText={actions.setPasswordInput}
                  placeholder="Digite sua senha"
                  placeholderTextColor="hsl(240, 5%, 60%)"
                  secureTextEntry={!returningPasswordVisible}
                  className="flex-1 text-foreground py-3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  onSubmitEditing={handleAuthenticatePassword}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onPress={() =>
                    setReturningPasswordVisible(!returningPasswordVisible)
                  }
                  className="ml-1"
                >
                  <Text className="text-muted-foreground text-xs">
                    {returningPasswordVisible ? "Ocultar" : "Exibir"}
                  </Text>
                </Button>
              </View>
            </View>

            {/* Authenticate Button */}
            <Button
              onPress={handleAuthenticatePassword}
              disabled={state.isLoading || !state.passwordInput}
              className="bg-primary"
              size="lg"
            >
              {state.isLoading ? (
                <ActivityIndicator size="small" color="hsl(0, 0%, 100%)" />
              ) : (
                <Text className="text-primary-foreground font-semibold text-base">
                  Entrar
                </Text>
              )}
            </Button>

            {/* Biometric Button */}
            {state.biometricEnabled && state.biometricEnrolled && (
              <Button
                onPress={handleBiometricAuth}
                disabled={state.isLoading}
                variant="outline"
                className="border-accent mt-2"
                size="lg"
              >
                {state.isLoading ? (
                  <ActivityIndicator size="small" color="hsl(40, 65%, 58%)" />
                ) : (
                  <Text className="text-accent font-semibold text-base">
                    Usar Biometria
                  </Text>
                )}
              </Button>
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default SecurityGateScreen;
