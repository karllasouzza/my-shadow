import AutoResizingInput from "@/components/ui/auto-resizing-input";
import { Text } from "@/components/ui/text";
import { formatDuration } from "@/features/chat/utils/format-duration";
import type { UseVoiceInputResult } from "@/features/chat/view-model/hooks/useVoiceInput";
import { useVoiceInput } from "@/features/chat/view-model/hooks/useVoiceInput";
import { cn } from "@/lib/utils";
import { AvailableModel } from "@/shared/ai/types/model-loader";
import React, { useCallback } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { ModelSelector } from "./model-selector";
import { NoModelPrompt } from "./no-model-prompt";
import QuickActions from "./quick-actions";
import { ReasoningToggle } from "./reasoning-toggle";
import { RecordingIndicator } from "./recording-indicator";
import { SendButton } from "./send-button";
import { VoiceInputButton } from "./voice-input-button";

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
  selectedWhisperModel: string | null;
  availableModels: AvailableModel[];
  modelError: string | null;
  handleModelSelect: (modelId: string) => void;
  handleWhisperModelSelect: (modelId: string) => void;

  reasoningEnabled: boolean;
  toggleReasoning: () => void;

  /** Optional: pass a pre-created voiceInput result (useful for testing) */
  voiceInput?: UseVoiceInputResult;

  /** Called to navigate to the model download screen */
  onNavigateToModelDownload?: () => void;
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
  selectedWhisperModel,
  availableModels,
  modelError,
  handleModelSelect,
  handleWhisperModelSelect,

  reasoningEnabled,
  toggleReasoning,

  voiceInput: voiceInputProp,
  onNavigateToModelDownload,
}: ChatBottomBarProps) {
  const internalVoiceInput = useVoiceInput({
    onTranscriptReady: (text) => {
      onChangeText(text);
      onSend();
    },
    onNavigateToModelDownload: onNavigateToModelDownload ?? (() => {}),
  });

  const voiceInput = voiceInputProp ?? internalVoiceInput;

  const {
    status: voiceStatus,
    partialTranscript,
    recordingDurationSeconds,
    isCancelPreview,
    noModelPromptVisible,
    errorMessage,
    onTap,
    dismissNoModelPrompt,
    confirmModelDownload,
  } = voiceInput;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isRecording = voiceStatus === "recording";
  const isProcessing = voiceStatus === "processing";
  const showVoiceButton = value.trim().length === 0;
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View className={cn("flex gap-6 bg-transparent p-0 w-full", className)}>
      {!hasContent && <QuickActions />}

      <View className="flex bg-transparent p-3 pt-0 w-full">
        <View className="bg-card p-3 border border-border rounded-2xl">
          {/* Text Input — shows partial transcript (italic/dimmed) while recording */}
          <AutoResizingInput
            value={isRecording ? partialTranscript : value}
            onChangeText={isRecording ? () => {} : onChangeText}
            minHeight={24}
            placeholder={
              isGenerating
                ? "Aguardando resposta..."
                : !isModelReady
                  ? "Modelo não carregado"
                  : "Pensando em algo?"
            }
            placeholderTextColor={Platform.OS === "ios" ? "#9CA3AF" : undefined}
            editable={isModelReady && !isGenerating && !isRecording}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            accessibilityLabel="Campo de mensagem do chat"
            className={cn(
              "bg-transparent outline-none w-full text-foreground placeholder:text-muted-foreground",
              isRecording && "italic opacity-60",
            )}
          />

          {/* Recording status row: duration + cancel hint + indicator */}
          {isRecording && (
            <View className="flex-row items-center gap-2 pt-1">
              <RecordingIndicator
                visible={isRecording}
                cancelPreview={isCancelPreview}
              />
              <Text className="text-muted-foreground text-xs">
                {`Gravando… ${formatDuration(recordingDurationSeconds)}`}
              </Text>
              <Text className="ml-auto text-muted-foreground text-xs">
                ← Deslize para cancelar
              </Text>
            </View>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <View className="flex-row items-center gap-2 pt-1">
              <ActivityIndicator size="small" />
              <Text className="text-muted-foreground text-xs">
                Processando…
              </Text>
            </View>
          )}

          {/* Inline error message */}
          {errorMessage !== null && (
            <Text className="pt-1 text-destructive text-xs">
              {errorMessage}
            </Text>
          )}

          <View className="flex-row justify-between items-center pt-1">
            <View className="flex-row items-center gap-2">
              <ModelSelector
                models={availableModels}
                selectedModelId={selectedModel}
                selectedWhisperModelId={selectedWhisperModel}
                isLoading={isModelLoading ?? false}
                error={modelError}
                onSelectLlm={handleModelSelect}
                onSelectWhisper={handleWhisperModelSelect}
              />
              {modelSupportsReasoning && (
                <ReasoningToggle
                  enabled={reasoningEnabled}
                  onToggle={toggleReasoning}
                />
              )}
            </View>

            {/* Conditionally render VoiceInputButton or SendButton */}
            {showVoiceButton ? (
              <VoiceInputButton
                status={voiceStatus}
                isCancelPreview={isCancelPreview}
                onTap={onTap}
              />
            ) : (
              <SendButton
                isGenerating={isGenerating}
                hasMessage={!!value.trim() && isModelReady}
                onSend={handleSend}
                onCancel={handleCancel}
              />
            )}
          </View>
        </View>
      </View>

      {/* No-model prompt (AlertDialog) */}
      <NoModelPrompt
        visible={noModelPromptVisible}
        onConfirm={confirmModelDownload}
        onDismiss={dismissNoModelPrompt}
      />
    </View>
  );
}

export default ChatBottomBar;
