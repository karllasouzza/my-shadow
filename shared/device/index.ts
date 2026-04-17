import type { DeviceInfo } from "@/shared/ai/types";
import { DeviceDetector } from "./detector";

export type {
  IDeviceInfoProvider, IMemoryInfoProvider, IPlatformProvider
} from "./adapters";
export { DeviceDetector };

export async function detectDevice(): Promise<DeviceInfo> {
  return new DeviceDetector().detect();
}
