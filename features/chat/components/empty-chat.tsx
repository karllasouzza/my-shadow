/**
 * T015: Empty chat state component
 */
import { View, Text } from "react-native";

export function EmptyChat() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-xl font-semibold mb-2">
        Inicie uma conversa
      </Text>
      <Text className="text-muted text-center text-base">
        Envie uma mensagem para começar sua reflexão com IA local.
      </Text>
    </View>
  );
}
