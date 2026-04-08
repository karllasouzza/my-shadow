import { getInitialRoute } from "@/features/onboarding";
import DailyReflectionScreen from "@/features/reflection/view/daily-reflection-screen";
import type { RelativePathString } from "expo-router";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function DailyReflectionRoute() {
  const router = useRouter();
  const [route, setRoute] = useState<string | null>(null);

  useEffect(() => {
    const initialRoute = getInitialRoute();
    setRoute(initialRoute);
    if (initialRoute !== "main") {
      router.replace("/onboarding" as RelativePathString);
    }
  }, [router]);

  if (route === null) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="hsl(277, 65%, 48%)" />
      </View>
    );
  }

  if (route !== "main") {
    return null;
  }

  return <DailyReflectionScreen />;
}
