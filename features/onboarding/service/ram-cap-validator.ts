/**
 * Slice 5: RAM Cap Validator
 *
 * Validates model RAM usage against a 60% budget of total device RAM.
 * Integrates with LocalAIRuntimeService to reject models that exceed the budget.
 */

import { getLocalAIRuntime } from "@/shared/ai/local-ai-runtime";
import { Result, createError, err, ok } from "@/shared/utils/app-error";

/**
 * Validates whether a model's estimated RAM usage fits within the 60% budget.
 *
 * @param estimatedRamBytes - The model's estimated RAM consumption
 * @param totalDeviceRamBytes - Total device RAM in bytes
 * @returns Validation result with reason if invalid
 */
export function validateRamBudget(
  estimatedRamBytes: number,
  totalDeviceRamBytes: number,
): { valid: boolean; reason?: string } {
  const budget60 = Math.floor(totalDeviceRamBytes * 0.6);

  if (estimatedRamBytes <= 0) {
    return {
      valid: false,
      reason: "RAM estimada do modelo e invalida.",
    };
  }

  if (totalDeviceRamBytes <= 0) {
    return {
      valid: false,
      reason: "Nao foi possivel detectar a memoria RAM do dispositivo.",
    };
  }

  if (estimatedRamBytes > budget60) {
    const excessBytes = estimatedRamBytes - budget60;
    const excessPercent = ((excessBytes / budget60) * 100).toFixed(0);
    return {
      valid: false,
      reason: `Este modelo excede o orcamento de RAM em ${excessPercent}%. Escolha um modelo mais leve para evitar travamentos.`,
    };
  }

  const usagePercent = ((estimatedRamBytes / totalDeviceRamBytes) * 100).toFixed(
    0,
  );
  return {
    valid: true,
    reason: `Modelo utiliza ${usagePercent}% da RAM total, dentro do limite de 60%.`,
  };
}

/**
 * Initializes the AI runtime with a model, enforcing the RAM budget cap.
 * If the model exceeds the 60% RAM budget, initialization is rejected.
 *
 * @param modelKey - The model identifier
 * @param totalDeviceRamBytes - Total device RAM in bytes
 * @returns Result indicating success or failure
 */
export async function initAIRuntimeWithCap(
  modelKey: string,
  totalDeviceRamBytes: number,
): Promise<Result<void>> {
  try {
    const runtime = getLocalAIRuntime();

    // Initialize the runtime first
    const initResult = await runtime.initialize();
    if (!initResult.success) {
      return err(initResult.error);
    }

    // Get model configuration to check RAM estimate
    const { MODEL_CATALOG } = await import("../model/model-configuration");
    const modelConfig = MODEL_CATALOG.find((m) => m.key === modelKey);

    if (!modelConfig) {
      return err(
        createError(
          "NOT_FOUND",
          `Modelo "${modelKey}" nao encontrado no catalogo.`,
          { modelKey },
        ),
      );
    }

    // Validate RAM budget
    const ramValidation = validateRamBudget(
      modelConfig.estimatedRamBytes,
      totalDeviceRamBytes,
    );

    if (!ramValidation.valid) {
      return err(
        createError(
          "VALIDATION_ERROR",
          `Modelo rejeitado: ${ramValidation.reason}`,
          {
            modelKey,
            estimatedRamBytes: modelConfig.estimatedRamBytes,
            totalDeviceRamBytes,
            budget60: Math.floor(totalDeviceRamBytes * 0.6),
          },
        ),
      );
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
