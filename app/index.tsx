import { getInitialRoute } from "@/features/onboarding";
import DailyReflectionScreen from "@/features/reflection/view/daily-reflection-screen";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

export default function DailyReflectionRoute() {
  useEffect(() => {
    const route = getInitialRoute();

    // If onboarding is not complete, redirect to onboarding flow
    if (route !== "main") {
      router.replace("/onboarding" as any);
    }
  }, []);

  const route = getInitialRoute();

  // Show loading state briefly while checking
  if (route !== "main") {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="hsl(277, 65%, 48%)" />
      </View>
    );
  }

  return <DailyReflectionScreen />;
}
