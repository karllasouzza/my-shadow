import React from "react";
import { View } from "react-native";

export function StreamingIndicator() {
  return (
    <View className="flex-row items-center gap-1.5 py-1">
      <View className="w-2 h-2 rounded-full bg-muted animate-pulse" />
      <View className="w-2 h-2 rounded-full bg-muted animate-pulse opacity-50" />
      <View className="w-2 h-2 rounded-full bg-muted animate-pulse opacity-80" />
    </View>
  );
}
