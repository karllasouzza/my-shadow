/**
 * T029/T034: Chat screen — wrapped with Legend State observer
 *
 * FlatList of messages + streaming text.
 * ChatInput at bottom. GeneratingIndicator during generation.
 * Cancel button after 30s (PF-005).
 *
 * T034: 6 UX states — empty, no model loaded, model loading, generating, error, populated
 *
 * Fix: Wrapped in observer() from @legendapp/state/react to prevent infinite re-renders.
 * Removed polling setInterval — observer tracks observables automatically.
 */
import { ChatInput } from "@/features/chat/components/chat-input";
import { EmptyChat } from "@/features/chat/components/empty-chat";
import { GeneratingIndicator } from "@/features/chat/components/generating-indicator";
import { MessageBubble } from "@/features/chat/components/message-bubble";
import {
  cancelGeneration,
  getChatState,
  sendMessage,
  syncModelStatus,
} from "@/features/chat/view-model/use-chat-vm";
import { observer } from "@legendapp/state/react";
import { Square } from "lucide-react-native";
import React, { useCallback, useEffect, useRef } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const ChatScreenInner = observer(function ChatScreenInner() {
  const state = getChatState();
  const flatListRef = useRef<FlatList>(null);

  // Read observables directly — observer() tracks them automatically
  const messages = state.currentConversation.get()?.messages ?? [];
  const isModelReady = state.isModelReady.get();
  const isGenerating = state.isGenerating.get();
  const streamingText = state.streamingText.get();
  const errorMessage = state.errorMessage.get();
  const showCancelOption = state.showCancelOption.get();

  // Sync model status on mount
  useEffect(() => {
    syncModelStatus();
  }, []);

  // Auto-scroll on new messages
  const prevCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevCount.current && messages.length > 0) {
      prevCount.current = messages.length;
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
});

/**
 * Exported ChatScreen wrapped in observer.
 *
 * Legend State observer() automatically tracks which observables
 * are accessed during render, and only re-renders when they change.
 * This replaces the polling setInterval approach which caused infinite re-renders.
 */
export function ChatScreen() {
  return <ChatScreenInner />;
}
