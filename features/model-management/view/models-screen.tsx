import { TopBar } from "@/components/top-bar";
import { ModelCatalog } from "@/features/model-management/components/model-catalog";
import { useModels } from "@/features/model-management/view-model/use-models";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { Text, View } from "react-native";

function ModelsScreenInner() {
  const router = useRouter();
  const {
    catalog,
    statuses,
    isLoading,
    errorMessage,
    searchQuery,
    setSearchQuery,
    downloadModel,
    removeModel,
  } = useModels();

  const handleDownload = useCallback(
    async (modelId: string) => {
      await downloadModel(modelId);
    },
    [downloadModel],
  );

  const handleRetry = useCallback(
    async (modelId: string) => {
      await handleDownload(modelId);
    },
    [handleDownload],
  );

  const handleRemove = useCallback(
    (modelId: string) => {
      removeModel(modelId);
    },
    [removeModel],
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <TopBar
        title="Gerenciamento de Modelos"
        showBack
        onBack={() => router.back()}
        showSearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Buscar modelo..."
      />

      {/* Error */}
      {errorMessage && (
        <View className="mx-5 mt-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <Text className="text-destructive text-sm">{errorMessage}</Text>
        </View>
      )}

      {/* Model Catalog */}
      <ModelCatalog
        models={catalog}
        statuses={statuses}
        onDownload={handleDownload}
        onRetry={handleRetry}
        onRemove={handleRemove}
        isLoading={isLoading}
      />
    </View>
  );
}

export const ModelsScreen = React.memo(function ModelsScreen() {
  return <ModelsScreenInner />;
});
