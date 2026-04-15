import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import ChatBottomBar from "@/features/chat/components/chat-bottom-bar";
import { useChat } from "@/features/chat/view-model/use-chat";
import { observer } from "@legendapp/state/react";
import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import React, { memo, useCallback, useState } from "react";
import { View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import MessagesList from "../components/messages-list";

const ChatScreenInner = observer(function ChatScreenInner() {
  const ScreenContainer = KeyboardAvoidingView;

  const chat = useChat();
  const [inputText, setInputText] = useState("");

  const params = useLocalSearchParams<{
    conversationId?: string;
    new?: string;
  }>();

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
                    className="size-5 text-muted-foreground p-0 stroke-2"
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
                    className="size-5 text-primary p-0 stroke-2"
                  />
                </Button>
              )}
            </>
          }
          leftAction={
            <Button
              variant="ghost"
              size="icon"
              onPress={() => {
                router.push("/history");
              }}
              accessibilityLabel="Ver histórico de conversas"
            >
              <Icon
                as={require("lucide-react-native").History}
                className="size-5 text-muted-foreground p-0 stroke-2"
              />
            </Button>
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
          availableModels={chat.availableModels}
          handleModelSelect={chat.handleLoadModel}
          modelError={chat.modelError}
          hasContent={chat.hasContent}
          // Thinking toggle props
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
