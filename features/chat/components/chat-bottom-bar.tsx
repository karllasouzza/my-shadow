import AutoResizingInput from "@/components/ui/auto-resizing-input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { AvailableModel } from "@/shared/ai/types/model-loader";
import React from "react";
import { Platform, ScrollView, View } from "react-native";
import { ModelSelector } from "./model-selector";

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface ChatBottomBarProps {
  value: string;
  onChangeText: (text: string) => void;
  handleCancel: () => void;
  onSend: () => void;
  onVoiceMode?: () => void;
  quickActions?: QuickAction[];
  isGenerating?: boolean;
  isModelReady?: boolean;
  isModelLoading?: boolean;
  className?: string;

  selectedModel: string | null;
  availableModels: AvailableModel[];
  modelError: string | null;
  handleModelSelect: (modelId: string) => void;
}

const defaultQuickActions: QuickAction[] = [
  {
    id: "explain",
    title: "Explicação",
    subtitle: "Me explique como calcular...",
    onPress: () => {},
  },
  {
    id: "plan",
    title: "Planejamento",
    subtitle: "Crie um plano para...",
    onPress: () => {},
  },
  {
    id: "brainstorm",
    title: "Criatividade",
    subtitle: "Me ajude dê ideias criativas para...",
    onPress: () => {},
  },
];

function ChatBottomBar({
  value,
  onChangeText,
  onSend,
  handleCancel,
  onVoiceMode,

  quickActions = defaultQuickActions,
  isGenerating = false,
  isModelReady = true,

  className,

  isModelLoading,
  selectedModel,
  availableModels,
  modelError,
  handleModelSelect,
}: ChatBottomBarProps) {
  const isDisabled = !isModelReady || isGenerating || !value.trim();

  const handleSend = () => {
    if (isDisabled) return;
    onSend();
  };

  if (availableModels.length === 0 && !isModelLoading) return null;

  return (
    <View className={cn("flex w-full bg-background", className)}>
      {quickActions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="px-4 pt-3 gap-2"
        >
          {quickActions.map((action) => (
            <Button
              key={action.id}
              onPress={action.onPress}
              className="flex flex-col items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={action.title}
            >
              <Text className="text-sm text-foreground font-medium">
                {action.title}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {action.subtitle}
              </Text>
            </Button>
          ))}
        </ScrollView>
      )}

      <View className="flex w-full p-3 pt-3">
        <View className="bg-card border border-border rounded-2xl p-3 pt-3">
          {/* Text Input */}
          <AutoResizingInput
            value={value}
            onChangeText={onChangeText}
            minHeight={24}
            placeholder={
              isGenerating
                ? "Aguardando resposta..."
                : !isModelReady
                  ? "Modelo não carregado"
                  : "Pensando em algo?"
            }
            placeholderTextColor={Platform.OS === "ios" ? "#9CA3AF" : undefined}
            editable={isModelReady && !isGenerating}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            accessibilityLabel="Campo de mensagem do chat"
            className="w-full"
          />

          <View className="flex-row items-center justify-between pt-1">
            <ModelSelector
              models={availableModels}
              selectedModelId={selectedModel}
              isLoading={isModelLoading ?? false}
              error={modelError}
              onSelect={handleModelSelect}
            />

            <Button
              onPress={
                isGenerating ? handleCancel : (onVoiceMode ?? handleSend)
              }
              variant={isGenerating ? "destructive" : "default"}
              size="icon"
              accessibilityRole="button"
              accessibilityLabel={
                isGenerating
                  ? "Gerando resposta"
                  : onVoiceMode
                    ? "Modo de voz"
                    : "Enviar mensagem"
              }
            >
              {isGenerating ? (
                <Icon
                  as={require("lucide-react-native").Square}
                  className="text-destructive size-5"
                />
              ) : onVoiceMode ? (
                <Icon
                  as={require("lucide-react-native").Mic}
                  className="text-primary-foreground size-5"
                />
              ) : (
                <Icon
                  as={require("lucide-react-native").ArrowUp}
                  className={cn("text-primary-foreground size-5")}
                />
              )}
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

export { ChatBottomBar, defaultQuickActions };
export type { ChatBottomBarProps, QuickAction };

