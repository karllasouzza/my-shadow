/**
 * Chat Screen
 *
 * Layout estilo ChatGPT:
 * - Header com navegação + thinking toggle
 * - LegendList com mensagens (user + AI com thinking)
 * - Carrega conversa pelo route ID
 */

import { AIBubble } from "@/features/chat/components/ai-bubble";
import { ChatInput } from "@/features/chat/components/chat-input";
import { EmptyState } from "@/features/chat/components/empty-state";
import { StreamingBubble } from "@/features/chat/components/streaming-bubble";
import { ThinkingToggle } from "@/features/chat/components/thinking-toggle";
import { UserBubble } from "@/features/chat/components/user-bubble";
import { useChat } from "@/features/chat/view-model/use-chat";
import { LegendList } from "@legendapp/list";
import { observer } from "@legendapp/state/react";
import { router, useLocalSearchParams } from "expo-router";
import { Clock, Plus, Settings, Square } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef } from "react";
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

  const params = useLocalSearchParams<{ conversationId?: string }>();
  const chat = useChat();

  // Init chat with route ID on mount
  useEffect(() => {
    chat.initChat(params.conversationId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync model status
  useEffect(() => {
    chat.syncModelStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (
      chat.displayMessages.length > prevCountRef.current &&
      chat.displayMessages.length > 0
    ) {
      prevCountRef.current = chat.displayMessages.length;
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [chat.displayMessages.length]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (chat.isGenerating) {
      const interval = setInterval(() => {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        });
      }, 200);
      return () => clearInterval(interval);
    }
  }, [chat.isGenerating]);

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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-background border-b border-border">
        {/* Settings */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/models")}
          className="p-2"
          accessibilityLabel="Gerenciar Modelos"
        >
          <Settings size={20} color="#a1a1aa" />
        </TouchableOpacity>

        {/* Model name */}
        <Text
          className="text-foreground text-sm font-semibold flex-1 text-center"
          numberOfLines={1}
        >
          {chat.activeModelName ?? "Nenhum modelo"}
        </Text>

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
              Nenhum modelo carregado
            </Text>
            <Text className="text-muted text-center text-base">
              Vá para a aba Modelos para selecionar e carregar um modelo.
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
            item.timestamp ? `msg-${item.timestamp}` : `msg-${index}`
          }
          contentContainerClassName="py-4"
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
