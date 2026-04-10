/**
 * T016: Empty history state component
 */
import { View, Text } from "react-native";

export function EmptyHistory() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-xl font-semibold mb-2">
        Nenhuma conversa ainda
      </Text>
      <Text className="text-muted text-center text-base">
        Suas conversas anteriores aparecerão aqui.
      </Text>
    </View>
  );
}
