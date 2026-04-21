import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import chatState$ from "@/database/chat";
import ChatBottomBar from "@/features/chat/components/chat-bottom-bar";
import { useChat } from "@/features/chat/view-model/use-chat";
import { observer } from "@legendapp/state/react";
import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { memo, useCallback, useState } from "react";
import { View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import MessagesList from "../components/messages-list";

const ChatScreenInner = observer(function ChatScreenInner() {
  const ScreenContainer = KeyboardAvoidingView;

  const chat = useChat();
  const [inputText, setInputText] = useState("");

  const { conversationId } = useLocalSearchParams<{
    conversationId?: string;
  }>();

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        const isNew = conversationId === undefined || conversationId === null;

        if (isNew) {
          chat.resetChatState();
          await chat.handleLoadModelForConversation(null);
          await chat.syncModelStatus();
          chat.refreshModelsOnFocus();
          return;
        }

        if (!isNew) {
          const existing = chatState$.conversations[conversationId].get().id;

          if (!existing) {
            chat.resetChatState();
            return;
          }

          await chat.initChat(conversationId);
          await chat.handleLoadModelForConversation(conversationId ?? null);
          await chat.syncModelStatus();
          chat.refreshModelsOnFocus();
        }
      };
      init();
    }, [conversationId]),
  );

  const handleNewConversation = useCallback(() => {
    chat.resetChatState();
  }, []);

  return (
    <View style={{ flex: 1 }} className="bg-background">
      <ScreenContainer
        behavior="padding"
        keyboardVerticalOffset={40}
        style={{
          flex: 1,
          gap: 0,
        }}
      >
        <TopBar
          title={chat.conversationTitle}
          rightAction={
            <>
              <Link href="/models" asChild>
                <Button variant="ghost" size="sm">
                  <Icon
                    as={require("lucide-react-native").Package}
                    className="stroke-2 p-0 size-5 text-muted-foreground"
                  />
                </Button>
              </Link>
              {chat.hasContent && (
                <Button
                  variant="outline"
                  className="!border-primary"
                  size="icon"
                  onPress={handleNewConversation}
                  accessibilityLabel="Iniciar nova conversa"
                >
                  <Icon
                    as={require("lucide-react-native").Plus}
                    className="stroke-2 p-0 size-5 text-primary"
                  />
                </Button>
              )}
            </>
          }
          leftAction={
            <Link href="/history" asChild>
              <Button
                variant="ghost"
                size="icon"
                accessibilityLabel="Ver histórico de conversas"
              >
                <Icon
                  as={require("lucide-react-native").TextAlignStart}
                  className="stroke-2 p-0 size-5 text-muted-foreground"
                />
              </Button>
            </Link>
          }
        />

        {/* Messages List (extracted) */}
        <MessagesList chat={chat} />

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
          selectedWhisperModel={chat.selectedWhisperModelId}
          availableModels={chat.availableModels}
          handleModelSelect={chat.handleLoadModel}
          handleWhisperModelSelect={chat.handleLoadWhisperModel}
          modelError={chat.modelError}
          hasContent={chat.hasContent}
          // Reasoning toggle props
          reasoningEnabled={chat.reasoningEnabled}
          toggleReasoning={chat.toggleReasoning}
        />
      </ScreenContainer>
    </View>
  );
});

export const ChatScreen = memo(function ChatScreen() {
  return <ChatScreenInner />;
});
