/**
 * T042: Queued-retry status banner for review generation
 *
 * Displays status when review generation is queued for retry due to
 * temporary unavailability of local generation capability
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";

interface RetryStatusBannerProps {
  visible: boolean;
  jobId?: string;
  status?: "queued" | "running" | "succeeded" | "failed";
  attempts?: number;
  maxAttempts?: number;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * Displays retry status for failed generation jobs
 */
export const RetryStatusBanner: React.FC<RetryStatusBannerProps> = ({
  visible,
  jobId,
  status = "queued",
  attempts = 0,
  maxAttempts = 3,
  onRetry,
  onDismiss,
}) => {
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!visible || !jobId) {
    return null;
  }

  const getStatusIcon = () => {
    switch (status) {
      case "running":
        return "hourglass";
      case "succeeded":
        return "checkmark-circle";
      case "failed":
        return "alert-circle";
      default:
        return "sync";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "bg-blue-100";
      case "succeeded":
        return "bg-green-100";
      case "failed":
        return "bg-red-100";
      default:
        return "bg-yellow-100";
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "running":
        return "Gerando...";
      case "succeeded":
        return "Análise concluída!";
      case "failed":
        return "Falha na geração";
      default:
        return "Na fila para tentar";
    }
  };

  return (
    <Animated.View style={{ opacity }}>
      <View
        className={`${getStatusColor()} border-l-4 border-orange-500 p-3 mx-4 my-2 rounded`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Ionicons
              name={getStatusIcon() as any}
              size={20}
              color="#FF8C00"
              style={{ marginRight: 8 }}
            />
            <View className="flex-1">
              <Text className="font-semibold text-gray-800">
                {getStatusText()}
              </Text>
              {attempts !== undefined && maxAttempts !== undefined && (
                <Text className="text-xs text-gray-600 mt-1">
                  Tentativa {attempts} de {maxAttempts} • Job:{" "}
                  {jobId.substring(0, 8)}
                </Text>
              )}
              {status === "failed" && (
                <Text className="text-xs text-red-700 mt-1">
                  Falha na geração. Tente novamente mais tarde.
                </Text>
              )}
            </View>
          </View>

          <View className="flex-row gap-2">
            {status === "failed" && onRetry && (
              <TouchableOpacity
                onPress={onRetry}
                className="bg-blue-500 rounded px-3 py-1"
              >
                <Text className="text-white text-xs font-semibold">
                  Retomar
                </Text>
              </TouchableOpacity>
            )}

            {onDismiss && (
              <TouchableOpacity onPress={onDismiss} className="px-2 py-1">
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
};
