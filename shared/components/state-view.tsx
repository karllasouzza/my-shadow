/**
 * Provides a composable component for handling loading, error, empty, and success states
 * across reflection, review, and export flows.
 */

import React, { ReactNode } from "react";
import { Text, View } from "react-native";
import { AppError } from "../utils/app-error";

export interface StateViewProps {
  /**
   * Current state: "loading" | "empty" | "error" | "success"
   */
  state: "loading" | "empty" | "error" | "success";

  /**
   * Optional error object to display when state is "error"
   */
  error?: AppError;

  /**
   * Content to render when state is "success"
   */
  children?: ReactNode;

  /**
   * Custom loading component. Defaults to "Carregando..."
   */
  loadingComponent?: ReactNode;

  /**
   * Custom empty state component. Defaults to "Nenhum conteúdo disponível"
   */
  emptyComponent?: ReactNode;

  /**
   * Custom error component. If not provided, displays error code and message
   */
  errorComponent?: (error: AppError) => ReactNode;

  /**
   * Container className for NativeWind styling
   */
  className?: string;
}

export const StateView: React.FC<StateViewProps> = ({
  state,
  error,
  children,
  loadingComponent,
  emptyComponent,
  errorComponent,
  className,
}) => {
  return (
    <View className={className || "flex-1 items-center justify-center p-4"}>
      {state === "loading" &&
        (loadingComponent || (
          <Text className="text-gray-500">Carregando...</Text>
        ))}

      {state === "empty" &&
        (emptyComponent || (
          <Text className="text-gray-400">Nenhum conteúdo disponível</Text>
        ))}

      {state === "error" &&
        error &&
        (errorComponent?.(error) || (
          <View className="gap-2">
            <Text className="text-red-600 font-semibold">{error.code}</Text>
            <Text className="text-red-500 text-sm">{error.message}</Text>
          </View>
        ))}

      {state === "success" && children}
    </View>
  );
};

export default StateView;
