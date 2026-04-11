/**
 * Conversation Error State
 *
 * Exibido quando a conversa não foi encontrada ou está corrompida.
 * Card centralizado com ícone, mensagem e botão para voltar ao histórico.
 */
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AlertCircle, Clock } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View } from "react-native";

interface ConversationErrorStateProps {
  title: string;
  description?: string;
  onBackToHistory: () => void;
}

export function ConversationErrorState({
  title,
  description = "Esta conversa não pôde ser carregada. Ela pode ter sido removida ou corrompida.",
  onBackToHistory,
}: ConversationErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="w-full bg-card border border-border rounded-2xl p-6 items-center">
        {/* Icon */}
        <View className="w-16 h-16 rounded-full bg-destructive/10 items-center justify-center mb-4">
          <Icon as={AlertCircle} size={32} className="text-destructive" />
        </View>

        {/* Title */}
        <Text className="text-foreground text-lg font-semibold mb-2">
          {title}
        </Text>

        {/* Description */}
        <Text className="text-muted text-center text-sm mb-6">
          {description}
        </Text>

        {/* Back button */}
        <TouchableOpacity
          onPress={onBackToHistory}
          className="w-full flex-row items-center justify-center gap-2 py-3 bg-primary rounded-xl active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel="Voltar ao histórico"
        >
          <Icon as={Clock} size={18} className="text-primary-foreground" />
          <Text className="text-primary-foreground text-base font-medium">
            Voltar ao Histórico
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
