import type { DeviceInfo } from "@/shared/types/device";

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
    hasGPU: false,
    gpuMemoryMB: undefined,
    gpuType: undefined,
    platform: "android",
    osVersion: "12.0",
    deviceModel: "Pixel 4a",
    detectedAt: Date.now(),
    detectionMethod: {
      ram: "react-native-device-info",
      gpu: "heuristic",
      cpuCores: "native",
    },
    ...overrides,
  };
}

/** 4 GB Android budget device */
export function mockBudgetDevice(): DeviceInfo {
  return mockDeviceInfo({
    totalRAM: 4,
    availableRAM: 3.2,
    hasGPU: false,
    gpuMemoryMB: undefined,
    deviceModel: "Pixel 4a",
  });
}

/** 6 GB Android mid-range device */
export function mockMidRangeDevice(): DeviceInfo {
  return mockDeviceInfo({
    totalRAM: 6,
    availableRAM: 5.2,
    hasGPU: true,
    gpuMemoryMB: 1500,
    gpuType: "adreno",
    deviceModel: "Samsung Galaxy A52",
  });
}

/** 8 GB iOS premium device */
export function mockPremiumDevice(): DeviceInfo {
  return mockDeviceInfo({
    totalRAM: 8,
    availableRAM: 7.1,
    cpuBrand: "bionic",
    hasGPU: true,
    gpuMemoryMB: 8192,
    gpuType: "metal",
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
