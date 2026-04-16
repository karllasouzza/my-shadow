import type { DeviceInfo, MemoryPressure } from "@/shared/device/types";

/** Default CPU cores for test device simulations */
const DEFAULT_CPU_CORES = 8;

export function mockDeviceInfo(
  overrides: Partial<DeviceInfo> = {},
): DeviceInfo {
  return {
    totalRAM: 4,
    availableRAM: 3.2,
    cpuCores: DEFAULT_CPU_CORES,
    cpuBrand: "snapdragon",
    performanceCores: 3,
    hasGPU: false,
    gpuMemoryMB: undefined,
    gpuType: undefined,
    gpuBackend: null,
    platform: "android",
    osVersion: "12.0",
    deviceModel: "Pixel 4a",
    detectedAt: Date.now(),
    ...overrides,
  };
}

/** 4 GB Android budget device */
export function mockBudgetDevice(): DeviceInfo {
  return mockDeviceInfo({
    totalRAM: 4,
    availableRAM: 3.2,
    cpuCores: 4,
    performanceCores: 2,
    hasGPU: false,
    gpuMemoryMB: undefined,
    gpuBackend: null,
    deviceModel: "Pixel 4a",
  });
}

/** 6 GB Android mid-range device */
export function mockMidRangeDevice(): DeviceInfo {
  return mockDeviceInfo({
    totalRAM: 6,
    availableRAM: 5.2,
    cpuCores: 6,
    performanceCores: 3,
    hasGPU: true,
    gpuMemoryMB: 1500,
    gpuType: "adreno",
    gpuBackend: "opencl",
    deviceModel: "Samsung Galaxy A52",
  });
}

/** 8 GB iOS premium device */
export function mockPremiumDevice(): DeviceInfo {
  return mockDeviceInfo({
    totalRAM: 8,
    availableRAM: 7.1,
    cpuCores: 8,
    performanceCores: 4,
    cpuBrand: "bionic",
    hasGPU: true,
    gpuMemoryMB: 8192,
    gpuType: "metal",
    gpuBackend: "metal",
    platform: "ios",
    osVersion: "17.3.1",
    deviceModel: "iPhone15,2",
  });
}

/** Simulate high memory pressure (70% utilization) */
export function mockHighPressureDevice(): DeviceInfo {
  return mockDeviceInfo({
    totalRAM: 4,
    availableRAM: 1.2,
  });
}

/** Simulate critically low available RAM (<1.5 GB) */
export function mockCriticalPressureDevice(): DeviceInfo {
  return mockDeviceInfo({
    totalRAM: 4,
    availableRAM: 0.8,
  });
}

/** Simulate MemoryPressure at a given utilization percent */
export function simulateMemoryPressure(percent: number): MemoryPressure {
  const totalRAM = 4 * 1024 ** 3;
  const usedRAM = (percent / 100) * totalRAM;
  const availableRAM = Math.max(0, totalRAM - usedRAM);
  return {
    totalRAM,
    usedRAM,
    availableRAM,
    utilizationPercent: percent,
    criticalLevel: percent > 85,
    canRunInference: availableRAM > 64 * 100,
    recommendedMaxContext: Math.min(
      4096,
      Math.floor((availableRAM * 0.5) / 70),
    ),
    recommendedBatch: Math.min(
      512,
      Math.max(64, Math.floor((availableRAM * 0.3) / 1024)),
    ),
    sampledAt: Date.now(),
  };
}
