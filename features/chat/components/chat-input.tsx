/**
 * T026: Chat input component
 *
 * Text input + send button. Disabled when !isModelReady or isGenerating.
 * Accessibility labels for screen readers.
 */
import { Send } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isModelReady: boolean;
  isGenerating: boolean;
  bottomOffset?: number;
}

export function ChatInput({
  onSendMessage,
  isModelReady,
  isGenerating,
  bottomOffset = 0,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const insets = useSafeAreaInsets();

  const isDisabled = !isModelReady || isGenerating || !text.trim();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isDisabled) return;
    onSendMessage(trimmed);
    setText("");
  };

  return (
    <View
      className="flex bg-card border-t border-border px-4 pt-3"
      style={{ paddingBottom: Math.max(insets.bottom, 12) + bottomOffset }}
    >
      {/* Model not ready indicator */}
      {!isModelReady && (
        <View className="mb-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <Text className="text-yellow-600 text-xs">
            Nenhum modelo carregado. Vá para a aba Modelos para carregar um.
          </Text>
        </View>
      )}

      {/* Input row */}
      <View className="flex-row items-center gap-2">
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={10000}
          placeholder={
            isGenerating
              ? "Aguardando resposta..."
              : !isModelReady
                ? "Modelo não carregado"
                : "Digite sua mensagem..."
          }
          placeholderTextColor="#9CA3AF"
          editable={isModelReady && !isGenerating}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          accessible
          accessibilityLabel="Campo de mensagem do chat"
          accessibilityHint="Digite sua mensagem e pressione enviar"
          className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground max-h-32 text-base"
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={isDisabled}
          accessible
          accessibilityLabel="Enviar mensagem"
          accessibilityRole="button"
          className={`p-3 rounded-full ${isDisabled ? "bg-muted" : "bg-primary"}`}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Send size={20} color={isDisabled ? "#9CA3AF" : "white"} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
