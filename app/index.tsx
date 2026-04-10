import { Link } from "expo-router";
import { View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <Link
        href="/chat"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Go to Chat
      </Link>
    </View>
  );
}
