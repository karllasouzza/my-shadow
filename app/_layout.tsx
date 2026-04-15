import { ThemeProvider } from "@/context/themes";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import "../global.css";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ThemeProvider>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
              initialRouteName="index"
            >
              <Stack.Screen
                name="history"
                options={{
                  animation: "slide_from_left",
                }}
              />
              <Stack.Screen
                name="index"
                options={{
                  animation: "fade",
                }}
              />
              <Stack.Screen
                name="models"
                options={{
                  animation: "slide_from_right",
                }}
              />
            </Stack>
            <PortalHost />
            <Toaster />
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
