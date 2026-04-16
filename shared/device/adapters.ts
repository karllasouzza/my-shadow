import { Platform } from "react-native";
import RNDeviceInfo from "react-native-device-info";
import { SystemState } from "./types";

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

function inferCoresFromModel(model: string, brand: string): number {
  const key = Object.keys(KNOWN_CORES).find((k) => model.includes(k));
  if (key) return KNOWN_CORES[key];

  if (Platform.OS === "ios") return 6;

  if (brand.toLowerCase().includes("samsung") && model.includes("Ultra"))
    return 8;
  return 4;
}

export function createRNAdapter() {
  return {
    async getSystemState(): Promise<SystemState> {
      const [totalRAM, usedRAM, brand, model, osVersion] = await Promise.all([
        RNDeviceInfo.getTotalMemory(),
        RNDeviceInfo.getUsedMemory(),
        RNDeviceInfo.getBrand(),
        RNDeviceInfo.getModel(),
        RNDeviceInfo.getSystemVersion(),
      ]);

      const cpuCores = inferCoresFromModel(model, brand);

      return {
        totalRAMBytes: totalRAM || 4 * BYTES_TO_GB,
        usedRAMBytes: usedRAM || 0,
        cpuCores,
        brand: brand || "unknown",
        model: model || "unknown",
        osVersion: osVersion || "unknown",
      };
    },
    platform: Platform.OS as "ios" | "android",
  };
}
