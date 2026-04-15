import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AIBubble } from "@/features/chat/components/ai-bubble";
import ChatBottomBar from "@/features/chat/components/chat-bottom-bar";
import { ConversationErrorState } from "@/features/chat/components/conversation-error-state";
import { EmptyState } from "@/features/chat/components/empty-state";
import { ScrollToBottomButton } from "@/features/chat/components/scroll-to-bottom-button";
import { StreamingBubble } from "@/features/chat/components/streaming-bubble";
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
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { ErrorBubble } from "../components/error-bubble";

const ChatScreenInner = observer(function ChatScreenInner() {
  const ScreenContainer = KeyboardAvoidingView;

  const flatListRef = useRef<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [inputText, setInputText] = useState("");

  const params = useLocalSearchParams<{
    conversationId?: string;
    new?: string;
  }>();
  const chat = useChat();

  // Init chat with route ID on mount AND on focus (handles navigation from history)
  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        // If route contains ?new=1 (or any truthy value), open a fresh chat
        const newParam = params?.new;
        const isNew =
          typeof newParam !== "undefined" &&
          newParam !== "false" &&
          newParam !== "0";

        if (isNew) {
          // Reset chat state to create a brand-new conversation
          chat.resetChatState();
          await chat.handleAutoLoadLastModel();
          chat.syncModelStatus();
          chat.refreshModelsOnFocus();
          return;
        }

        await chat.initChat(params.conversationId ?? null);
        await chat.handleAutoLoadLastModel();
        chat.syncModelStatus();
        chat.refreshModelsOnFocus();
      };
      init();
    }, [params.conversationId, params.new]),
  );

  // Auto-scroll when user is near bottom
  // Triggers on: new messages added, streaming message updates
  useEffect(() => {
    if (
      chat.displayMessages.length > 0 &&
      !showScrollButton &&
      chat.isGenerating
    ) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex?.({
          index: chat.displayMessages.length - 1,
          animated: true,
          viewPosition: 1,
        });
      });
    }
  }, [
    chat.displayMessages.length,
    showScrollButton,
    chat.displayMessages[chat.displayMessages.length - 1]?.timestamp,
    chat.isGenerating,
  ]);

  // Track scroll position — show button when >1 screen height from bottom
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    const contentHeight = contentSize.height;
    const visibleHeight = layoutMeasurement.height;
    const distanceFromBottom = contentHeight - contentOffset.y - visibleHeight;

    // Show scroll button when more than 1 screen height from bottom
    setShowScrollButton(distanceFromBottom > visibleHeight);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToIndex?.({
      index: chat.displayMessages.length - 1,
      animated: true,
      viewPosition: 1,
    });
  }, [chat.displayMessages.length]);

  const handleNewConversation = useCallback(() => {
    chat.resetChatState();
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <ScreenContainer
        behavior="padding"
        keyboardVerticalOffset={40}
        style={{
          flex: 1,
        }}
      >
        <TopBar
          title={chat.conversationTitle}
          showBack
          onBack={() => router.push("/history")}
          rightAction={
            <View className="flex flex-row gap-2">
              <Link href="/models" asChild>
                <Button variant="ghost" size="sm">
                  <Icon
                    as={require("lucide-react-native").Package}
                    className="size-5 text-muted-foreground p-0 stroke-2"
                  />
                </Button>
              </Link>
              {chat.hasContent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={handleNewConversation}
                  accessibilityLabel="Iniciar nova conversa"
                >
                  <Icon
                    as={require("lucide-react-native").Plus}
                    className="size-5 text-muted-foreground p-0 stroke-2"
                  />
                </Button>
              )}
            </View>
          }
        />

        {/* Messages List */}
        <View style={{ flex: 1 }}>
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
            <View style={{ flex: 1 }}>
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
                  (item as any)._key ??
                  `msg-${item.timestamp ?? index}-${index}`
                }
                contentContainerClassName="px-4 pt-6 pb-2"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={{ flex: 1 }}
              />

              {/* Scroll to bottom button */}
              <ScrollToBottomButton
                visible={showScrollButton}
                onPress={scrollToBottom}
              />
            </View>
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
          handleModelSelect={chat.handleLoadModel}
          modelError={chat.modelError}
          hasContent={chat.hasContent}
          // Thinking toggle props
          modelSupportsReasoning={chat.modelSupportsReasoning}
          thinkingEnabled={chat.thinkingEnabled}
          toggleThinking={chat.toggleThinking}
        />
      </ScreenContainer>
    </View>
  );
});

export const ChatScreen = memo(function ChatScreen() {
  return <ChatScreenInner />;
});
