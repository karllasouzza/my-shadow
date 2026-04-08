import { ThemeProvider } from "@/context/themes";
import { initCredentialRepository } from "@/features/onboarding";
import { initReflectionStore } from "@/shared/storage/encrypted-reflection-store";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  // Initialize encrypted stores before rendering any routes
  useEffect(() => {
    (async () => {
      try {
        await initCredentialRepository();
        await initReflectionStore();
      } catch {
        // If init fails, continue anyway — repositories will use fallback
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="hsl(277, 65%, 48%)" />
      </View>
    );
  }

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
            <Stack.Screen
              name="onboarding"
              options={{ headerShown: false, animation: "none" }}
            />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
