/**
 * T029/T034: Chat screen
 *
 * FlatList of messages + streaming text.
 * ChatInput at bottom. GeneratingIndicator during generation.
 * Cancel button after 30s (PF-005).
 *
 * T034: 6 UX states — empty, no model loaded, model loading, generating, error, populated
 */
import { ChatInput } from "@/features/chat/components/chat-input";
import { EmptyChat } from "@/features/chat/components/empty-chat";
import { GeneratingIndicator } from "@/features/chat/components/generating-indicator";
import { MessageBubble } from "@/features/chat/components/message-bubble";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import {
    cancelGeneration,
    getChatState,
    sendMessage,
    syncModelStatus,
} from "@/features/chat/view-model/use-chat-vm";
import { Square } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export function ChatScreen() {
  const state = getChatState();
  const flatListRef = useRef<FlatList>(null);

  // Local React state — refreshed from Legend State observables
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCancelOption, setShowCancelOption] = useState(false);
  const [_tick, setTick] = useState(0);

  // Refresh from Legend State periodically (v3 beta compatibility)
  useEffect(() => {
    function refresh() {
      const conv = state.currentConversation.get();
      setMessages(conv?.messages ?? []);
      setIsModelReady(state.isModelReady.get());
      setIsGenerating(state.isGenerating.get());
      setErrorMessage(state.errorMessage.get());
      setShowCancelOption(state.showCancelOption.get());
      setTick((t) => t + 1);
    }
    refresh();
    const interval = setInterval(refresh, 200);
    return () => clearInterval(interval);
  }, []);

  // Sync model status on mount
  useEffect(() => {
    syncModelStatus();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [messages.length]);

  // Auto-scroll during streaming
  const streamingText = state.streamingText.get();
  useEffect(() => {
    if (streamingText) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [streamingText]);

  const handleSend = async (text: string) => {
    await sendMessage(text);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* T034: UX States */}
      {messages.length === 0 && !streamingText && !isGenerating ? (
        /* State: empty OR no model loaded */
        !isModelReady ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-foreground text-xl font-semibold mb-2">
              Nenhum modelo carregado
            </Text>
            <Text className="text-muted text-center text-base">
              Vá para a aba Modelos para selecionar e carregar um modelo GGUF.
            </Text>
          </View>
        ) : (
          <EmptyChat />
        )
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => <MessageBubble message={item} />}
          keyExtractor={(_, index) => `msg-${index}`}
          contentContainerClassName="py-4"
          ListFooterComponent={
            <View>
              {/* State: generating */}
              {isGenerating && <GeneratingIndicator />}
              {/* Streaming text display */}
              {streamingText ? (
                <View className="mx-4 mt-1 px-4 py-3 rounded-2xl rounded-bl-md bg-secondary">
                  <Text className="text-foreground text-base">
                    {streamingText}
                  </Text>
                </View>
              ) : null}
              {/* T033: Cancel generation button (after 30s) */}
              {showCancelOption && isGenerating && (
                <TouchableOpacity
                  onPress={cancelGeneration}
                  accessible
                  accessibilityLabel="Cancelar geração"
                  className="mx-4 my-2 flex-row items-center justify-center gap-2 py-2 border border-destructive rounded-lg"
                >
                  <Square size={14} color="#ef4444" />
                  <Text className="text-destructive text-sm font-medium">
                    Cancelar geração
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* State: error */}
      {errorMessage && (
        <View className="mx-4 mb-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{errorMessage}</Text>
        </View>
      )}

      {/* Chat input */}
      <ChatInput
        onSendMessage={handleSend}
        isModelReady={isModelReady}
        isGenerating={isGenerating}
      />
    </KeyboardAvoidingView>
  );
}
