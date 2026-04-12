/**
 * Error Bubble
 *
 * Mensagem de erro exibida como bubble na conversa com botão de retry.
 */
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AlertTriangle, RefreshCw } from "lucide-react-native";
import React from "react";
import { Pressable, View } from "react-native";

interface ErrorBubbleProps {
  message: string;
  onRetry: () => void;
}

export function ErrorBubble({ message, onRetry }: ErrorBubbleProps) {
  return (
    <View className="mx-4 my-2 flex-row gap-3">
      {/* Error icon */}
      <View className="w-8 h-8 rounded-full bg-destructive/15 items-center justify-center shrink-0 mt-1">
        <Icon as={AlertTriangle} size={16} className="text-destructive" />
      </View>

      {/* Content */}
      <View className="flex-1 bg-destructive/10 border border-destructive/20 rounded-xl rounded-tl-sm p-3">
        <Text className="text-destructive font-semibold text-sm mb-1">
          Erro na geração
        </Text>
        <Text className="text-destructive/80 text-sm leading-5">
          {message}
        </Text>

        {/* Retry button */}
        <Pressable
          onPress={onRetry}
          className="flex-row items-center gap-1.5 mt-3 px-3 py-1.5 bg-destructive/15 rounded-lg active:opacity-80 self-end"
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
        >
          <Icon as={RefreshCw} size={14} className="text-destructive" />
          <Text className="text-destructive text-sm font-medium">
            Tentar novamente
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
