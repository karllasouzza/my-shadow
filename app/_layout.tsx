import { ThemeProvider } from "@/context/themes";
import { DeviceDetector } from "@/shared/ai/device-detector";
import { selectDeviceProfile } from "@/shared/ai/device-profiles";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import "../global.css";

export default function RootLayout() {
  useEffect(() => {
    const detector = new DeviceDetector();
    detector.detect().then((info) => {
      const profile = selectDeviceProfile(info);
      console.log(
        `[Device] ${info.totalRAM.toFixed(1)}GB RAM, ${profile.tier} tier, ${info.gpuBackend ?? "CPU-only"}`,
      );
    }).catch(() => {
      // Device detection is non-blocking; log failures silently
    });
  }, []);

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
