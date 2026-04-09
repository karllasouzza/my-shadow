import React, { useRef } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import type { Message } from "react-native-rag";

interface MessagesListProps {
  messages: Message[];
  response: string;
  isGenerating: boolean;
}

/**
 * T032: MessagesList component with generation state UX
 *
 * Displays message history and active generation status with:
 * - User/assistant message differentiation
 * - Generation progress indicator
 * - Streaming response preview
 */
export const MessagesList = ({
  messages,
  response,
  isGenerating,
}: MessagesListProps) => {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollRef}
      onContentSizeChange={() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }}
      className="flex-1 px-2 py-1"
    >
      {/* Message History */}
      {messages.map((message, index) => (
        <View
          key={index}
          className={`flex-row my-2 ${
            message.role === "assistant"
              ? "justify-start"
              : "justify-end flex-row-reverse"
          }`}
        >
          {/* Assistant Icon */}
          {message.role === "assistant" && (
            <View className="w-8 h-8 rounded-lg bg-gray-200 justify-center items-center mr-2">
              {/* Icon would go here */}
            </View>
          )}

          {/* Message Bubble */}
          <View
            className={`max-w-3/4 rounded-xl px-3 py-2 ${
              message.role === "assistant" ? "bg-gray-100" : "bg-black"
            }`}
          >
            <Text
              className={`text-sm leading-5 ${
                message.role === "user" ? "text-white" : "text-gray-800"
              }`}
            >
              {message.content}
            </Text>
          </View>
        </View>
      ))}

      {/* Generation Status */}
      {isGenerating && (
        <View className="flex-row my-2 justify-start">
          {/* Assistant Icon */}
          <View className="w-8 h-8 rounded-lg bg-gray-200 justify-center items-center mr-2">
            <ActivityIndicator size="small" color="black" />
          </View>

          {/* Response Bubble */}
          <View className="bg-gray-100 rounded-xl px-3 py-2 max-w-3/4 flex-1">
            {!response ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="gray" />
                <Text className="text-sm text-gray-600">
                  Gerando resposta...
                </Text>
              </View>
            ) : (
              <Text className="text-sm leading-5 text-gray-800">
                {response.trim()}
              </Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};
