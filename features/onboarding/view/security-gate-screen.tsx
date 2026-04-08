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
  ScrollView,
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

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      await actions.enableBiometric();
    }
  };

  const disabled = state.isLoading;

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{
          justifyContent: "center",
          flexGrow: 1,
          paddingVertical: 32,
        }}
        keyboardShouldPersistTaps="handled"
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
          {state.isLoading && (
            <View className="mt-4">
              <ActivityIndicator size="large" color="hsl(277, 65%, 48%)" />
            </View>
          )}
        </View>

        {/* Error Display */}
        {state.error && (
          <View className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6">
            <Text className="text-destructive text-sm text-center">
              {state.error}
            </Text>
          </View>
        )}

        {state.mode === "firstTime" ? (
          /* FIRST TIME: Create Password */
          <View className="gap-4" style={{ opacity: disabled ? 0.5 : 1 }}>
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
                  editable={!disabled}
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
                  editable={!disabled}
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
                  disabled={disabled}
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

            <Button
              onPress={handleCreatePassword}
              disabled={disabled}
              className="mt-6 bg-primary"
              size="lg"
            >
              <Text className="text-primary-foreground font-semibold text-base">
                Criar Senha
              </Text>
            </Button>
          </View>
        ) : (
          /* RETURNING: Authenticate */
          <View className="gap-4" style={{ opacity: disabled ? 0.5 : 1 }}>
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
                  editable={!disabled}
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

            <Button
              onPress={handleAuthenticatePassword}
              disabled={disabled || !state.passwordInput}
              className="bg-primary"
              size="lg"
            >
              <Text className="text-primary-foreground font-semibold text-base">
                Entrar
              </Text>
            </Button>

            {state.biometricEnabled && state.biometricEnrolled && (
              <Button
                onPress={handleBiometricAuth}
                disabled={disabled}
                variant="outline"
                className="border-accent mt-2"
                size="lg"
              >
                <Text className="text-accent font-semibold text-base">
                  Usar Biometria
                </Text>
              </Button>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SecurityGateScreen;
