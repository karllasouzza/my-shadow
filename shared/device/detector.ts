import { resolveCpuProfile, resolveGpuProfile } from "./hardware-database";
import { DetectionDeps, DeviceInfo } from "./types";

export const BYTES_TO_GB = 1024 ** 3;
export const OS_OVERHEAD_BYTES = 0.8 * BYTES_TO_GB;

export async function detectCapabilities(
  deps: DetectionDeps,
): Promise<DeviceInfo> {
  const state = await deps.getSystemState();

  const totalRAM = state.totalRAMBytes / BYTES_TO_GB;
  const availableRAM =
    Math.max(0, state.totalRAMBytes - state.usedRAMBytes - OS_OVERHEAD_BYTES) /
    BYTES_TO_GB;

  const cpuProfile = resolveCpuProfile(state.brand);
  const gpuProfile = resolveGpuProfile(deps.platform, state.brand);

  const performanceCores = Math.max(
    2,
    Math.ceil(state.cpuCores * cpuProfile.performanceCoreRatio),
  );
  const gpuMemoryMB = Math.round(
    (state.totalRAMBytes * gpuProfile.vramFraction) / (1024 * 1024),
  );

  return {
    totalRAM,
    availableRAM,
    cpuCores: Math.min(state.cpuCores, 16),
    performanceCores: Math.min(performanceCores, 8),
    cpuBrand: cpuProfile.brand,
    hasGPU: gpuProfile.backend !== null && gpuMemoryMB > 512,
    gpuMemoryMB: gpuProfile.backend ? gpuMemoryMB : undefined,
    gpuType: gpuProfile.type,
    gpuBackend: gpuProfile.backend,
    platform: deps.platform,
    osVersion: state.osVersion,
    deviceModel: state.model,
    detectedAt: Date.now(),
  };
}
