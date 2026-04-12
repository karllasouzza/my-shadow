import { Button } from "@/components/ui/button";
import { AIBubble } from "@/features/chat/components/ai-bubble";
import { ChatBottomBar } from "@/features/chat/components/chat-bottom-bar";
import { ConversationErrorState } from "@/features/chat/components/conversation-error-state";
import { EmptyState } from "@/features/chat/components/empty-state";
import { StreamingBubble } from "@/features/chat/components/streaming-bubble";
import { ThinkingToggle } from "@/features/chat/components/thinking-toggle";
import { UserBubble } from "@/features/chat/components/user-bubble";
import { useChat } from "@/features/chat/view-model/use-chat";
import { LegendList } from "@legendapp/list";
import { observer } from "@legendapp/state/react";
import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { Clock, Plus, Settings } from "lucide-react-native";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { ErrorBubble } from "../components/error-bubble";

const ChatScreenInner = observer(function ChatScreenInner() {
  const ScreenContainer = KeyboardAvoidingView;

  const flatListRef = useRef<any>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [inputText, setInputText] = useState("");

  const params = useLocalSearchParams<{ conversationId?: string }>();
  const chat = useChat();

  // Init chat with route ID on mount AND on focus (handles navigation from history)
  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        await chat.initChat(params.conversationId ?? null);
        chat.handleAutoLoadLastModel();
        chat.syncModelStatus();
      };
      init();
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
  }, []);

  const handleNewConversation = useCallback(() => {
    chat.resetChatState();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [chat.resetChatState]);

  const handleModelSelect = useCallback(
    (modelId: string) => {
      chat.handleLoadModel(modelId);
    },
    [chat.handleLoadModel],
  );

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <ScreenContainer
        behavior="padding"
        keyboardVerticalOffset={40}
        style={{
          flex: 1,
        }}
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
          {/* Conversation Error Overlay */}
          {chat.conversationError ? (
            <ConversationErrorState
              title={chat.conversationError}
              onBackToHistory={() => {
                chat.clearConversationError();
                router.push("/history");
              }}
            />
          ) : !chat.hasContent ? (
            !chat.isModelReady ? (
              <View className="flex-1 items-center justify-center px-8">
                <Text className="text-foreground text-2xl font-semibold">
                  {chat.availableModels.length === 0
                    ? "Nenhum modelo baixado"
                    : "Nenhum modelo carregado"}
                </Text>
                <Text className="text-foreground/75 text-center text-base">
                  {chat.availableModels.length === 0
                    ? "Baixe um modelo para começar a conversar."
                    : "Selecione um modelo no seletor acima."}
                </Text>
                {chat.availableModels.length === 0 && (
                  <Link href="/models" asChild>
                    <Button className="mt-6">
                      <Text className="text-sm text-primary-foreground">
                        Baixar Modelos
                      </Text>
                    </Button>
                  </Link>
                )}
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
                ) : item.role === "error" ? (
                  <ErrorBubble
                    message={item.content}
                    onRetry={() => chat.retryLastMessage?.()}
                  />
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
              style={{ flex: 1 }}
            />
          )}
        </View>

        {/* Chat Bottom Bar */}
        <ChatBottomBar
          value={inputText}
          onChangeText={setInputText}
          onSend={() => {
            chat.sendMessage(inputText.trim());
            setInputText("");
          }}
          handleCancel={chat.cancelGeneration}
          isGenerating={chat.isGenerating}
          isModelReady={chat.isModelReady}
          isModelLoading={chat.isModelLoading}
          // Model selector props
          selectedModel={chat.selectedModelId}
          availableModels={chat.availableModels}
          handleModelSelect={handleModelSelect}
          modelError={chat.modelError}
        />
      </ScreenContainer>
    </View>
  );
});

export const ChatScreen = memo(function ChatScreen() {
  return <ChatScreenInner />;
});
