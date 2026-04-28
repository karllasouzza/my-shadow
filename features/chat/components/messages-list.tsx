import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/database/chat/types";
import { AIBubble } from "@/features/chat/components/ai-bubble";
import { ConversationErrorState } from "@/features/chat/components/conversation-error-state";
import { EmptyState } from "@/features/chat/components/empty-state";
import { ScrollToBottomButton } from "@/features/chat/components/scroll-to-bottom-button";
import { StreamingBubble } from "@/features/chat/components/streaming-bubble";
import { UserBubble } from "@/features/chat/components/user-bubble";
import { LegendList } from "@legendapp/list";
import { observer } from "@legendapp/state/react";
import { Link, router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

interface MessagesListProps {
  chat: {
    displayMessages: ChatMessage[];
    isGenerating: boolean;
    conversationError: string | null;
    hasContent: boolean;
    isModelReady: boolean;
    availableModels: any[];
    reasoningEnabled: boolean;
    retryLastUserMessage?: () => void;
    clearConversationError: () => void;
  };
}

export const MessagesList = observer(function MessagesList({
  chat,
}: MessagesListProps) {
  const flatListRef = useRef<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

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
    chat.displayMessages[chat.displayMessages.length - 1]?.createdAt,
    chat.isGenerating,
  ]);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    const contentHeight = contentSize.height;
    const visibleHeight = layoutMeasurement.height;
    const distanceFromBottom = contentHeight - contentOffset.y - visibleHeight;

    setShowScrollButton(distanceFromBottom > visibleHeight);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToIndex?.({
      index: chat.displayMessages.length - 1,
      animated: true,
      viewPosition: 1,
    });
  }, [chat.displayMessages.length]);

  if (chat.conversationError) {
    return (
      <View style={{ flex: 1 }}>
        <ConversationErrorState
          title={chat.conversationError}
          onBackToHistory={() => {
            chat.clearConversationError();
            router.push("/history");
          }}
        />
      </View>
    );
  }

  if (!chat.hasContent) {
    return (
      <View style={{ flex: 1 }}>
        {!chat.isModelReady ? (
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
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <LegendList
        ref={flatListRef}
        data={chat.displayMessages}
        renderItem={({ item }) => {
          const msg: any = item;
          return msg._isStreaming ? (
            <StreamingBubble
              message={msg}
              isReasonEnabled={chat.reasoningEnabled}
            />
          ) : msg.role === "user" ? (
            <UserBubble
              message={msg}
              onRetry={() => chat.retryLastUserMessage?.()}
            />
          ) : (
            <AIBubble
              message={msg}
              onRetry={() => chat.retryLastUserMessage?.()}
              isReasonEnabled={chat.reasoningEnabled}
            />
          );
        }}
        keyExtractor={(item, index) =>
          (item as any)._key ?? `msg-${(item as any).id ?? index}`
        }
        contentContainerClassName="px-4 pt-6 pb-2"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      />

      <ScrollToBottomButton
        visible={showScrollButton}
        onPress={scrollToBottom}
      />
    </View>
  );
});
