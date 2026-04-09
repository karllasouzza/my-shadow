import { Icon } from "@/components/ui/icon";
import { ThemeProvider } from "@/context/themes";
import { initCredentialRepository } from "@/features/onboarding";
import { initReflectionStore } from "@/shared/storage/encrypted-reflection-store";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { Loader2 } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import "../global.css";

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  // Initialize encrypted stores before rendering any routes
  useEffect(() => {
    const initializeStores = async () => {
      try {
        await initCredentialRepository();
        await initReflectionStore();
      } catch {
        // Initialization failed — will still mark as ready
      } finally {
        setIsReady(true);
      }
    };

    initializeStores();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Icon as={Loader2} className="text-primary size-6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Stack
            screenOptions={{
              contentStyle: {
                backgroundColor: "transparent",
              },
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="review" />
            <Stack.Screen name="export" />
            <Stack.Screen name="onboarding" />
          </Stack>
        </ThemeProvider>
        <PortalHost />
        <Toaster />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
