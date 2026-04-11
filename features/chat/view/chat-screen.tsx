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
import {
    KeyboardAvoidingView,
    Platform,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const ChatScreenInner = observer(function ChatScreenInner() {
  const flatListRef = useRef<any>(null);
  const prevCountRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

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

  // Scroll to bottom only when a NEW message arrives (not during streaming)
  useEffect(() => {
    if (
      chat.displayMessages.length > prevCountRef.current &&
      chat.displayMessages.length > 0
    ) {
      prevCountRef.current = chat.displayMessages.length;
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
      setShowScrollButton(false);
    }
  }, [chat.displayMessages.length]);

  // Track scroll position
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scrollOffsetRef.current = contentOffset.y;

    const contentHeight = contentSize.height;
    const visibleHeight = layoutMeasurement.height;
    const distanceFromBottom = contentHeight - contentOffset.y - visibleHeight;

    // Show button when user scrolled up more than 1 screen
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
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-3 py-2 bg-background border-b border-border">
        {/* Settings */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/models")}
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
          onPress={() => router.push("/(tabs)/history")}
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
        />
      )}

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <TouchableOpacity
          onPress={scrollToBottom}
          className="absolute right-4 bottom-24 w-10 h-10 rounded-full bg-primary items-center justify-center shadow-lg"
          accessibilityLabel="Ir para última mensagem"
        >
          <ArrowDown size={20} color="white" />
        </TouchableOpacity>
      )}

      {/* Error */}
      {chat.errorMessage && (
        <View className="mx-4 mb-2 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{chat.errorMessage}</Text>
        </View>
      )}

      {/* Input */}
      <ChatInput
        onSendMessage={handleSend}
        isModelReady={chat.isModelReady}
        isGenerating={chat.isGenerating}
      />
    </KeyboardAvoidingView>
  );
});

export const ChatScreen = memo(function ChatScreen() {
  return <ChatScreenInner />;
});
