import AutoResizingInput from "@/components/ui/auto-resizing-input";
import { cn } from "@/lib/utils";
import { AvailableModel } from "@/shared/ai/types/model-loader";
import React, { useCallback } from "react";
import { Platform, View } from "react-native";
import { ModelSelector } from "./model-selector";
import QuickActions from "./quick-actions";
import { SendButton } from "./send-button";
import { ThinkingToggle } from "./thinking-toggle";

interface ChatBottomBarProps {
  value: string;
  onChangeText: (text: string) => void;
  handleCancel: () => void;
  onSend: () => void;
  hasContent?: boolean;
  isGenerating?: boolean;
  isModelReady?: boolean;
  isModelLoading?: boolean;
  className?: string;

  selectedModel: string | null;
  availableModels: AvailableModel[];
  modelError: string | null;
  handleModelSelect: (modelId: string) => void;

  thinkingEnabled: boolean;
  toggleThinking: () => void;
}

function ChatBottomBar({
  value,
  onChangeText,
  onSend,
  handleCancel,

  hasContent,
  isGenerating = false,
  isModelReady = true,

  className,

  isModelLoading,
  selectedModel,
  availableModels,
  modelError,
  handleModelSelect,

  thinkingEnabled,
  toggleThinking,
}: ChatBottomBarProps) {
  const isDisabled = !isModelReady || isGenerating || !value.trim();

  const handleSend = () => {
    if (isDisabled) return;
    onSend();
  };

  if (availableModels.length === 0 && !isModelLoading) return null;

  const modelSupportsReasoning = useCallback(() => {
    if (!selectedModel) return false;
    const model = availableModels.find((m) => m.id === selectedModel);
    return model?.supportsReasoning || false;
  }, [selectedModel, availableModels])();

  return (
    <View className={cn("flex w-full p-0 bg-transparent", className)}>
      {!hasContent && <QuickActions />}

      <View className="flex w-full p-3 pt-6  bg-transparent">
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
            className="w-full text-foreground placeholder:text-muted-foreground bg-transparent outline-none"
          />

          <View className="flex-row items-center justify-between pt-1">
            <View className="flex-row items-center gap-2">
              <ModelSelector
                models={availableModels}
                selectedModelId={selectedModel}
                isLoading={isModelLoading ?? false}
                error={modelError}
                onSelect={handleModelSelect}
              />
              {modelSupportsReasoning && (
                <ThinkingToggle
                  enabled={thinkingEnabled}
                  onToggle={toggleThinking}
                />
              )}
            </View>

            <SendButton
              isGenerating={isGenerating}
              hasMessage={!!value.trim() && isModelReady}
              onSend={handleSend}
              onCancel={handleCancel}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export default ChatBottomBar;
