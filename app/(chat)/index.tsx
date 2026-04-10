/**
 * T024-T029, T034-T042: Chat screen with model picker integration
 *
 * Root route of the app. Displays:
 * - ModelSelector in header (tap to open model picker modal)
 * - FlatList of messages + streaming text
 * - ChatInput (disabled while model loading/generating)
 * - Cancel generation button (after 30s)
 * - Empty, loading, error states
 * - Model picker modal for download/select/load
 */
import { ChatInput } from "@/components/chat/chat-input";
import {
  EmptyChatState,
  GeneratingIndicator,
  MessageBubble,
} from "@/components/chat/message-bubble";
import { ModelSelector } from "@/components/chat/model-selector";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import {
  cancelGeneration,
  getChatState,
  loadModelForChat,
  sendMessage,
  syncModelStatus,
} from "@/features/chat/view-model/use-chat-vm";
import {
  ModelPicker,
  type ModelCatalogEntry,
} from "@/features/onboarding/view/model-picker";
import { router, useFocusEffect } from "expo-router";
import { Clock, Square } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/** Model catalog — matches MODEL_CATALOG from onboarding */
const MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    id: "qwen2.5-0.5b-instruct",
    displayName: "Qwen 2.5 0.5B",
    description: "Leve e rápido, ideal para dispositivos com pouca RAM.",
    fileSizeMB: 350,
    estimatedRamMB: 600,
    downloadStatus: "pending",
    downloadProgress: 0,
  },
  {
    id: "qwen2.5-1.5b-instruct",
    displayName: "Qwen 2.5 1.5B",
    description: "Equilíbrio entre qualidade e desempenho.",
    fileSizeMB: 938,
    estimatedRamMB: 1800,
    downloadStatus: "pending",
    downloadProgress: 0,
  },
  {
    id: "qwen2.5-3b-instruct",
    displayName: "Qwen 2.5 3B",
    description: "Maior qualidade, recomendado para 8GB+ RAM.",
    fileSizeMB: 1830,
    estimatedRamMB: 3500,
    downloadStatus: "pending",
    downloadProgress: 0,
  },
];

export default function ChatScreen() {
  const state = getChatState();
  const flatListRef = useRef<FlatList>(null);

  // Local React state — refreshed from Legend State observables
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadedModelName, setLoadedModelName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCancelOption, setShowCancelOption] = useState(false);
  const [_tick, setTick] = useState(0);

  // Model picker state (T034)
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Refresh from Legend State periodically (v3 beta compatibility)
  useEffect(() => {
    function refresh() {
      const conv = state.currentConversation.get();
      setMessages(conv?.messages ?? []);
      setIsModelReady(state.isModelReady.get());
      setIsGenerating(state.isGenerating.get());
      setLoadedModelName(state.loadedModelName.get());
      setErrorMessage(state.errorMessage.get());
      setShowCancelOption(state.showCancelOption.get());
      setTick((t) => t + 1);
    }
    refresh();
    const interval = setInterval(refresh, 200);
    return () => clearInterval(interval);
  }, []);

  const streamingText = state.streamingText.get();

  // Sync model status when screen gains focus
  useFocusEffect(
    useCallback(() => {
      syncModelStatus();
    }, []),
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages.length]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (streamingText) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [streamingText]);

  const handleSend = useCallback(async (text: string) => {
    await sendMessage(text);
  }, []);

  // Open model picker modal
  const handleModelSelectorPress = useCallback(() => {
    setShowModelPicker(true);
  }, []);

  // Handle model selection after download
  const handleModelSelect = useCallback(async (modelId: string) => {
    // Load model into runtime
    // filePath would come from model manager after download
    // For now, use standard path convention
    const filePath = `file://${modelId}.gguf`;
    await loadModelForChat(modelId, filePath);
    setShowModelPicker(false);
  }, []);

  // Handle model download (progress callback integrated in ModelPicker)
  const handleModelDownload = useCallback((modelId: string) => {
    // Trigger download via model manager
    // Progress callback updates ModelPicker UI
    console.log(`[ChatScreen] Download requested for: ${modelId}`);
  }, []);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-card">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.push("/(chat)/history")}
            accessible
            accessibilityLabel="Ver histórico de conversas"
            accessibilityRole="button"
          >
            <Clock size={22} color="#6B7280" />
          </TouchableOpacity>
          <Text className="text-foreground text-lg font-bold">Shadow Chat</Text>
        </View>
        <ModelSelector
          modelName={loadedModelName}
          isModelLoaded={isModelReady}
          onPress={handleModelSelectorPress}
        />
      </View>

      {/* Messages List */}
      {messages.length === 0 && !streamingText ? (
        <EmptyChatState />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => <MessageBubble message={item} />}
          keyExtractor={(_, index) => `msg-${index}`}
          contentContainerClassName="py-4"
          ListFooterComponent={
            isGenerating ? (
              <View>
                <GeneratingIndicator />
                {streamingText ? (
                  <View className="mx-6 mt-1 px-4 py-3 rounded-2xl rounded-bl-md bg-secondary">
                    <Text className="text-foreground text-base">
                      {streamingText}
                    </Text>
                  </View>
                ) : null}
                {showCancelOption && (
                  <TouchableOpacity
                    onPress={cancelGeneration}
                    accessible
                    accessibilityLabel="Cancelar geração"
                    className="mx-6 my-2 flex-row items-center justify-center gap-2 py-2 border border-destructive rounded-lg"
                  >
                    <Square size={14} color="#ef4444" />
                    <Text className="text-destructive text-sm font-medium">
                      Cancelar geração
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null
          }
        />
      )}

      {/* Error banner */}
      {errorMessage && (
        <View className="mx-4 mb-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{errorMessage}</Text>
        </View>
      )}

      {/* Input */}
      <ChatInput
        onSendMessage={handleSend}
        isModelReady={isModelReady}
        isGenerating={isGenerating}
        modelLoadingMessage={!isModelReady ? "Selecione um modelo" : undefined}
      />

      {/* Model Picker Modal */}
      <ModelPicker
        visible={showModelPicker}
        onClose={() => setShowModelPicker(false)}
        models={MODEL_CATALOG}
        onDownload={handleModelDownload}
        onSelect={handleModelSelect}
      />
    </KeyboardAvoidingView>
  );
}
