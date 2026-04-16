import {
    autoLoadLastModel,
    getAvailableModels,
    getSelectedModelId,
    isModelDownloaded,
    loadModel,
    unloadModel,
} from "@/shared/ai/model-loader";
import { getAIRuntime } from "@/shared/ai/runtime";
import type { AvailableModel } from "@/shared/ai/types/model-loader";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useModelManager() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [available, setAvailable] = useState<AvailableModel[]>([]);

  const refresh = useCallback(async () => {
    const models = await getAvailableModels();
    setAvailable(models);
    return models;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const load = useCallback(
    async (modelId: string) => {
      setIsLoading(true);
      setError(null);

      const result = await loadModel(modelId);
      setIsLoading(false);

      if (!result.success) {
        setError(result.error ?? "Falha ao carregar modelo.");
        return false;
      }

      setCurrentId(modelId);
      setIsReady(true);
      await refresh();
      return true;
    },
    [refresh],
  );

  const unload = useCallback(async () => {
    setIsLoading(true);
    const result = await unloadModel();
    setIsLoading(false);

    if (!result.success) {
      setError(result.error ?? "Falha ao descarregar modelo.");
      return false;
    }

    setCurrentId(null);
    setIsReady(false);
    setError(null);
    await refresh();
    return true;
  }, [refresh]);

  const autoLoad = useCallback(async () => {
    const runtime = getAIRuntime();

    if (runtime.isModelLoaded()) {
      setCurrentId(runtime.getCurrentModel()?.id ?? null);
      setIsReady(true);
      setError(null);
      await refresh();
      return true;
    }

    setIsLoading(true);
    const result = await autoLoadLastModel();
    setIsLoading(false);

    if (result?.success) {
      setCurrentId(runtime.getCurrentModel()?.id ?? null);
      setIsReady(true);
      setError(null);
      await refresh();
      return true;
    }

    if (result?.error) {
      setError(result.error);
    }

    return false;
  }, [refresh]);

  const sync = useCallback(async () => {
    const runtime = getAIRuntime();
    const loaded = runtime.isModelLoaded();
    const model = runtime.getCurrentModel();

    if (loaded && model && !(await isModelDownloaded(model.id))) {
      await runtime.unloadModel();
      setCurrentId(null);
      setIsReady(false);
      setError("Modelo removido do dispositivo.");
      await refresh();
      return;
    }

    setCurrentId(model?.id ?? null);
    setIsReady(loaded);
    await refresh();
  }, [refresh]);

  const selectedId = useMemo(
    () => currentId ?? getSelectedModelId(),
    [currentId, isReady, available.length],
  );

  return useMemo(
    () => ({
      isReady,
      isLoading,
      error,
      currentId,
      available,
      selectedId,
      load,
      unload,
      autoLoad,
      sync,
      refresh,
    }),
    [
      isReady,
      isLoading,
      error,
      currentId,
      available,
      selectedId,
      load,
      unload,
      autoLoad,
      sync,
      refresh,
    ],
  );
}
