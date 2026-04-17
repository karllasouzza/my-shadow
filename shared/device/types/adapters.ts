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

export type RNDeviceInfoLib = {
  getTotalMemory: () => Promise<number>;
  getUsedMemory: () => Promise<number>;
  getModel: () => Promise<string>;
  getSystemVersion: () => Promise<string>;
  getBrand: () => Promise<string>;
  getNumberOfCPUCores: () => Promise<number>;
};
