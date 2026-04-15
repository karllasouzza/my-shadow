/**
 * T017: Model item component — single model row for catalog/list
 *
 * Shows model name, size, RAM estimate, and download button.
 * Load/unload is handled in the Chat screen.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Model } from "@/shared/ai/types/model";
import React from "react";
import { Text, View } from "react-native";
import { ModelItemStatus } from "../view-model/types";

interface ModelItemProps {
  item: Model;
  itemStatus?: ModelItemStatus;

  onDownload?: () => void;
  onRetry?: () => void;
  onRemove?: () => void;

  isLoading?: boolean;
}

const DEFAULT_STATUS: ModelItemStatus = {
  status: "not-downloaded",
  progress: 0,
  isLowRam: false,
};

export function ModelItem({
  item: {
    displayName,
    description,
    fileSizeBytes,
    estimatedRamBytes,
    supportsReasoning,
    tags,
    bytes,
  },
  itemStatus = DEFAULT_STATUS,
  onDownload,
  onRetry,
  onRemove,
  isLoading,
}: ModelItemProps) {
  const sizeMB = Math.round(fileSizeBytes / 1024 / 1024);
  const ramMB = Math.round(estimatedRamBytes / 1024 / 1024);
  return (
    <View className="px-5 py-4 border-b border-border/50">
      <View className="flex-row items-start justify-between">
        <View className="flex flex-1 gap-3">
          <View className="flex flex-col items-start gap-0.5">
            <View className="flex flex-row items-center justify-center gap-2">
              <Text className="text-foreground text-base font-semibold">
                {displayName}
              </Text>
              <Text className="text-primary/75 text-base">{bytes}</Text>
            </View>
            <Text className="text-muted-foreground text-xs">{description}</Text>
          </View>
          <View className="flex flex-row gap-1">
            <Badge variant="outline">
              <Text className="text-muted-foreground text-xs">~{sizeMB}MB</Text>
            </Badge>

            <Badge variant="outline">
              <Text className="text-muted-foreground text-xs">
                RAM: ~{ramMB}MB
              </Text>
            </Badge>

            {supportsReasoning && (
              <Badge variant="default">
                <Icon
                  as={require("lucide-react-native").Brain}
                  className="size-3 text-primary-foreground"
                />
              </Badge>
            )}
          </View>
          <View className="flex flex-row gap-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                <Text className="text-muted-foreground text-xs">{tag}</Text>
              </Badge>
            ))}
          </View>
        </View>

        {/* Action button based on status */}
        {itemStatus.status === "downloaded" ? (
          <Button onPress={onRemove} variant="destructive">
            <Text className="text-destructive-foreground text-sm font-semibold">
              Apagar
            </Text>
            <Icon
              as={require("lucide-react-native").Trash2}
              className="size-5 text-destructive-foreground"
            />
          </Button>
        ) : itemStatus.status === "downloading" ? (
          <View className="flex flex-row items-center gap-2 px-3 py-2">
            <Text className="text-blue-500 text-sm font-medium">
              {Math.round(itemStatus.progress)}%
            </Text>
          </View>
        ) : itemStatus.status === "failed" ? (
          <Button
            size="icon"
            onPress={onRetry}
            disabled={isLoading}
            variant="destructive"
          >
            <Text className="text-white text-sm font-semibold sr-only">
              Tentar novamente
            </Text>
            <Icon
              as={require("lucide-react-native").RotateCw}
              className="size-5 text-white"
            />
          </Button>
        ) : itemStatus.isLowRam ? (
          <View className="flex flex-row items-center gap-2 px-3 py-2 bg-yellow-500/10 rounded-lg">
            <Text className="text-yellow-600 text-xs">RAM insuficiente</Text>
            <Icon
              as={require("lucide-react-native").AlertTriangle}
              className="size-5 text-yellow-600"
            />
          </View>
        ) : (
          <Button variant="default" disabled={isLoading} onPress={onDownload}>
            <Text className="text-primary-foreground text-sm font-semibold">
              Baixar
            </Text>
            <Icon
              as={require("lucide-react-native").Download}
              className="size-5 text-primary-foreground"
            />
          </Button>
        )}
      </View>
    </View>
  );
}
