/**
 * useModels
 *
 * Hook exclusivo da ModelsScreen — download e remoção de modelos.
 * Toda a lógica de download, validação e persistência fica em shared/ai.
 */

import {
  downloadModelById,
  findModelById,
  getAllModels,
  getDownloadedModels,
  removeDownloadedModel,
} from "@/shared/ai";
import { useCallback, useMemo, useState } from "react";

// ============================================================================
// Hook
// ============================================================================

export function useModels() {
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadedVersion, setDownloadedVersion] = useState(0);

  const catalog = useMemo(() => getAllModels(), []);

  const downloadedModels = useMemo(
    () => getDownloadedModels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [downloadedVersion],
  );

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog;
    const query = searchQuery.toLowerCase();
    return catalog.filter(
      (model) =>
        model.displayName.toLowerCase().includes(query) ||
        model.description.toLowerCase().includes(query) ||
        model.bytes.toLowerCase().includes(query) ||
        model.quantization.toLowerCase().includes(query),
    );
  }, [catalog, searchQuery]);

  // ==========================================================================
  // Actions (delegadas ao shared/ai)
  // ==========================================================================

  const downloadModel = useCallback(async (modelId: string) => {
    const model = findModelById(modelId);
    if (!model) {
      setErrorMessage("Modelo não encontrado no catálogo.");
      return;
    }

    setIsLoading(true);
    setDownloadingModelId(modelId);
    setDownloadProgress(0);
    setErrorMessage(null);

    const result = await downloadModelById(
      modelId,
      model.huggingFaceId,
      (info) => {
        setDownloadProgress(Math.round(info.progress));
      },
    );

    if (!result.success) {
      setErrorMessage(result.error.message);
    }

    setDownloadingModelId(null);
    setDownloadedVersion((v) => v + 1);
    setIsLoading(false);
  }, []);

  const removeModel = useCallback((modelId: string) => {
    removeDownloadedModel(modelId);
    setDownloadedVersion((v) => v + 1);
  }, []);

  return useMemo(
    () => ({
      // State
      catalog: filteredCatalog,
      isLoading,
      downloadingModelId,
      downloadProgress,
      errorMessage,
      downloadedModels,
      searchQuery,

      // Actions
      downloadModel,
      removeModel,
      setSearchQuery,
    }),
    [
      filteredCatalog,
      isLoading,
      downloadingModelId,
      downloadProgress,
      errorMessage,
      downloadedModels,
      searchQuery,
      downloadModel,
      removeModel,
    ],
  );
}
