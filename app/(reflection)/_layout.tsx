import { Stack } from "expo-router";
import React from "react";

export default function ReflectionLayout() {
  return (
    <Stack>
      <Stack.Screen name="daily" options={{ title: "Daily Reflection" }} />
      <Stack.Screen name="review" options={{ title: "Period Review" }} />
      <Stack.Screen name="export" options={{ title: "Export" }} />
    </Stack>
  );
}
