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
      <Text className="text-muted-foreground text-center text-base leading-6">
        Me pergunte qualquer coisa ou peça para realizar uma tarefa.
      </Text>
      <Text className="text-muted-foreground text-center text-base leading-6">
        Estou aqui para ajudar!
      </Text>
    </View>
  );
}
