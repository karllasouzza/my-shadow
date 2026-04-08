import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: "Daily Reflection" }} />
          <Stack.Screen name="review" options={{ title: "Period Review" }} />
          <Stack.Screen name="export" options={{ title: "Export" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
