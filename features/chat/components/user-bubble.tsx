import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ChatMessage } from "@/features/chat/model/chat-message";
import { AlertCircle } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";

interface UserBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "Mensagem inválida.",
  MODEL_NOT_LOADED: "Nenhum modelo carregado.",
  CONVERSATION_LOAD_FAILED: "Falha ao carregar conversa.",
  GENERATION_FAILED: "Falha ao gerar resposta.",
};

export function UserBubble({ message, onRetry }: UserBubbleProps) {
  const errorMsg = message.errorCode
    ? ERROR_MESSAGES[message.errorCode] || "Erro ao processar mensagem."
    : null;

  return (
    <View className="self-end max-w-[85%]">
      <View className="bg-primary rounded-2xl rounded-br-md px-2 py-2">
        <Text className="text-primary-foreground text-base" selectable>
          {message.content}
        </Text>
      </View>

      {/* Error indicator attached to user message */}
      {errorMsg && (
        <View className="bg-destructive/10 border border-destructive rounded-lg p-3 mt-2">
          <View className="flex-row items-center gap-2 mb-2">
            <Icon as={AlertCircle} className="size-4 text-destructive" />
            <Text className="text-destructive text-xs font-semibold flex-1">
              {errorMsg}
            </Text>
          </View>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onPress={onRetry}
              className="self-start"
            >
              <Text className="text-xs">Tentar novamente</Text>
            </Button>
          )}
        </View>
      )}

      <Text className="text-muted-foreground/55 text-xs mt-1 self-end px-1">
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
