/**
 * T011: Model picker component
 *
 * Modal sheet shown when no model is loaded (or user taps model badge).
 * Lists available models from catalog, shows download progress, RAM warning.
 */
import { AlertTriangle, Download, X } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  description: string;
  fileSizeMB: number;
  estimatedRamMB: number;
  downloadStatus: "pending" | "downloading" | "completed" | "failed";
  downloadProgress: number; // 0-100
}

interface ModelPickerProps {
  visible: boolean;
  onClose: () => void;
  models: ModelCatalogEntry[];
  onDownload: (modelId: string) => void;
  onSelect: (modelId: string) => void;
  deviceRamMB?: number;
}

export function ModelPicker({
  visible,
  onClose,
  models,
  onDownload,
  onSelect,
  deviceRamMB,
}: ModelPickerProps) {
  console.log("ModelPicker render", { visible, models, deviceRamMB });
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 flex h-screen bg-black/50 justify-end">
        <View className="bg-card flex-1 flex rounded-t-3xl max-h-[80%] h-max">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <Text className="text-foreground text-lg font-semibold">
              Selecionar Modelo
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessible
              accessibilityLabel="Fechar"
            >
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Model list */}
          <ScrollView
            className="bg-card flex-1 px-5 py-3"
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {models.map((model) => (
              <ModelRow
                key={model.id}
                model={model}
                deviceRamMB={deviceRamMB}
                onDownload={() => onDownload(model.id)}
                onSelect={() => onSelect(model.id)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ModelRow({
  model,
  deviceRamMB,
  onDownload,
  onSelect,
}: {
  model: ModelCatalogEntry;
  deviceRamMB?: number;
  onDownload: () => void;
  onSelect: () => void;
}) {
  const ramInsufficient = deviceRamMB
    ? deviceRamMB < model.estimatedRamMB
    : false;

  return (
    <View className="py-4 border-b border-border/50">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-foreground text-base font-semibold">
            {model.displayName}
          </Text>
          <Text className="text-muted text-xs mt-0.5">{model.description}</Text>
          <View className="flex-row items-center gap-3 mt-2">
            <Text className="text-muted text-xs">~{model.fileSizeMB}MB</Text>
            <Text className="text-muted text-xs">
              RAM: ~{model.estimatedRamMB}MB
            </Text>
          </View>
        </View>

        {/* Action button */}
        {model.downloadStatus === "completed" ? (
          <TouchableOpacity
            onPress={onSelect}
            className="bg-green-500 px-4 py-2 rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">Usar</Text>
          </TouchableOpacity>
        ) : model.downloadStatus === "downloading" ? (
          <View className="items-center justify-center px-4 py-2">
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text className="text-blue-500 text-xs mt-1">
              {model.downloadProgress}%
            </Text>
          </View>
        ) : model.downloadStatus === "failed" ? (
          <TouchableOpacity
            onPress={onDownload}
            className="bg-red-500 px-4 py-2 rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">Retry</Text>
          </TouchableOpacity>
        ) : ramInsufficient ? (
          <View className="flex-row items-center gap-1 px-3 py-2 bg-yellow-500/10 rounded-lg">
            <AlertTriangle size={14} color="#eab308" />
            <Text className="text-yellow-600 text-xs">RAM insuficiente</Text>
          </View>
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
