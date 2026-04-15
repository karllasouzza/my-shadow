/**
 * T016: Empty history state component
 */
import { Button } from "@/components/ui/button";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

export function EmptyHistory() {
  const router = useRouter();

  const handleNewConversation = () => {
    router.push({ pathname: "/", params: { new: "1" } });
  };

  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-xl font-semibold mb-2">
        Você não tem nenhuma conversa ainda.
      </Text>
      <Text className="text-muted text-center text-base">
        Inicie uma nova conversa para ver seu histórico aqui.
      </Text>
      <Button
        variant="default"
        className="mt-6"
        onPress={handleNewConversation}
      >
        <Text className="text-primary-foreground text-sm font-semibold">
          Nova Conversa
        </Text>
      </Button>
    </View>
  );
}
