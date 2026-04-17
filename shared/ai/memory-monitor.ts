import type { MemoryPressure, RuntimeConfig } from "@/shared/device/types";

const BYTES_TO_GB = 1024 ** 3;
const CRITICAL_UTILIZATION_THRESHOLD = 85;
const KV_CACHE_BYTES_PER_TOKEN_BUDGET = 50;
const KV_CACHE_BYTES_PER_TOKEN_OTHER = 70;
const SAFE_MEMORY_FRACTION = 0.5;

type MemoryWarningCallback = (pressure: MemoryPressure) => void;

export interface IMemoryInfoProvider {
  getTotalMemory(): Promise<number>;
  getUsedMemory(): Promise<number>;
}

class DefaultMemoryInfoProvider implements IMemoryInfoProvider {
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
}

export class MemoryMonitor {
  private currentConfig: Pick<RuntimeConfig, "n_batch" | "n_ctx"> | null = null;
  private onWarningCallback: MemoryWarningCallback | null = null;
  private unloadModelFn: (() => Promise<void>) | null = null;
  private reloadModelFn: (() => Promise<void>) | null = null;
  private appStateSubscription: { remove(): void } | null = null;
  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private readonly memoryProvider: IMemoryInfoProvider;

  constructor(memoryProvider?: IMemoryInfoProvider) {
    this.memoryProvider = memoryProvider ?? new DefaultMemoryInfoProvider();
  }

  configure(
    config: Pick<RuntimeConfig, "n_batch" | "n_ctx">,
    callbacks?: {
      onMemoryWarning?: MemoryWarningCallback;
      unloadModel?: () => Promise<void>;
      reloadModel?: () => Promise<void>;
    },
  ): void {
    this.currentConfig = config;
    this.onWarningCallback = callbacks?.onMemoryWarning ?? null;
    this.unloadModelFn = callbacks?.unloadModel ?? null;
    this.reloadModelFn = callbacks?.reloadModel ?? null;
  }

  async evaluate(): Promise<MemoryPressure> {
    const [totalRAM, usedRAM] = await this.readRAWBytes();
    const availableRAM = Math.max(0, totalRAM - usedRAM);
    const utilizationPercent =
      totalRAM > 0 ? Math.round((usedRAM / totalRAM) * 100) : 0;
    const criticalLevel = utilizationPercent > CRITICAL_UTILIZATION_THRESHOLD;

    const nBatch = this.currentConfig?.n_batch ?? 64;
    const maxCtx = this.currentConfig?.n_ctx ?? 1024;
    const bytesPerToken = criticalLevel
      ? KV_CACHE_BYTES_PER_TOKEN_BUDGET
      : KV_CACHE_BYTES_PER_TOKEN_OTHER;

    const safeTokens = Math.floor(
      (availableRAM * SAFE_MEMORY_FRACTION) / bytesPerToken,
    );

    const canRunInference = availableRAM > nBatch * 100;

    const pressure: MemoryPressure = {
      totalRAM,
      usedRAM,
      availableRAM,
      utilizationPercent,
      criticalLevel,
      canRunInference,
      recommendedMaxContext: Math.min(safeTokens, maxCtx),
      recommendedBatch: Math.min(
        512,
        Math.max(64, Math.floor((availableRAM * 0.3) / 1024)),
      ),
      sampledAt: Date.now(),
    };

    if (criticalLevel) {
      this.onWarningCallback?.(pressure);
    }

    return pressure;
  }

  onAppBackground(): void {
    this.evaluate()
      .then((pressure) => {
        if (pressure.criticalLevel && this.unloadModelFn) {
          void this.unloadModelFn();
        }
      })
      .catch(() => {});
  }

  onAppForeground(): void {
    this.evaluate()
      .then((pressure) => {
        if (pressure.canRunInference && this.reloadModelFn) {
          void this.reloadModelFn();
        }
      })
      .catch(() => {});
  }

  onMemoryWarning(callback: MemoryWarningCallback): void {
    this.onWarningCallback = callback;
  }

  attachAppLifecycle(): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AppState } =
      require("react-native") as typeof import("react-native");
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange.bind(this),
    );
  }

  detachAppLifecycle(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  startMonitoring(onCritical?: MemoryWarningCallback): void {
    if (onCritical) {
      this.onWarningCallback = onCritical;
    }
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      this.evaluate()
        .then((pressure) => {
          if (pressure.criticalLevel) {
            this.onWarningCallback?.(pressure);
          }
        })
        .catch(() => {});
    }, 5000);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  getPressure(): null {
    return null;
  }

  private handleAppStateChange(state: string): void {
    if (state === "background" || state === "inactive") {
      this.onAppBackground();
    } else if (state === "active") {
      this.onAppForeground();
    }
  }

  private async readRAWBytes(): Promise<[number, number]> {
    try {
      const [total, used] = await Promise.all([
        this.memoryProvider.getTotalMemory(),
        this.memoryProvider.getUsedMemory(),
      ]);
      return [total, used];
    } catch {
      const total = 4 * BYTES_TO_GB;
      const used = 2 * BYTES_TO_GB;
      return [total, used];
    }
  }
}
