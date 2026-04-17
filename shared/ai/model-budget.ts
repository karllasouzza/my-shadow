// Memory budget calculation for AI model loading.
// Implements FR-005, FR-006, FR-007, FR-009 from spec 005-simplify-shared.
//
// NOTE: verifyIntegrity and preflightCheck use Node.js `crypto`/`fs` modules.
// These work under Bun (for tests and tooling) but require a native module
// replacement for React Native production builds.

import { createHash } from "crypto";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import type { IntegrityResult, PreflightCheckResult } from "@/shared/ai/types";

const BYTES_PER_GB = 1024 ** 3;
const WORKING_MEMORY_FACTOR = 0.15;
const FIXED_OVERHEAD_GB = 0.5;
const KV_CACHE_BYTES_PER_TOKEN_F16 = 2;
const KV_CACHE_BYTES_PER_TOKEN_Q8 = 1;
const KV_CACHE_BYTES_PER_TOKEN_Q4 = 0.5;
const ATTENTION_HEADS = 32;
const HEAD_DIM = 128;
const NUM_LAYERS = 32;

export interface MemoryBudgetResult {
  requiredGB: number;
  availableGB: number;
  sufficient: boolean;
  breakdown: {
    weightsGB: number;
    kvCacheGB: number;
    workingMemoryGB: number;
    overheadGB: number;
  };
}

/**
 * Pure calculation of memory required to load a model.
 *
 * Formula: Weights + KV Cache + Working (15%) + Overhead (0.5 GB)
 *
 * KV Cache = 2 (K+V) × numLayers × contextSize × (headDim × attentionHeads) × bytesPerElement
 */
export function calculateMemoryBudget(
  modelSizeGB: number,
  contextSize: number,
  kvCacheType: "f16" | "q8_0" | "q4_0",
  availableRAM: number,
): MemoryBudgetResult {
  const bytesPerToken =
    kvCacheType === "f16"
      ? KV_CACHE_BYTES_PER_TOKEN_F16
      : kvCacheType === "q8_0"
        ? KV_CACHE_BYTES_PER_TOKEN_Q8
        : KV_CACHE_BYTES_PER_TOKEN_Q4;

  // 2 × 32 × contextSize × 4096 × bytesPerElement
  const kvCacheBytes =
    2 * NUM_LAYERS * contextSize * HEAD_DIM * ATTENTION_HEADS * bytesPerToken;
  const kvCacheGB = kvCacheBytes / BYTES_PER_GB;

  const workingMemoryGB = (modelSizeGB + kvCacheGB) * WORKING_MEMORY_FACTOR;
  const requiredGB =
    modelSizeGB + kvCacheGB + workingMemoryGB + FIXED_OVERHEAD_GB;

  return {
    requiredGB,
    availableGB: availableRAM,
    sufficient: availableRAM >= requiredGB,
    breakdown: {
      weightsGB: modelSizeGB,
      kvCacheGB,
      workingMemoryGB,
      overheadGB: FIXED_OVERHEAD_GB,
    },
  };
}

/**
 * Reads the model file size from disk, then delegates to calculateMemoryBudget.
 * Falls back to a conservative 4 GB / 1024-token estimate when the file is
 * unavailable (e.g. during unit tests or before download).
 */
export async function calculateMemoryBudgetFromPath(
  modelPath: string,
  contextSize: number,
  kvCacheType: "f16" | "q8_0" | "q4_0",
  availableRAM: number,
): Promise<MemoryBudgetResult> {
  try {
    const stats = await stat(modelPath);
    const modelSizeGB = stats.size / BYTES_PER_GB;
    return calculateMemoryBudget(modelSizeGB, contextSize, kvCacheType, availableRAM);
  } catch {
    return calculateMemoryBudget(4, 1024, "f16", availableRAM);
  }
}

/**
 * Computes the SHA-256 hash of a model file and compares it to an optional
 * expected hash.
 *
 * NOTE: Uses Node.js `crypto` and `fs` streams — suitable for Bun-based
 * tooling and tests only. A native module is required for production RN usage.
 */
export async function verifyIntegrity(
  modelPath: string,
  expectedHash?: string,
): Promise<IntegrityResult> {
  const stats = await stat(modelPath);

  return new Promise<IntegrityResult>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(modelPath, { highWaterMark: 64 * 1024 });

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => {
      const calculatedHash = hash.digest("hex");
      resolve({
        calculatedHash,
        expectedHash,
        matches: expectedHash ? calculatedHash === expectedHash : true,
        filePath: modelPath,
        fileSize: stats.size,
        verifiedAt: Date.now(),
      });
    });
    stream.on("error", reject);
  });
}

export interface ModelPreflightInput {
  modelPath: string;
  availableRAM: number;
  contextSize?: number;
  kvCacheType?: "f16" | "q8_0" | "q4_0";
  expectedHash?: string;
}

/**
 * Runs pre-load checks (file existence, RAM budget, optional integrity) and
 * returns a consolidated result with pt-BR user-facing reason strings.
 */
export async function preflightCheck(
  input: ModelPreflightInput,
): Promise<PreflightCheckResult> {
  const reasons: string[] = [];
  let ramSufficient = false;
  let integrityStatus: "verified" | "unverified" | "failed" = "unverified";
  let requiredRAM = 0;
  let integrityOk = true;

  let fileSizeGB = 0;
  try {
    const stats = await stat(input.modelPath);
    fileSizeGB = stats.size / BYTES_PER_GB;
  } catch {
    reasons.push(
      `Modelo não encontrado: ${path.basename(input.modelPath)}`,
    );
    return {
      canLoad: false,
      requiredRAM: 0,
      availableRAM: input.availableRAM,
      ramSufficient: false,
      integrityOk: false,
      integrityStatus: "failed",
      reasons,
    };
  }

  const budget = calculateMemoryBudget(
    fileSizeGB,
    input.contextSize ?? 1024,
    input.kvCacheType ?? "q8_0",
    input.availableRAM,
  );
  requiredRAM = budget.requiredGB;
  ramSufficient = budget.sufficient;

  if (!ramSufficient) {
    const deficit = (budget.requiredGB - input.availableRAM).toFixed(2);
    reasons.push(
      `Memória insuficiente: ${input.availableRAM.toFixed(2)} GB disponível, ` +
        `${budget.requiredGB.toFixed(2)} GB necessário (déficit: ${deficit} GB)`,
    );
  }

  if (input.expectedHash) {
    try {
      const result = await verifyIntegrity(input.modelPath, input.expectedHash);
      if (result.matches) {
        integrityStatus = "verified";
        integrityOk = true;
      } else {
        integrityStatus = "failed";
        integrityOk = false;
        reasons.push(
          "Verificação de integridade falhou: o modelo pode estar corrompido. Tente baixar novamente.",
        );
      }
    } catch {
      integrityStatus = "failed";
      integrityOk = false;
      reasons.push("Não foi possível verificar a integridade do modelo.");
    }
  }

  return {
    canLoad: ramSufficient && integrityOk,
    requiredRAM,
    availableRAM: input.availableRAM,
    ramSufficient,
    integrityOk,
    integrityStatus,
    reasons,
  };
}
