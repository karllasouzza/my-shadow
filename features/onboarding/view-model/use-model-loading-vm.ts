/**
 * Onboarding: Model Loading ViewModel
 *
 * Manages state and actions for the model loading screen.
 * Integrates with LocalAIRuntimeService to load models into memory.
 * Validates model fits within 60% RAM budget before loading.
 * On success: updates lastUsedAt in ModelRepository.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MODEL_CATALOG } from '../model/model-configuration';
import { getModelRepository } from '../repository/model-repository';
import { getDeviceInfo } from '../service/device-detector';
import { getModelManager } from '../service/model-manager';
import { getLocalAIRuntime } from '@/shared/ai/local-ai-runtime';

export type LoadStatus = 'loading' | 'success' | 'failed';

export interface ModelLoadingState {
  loadStatus: LoadStatus;
  loadProgress: number;
  errorMessage: string | null;
  modelName: string | null;
  isLoading: boolean;
}

export interface UseModelLoadingVm {
  state: ModelLoadingState;
  actions: {
    loadModel: () => Promise<void>;
    retryLoad: () => Promise<void>;
    cancel: () => void;
  };
}

export const useModelLoadingVm = (): UseModelLoadingVm => {
  const modelManager = getModelManager();
  const modelRepository = getModelRepository();
  const runtime = getLocalAIRuntime();
  const loadStartedRef = useRef(false);

  const [state, setState] = useState<ModelLoadingState>({
    loadStatus: 'loading',
    loadProgress: 0,
    errorMessage: null,
    modelName: null,
    isLoading: true,
  });

  // Auto-load on mount
  useEffect(() => {
    if (!loadStartedRef.current) {
      loadStartedRef.current = true;
      loadModelInternal();
    }
  }, []);

  const loadModelInternal = useCallback(async () => {
    const activeModel = modelRepository.getActiveModel();

    if (!activeModel) {
      setState((s) => ({
        ...s,
        loadStatus: 'failed',
        isLoading: false,
        errorMessage:
          'Nenhum modelo configurado. Volte e selecione um modelo primeiro.',
      }));
      return;
    }

    setState((s) => ({
      ...s,
      loadStatus: 'loading',
      isLoading: true,
      errorMessage: null,
      loadProgress: 0,
      modelName: activeModel.displayName,
    }));

    try {
      // Validate model fits within 60% RAM budget
      const deviceInfo = await getDeviceInfo();
      const ramBudget60 = deviceInfo.ramBudget60;

      const catalogModel = MODEL_CATALOG.find(
        (m) => m.key === activeModel.id.split(':')[0],
      );

      if (catalogModel && catalogModel.estimatedRamBytes > ramBudget60) {
        setState((s) => ({
          ...s,
          loadStatus: 'failed',
          isLoading: false,
          errorMessage: `O modelo ${catalogModel.name} requer mais memoria RAM do que o disponivel neste dispositivo.`,
        }));
        return;
      }

      // Use the filePath from the active model config
      const filePath = activeModel.filePath || activeModel.customFolderUri;

      if (!filePath) {
        setState((s) => ({
          ...s,
          loadStatus: 'failed',
          isLoading: false,
          errorMessage:
            'Caminho do modelo nao encontrado. Faca o download novamente.',
        }));
        return;
      }

      // Verify model file exists
      const verifyResult = await modelManager.verifyModel(filePath);
      if (!verifyResult.success) {
        setState((s) => ({
          ...s,
          loadStatus: 'failed',
          isLoading: false,
          errorMessage: verifyResult.error.message,
        }));
        return;
      }

      setState((s) => ({ ...s, loadProgress: 30 }));

      // Load model into memory
      const loadResult = await modelManager.loadModel(activeModel.id, filePath);
      if (!loadResult.success) {
        setState((s) => ({
          ...s,
          loadStatus: 'failed',
          isLoading: false,
          errorMessage: loadResult.error.message,
        }));
        return;
      }

      setState((s) => ({ ...s, loadProgress: 80 }));

      // Also load into runtime for immediate use
      const runtimeResult = await runtime.loadModel(activeModel.id, filePath);
      if (!runtimeResult.success) {
        setState((s) => ({
          ...s,
          loadStatus: 'failed',
          isLoading: false,
          errorMessage:
            'Falha ao inicializar o modelo no runtime de IA local.',
        }));
        return;
      }

      setState((s) => ({ ...s, loadProgress: 100 }));

      // Update lastUsedAt in ModelRepository
      activeModel.lastUsedAt = new Date().toISOString();
      activeModel.isLoaded = true;
      modelRepository.saveActiveModel(activeModel);

      setState((s) => ({
        ...s,
        loadStatus: 'success',
        isLoading: false,
        loadProgress: 100,
      }));
    } catch {
      setState((s) => ({
        ...s,
        loadStatus: 'failed',
        isLoading: false,
        errorMessage:
          'Erro inesperado ao carregar o modelo. Tente novamente.',
      }));
    }
  }, []);

  const loadModel = useCallback(async () => {
    loadStartedRef.current = true;
    await loadModelInternal();
  }, [loadModelInternal]);

  const retryLoad = useCallback(async () => {
    setState((s) => ({
      ...s,
      errorMessage: null,
      loadProgress: 0,
      loadStatus: 'loading',
      isLoading: true,
    }));
    loadStartedRef.current = true;
    await loadModelInternal();
  }, [loadModelInternal]);

  const cancel = useCallback(() => {
    modelManager.cancelDownload();
    setState((s) => ({
      ...s,
      loadStatus: 'failed',
      isLoading: false,
      errorMessage: 'Carregamento cancelado pelo usuario.',
    }));
  }, []);

  return {
    state,
    actions: {
      loadModel,
      retryLoad,
      cancel,
    },
  };
};
