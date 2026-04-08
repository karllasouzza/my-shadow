import { ThemeProvider } from "@/context/themes";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: "hsl(240 4% 7%)",
              },
              headerTintColor: "hsl(277 65% 50%)",
              headerTitleStyle: {
                fontWeight: "600",
              },
              contentStyle: {
                backgroundColor: "hsl(240 5% 3%)",
              },
            }}
          >
            <Stack.Screen name="index" options={{ title: "Reflexão Diária" }} />
            <Stack.Screen
              name="review"
              options={{ title: "Revisão do Período" }}
            />
            <Stack.Screen name="export" options={{ title: "Exportar" }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
