/**
 * T006/T008/T046: Root layout — routes to (tabs)/ group with auto-load
 *
 * T046: On app launch, checks for active model in MMKV and auto-loads it.
 */
import { ThemeProvider } from "@/context/themes";
import { findModelById } from "@/shared/ai/model-catalog";
import { getModelManager } from "@/shared/ai/model-manager";
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

  // T046: Auto-load active model on app launch
  useEffect(() => {
    async function init() {
      try {
        const manager = getModelManager();
        const activeModelId = manager.getActiveModel();
        if (activeModelId) {
          const model = findModelById(activeModelId);
          if (model) {
            // Attempt to load the active model
            await manager.loadModel(
              activeModelId,
              `file://${activeModelId}.gguf`,
            );
          }
        }
      } catch {
        // Auto-load failed — app continues without model
      } finally {
        setIsReady(true);
      }
    }
    init();
  }, []);

  if (!isReady) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Loader2 size={24} color="#3b82f6" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: "transparent" },
              headerShown: false,
            }}
          >
            <Stack.Screen name="(tabs)" />
          </Stack>
          <PortalHost />
          <Toaster />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
