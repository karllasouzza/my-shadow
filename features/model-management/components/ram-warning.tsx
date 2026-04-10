/**
 * T019: RAM warning component
 *
 * Yellow warning banner when device RAM < model estimate.
 */
import React from "react";
import { View, Text } from "react-native";
import { AlertTriangle } from "lucide-react-native";

interface RamWarningProps {
  requiredMB: number;
  availableMB?: number;
}

export function RamWarning({ requiredMB, availableMB }: RamWarningProps) {
  return (
    <View className="mx-5 my-2 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex-row items-start gap-2">
      <AlertTriangle size={16} color="#eab308" className="mt-0.5" />
      <View className="flex-1">
        <Text className="text-yellow-600 text-sm font-medium">
          RAM insuficiente
        </Text>
        <Text className="text-yellow-600/80 text-xs mt-0.5">
          Este modelo requer ~{requiredMB}MB de RAM.
          {availableMB ? ` Seu dispositivo tem ~${availableMB}MB.` : ""}
          {" "}O modelo pode não carregar corretamente.
        </Text>
      </View>
    </View>
  );
}
