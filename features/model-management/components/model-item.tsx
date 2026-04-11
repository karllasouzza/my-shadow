/**
 * T017: Model item component — single model row for catalog/list
 *
 * Shows model name, size, RAM estimate, and action button
 * (download / load / retry based on status).
 */
import { AlertTriangle, Cpu, Download, XCircle } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

export type ModelStatus =
  | "not-downloaded"
  | "downloading"
  | "downloaded"
  | "loaded"
  | "failed";

interface ModelItemProps {
  name: string;
  description: string;
  sizeMB: number;
  ramMB: number;
  status: ModelStatus;
  progress?: number;
  onDownload?: () => void;
  onLoad?: () => void;
  onUnload?: () => void;
  onRetry?: () => void;
  isLowRam?: boolean;
}

export function ModelItem({
  name,
  description,
  sizeMB,
  ramMB,
  status,
  progress = 0,
  onDownload,
  onLoad,
  onUnload,
  onRetry,
  isLowRam = false,
}: ModelItemProps) {
  return (
    <View className="px-5 py-4 border-b border-border/50">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-foreground text-base font-semibold">
            {name}
          </Text>
          <Text className="text-muted text-xs mt-0.5">{description}</Text>
          <View className="flex-row items-center gap-3 mt-2">
            <Text className="text-muted text-xs">~{sizeMB}MB</Text>
            <Text className="text-muted text-xs">RAM: ~{ramMB}MB</Text>
          </View>
        </View>

        {/* Action button based on status */}
        {status === "loaded" ? (
          <TouchableOpacity
            onPress={onUnload}
            className="flex-row items-center gap-1 px-3 py-2 bg-destructive/10 rounded-lg"
          >
            <XCircle size={14} color="#ef4444" />
            <Text className="text-destructive text-xs font-medium">
              Descarregar
            </Text>
          </TouchableOpacity>
        ) : status === "downloading" ? (
          <View className="items-center justify-center px-4 py-2">
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text className="text-blue-500 text-xs mt-1">{progress}%</Text>
          </View>
        ) : status === "failed" ? (
          <TouchableOpacity
            onPress={onRetry}
            className="bg-red-500 px-4 py-2 rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">Retry</Text>
          </TouchableOpacity>
        ) : isLowRam ? (
          <View className="flex-row items-center gap-1 px-3 py-2 bg-yellow-500/10 rounded-lg">
            <AlertTriangle size={14} color="#eab308" />
            <Text className="text-yellow-600 text-xs">RAM insuficiente</Text>
          </View>
        ) : status === "downloaded" ? (
          <TouchableOpacity
            onPress={onLoad}
            className="bg-primary px-4 py-2 rounded-lg flex-row items-center gap-1"
          >
            <Cpu size={14} color="white" />
            <Text className="text-primary-foreground text-sm font-semibold">
              Carregar
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onDownload}
            className="bg-primary px-4 py-2 rounded-lg flex-row items-center gap-1"
          >
            <Download size={14} color="white" />
            <Text className="text-primary-foreground text-sm font-semibold">
              Baixar
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
