/**
 * Chat Screen
 *
 * Layout estilo ChatGPT:
 * - Header com Model Selector + navegação
 * - LegendList com mensagens (user + AI com thinking + modelId)
 * - Carrega último modelo automaticamente
 */

import { AIBubble } from "@/features/chat/components/ai-bubble";
import { ChatInput } from "@/features/chat/components/chat-input";
import { EmptyState } from "@/features/chat/components/empty-state";
import { ModelSelector } from "@/features/chat/components/model-selector";
import { StreamingBubble } from "@/features/chat/components/streaming-bubble";
import { ThinkingToggle } from "@/features/chat/components/thinking-toggle";
import { UserBubble } from "@/features/chat/components/user-bubble";
import { useChat } from "@/features/chat/view-model/use-chat";
import { LegendList } from "@legendapp/list";
import { observer } from "@legendapp/state/react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowDown, Clock, Plus, Settings, Square } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import {
  KeyboardAvoidingView,
  useKeyboardState,
  useResizeMode,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ChatScreenInner = observer(function ChatScreenInner() {
  // Enable resize mode for proper keyboard handling on Android
  useResizeMode();

  const ScreenContainer = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const insets = useSafeAreaInsets();

  const flatListRef = useRef<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const keyboardHeight = useKeyboardState((state) => state.height);
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);

  const params = useLocalSearchParams<{ conversationId?: string }>();
  const chat = useChat();

  // Init chat with route ID on mount AND on focus (handles navigation from history)
  useFocusEffect(
    useCallback(() => {
      chat.initChat(params.conversationId ?? null);
      chat.autoLoadLastModel();
      chat.syncModelStatus();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.conversationId]),
  );

  // Auto-scroll only when user is already near bottom (threshold: 100px)
  useEffect(() => {
    if (chat.displayMessages.length > 0 && isNearBottom) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [chat.displayMessages.length, isNearBottom]);

  // Track scroll position
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    const contentHeight = contentSize.height;
    const visibleHeight = layoutMeasurement.height;
    const distanceFromBottom = contentHeight - contentOffset.y - visibleHeight;

    const AUTO_SCROLL_THRESHOLD = 100; // px from bottom
    setIsNearBottom(distanceFromBottom < AUTO_SCROLL_THRESHOLD);
    setShowScrollButton(distanceFromBottom > visibleHeight);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollButton(false);
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      await chat.sendMessage(text);
    },
    [chat.sendMessage],
  );

  const handleNewConversation = useCallback(() => {
    chat.resetChatState();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [chat.resetChatState]);

  const handleModelSelect = useCallback(
    (modelId: string) => {
      chat.loadModel(modelId);
    },
    [chat.loadModel],
  );

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <ScreenContainer
        {...(Platform.OS === "ios" ? { behavior: "padding" as const } : {})}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-3 py-2 bg-background border-b border-border">
          {/* Settings */}
          <TouchableOpacity
            onPress={() => router.push("/models")}
            className="p-2"
            accessibilityLabel="Gerenciar Modelos"
          >
            <Settings size={20} color="#a1a1aa" />
          </TouchableOpacity>

          {/* Model Selector */}
          <ModelSelector
            models={chat.availableModels}
            selectedModelId={chat.selectedModelId}
            isLoading={chat.isModelLoading}
            error={chat.modelError}
            onSelect={handleModelSelect}
          />

          {/* Thinking Toggle (only for reasoning models) */}
          {chat.modelSupportsReasoning && (
            <ThinkingToggle
              enabled={chat.thinkingEnabled}
              onToggle={chat.toggleThinking}
            />
          )}

          {/* History */}
          <TouchableOpacity
            onPress={() => router.push("/history")}
            className="p-2"
            accessibilityLabel="Histórico"
          >
            <Clock size={20} color="#a1a1aa" />
          </TouchableOpacity>

          {/* New Conversation */}
          <TouchableOpacity
            onPress={handleNewConversation}
            className="p-2"
            accessibilityLabel="Nova Conversa"
          >
            <Plus size={20} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <View style={{ flex: 1 }}>
          {!chat.hasContent ? (
            !chat.isModelReady ? (
              <View className="flex-1 items-center justify-center px-8">
                <Text className="text-foreground text-xl font-semibold mb-2">
                  {chat.availableModels.length === 0
                    ? "Nenhum modelo baixado"
                    : "Nenhum modelo carregado"}
                </Text>
                <Text className="text-muted text-center text-base">
                  {chat.availableModels.length === 0
                    ? "Vá para Modelos para baixar um modelo."
                    : "Selecione um modelo no seletor acima."}
                </Text>
              </View>
            ) : (
              <EmptyState />
            )
          ) : (
            <LegendList
              ref={flatListRef}
              data={chat.displayMessages}
              renderItem={({ item }) =>
                (item as any)._isStreaming ? (
                  <StreamingBubble message={item} />
                ) : item.role === "user" ? (
                  <UserBubble message={item} />
                ) : (
                  <AIBubble message={item} />
                )
              }
              keyExtractor={(item, index) =>
                (item as any)._key ?? `msg-${item.timestamp ?? index}-${index}`
              }
              contentContainerClassName="py-4"
              onScroll={handleScroll}
              scrollEventThrottle={16}
              ListFooterComponent={
                chat.showCancelOption ? (
                  <TouchableOpacity
                    onPress={chat.cancelGeneration}
                    accessible
                    accessibilityLabel="Cancelar geração"
                    className="mx-4 my-2 flex-row items-center justify-center gap-2 py-2 border border-destructive rounded-lg"
                  >
                    <Square size={14} color="#ef4444" />
                    <Text className="text-destructive text-sm font-medium">
                      Cancelar geração
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
              style={{ flex: 1 }}
            />
          )}
        </View>

        {/* Error */}
        {chat.errorMessage && (
          <View className="mx-4 mb-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <Text className="text-destructive text-sm">
              {chat.errorMessage}
            </Text>
          </View>
        )}

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <TouchableOpacity
            onPress={scrollToBottom}
            className="absolute right-4 w-10 h-10 rounded-full bg-primary items-center justify-center shadow-lg"
            accessibilityLabel="Ir para última mensagem"
            style={{ bottom: isKeyboardVisible ? 16 : insets.bottom + 72 }}
          >
            <ArrowDown size={20} color="white" />
          </TouchableOpacity>
        )}

        {/* Input */}
        <ChatInput
          onSendMessage={handleSend}
          isModelReady={chat.isModelReady}
          isGenerating={chat.isGenerating}
          bottomOffset={Platform.OS === "android" ? keyboardHeight : 0}
        />
      </ScreenContainer>
    </View>
  );
});

export const ChatScreen = memo(function ChatScreen() {
  return <ChatScreenInner />;
});
