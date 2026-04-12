/**
 * Streaming Indicator
 *
 * Indicador animado de "digitando..." durante geração da IA.
 * Três pontos pulsantes estilo ChatGPT.
 */

import React from "react";
import { View } from "react-native";

export function StreamingIndicator() {
  return (
    <View className="flex-row items-center gap-1.5 py-1">
      <View
        className="w-2 h-2 rounded-full bg-muted"
        style={{
          opacity: 1,
          transform: [{ scale: 1 }],
        }}
      />
      <View
        className="w-2 h-2 rounded-full bg-muted"
        style={{
          opacity: 0.6,
          transform: [{ scale: 0.9 }],
        }}
      />
      <View
        className="w-2 h-2 rounded-full bg-muted"
        style={{
          opacity: 0.3,
          transform: [{ scale: 0.8 }],
        }}
      />
    </View>
  );
}
