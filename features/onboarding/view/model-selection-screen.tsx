/**
 * Onboarding: Model Selection Screen
 *
 * Shadow Jung themed (dark purple/gold) model selection interface.
 * Lists compatible models with name, description, size, RAM estimate.
 * Recommended model highlighted with accent color border.
 * Incompatible models shown disabled with reason.
 * Download progress bar with cancel button.
 * All text in Brazilian Portuguese.
 */

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { usePreventRemove } from "@react-navigation/native";
import type { RelativePathString } from "expo-router";
import { useRouter } from "expo-router";
import { Loader2 } from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import {
  useModelSelectionVm,
  type ModelItem,
} from "../view-model/use-model-selection-vm";

export const ModelSelectionScreen: React.FC = () => {
  const { state, actions } = useModelSelectionVm();
  const router = useRouter();

  // Block back button during active download
  usePreventRemove(
    state.isDownloading,
    useCallback(
      (event: { data: { action: { type: string } } }) => {
        const action = event.data.action;
        if (action?.type === "GO_BACK" || action?.type === "NAVIGATE") {
          actions.cancelDownload();
        }
      },
      [actions.cancelDownload],
    ),
  );

  // Signal download complete - OnboardingRouter will detect and re-render
  useEffect(() => {
    if (state.downloadComplete && state.selectedModel) {
      const timer = setTimeout(() => {
        // Navigate to /onboarding; OnboardingRouter will detect model is ready
        // and show the loading screen based on getInitialRoute()
        router.replace("/onboarding" as RelativePathString);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [state.downloadComplete, state.selectedModel]);

  const handleDownload = useCallback(async () => {
    await actions.startDownload();
  }, [actions.startDownload]);

  const handleCancelDownload = useCallback(() => {
    actions.cancelDownload();
  }, [actions.cancelDownload]);

  const handleRetryDownload = useCallback(async () => {
    await actions.retryDownload();
  }, [actions.retryDownload]);

  if (state.isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Icon as={Loader2} className="text-primary size-6" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-6 pb-4">
        <Text variant="h3" className="text-accent tracking-wide">
          Escolha seu Modelo
        </Text>
        <Text variant="muted" className="mt-2">
          Selecione um modelo de IA para rodar localmente no seu dispositivo.
          Modelos maiores oferecem melhor qualidade, mas exigem mais memoria.
        </Text>
      </View>

      {/* Error Display */}
      {state.error && (
        <View className="mx-6 mb-4 bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <Text className="text-destructive text-sm text-center">
            {state.error}
          </Text>
        </View>
      )}

      {/* Model List */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-6">
          {state.compatibleModels.map((model) => (
            <ModelCard
              key={model.key}
              model={model}
              isSelected={state.selectedModel?.key === model.key}
              isDownloading={
                state.isDownloading && state.selectedModel?.key === model.key
              }
              downloadProgress={
                state.selectedModel?.key === model.key
                  ? state.downloadProgress
                  : 0
              }
              onSelect={() => actions.selectModel(model)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Download Progress Section */}
      {state.isDownloading && state.selectedModel && (
        <View className="mx-6 mb-4 bg-card border border-border rounded-lg p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text variant="small" className="text-foreground flex-1 mr-3">
              Baixando {state.selectedModel.name}...
            </Text>
            <Text variant="small" className="text-primary font-medium">
              {Math.round(state.downloadProgress)}%
            </Text>
          </View>

          {/* Progress Bar */}
          <View className="h-2 bg-secondary rounded-full overflow-hidden mb-3">
            <View
              className="h-full bg-primary rounded-full"
              style={{
                width: `${Math.min(state.downloadProgress, 100)}%`,
              }}
            />
          </View>

          {/* Cancel Button */}
          <Button
            variant="destructive"
            size="sm"
            onPress={handleCancelDownload}
          >
            <Text className="text-destructive-foreground text-sm font-medium">
              Cancelar Download
            </Text>
          </Button>
        </View>
      )}

      {/* Action Buttons */}
      <View className="px-6 pb-4">
        {state.downloadComplete ? (
          <Button
            variant="default"
            size="lg"
            onPress={() => router.replace("/onboarding" as RelativePathString)}
            className="bg-primary"
          >
            <Text className="text-primary-foreground font-semibold text-base">
              Proximo: Carregar Modelo
            </Text>
          </Button>
        ) : state.isDownloading ? null : state.selectedModel &&
          state.selectedModel.isDownloaded ? (
          <Button
            variant="default"
            size="lg"
            onPress={handleDownload}
            className="bg-primary"
          >
            <Text className="text-primary-foreground font-semibold text-base">
              Recarregar Modelo
            </Text>
          </Button>
        ) : (
          <Button
            variant="default"
            size="lg"
            disabled={
              !state.selectedModel ||
              !state.selectedModel.isCompatible ||
              state.downloadProgress > 0
            }
            onPress={handleDownload}
            className="bg-primary"
          >
            {state.downloadProgress > 0 && state.downloadProgress < 100 ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="hsl(0, 0%, 100%)" />
                <Text className="text-primary-foreground font-semibold text-base">
                  Baixando... {Math.round(state.downloadProgress)}%
                </Text>
              </View>
            ) : (
              <Text className="text-primary-foreground font-semibold text-base">
                Baixar e Continuar
              </Text>
            )}
          </Button>
        )}

        {!state.isDownloading &&
          state.downloadProgress > 0 &&
          state.downloadProgress < 100 && (
            <View className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onPress={handleRetryDownload}
                className="border-border"
              >
                <Text className="text-foreground text-sm">
                  Tentar Novamente
                </Text>
              </Button>
            </View>
          )}
      </View>
    </View>
  );
};

interface ModelCardProps {
  model: ModelItem;
  isSelected: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  onSelect: () => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isSelected,
  isDownloading,
  downloadProgress,
  onSelect,
}) => {
  const isDisabled = !model.isCompatible;

  return (
    <Pressable
      onPress={!isDisabled ? onSelect : undefined}
      disabled={isDisabled}
      className={cn(
        "rounded-lg p-4 border",
        model.isRecommended && !isDisabled
          ? "border-accent bg-card"
          : isSelected
            ? "border-primary bg-card"
            : "border-border bg-card",
        isDisabled && "opacity-50",
      )}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <View className="flex-row items-center gap-2 mb-1">
            <Text
              variant="h4"
              className={cn(
                model.isRecommended && !isDisabled
                  ? "text-accent"
                  : "text-foreground",
              )}
            >
              {model.name}
            </Text>
            {model.isRecommended && !isDisabled && (
              <View className="bg-accent/20 rounded-full px-2 py-0.5">
                <Text className="text-accent text-xs font-medium">
                  Recomendado
                </Text>
              </View>
            )}
            {model.isDownloaded && (
              <View className="bg-primary/20 rounded-full px-2 py-0.5">
                <Text className="text-primary text-xs font-medium">
                  Baixado
                </Text>
              </View>
            )}
          </View>

          <Text variant="muted" className="mt-1">
            {model.description}
          </Text>

          <View className="flex-row mt-3 gap-4">
            <View>
              <Text variant="muted" className="text-xs">
                Tamanho
              </Text>
              <Text variant="small" className="text-foreground mt-0.5">
                {formatBytes(model.fileSizeBytes)}
              </Text>
            </View>
            <View>
              <Text variant="muted" className="text-xs">
                RAM estimada
              </Text>
              <Text variant="small" className="text-foreground mt-0.5">
                {formatBytes(model.estimatedRamBytes)}
              </Text>
            </View>
            <View>
              <Text variant="muted" className="text-xs">
                Quantizacao
              </Text>
              <Text variant="small" className="text-foreground mt-0.5">
                {model.quantization}
              </Text>
            </View>
          </View>
        </View>

        {!isDisabled && (
          <View
            className={cn(
              "w-5 h-5 rounded-full border-2 justify-center items-center",
              isSelected ? "border-accent bg-accent" : "border-border",
            )}
          >
            {isSelected && <View className="w-2 h-2 rounded-full bg-accent" />}
          </View>
        )}
      </View>

      {isDownloading && (
        <View className="mt-3">
          <View className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{
                width: `${Math.min(downloadProgress, 100)}%`,
              }}
            />
          </View>
        </View>
      )}

      {isDisabled && model.incompatibilityReason && (
        <View className="mt-3 bg-muted/50 rounded-md p-2">
          <Text className="text-muted-foreground text-xs">
            {model.incompatibilityReason}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function cn(...inputs: (string | false | undefined | null)[]): string {
  return inputs.filter(Boolean).join(" ");
}

export default ModelSelectionScreen;
