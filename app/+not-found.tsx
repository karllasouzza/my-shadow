import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 bg-background items-center justify-center p-6">
        <Text className="text-foreground text-xl font-bold mb-4">
          This screen doesn&apos;t exist.
        </Text>
        <Link href="/" className="text-primary">
          <Text className="text-primary text-lg">Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}
