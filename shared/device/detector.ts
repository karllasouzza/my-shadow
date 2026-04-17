import {
  DefaultDeviceInfoProvider,
  DefaultPlatformProvider,
  IDeviceInfoProvider,
  IPlatformProvider,
} from "./adapters";
import type { DeviceInfo as AiDeviceInfo } from "@/shared/ai/types";
import { selectGpuBackend } from "@/shared/ai/runtime-config-generator";

export const BYTES_TO_GB = 1024 ** 3;

export class DeviceDetector {
  constructor(
    private readonly deviceInfoProvider: IDeviceInfoProvider = new DefaultDeviceInfoProvider(),
    private readonly platformProvider: IPlatformProvider = new DefaultPlatformProvider(),
  ) {}

  async detect(): Promise<AiDeviceInfo> {
    const [totalBytes, usedBytes, brand, model, osVersion, cpuCores] =
      await Promise.all([
        this.deviceInfoProvider.getTotalMemory(),
        this.deviceInfoProvider.getUsedMemory(),
        this.deviceInfoProvider.getBrand(),
        this.deviceInfoProvider.getModel(),
        this.deviceInfoProvider.getSystemVersion(),
        this.deviceInfoProvider.getNumberOfCPUCores(),
      ]);

    const platform = this.platformProvider.OS;
    // iOS SpringBoard and system daemons consume ~1.5 GB continuously;
    // Android keeps more background processes alive and uses ~2.0 GB.
    // These values come from empirical measurement on physical devices (ADR-0002).
    const osOverheadGB = platform === "ios" ? 1.5 : 2.0;
    const totalRAM = totalBytes / BYTES_TO_GB;
    const usedRAM = usedBytes / BYTES_TO_GB;
    const availableRAM = Math.max(0, totalRAM - osOverheadGB - usedRAM);

    let gpuBackend: AiDeviceInfo["gpuBackend"] = selectGpuBackend(
      osVersion,
      brand ?? "",
      platform,
    );
    let hasGPU = gpuBackend !== "none";

    // T016: insufficient available RAM disables GPU acceleration
    if (availableRAM < 1) {
      hasGPU = false;
      gpuBackend = "none";
    }

    return {
      totalRAM,
      availableRAM,
      cpuCores,
      hasGPU,
      gpuBackend,
      platform: platform === "ios" ? "iOS" : "Android",
      osVersion,
      deviceModel: model,
      detectedAt: Date.now(),
      gpuBrand: brand || undefined,
    };
  }
}
