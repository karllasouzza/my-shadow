/**
 * T028: Generating indicator component
 *
 * Shows spinner + "Pensando..." during AI generation.
 */
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";

export function GeneratingIndicator() {
  return (
    <View className="mx-4 my-1 px-4 py-3 rounded-2xl rounded-bl-md bg-secondary self-start flex-row items-center gap-2">
      <ActivityIndicator size="small" color="#6B7280" />
      <Text className="text-muted text-base">Pensando...</Text>
    </View>
  );
}
