import { aiInfo, aiWarn } from "@/shared/ai/log";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

export type DeviceTier = "low" | "mid" | "high";
export type MemoryPressure = "low" | "medium" | "high";

export interface DeviceProfile {
  totalRAM: number;
  availableRAM: number;
  cpuCores: number;
  hasGPU: boolean;
  gpuBackend: "Metal" | "OpenCL" | "Vulkan" | "none";
  platform: "iOS" | "Android";
  tier: DeviceTier;
  recommended: {
    n_ctx: number;
    n_batch: number;
    n_threads: number;
    n_gpu_layers: number;
    maxModelSize: number;
    enableFlashAttention: boolean;
    enableThinking: boolean;
  };
  limits: {
    maxConcurrentModels: number;
    maxContextWindow: number;
    warningThreshold: number;
  };
  memoryPressure: MemoryPressure;
}

const GB = 1024 ** 3;

interface MemorySample {
  timestamp: number;
  available: number;
}

class MemoryMonitor {
  private samples: MemorySample[] = [];
  private maxSamples = 10;

  addSample(available: number): void {
    this.samples.push({ timestamp: Date.now(), available });
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  getAverageAvailable(): number {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((acc, s) => acc + s.available, 0);
    return sum / this.samples.length;
  }

  getMinAvailable(): number {
    if (this.samples.length === 0) return 0;
    return Math.min(...this.samples.map((s) => s.available));
  }

  getMemoryPressure(): MemoryPressure {
    const avg = this.getAverageAvailable();
    const min = this.getMinAvailable();
    if (avg < 2 || min < 1) return "high";
    if (avg < 4 || min < 2) return "medium";
    return "low";
  }
}

const memoryMonitor = new MemoryMonitor();

async function detectCpuCores(): Promise<number> {
  try {
    const totalMemory = await DeviceInfo.getTotalMemory();
    const gb = totalMemory / GB;
    const isIOS = Platform.OS === "ios";

    if (isIOS) {
      if (gb >= 8) return 6;
      if (gb >= 4) return 4;
      return 2;
    }
    if (gb >= 8) return 8;
    if (gb >= 6) return 6;
    if (gb >= 4) return 4;
    return 2;
  } catch {
    aiWarn("DEVICE:cpu-detection-failed", "Using fallback value 4");
    return 4;
  }
}

function calculateDeviceTier(
  totalRAM: number,
  cpuCores: number,
  hasGPU: boolean,
): DeviceTier {
  if (totalRAM >= 8 && cpuCores >= 6 && hasGPU) return "high";
  if (totalRAM >= 4 && cpuCores >= 4) return "mid";
  return "low";
}

function getRecommendedConfig(
  tier: DeviceTier,
): DeviceProfile["recommended"] {
  switch (tier) {
    case "high":
      return {
        n_ctx: 4096,
        n_batch: 512,
        n_threads: 8,
        n_gpu_layers: 99,
        maxModelSize: 4 * 1024 ** 3,
        enableFlashAttention: true,
        enableThinking: true,
      };
    case "mid":
      return {
        n_ctx: 2048,
        n_batch: 256,
        n_threads: 4,
        n_gpu_layers: 99,
        maxModelSize: 2 * 1024 ** 3,
        enableFlashAttention: true,
        enableThinking: false,
      };
    case "low":
      return {
        n_ctx: 1024,
        n_batch: 128,
        n_threads: 2,
        n_gpu_layers: 0,
        maxModelSize: 1 * 1024 ** 3,
        enableFlashAttention: false,
        enableThinking: false,
      };
  }
}

function getDeviceLimits(tier: DeviceTier): DeviceProfile["limits"] {
  switch (tier) {
    case "high":
      return {
        maxConcurrentModels: 2,
        maxContextWindow: 8192,
        warningThreshold: 80,
      };
    case "mid":
      return {
        maxConcurrentModels: 1,
        maxContextWindow: 4096,
        warningThreshold: 70,
      };
    case "low":
      return {
        maxConcurrentModels: 1,
        maxContextWindow: 2048,
        warningThreshold: 60,
      };
  }
}

function calculateDynamicBuffer(
  totalGB: number,
  pressure: MemoryPressure,
): number {
  const baseBuffer = totalGB > 8 ? 0.8 : totalGB > 6 ? 1.0 : 1.5;
  const multiplier = { low: 0.8, medium: 1.0, high: 1.3 };
  return baseBuffer * multiplier[pressure];
}

export { getRecommendedConfig, getDeviceLimits };

export async function detectDevice(): Promise<DeviceProfile> {
  const [total, used, cpuCores] = await Promise.all([
    DeviceInfo.getTotalMemory().catch(() => 4 * GB),
    DeviceInfo.getUsedMemory().catch(() => 0),
    detectCpuCores(),
  ]);

  const isIOS = Platform.OS === "ios";
  const totalGB = total / GB;
  const rawAvailable = (total - used) / GB;

  memoryMonitor.addSample(rawAvailable);
  const pressure = memoryMonitor.getMemoryPressure();
  const buffer = calculateDynamicBuffer(totalGB, pressure);
  const availableRAM = Math.max(0, rawAvailable - buffer);

  const hasGPU = isIOS;
  const tier = calculateDeviceTier(totalGB, cpuCores, hasGPU);
  const recommended = getRecommendedConfig(tier);
  const limits = getDeviceLimits(tier);

  const profile: DeviceProfile = {
    totalRAM: totalGB,
    availableRAM,
    cpuCores,
    hasGPU,
    gpuBackend: isIOS ? "Metal" : "none",
    platform: isIOS ? "iOS" : "Android",
    tier,
    recommended,
    limits,
    memoryPressure: pressure,
  };

  aiInfo(
    "DEVICE:detect",
    `platform=${profile.platform} tier=${tier} cpuCores=${cpuCores}`,
    { device: profile },
  );

  return profile;
}
