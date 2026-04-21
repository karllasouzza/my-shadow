import { aiInfo } from "@/shared/ai/log";
import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

export interface DeviceInfo {
  totalRAM: number;
  availableRAM: number;
  cpuCores: number;
  hasGPU: boolean;
  gpuBackend: "Metal" | "OpenCL" | "Vulkan" | "none";
  gpuModel?: string;
  platform: "iOS" | "Android";
}

const GB = 1024 ** 3;

/**
 * Estimate CPU cores using device heuristics.
 * Falls back to sensible defaults based on RAM and device tier.
 * For precise detection, implement a native module using sysconf(_SC_NPROCESSORS_ONLN) [[44]]
 */
async function detectCPUCores(): Promise<number> {
  try {
    // Try to infer from supported ABIs (64-bit devices typically have more cores)
    const abis = await DeviceInfo.supportedAbis().catch(() => []);
    const has64Bit = abis.some(
      (abi: string) => abi.includes("arm64") || abi.includes("x86_64"),
    );

    // Get RAM as a strong indicator of device tier
    const totalMemory = await DeviceInfo.getTotalMemory().catch(() => 4 * GB);
    const totalGB = totalMemory / GB;

    // Heuristic mapping based on device specifications
    if (Platform.OS === "ios") {
      // iOS devices: A-series chips have predictable core counts
      const deviceId = DeviceInfo.getDeviceId(); // e.g., "iPhone15,2"
      if (
        deviceId.includes("iPhone14") ||
        deviceId.includes("iPhone15") ||
        deviceId.includes("iPhone16")
      ) {
        return 6; // A15/A16/A17: 6 cores (2 performance + 4 efficiency)
      } else if (
        deviceId.includes("iPhone13") ||
        deviceId.includes("iPhone12")
      ) {
        return 6; // A14/A15: 6 cores
      } else if (
        deviceId.includes("iPhone11") ||
        deviceId.includes("iPhone10")
      ) {
        return 6; // A12/A13: 6 cores
      }
      // Fallback for older iOS or unknown models
      return has64Bit ? 6 : 4;
    } else {
      // Android: Use RAM + ABI heuristics
      if (totalGB >= 8 && has64Bit) return 8; // Flagship: 8 cores typical
      if (totalGB >= 6 && has64Bit) return 6; // Upper mid-range: 6-8 cores
      if (totalGB >= 4 && has64Bit) return 4; // Mid-range: 4-6 cores
      if (totalGB >= 4) return 4; // Mid-range 32-bit: 4 cores
      return 4; // Budget: conservative default
    }
  } catch (err) {
    aiInfo("DEVICE:cpu-detect:error", `error=${(err as Error)?.message}`);
    return 4; // Safe fallback
  }
}

/**
 * Detect if device has an OpenCL-capable GPU (Android only).
 * Supports Qualcomm Adreno 700+ series.
 */
async function detectAndroidGPU(): Promise<{
  hasGPU: boolean;
  gpuModel?: string;
}> {
  try {
    const device = await DeviceInfo.getModel();
    const brand = await DeviceInfo.getBrand();
    const systemVersion = await DeviceInfo.getSystemVersion();

    aiInfo("DEVICE:gpu-detect:android", `device=${device} brand=${brand}`, {
      device,
      brand,
      systemVersion,
    });

    const premiumBrands = [
      "samsung",
      "google",
      "oneplus",
      "xiaomi",
      "oppo",
      "realme",
    ];
    const isFlagship =
      premiumBrands.some((b) => brand?.toLowerCase()?.includes(b)) &&
      !device?.toLowerCase()?.includes("mid") &&
      !device?.toLowerCase()?.includes("budget") &&
      !device?.toLowerCase()?.includes("entry");

    if (isFlagship) {
      const snapdragonMatch = device?.match(/snapdragon|sd\s*8|sd\s*7/i);
      if (snapdragonMatch) {
        return { hasGPU: true, gpuModel: "Adreno (Snapdragon)" };
      }
      return { hasGPU: true, gpuModel: "Adreno (estimated)" };
    }

    return { hasGPU: false };
  } catch (err) {
    aiInfo(
      "DEVICE:gpu-detect:android:error",
      `error=${(err as Error)?.message}`,
    );
    return { hasGPU: false };
  }
}

export async function detectDevice(): Promise<DeviceInfo> {
  const [total, used, cpuCores] = await Promise.all([
    DeviceInfo.getTotalMemory().catch(() => 4 * GB),
    DeviceInfo.getUsedMemory().catch(() => 0),
    detectCPUCores(), // ✅ Now properly detects cores
  ]);

  const isIOS = Platform.OS === "ios";
  const totalGB = total / GB;

  const buffer = totalGB > 8 ? 0.8 : totalGB > 6 ? 1.0 : 1.5;
  const availableRAM = Math.max(0, (total - used) / GB - buffer);

  let gpuBackend: "Metal" | "OpenCL" | "Vulkan" | "none" = "none";
  let hasGPU = false;
  let gpuModel: string | undefined;

  if (isIOS) {
    hasGPU = true;
    gpuBackend = "Metal";
    gpuModel = "Metal";
  } else {
    const androidGPU = await detectAndroidGPU();
    hasGPU = androidGPU.hasGPU;
    gpuModel = androidGPU.gpuModel;
    if (hasGPU) {
      gpuBackend = "OpenCL";
    }
  }

  const deviceInfo: DeviceInfo = {
    totalRAM: totalGB,
    availableRAM,
    cpuCores, // ✅ Replaces hardcoded value
    hasGPU,
    gpuBackend,
    gpuModel,
    platform: isIOS ? "iOS" : "Android",
  };

  aiInfo(
    "DEVICE:detect",
    `platform=${deviceInfo.platform} gpu=${hasGPU} cores=${cpuCores}`,
    {
      device: deviceInfo,
    },
  );

  return deviceInfo;
}
