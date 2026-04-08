/**
 * Slice 5: RAM Cap Integration
 *
 * Wraps LocalAIRuntimeService usage to respect RAM caps during model loading.
 * Provides a safe initialization function that validates RAM budget before
 * loading any model into memory.
 */

import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
import { Result, createError, err, ok } from "@/shared/utils/app-error";
import { validateRamBudget } from "./ram-cap-validator";

/**
 * Initializes the AI runtime and loads a model while respecting the RAM budget cap.
 *
 * This function performs three steps:
 * 1. Initializes the local AI runtime
 * 2. Validates the model's estimated RAM usage against the budget
 * 3. Loads the model only if validation passes
 *
 * @param modelKey - The model identifier key
 * @param filePath - The local file path of the model binary
 * @param ramBudgetBytes - The maximum RAM budget in bytes (typically 60% of total)
 * @returns Result indicating success or failure
 */
export async function initAIRuntimeWithModelCap(
  modelKey: string,
  filePath: string,
  ramBudgetBytes: number,
): Promise<Result<void>> {
  try {
    const runtime = getLocalAIRuntime();

    // Step 1: Initialize the runtime
    const initResult = await runtime.initialize();
    if (!initResult.success) {
      return err(initResult.error);
    }

    // Step 2: Get model info to validate RAM
    // We need to estimate RAM usage — for custom models, we use file size as a proxy
    // (model RAM usage is typically 1.5-2x the file size for quantized models)
    const { MODEL_CATALOG } = await import("../model/model-configuration");
    const catalogModel = MODEL_CATALOG.find((m) => m.key === modelKey);

    let estimatedRamBytes: number;

    if (catalogModel) {
      // Use catalog estimate if available
      estimatedRamBytes = catalogModel.estimatedRamBytes;
    } else {
      // For custom models, estimate based on file size
      // Quantized models typically use ~1.7x their file size in RAM
      const { File } = await import("expo-file-system");
      const modelFile = new File(filePath);

      if (!modelFile.exists) {
        return err(
          createError(
            "NOT_FOUND",
            "Arquivo do modelo nao encontrado.",
            { filePath },
          ),
        );
      }

      // Estimate: file size * 1.7 for quantized model runtime memory
      estimatedRamBytes = Math.floor(modelFile.size * 1.7);
    }

    // Step 3: Validate RAM budget
    // We need total device RAM — get it from device detector
    const { getDeviceInfo } = await import("./device-detector");
    const deviceInfo = await getDeviceInfo();

    const ramValidation = validateRamBudget(estimatedRamBytes, deviceInfo.totalRamBytes);

    if (!ramValidation.valid) {
      return err(
        createError(
          "VALIDATION_ERROR",
          `Modelo excede limite de RAM: ${ramValidation.reason}`,
          {
            modelKey,
            estimatedRamBytes,
            ramBudgetBytes,
            totalDeviceRamBytes: deviceInfo.totalRamBytes,
          },
        ),
      );
    }

    // Step 4: Load the model
    const loadResult = await runtime.loadModel(modelKey, filePath);
    if (!loadResult.success) {
      return err(loadResult.error);
    }

    return ok(undefined);
  } catch (error) {
    return err(
      createError(
        "NOT_READY",
        "Falha ao inicializar runtime de IA com limite de RAM",
        {},
        error as Error,
      ),
    );
  }
}
