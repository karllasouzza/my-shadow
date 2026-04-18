import { aiInfo } from "@/shared/ai/log";
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
  const totalGB = total / GB;
  
  // Adaptive RAM buffer: larger devices need less buffer percentage
  // This prevents over-conservative memory reporting on modern devices
  const buffer = totalGB > 8 ? 0.8 : totalGB > 6 ? 1.0 : 1.5;
  const availableRAM = Math.max(0, (total - used) / GB - buffer);

  const deviceInfo: DeviceInfo = {
    totalRAM: totalGB,
    availableRAM,
    // TODO: Implement proper CPU core detection for better performance
    // Currently hardcoded to 4, but modern phones have 6-8+ cores
    cpuCores: 4,
    hasGPU: isIOS,
    gpuBackend: isIOS ? "Metal" : "none",
    platform: isIOS ? "iOS" : "Android",
  };

  aiInfo("DEVICE:detect", `platform=${deviceInfo.platform}`, {
    device: deviceInfo,
  });

  return deviceInfo;
}
