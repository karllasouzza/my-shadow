import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
    ActivityIndicator,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface ChatInputProps {
  message: string;
  onMessageChange: (text: string) => void;
  onAddDocument: () => void;
  onToggleAugmentedGeneration: () => void;
  onMessageSubmit: () => void;
  augmentedGeneration: boolean;
  isReady: boolean;
  isGenerating: boolean;
}

/**
 * T032: ChatInput component with generation state UX
 *
 * Displays message input with status indicators for:
 * - Generation in progress (spinner, disabled state)
 * - Ready/not-ready state
 * - Augmented generation mode toggle
 */
export const ChatInput = ({
  message,
  onMessageChange,
  onAddDocument,
  onToggleAugmentedGeneration,
  onMessageSubmit,
  isReady,
  isGenerating,
  augmentedGeneration,
}: ChatInputProps) => {
  const messageSubmitBtnDisabled = !isReady || isGenerating || !message.trim();

  return (
    <View className="bg-gray-200 rounded-2xl p-3 gap-2 mx-3 my-2">
      {/* Status Indicator */}
      {!isReady && (
        <View className="bg-yellow-100 border-l-4 border-yellow-500 px-3 py-2 rounded">
          <Text className="text-yellow-800 text-xs font-semibold">
            Inicializando modelo local...
          </Text>
        </View>
      )}

      {/* Text Input */}
      <TextInput
        value={message}
        onChangeText={onMessageChange}
        multiline
        placeholder={
          isGenerating ? "Aguardando geração..." : "Faça uma pergunta..."
        }
        placeholderTextColor="#999"
        editable={!isGenerating && isReady}
        className="bg-white rounded-lg px-3 py-2 text-gray-800 max-h-24"
      />

      {/* Action Buttons */}
      <View className="flex-row justify-between items-center">
        {/* Document Button */}
        <TouchableOpacity
          onPress={onAddDocument}
          disabled={isGenerating || !isReady}
          className={isGenerating || !isReady ? "opacity-50" : ""}
        >
          <Ionicons
            name="document-text-outline"
            size={28}
            color={isGenerating || !isReady ? "#999" : "black"}
          />
        </TouchableOpacity>

        {/* Right Actions Row */}
        <View className="flex-row items-center gap-2">
          {/* Augmented Generation Toggle */}
          <TouchableOpacity
            onPress={onToggleAugmentedGeneration}
            disabled={isGenerating || !isReady}
            className={`${augmentedGeneration ? "" : "opacity-50"}`}
          >
            <Ionicons
              name="search-outline"
              size={28}
              color={isGenerating || !isReady ? "#999" : "black"}
            />
          </TouchableOpacity>

          {/* Generation Status & Submit Button */}
          {isGenerating ? (
            <View className="flex-row items-center gap-2 px-3 py-2">
              <ActivityIndicator size="small" color="black" />
              <Text className="text-xs text-gray-600">Gerando...</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={onMessageSubmit}
              disabled={messageSubmitBtnDisabled}
              className={messageSubmitBtnDisabled ? "opacity-50" : ""}
            >
              <Ionicons
                name="arrow-up-circle"
                size={36}
                color={messageSubmitBtnDisabled ? "#ccc" : "black"}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};
