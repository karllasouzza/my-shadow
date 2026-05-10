import { isModelDownloaded } from "@/shared/ai/manager";
import {
    autoLoadLastModel,
    getAvailableModels,
    getSelectedModelId,
    loadModel,
    unloadModel,
} from "@/shared/ai/model-loader";
import { getTextEngine } from "@/shared/ai/text-generation";
import { getWhisperRuntime } from "@/shared/ai/stt/runtime";
import type { AvailableModel } from "@/shared/ai/types/model-loader";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useModelManager() {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentWhisperId, setCurrentWhisperId] = useState<string | null>(null);
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

  const loadWhisper = useCallback(
    async (modelId: string) => {
      setIsLoading(true);
      setError(null);

      const result = await loadModel(modelId);
      setIsLoading(false);

      if (!result.success) {
        setError(result.error ?? "Falha ao carregar modelo de voz.");
        return false;
      }

      setCurrentWhisperId(modelId);
      await refresh();
      return true;
    },
    [refresh],
  );

  const unload = useCallback(async () => {
    // Get the currently loaded model ID
    const modelId = getSelectedModelId("gguf");
    if (!modelId) {
      setError("Nenhum modelo carregado.");
      return false;
    }

    setIsLoading(true);
    const result = await unloadModel(modelId);
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
    const engine = getTextEngine();

    // Check if a model is already loaded
    if (engine.isReady()) {
      setCurrentId(engine.getState().modelId ?? null);
      setIsReady(true);
      setError(null);
      await refresh();
      return true;
    }

    setIsLoading(true);
    const result = await autoLoadLastModel("gguf");
    setIsLoading(false);

    if (result.success) {
      setCurrentId(engine.getState().modelId ?? null);
      setIsReady(true);
      setError(null);
      await refresh();
      return true;
    }

    if (result.error) {
      setError(result.error);
    }

    return false;
  }, [refresh]);

  const autoLoadWhisper = useCallback(async () => {
    const runtime = getWhisperRuntime();

    // Check if a Whisper model is already loaded
    if (runtime.isModelLoaded()) {
      setCurrentWhisperId(runtime.getCurrentModel()?.id ?? null);
      await refresh();
      return true;
    }

    setIsLoading(true);
    const result = await autoLoadLastModel("bin");
    setIsLoading(false);

    if (result.success) {
      setCurrentWhisperId(runtime.getCurrentModel()?.id ?? null);
      await refresh();
      return true;
    }

    // Silent failure for Whisper autoload — it's optional for text-based chat
    return false;
  }, [refresh]);

  const sync = useCallback(async () => {
    const engine = getTextEngine();
    const state = engine.getState();

    if (state.isLoaded && state.modelId && !(await isModelDownloaded(state.modelId))) {
      await engine.unloadModel();
      setCurrentId(null);
      setIsReady(false);
      setError("Modelo removido do dispositivo.");
      await refresh();
      return;
    }

    setCurrentId(state.modelId ?? null);
    setCurrentWhisperId(getSelectedModelId("bin"));
    setIsReady(state.isLoaded);
    await refresh();
  }, [refresh]);

  const selectedId = useMemo(
    () => currentId ?? getSelectedModelId("gguf"),
    [currentId, isReady, available.length],
  );

  const selectedWhisperId = useMemo(
    () => currentWhisperId ?? getSelectedModelId("bin"),
    [currentWhisperId, available.length],
  );

  return useMemo(
    () => ({
      isReady,
      isLoading,
      error,
      currentId,
      available,
      selectedId,
      selectedWhisperId,
      load,
      loadWhisper,
      unload,
      autoLoad,
      autoLoadWhisper,
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
      selectedWhisperId,
      load,
      loadWhisper,
      unload,
      autoLoad,
      autoLoadWhisper,
      sync,
      refresh,
    ],
  );
}
