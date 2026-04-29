import {
  downloadModelById,
  getDownloadedModels,
  removeDownloadedModel,
} from "@/shared/ai/manager";
import { findWhisperModelById, WHISPER_CATALOG } from "@/shared/ai/stt/catalog";
import { WhisperModel } from "@/shared/ai/stt/types";
import {
  findModelById,
  getAllModels,
} from "@/shared/ai/text-generation/catalog";
import { Model } from "@/shared/ai/types/model";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModelItemStatus } from "./types";

export type CatalogEntry = (Model | WhisperModel) & {
  modelCategory: "llm" | "whisper";
};

export function useModels() {
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(
    null,
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloadedModelIds, setDownloadedModelIds] = useState<string[]>([]);

  const catalog = useMemo((): CatalogEntry[] => {
    try {
      const llm: CatalogEntry[] = getAllModels().map((m) => ({
        ...m,
        modelCategory: "llm" as const,
      }));
      const whisper: CatalogEntry[] = WHISPER_CATALOG.map((m) => ({
        ...m,
        modelCategory: "whisper" as const,
      }));
      return [...llm, ...whisper];
    } catch (error) {
      console.error("Failed to load model catalog", error);
      return [];
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDownloadedModels = async () => {
      try {
        const map = await getDownloadedModels();
        if (isMounted) {
          setDownloadedModelIds(Object.keys(map));
        }
      } catch (error) {
        console.error("Failed to read downloaded models", error);
        if (isMounted) {
          setDownloadedModelIds([]);
        }
      }
    };

    loadDownloadedModels();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const filteredCatalog = useMemo((): CatalogEntry[] => {
    try {
      if (!searchQuery.trim()) return catalog;

      const query = searchQuery.toLowerCase();

      return catalog.filter(
        (model) =>
          model.displayName.toLowerCase().includes(query) ||
          model.description.toLowerCase().includes(query) ||
          (("bytes" in model ? model.bytes : undefined) ?? "")
            .toLowerCase()
            .includes(query),
      );
    } catch (error) {
      console.error("Failed to filter model catalog", error);
      return catalog;
    }
  }, [catalog, searchQuery]);

  const downloadedModelIdSet = useMemo(
    () => new Set(downloadedModelIds),
    [downloadedModelIds],
  );

  const downloadModel = useCallback(async (modelId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const model = findModelById(modelId) ?? findWhisperModelById(modelId);
      if (!model) {
        setErrorMessage("Modelo não encontrado no catálogo.");
        return;
      }

      setDownloadingModelId(modelId);
      setDownloadProgress(0);

      const result = await downloadModelById(
        modelId,
        model.downloadLink,
        model.modelType,
        (info) => {
          setDownloadProgress(Math.round(info.progress));
        },
      );

      if (!result.success) {
        setErrorMessage(result.error.message);
      }
    } catch (error) {
      console.error("Failed to download model", error);
      setErrorMessage("Falha ao baixar modelo.");
    } finally {
      setDownloadingModelId(null);
      setRefreshKey((v) => v + 1);
      setIsLoading(false);
    }
  }, []);

  const removeModel = useCallback(async (modelId: string) => {
    setErrorMessage(null);
    try {
      const result = await removeDownloadedModel(modelId);
      if (!result.success) {
        setErrorMessage(result.error.message);
      }
    } catch (error) {
      console.error("Failed to remove model", error);
      setErrorMessage("Falha ao remover modelo.");
    } finally {
      setRefreshKey((v) => v + 1);
    }
  }, []);

  const statuses = useMemo(() => {
    if (!filteredCatalog.length) return {};

    const nextStatuses: Record<string, ModelItemStatus> = {};

    for (const { id } of filteredCatalog) {
      const isDownloading = downloadingModelId === id;
      const isDownloaded = downloadedModelIdSet.has(id);

      nextStatuses[id] = isDownloading
        ? {
            status: "downloading",
            progress: downloadProgress,
            isLowRam: false,
          }
        : {
            status: isDownloaded ? "downloaded" : "not-downloaded",
            progress: isDownloaded ? 100 : 0,
            isLowRam: false,
          };
    }

    return nextStatuses;
  }, [
    filteredCatalog,
    downloadingModelId,
    downloadProgress,
    downloadedModelIdSet,
  ]);

  return useMemo(
    () => ({
      // State
      catalog: filteredCatalog,
      downloadedModelIds,
      statuses,
      isLoading,
      downloadingModelId,
      downloadProgress,
      errorMessage,
      searchQuery,

      // Actions
      downloadModel,
      removeModel,
      setSearchQuery,
    }),
    [
      filteredCatalog,
      downloadedModelIds,
      statuses,
      isLoading,
      downloadingModelId,
      downloadProgress,
      errorMessage,
      searchQuery,
      downloadModel,
      removeModel,
    ],
  );
}
