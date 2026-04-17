import {
  IDeviceInfoProvider,
  IMemoryInfoProvider,
  IPlatformProvider,
  RNDeviceInfoLib,
} from "./types/adapters";

export class DefaultDeviceInfoProvider implements IDeviceInfoProvider {
  private get lib(): RNDeviceInfoLib {
    return (require("react-native-device-info") as { default: RNDeviceInfoLib })
      .default;
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
    const { Platform } = require("react-native") as {
      Platform: { OS: "ios" | "android" };
    };
    return Platform.OS;
  }
}

export class DefaultMemoryInfoProvider implements IMemoryInfoProvider {
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
