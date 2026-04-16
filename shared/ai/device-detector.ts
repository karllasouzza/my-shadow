import type { CpuBrand, DeviceInfo, GpuType } from "@/shared/types/device";
import { Platform } from "react-native";
import DeviceInfoLib from "react-native-device-info";

/** Bytes → GB conversion factor */
const BYTES_TO_GB = 1024 ** 3;
/** Conservative OS overhead reservation in GB */
const OS_OVERHEAD_GB = 0.8;

export class DeviceDetector {
  async detect(): Promise<DeviceInfo> {
    const [totalRAMBytes, availableRAMBytes] = await Promise.all([
      this.getTotalRAMBytes(),
      this.getAvailableRAMBytes(),
    ]);

    const totalRAM = totalRAMBytes / BYTES_TO_GB;
    const availableRAM = availableRAMBytes / BYTES_TO_GB;

    const cpuCores = await this.detectCpuCores();
    const cpuBrand = await this.detectCpuBrand();

    const { hasGPU, gpuMemoryMB, gpuType, gpuDetectionMethod } =
      await this.detectGPU(totalRAMBytes);

    const osVersion = await DeviceInfoLib.getSystemVersion();
    const deviceModel = await DeviceInfoLib.getModel();
    const platform = Platform.OS as "ios" | "android";

    return {
      totalRAM,
      availableRAM,
      cpuCores,
      cpuBrand,
      hasGPU,
      gpuMemoryMB,
      gpuType,
      platform,
      osVersion,
      deviceModel,
      detectedAt: Date.now(),
      detectionMethod: {
        ram: "react-native-device-info",
        gpu: gpuDetectionMethod,
        cpuCores: "native",
      },
    };
  }

  private async getTotalRAMBytes(): Promise<number> {
    try {
      return await DeviceInfoLib.getTotalMemory();
    } catch {
      return 4 * BYTES_TO_GB;
    }
  }

  private async getAvailableRAMBytes(): Promise<number> {
    try {
      const used = await DeviceInfoLib.getUsedMemory();
      const total = await DeviceInfoLib.getTotalMemory();
      const available = Math.max(0, total - used - OS_OVERHEAD_GB * BYTES_TO_GB);
      return available;
    } catch {
      return 2 * BYTES_TO_GB;
    }
  }

  private async detectCpuCores(): Promise<number> {
    try {
      const count = await DeviceInfoLib.getMaxMemory();
      if (typeof count === "number" && count > 0) return Math.min(count, 16);
    } catch {
      // fall through
    }
    return 4;
  }

  private async detectCpuBrand(): Promise<CpuBrand> {
    try {
      const brand = (await DeviceInfoLib.getBrand()).toLowerCase();
      if (Platform.OS === "ios") return "bionic";
      if (brand.includes("qualcomm") || brand.includes("snapdragon"))
        return "snapdragon";
      if (brand.includes("exynos")) return "exynos";
      if (brand.includes("helio") || brand.includes("mediatek"))
        return "helio";
    } catch {
      // fall through
    }
    return "unknown";
  }

  private async detectGPU(totalRAMBytes: number): Promise<{
    hasGPU: boolean;
    gpuMemoryMB?: number;
    gpuType?: GpuType;
    gpuDetectionMethod: DeviceInfo["detectionMethod"]["gpu"];
  }> {
    if (Platform.OS === "ios") {
      return {
        hasGPU: true,
        gpuMemoryMB: Math.round(totalRAMBytes / (1024 * 1024)),
        gpuType: "metal",
        gpuDetectionMethod: "metal",
      };
    }

    const heuristicVRAMMB = Math.round((totalRAMBytes * 0.3) / (1024 * 1024));

    return {
      hasGPU: heuristicVRAMMB > 512,
      gpuMemoryMB: heuristicVRAMMB,
      gpuType: "adreno",
      gpuDetectionMethod: "heuristic",
    };
  }
}
