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
  const [total, used] = await Promise.all([
    DeviceInfo.getTotalMemory().catch(() => 4 * GB),
    DeviceInfo.getUsedMemory().catch(() => 0),
  ]);

  const isIOS = Platform.OS === "ios";
  const availableRAM = Math.max(0, (total - used) / GB - (isIOS ? 1.5 : 2.0));

  return {
    totalRAM: total / GB,
    availableRAM,
    cpuCores: 4,
    hasGPU: isIOS,
    gpuBackend: isIOS ? "Metal" : "none",
    platform: isIOS ? "iOS" : "Android",
  };
}
