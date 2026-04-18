import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

export interface DeviceInfo {
  totalRAM: number;
  availableRAM: number;
  cpuCores: number;
  hasGPU: boolean;
  gpuBackend: "Metal" | "OpenCL" | "Vulkan" | "none";
  platform: "iOS" | "Android";
}

const GB = 1024 ** 3;

export async function detectDevice(): Promise<DeviceInfo> {
  const [total, used, cores] = await Promise.all([
    DeviceInfo.getTotalMemory().catch(() => 4 * GB),
    DeviceInfo.getUsedMemory().catch(() => 0),
    DeviceInfo.getMaxMemory().catch(() => 4),
  ]);

  const isIOS = Platform.OS === "ios";
  const availableRAM = Math.max(0, (total - used) / GB - (isIOS ? 1.5 : 2.0));

  return {
    totalRAM: total / GB,
    availableRAM,
    cpuCores: Math.min(cores || 4, 8),
    hasGPU: isIOS,
    gpuBackend: isIOS ? "Metal" : "none",
    platform: isIOS ? "iOS" : "Android",
  };
}
