/**
 * T038/T039/T040/T041/T042: Model Management view-model
 *
 * Legend State observables:
 * - catalog: ModelCatalogEntry[]
 * - downloadedModels: { id, localPath, isLoaded }[]
 * - activeModel: string | null
 * - isLoading: boolean
 * - downloadProgress: number (0-100)
 * - downloadingModelId: string | null
 * - errorMessage: string | null
 * - ramWarning: { modelId, requiredMB, availableMB } | null
 *
 * Actions: browseModels(), downloadModel(), loadModel(), unloadModel(), refreshStatus()
 */
import { getLocalAIRuntime } from "@/shared/ai/runtime/local-ai-runtime.service";
import {
  findModelById,
  MODEL_CATALOG,
  type ModelCatalogEntry,
} from "@/shared/ai/catalog";
import { getModelManager } from "@/shared/ai/manager/model-manager.service";
import { observable, Observable } from "@legendapp/state";
import DeviceInfo from "react-native-device-info";

export interface DownloadedModelInfo {
  id: string;
  localPath: string | null;
  isLoaded: boolean;
}

export interface ModelsState {
  catalog: Observable<ModelCatalogEntry[]>;
  downloadedModels: Observable<DownloadedModelInfo[]>;
  activeModel: Observable<string | null>;
  isLoading: Observable<boolean>;
  downloadProgress: Observable<number>;
  downloadingModelId: Observable<string | null>;
  errorMessage: Observable<string | null>;
  ramWarning: Observable<{
    modelId: string;
    requiredMB: number;
    availableMB: number;
  } | null>;
}

let modelsState: ModelsState | null = null;

export function getModelsState(): ModelsState {
  if (!modelsState) {
    modelsState = {
      catalog: observable<ModelCatalogEntry[]>(MODEL_CATALOG),
      downloadedModels: observable<DownloadedModelInfo[]>([]),
      activeModel: observable<string | null>(null),
      isLoading: observable(false),
      downloadProgress: observable(0),
      downloadingModelId: observable<string | null>(null),
      errorMessage: observable<string | null>(null),
      ramWarning: observable<{
        modelId: string;
        requiredMB: number;
        availableMB: number;
      } | null>(null),
    };
  }
  return modelsState;
}

/** T038: Browse available models (catalog is static, just display) */
export function browseModels(): void {
  const state = getModelsState();
  state.catalog.set(MODEL_CATALOG);
}

/**
 * T039: Download a model with progress callback.
 * Validates disk space before starting.
 */
export async function downloadModel(modelId: string): Promise<void> {
  const state = getModelsState();
  const model = findModelById(modelId);
  if (!model) {
    state.errorMessage.set("Modelo não encontrado no catálogo.");
    return;
  }

  // T041: Disk space validation
  const manager = getModelManager();
  const diskResult = await manager.hasEnoughDisk(model.fileSizeBytes);
  if (!diskResult.success) {
    state.errorMessage.set(diskResult.error.message);
    return;
  }

  state.isLoading.set(true);
  state.downloadingModelId.set(modelId);
  state.downloadProgress.set(0);
  state.errorMessage.set(null);

  const downloadResult = await manager.downloadModel(
    modelId,
    model.downloadUrl,
    undefined,
    model.fileSizeBytes,
    (progress: number) => {
      state.downloadProgress.set(progress);
    },
  );

  state.isLoading.set(false);
  state.downloadingModelId.set(null);

  if (!downloadResult.success) {
    state.errorMessage.set(downloadResult.error.message);
    return;
  }

  await refreshStatus();
}

/**
 * T040: Load a model into runtime.
 * - Calls model-manager.loadModel()
 * - Calls model-manager.setActiveModel() for persistence
 * - Broadcasts to chat VM's isModelReady
 */
export async function loadModel(
  modelId: string,
  onChatReady?: () => void,
): Promise<void> {
  const state = getModelsState();
  const model = findModelById(modelId);
  if (!model) {
    state.errorMessage.set("Modelo não encontrado no catálogo.");
    return;
  }

  // T042: RAM warning check
  const manager = getModelManager();
  const ramResult = await manager.hasEnoughRam(model.estimatedRamBytes);
  if (!ramResult.success) {
    state.ramWarning.set({
      modelId,
      requiredMB: Math.round(model.estimatedRamBytes / 1024 / 1024),
      availableMB: Math.round(
        (await DeviceInfo.getTotalMemory()) / 1024 / 1024,
      ),
    });
    state.errorMessage.set(ramResult.error.message);
    return;
  }

  state.ramWarning.set(null);
  state.isLoading.set(true);
  state.errorMessage.set(null);

  const localPath = await manager.getDownloadedModelPath(
    modelId,
    model.downloadUrl,
  );

  if (!localPath) {
    state.isLoading.set(false);
    state.errorMessage.set(
      "Arquivo do modelo nao encontrado no disco. Baixe o modelo novamente.",
    );
    return;
  }

  const loadResult = await manager.loadModel(modelId, localPath);

  state.isLoading.set(false);

  if (!loadResult.success) {
    state.errorMessage.set(loadResult.error.message);
    return;
  }

  // T040: Persist active model
  manager.setActiveModel(modelId);
  state.activeModel.set(modelId);

  // Broadcast to chat VM
  if (onChatReady) {
    onChatReady();
  }

  refreshStatus();
}

/** Unload current model */
export async function unloadModel(): Promise<void> {
  const state = getModelsState();
  const manager = getModelManager();

  state.isLoading.set(true);
  const result = await manager.unloadModel();
  state.isLoading.set(false);

  if (!result.success) {
    state.errorMessage.set(result.error.message);
    return;
  }

  refreshStatus();
}

/** Refresh downloaded/loaded model status */
export async function refreshStatus(): Promise<void> {
  const state = getModelsState();
  const runtime = getLocalAIRuntime();
  const currentModel = runtime.getCurrentModel();
  const manager = getModelManager();

  state.activeModel.set(currentModel?.id ?? null);

  // Read persisted downloaded model paths
  const downloadedPaths = manager.getDownloadedModels();

  const downloaded: DownloadedModelInfo[] = MODEL_CATALOG.map((m) => ({
    id: m.id,
    localPath: downloadedPaths[m.id] ?? null,
    isLoaded: m.id === currentModel?.id,
  }));

  state.downloadedModels.set(downloaded);
}
