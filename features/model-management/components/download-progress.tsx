/**
 * T018: Download progress component
 *
 * Shows progress bar + percentage for active model download.
 */
import React from "react";
import { View, Text, ActivityIndicator } from "react-native";

interface DownloadProgressProps {
  progress: number; // 0-100
  modelName?: string;
}

export function DownloadProgress({
  progress,
  modelName,
}: DownloadProgressProps) {
  return (
    <View className="mx-5 my-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
      <View className="flex-row items-center gap-2 mb-2">
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text className="text-blue-500 text-sm font-medium">
          {modelName ? `Baixando ${modelName}...` : "Baixando..."}
        </Text>
      </View>
      <View className="w-full bg-blue-500/20 rounded-full h-2">
        <View
          className="bg-blue-500 rounded-full h-2"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </View>
      <Text className="text-blue-400 text-xs mt-1 text-right">
        {Math.round(progress)}%
      </Text>
    </View>
  );
}
