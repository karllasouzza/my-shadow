import type { CpuBrand, DeviceInfo, GpuBackend, GpuType } from "@/shared/types/device";

/** Bytes → GB conversion factor */
const BYTES_TO_GB = 1024 ** 3;
/** Conservative OS overhead reservation in GB */
const OS_OVERHEAD_GB = 0.8;
/** Heuristic: estimated GPU VRAM as fraction of total RAM (Android) */
const GPU_VRAM_FRACTION = 0.3;

export interface IDeviceInfoProvider {
  getTotalMemory(): Promise<number>;
  getUsedMemory(): Promise<number>;
  getMaxMemory(): Promise<number>;
  /** Number of CPU cores reported by the device (prefer a native source) */
  getNumberOfCores(): Promise<number>;
  getBrand(): Promise<string> | string;
  getSystemVersion(): Promise<string> | string;
  getModel(): Promise<string> | string;
}

export interface IPlatformProvider {
  readonly OS: "ios" | "android";
}

class DefaultDeviceInfoProvider implements IDeviceInfoProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private get lib() {
    return (
      require("react-native-device-info") as {
        default: typeof import("react-native-device-info");
      }
    ).default;
  }
  getTotalMemory() {
    return this.lib.getTotalMemory();
  }
  getUsedMemory() {
    return this.lib.getUsedMemory();
  }
  getMaxMemory() {
    return this.lib.getMaxMemory();
  }
  getNumberOfCores() {
    // react-native-device-info may expose getNumberOfCores as either
    // a sync number or a promise-returning function depending on platform.
    // Wrap with Promise.resolve to normalize.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (this.lib as any).getNumberOfCores?.();
    return Promise.resolve(res ?? 0);
  }
  getBrand() {
    return this.lib.getBrand();
  }
  getSystemVersion() {
    return this.lib.getSystemVersion();
  }
  getModel() {
    return this.lib.getModel();
  }
}

export class DeviceDetector {
  private readonly deviceInfo: IDeviceInfoProvider;
  private readonly platform: IPlatformProvider;

  constructor(
    deviceInfo?: IDeviceInfoProvider,
    platformProvider?: IPlatformProvider,
  ) {
    this.deviceInfo = deviceInfo ?? new DefaultDeviceInfoProvider();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    this.platform =
      platformProvider ??
      (require("react-native") as { Platform: IPlatformProvider }).Platform;
  }

  async detect(): Promise<DeviceInfo> {
    const [totalRAMBytes, availableRAMBytes] = await Promise.all([
      this.getTotalRAMBytes(),
      this.getAvailableRAMBytes(),
    ]);

    const totalRAM = totalRAMBytes / BYTES_TO_GB;
    const availableRAM = availableRAMBytes / BYTES_TO_GB;

    const { count: cpuCores, method: cpuCoresMethod } =
      await this.detectCpuCores();
    const cpuBrand = await this.detectCpuBrand();

    const platformOS = this.platform.OS;

    const { hasGPU, gpuMemoryMB, gpuType, gpuDetectionMethod } =
      await this.detectGPU(totalRAMBytes);

    const performanceCores = this.calculatePerformanceCores(
      cpuCores,
      cpuBrand,
      platformOS,
    );

    const gpuBackend = this.detectGpuBackend(platformOS, gpuType);

    const osVersion = await this.deviceInfo.getSystemVersion();
    const deviceModel = await this.deviceInfo.getModel();

    return {
      totalRAM,
      availableRAM,
      cpuCores,
      cpuBrand,
      performanceCores,
      hasGPU,
      gpuMemoryMB,
      gpuType,
      gpuBackend,
      platform: platformOS,
      osVersion,
      deviceModel,
      detectedAt: Date.now(),
      detectionMethod: {
        ram: "react-native-device-info",
        gpu: gpuDetectionMethod,
        cpuCores: cpuCoresMethod,
      },
    };
  }

  private async getTotalRAMBytes(): Promise<number> {
    try {
      return await this.deviceInfo.getTotalMemory();
    } catch {
      return 4 * BYTES_TO_GB;
    }
  }

  private async getAvailableRAMBytes(): Promise<number> {
    try {
      const used = await this.deviceInfo.getUsedMemory();
      const total = await this.deviceInfo.getTotalMemory();
      const available = Math.max(
        0,
        total - used - OS_OVERHEAD_GB * BYTES_TO_GB,
      );
      return available;
    } catch {
      return 2 * BYTES_TO_GB;
    }
  }

  private async detectCpuCores(): Promise<{
    count: number;
    method: "os.cpus" | "native";
  }> {
    // Prefer a native/core-count source exposed via the device info provider
    try {
      const count = await this.deviceInfo.getNumberOfCores();
      if (typeof count === "number" && count > 0)
        return { count: Math.min(count, 16), method: "native" };
    } catch {
      // fall through to JS fallback
    }

    // Fallback to Node/JS os.cpus() when available (tests / non-native envs)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const os = require("os");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cpus = (os as any).cpus?.();
      const count = cpus?.length ?? 0;
      if (typeof count === "number" && count > 0)
        return { count: Math.min(count, 16), method: "os.cpus" };
    } catch {
      // fall through
    }

    // Final safe default
    return { count: 4, method: "native" };
  }

  private async detectCpuBrand(): Promise<CpuBrand> {
    try {
      const brand = (await this.deviceInfo.getBrand()).toLowerCase();
      if (this.platform.OS === "ios") return "bionic";
      if (brand.includes("qualcomm") || brand.includes("snapdragon"))
        return "snapdragon";
      if (brand.includes("exynos")) return "exynos";
      if (brand.includes("helio") || brand.includes("mediatek")) return "helio";
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
    if (this.platform.OS === "ios") {
      return {
        hasGPU: true,
        gpuMemoryMB: Math.round(totalRAMBytes / (1024 * 1024)),
        gpuType: "metal",
        gpuDetectionMethod: "metal",
      };
    }

    const heuristicVRAMMB = Math.round(
      (totalRAMBytes * GPU_VRAM_FRACTION) / (1024 * 1024),
    );

    return {
      hasGPU: heuristicVRAMMB > 512,
      gpuMemoryMB: heuristicVRAMMB,
      gpuType: "adreno",
      gpuDetectionMethod: "heuristic",
    };
  }

  /**
   * Estimate the number of high-frequency P-cores.
   * iOS (Apple Silicon): ~50% P/E split.
   * Android Snapdragon/Bionic: ~37.5% (3 of 8 typical).
   * Android Helio/unknown: conservative 50% fallback.
   */
  private calculatePerformanceCores(
    cpuCores: number,
    cpuBrand: CpuBrand,
    platform: "ios" | "android",
  ): number {
    if (platform === "ios") {
      return Math.ceil(cpuCores * 0.5);
    }
    if (cpuBrand === "snapdragon" || cpuBrand === "bionic") {
      return Math.ceil(cpuCores * 0.375);
    }
    return Math.max(2, Math.ceil(cpuCores * 0.5));
  }

  /**
   * Map detected GPU type to the compute backend used by llama.cpp.
   * iOS → Metal, Android Adreno → OpenCL, Android Mali → Vulkan, else null.
   */
  private detectGpuBackend(
    platform: "ios" | "android",
    gpuType?: GpuType,
  ): GpuBackend {
    if (platform === "ios") return "metal";
    if (gpuType === "adreno") return "opencl";
    if (gpuType === "mali") return "vulkan";
    return null;
  }
}
