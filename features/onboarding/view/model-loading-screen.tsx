/**
 * Onboarding: Model Loading Screen
 *
 * Full-screen centered layout with activity indicator.
 * Shows model name being loaded.
 * usePreventRemove blocks back button during loading.
 * On failure: error message + retry button + cancel button.
 * On success: brief checkmark -> auto-navigate after 500ms.
 * All text in Brazilian Portuguese.
 */

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { usePreventRemove } from "@react-navigation/native";
import { router } from "expo-router";
import { Loader2 } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import { View } from "react-native";
import { useModelLoadingVm } from "../view-model/use-model-loading-vm";

export const ModelLoadingScreen: React.FC = () => {
  const { state, actions } = useModelLoadingVm();

  // Block back button during loading
  usePreventRemove(
    state.isLoading,
    useCallback(
      (event: any) => {
        const action = event?.data?.action;
        if (action?.type === "GO_BACK" || action?.type === "NAVIGATE") {
          // Prevent the navigation (back) while loading and cancel the operation
          event?.preventDefault?.();
          actions.cancel();
        }
        return void 0;
      },
      [actions.cancel],
    ),
  );

  // Auto-navigate on success after 500ms
  useEffect(() => {
    if (state.loadStatus === "success") {
      const timer = setTimeout(() => {
        router.replace("/");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.loadStatus]);

  const handleRetry = async () => {
    await actions.retryLoad();
  };

  const handleCancel = () => {
    actions.cancel();
  };

  const handleGoBack = () => {
    router.replace("/onboarding?route=model-selection");
  };

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      {/* Loading State */}
      {state.loadStatus === "loading" && (
        <View className="items-center">
          <Icon as={Loader2} className="text-primary size-6" />

          {state.modelName && (
            <Text variant="h4" className="text-foreground mt-8 text-center">
              Carregando {state.modelName}
            </Text>
          )}

          <Text variant="muted" className="mt-3 text-center">
            Preparando o modelo de IA para uso local. Isso pode levar alguns
            instantes.
          </Text>

          {/* Progress Bar */}
          <View className="w-full mt-8">
            <View className="h-2 bg-secondary rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{
                  width: `${Math.min(state.loadProgress, 100)}%`,
                }}
              />
            </View>
            <Text variant="muted" className="text-center mt-2 text-xs">
              {Math.round(state.loadProgress)}%
            </Text>
          </View>

          <Button
            variant="outline"
            size="sm"
            onPress={handleCancel}
            className="mt-6 border-border"
          >
            <Text className="text-foreground text-sm">Cancelar</Text>
          </Button>
        </View>
      )}

      {/* Success State */}
      {state.loadStatus === "success" && (
        <View className="items-center">
          <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mb-6">
            <Text className="text-primary text-3xl">{"\u2713"}</Text>
          </View>

          <Text variant="h3" className="text-accent text-center">
            Modelo Carregado!
          </Text>

          <Text variant="muted" className="mt-3 text-center">
            Seu modelo de IA está pronto para uso. Iniciando a experiência My
            Shadow...
          </Text>
        </View>
      )}

      {/* Failed State */}
      {state.loadStatus === "failed" && (
        <View className="items-center w-full max-w-sm">
          <View className="w-16 h-16 rounded-full bg-destructive/20 items-center justify-center mb-6">
            <Text className="text-destructive text-3xl">{"\u2717"}</Text>
          </View>

          <Text variant="h3" className="text-destructive text-center">
            Falha ao Carregar
          </Text>

          {state.errorMessage && (
            <View className="w-full mt-4 bg-destructive/10 border border-destructive/30 rounded-lg p-4">
              <Text className="text-destructive text-sm text-center">
                {state.errorMessage}
              </Text>
            </View>
          )}

          <View className="w-full mt-8 gap-3">
            <Button
              variant="default"
              size="lg"
              onPress={handleRetry}
              className="bg-primary"
            >
              <Text className="text-primary-foreground font-semibold text-base">
                Tentar Novamente
              </Text>
            </Button>

            <Button
              variant="outline"
              size="lg"
              onPress={handleGoBack}
              className="border-border"
            >
              <Text className="text-foreground text-base">
                Voltar para Seleção
              </Text>
            </Button>
          </View>
        </View>
      )}
    </View>
  );
};

export default ModelLoadingScreen;
