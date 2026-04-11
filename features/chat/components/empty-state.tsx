/**
 * Empty State
 *
 * Estado vazio do chat — mensagem de boas-vindas.
 */

import React from "react";
import { Text, View } from "react-native";

export function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-2xl font-bold mb-3">
        Como posso ajudar?
      </Text>
      <Text className="text-muted text-center text-base leading-6">
        Envie uma mensagem para iniciar uma conversa.{"\n"}
        A IA responderá em tempo real.
      </Text>
    </View>
  );
}
