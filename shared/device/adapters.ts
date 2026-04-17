export interface IDeviceInfoProvider {
  getTotalMemory(): Promise<number>;
  getUsedMemory(): Promise<number>;
  getModel(): Promise<string>;
  getSystemVersion(): Promise<string>;
  getBrand(): Promise<string>;
  getNumberOfCPUCores(): Promise<number>;
}

export interface IPlatformProvider {
  OS: "ios" | "android";
}

export interface IMemoryInfoProvider {
  getTotalMemory(): Promise<number>;
  getUsedMemory(): Promise<number>;
}

type RNDeviceInfoLib = {
  getTotalMemory: () => Promise<number>;
  getUsedMemory: () => Promise<number>;
  getModel: () => Promise<string>;
  getSystemVersion: () => Promise<string>;
  getBrand: () => Promise<string>;
  getNumberOfCPUCores: () => Promise<number>;
};

export class DefaultDeviceInfoProvider implements IDeviceInfoProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private get lib(): RNDeviceInfoLib {
    return (
      require("react-native-device-info") as { default: RNDeviceInfoLib }
    ).default;
  }
  getTotalMemory() {
    return this.lib.getTotalMemory();
  }
  getUsedMemory() {
    return this.lib.getUsedMemory();
  }
  getModel() {
    return this.lib.getModel();
  }
  getSystemVersion() {
    return this.lib.getSystemVersion();
  }
  getBrand() {
    return this.lib.getBrand();
  }
  getNumberOfCPUCores() {
    return this.lib.getNumberOfCPUCores();
  }
}

export class DefaultPlatformProvider implements IPlatformProvider {
  get OS(): "ios" | "android" {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native") as {
      Platform: { OS: "ios" | "android" };
    };
    return Platform.OS;
  }
}

export class DefaultMemoryInfoProvider implements IMemoryInfoProvider {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  private get lib(): Pick<RNDeviceInfoLib, "getTotalMemory" | "getUsedMemory"> {
    return (
      require("react-native-device-info") as {
        default: RNDeviceInfoLib;
      }
    ).default;
  }
  getTotalMemory() {
    return this.lib.getTotalMemory();
  }
  getUsedMemory() {
    return this.lib.getUsedMemory();
  }
}

const BYTES_TO_GB = 1024 ** 3;

const KNOWN_CORES: Record<string, number> = {
  "iPhone15,2": 6,
  "iPhone15,3": 6,
  "iPhone16,1": 6,
  "iPhone16,2": 6,
  "iPhone17,1": 6,
  "iPhone17,2": 6,
  "SM-S928B": 8,
  "SM-G991B": 8,
};

function inferCoresFromModel(
  model: string,
  brand: string,
  platformOS: string,
): number {
  const key = Object.keys(KNOWN_CORES).find((k) => model.includes(k));
  if (key) return KNOWN_CORES[key];

  if (platformOS === "ios") return 6;

  if (brand.toLowerCase().includes("samsung") && model.includes("Ultra"))
    return 8;
  return 4;
}

export function createRNAdapter() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require("react-native") as {
    Platform: { OS: "ios" | "android" };
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RNDeviceInfo = (
    require("react-native-device-info") as { default: RNDeviceInfoLib }
  ).default;

  return {
    async getSystemState(): Promise<SystemState> {
      const [totalRAM, usedRAM, brand, model, osVersion] = await Promise.all([
        RNDeviceInfo.getTotalMemory(),
        RNDeviceInfo.getUsedMemory(),
        RNDeviceInfo.getBrand(),
        RNDeviceInfo.getModel(),
        RNDeviceInfo.getSystemVersion(),
      ]);

      const cpuCores = inferCoresFromModel(model, brand, Platform.OS);

      return {
        totalRAMBytes: totalRAM || 4 * BYTES_TO_GB,
        usedRAMBytes: usedRAM || 0,
        cpuCores,
        brand: brand || "unknown",
        model: model || "unknown",
        osVersion: osVersion || "unknown",
      };
    },
    platform: Platform.OS,
  };
}
