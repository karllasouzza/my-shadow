import { DeviceProfile } from "@/shared/device";
import { CacheType, RuntimeConfig } from "./types";

export class ConfigBuilder {
  private config: Partial<RuntimeConfig> = {};

  static fromDeviceProfile(profile: DeviceProfile): ConfigBuilder {
    const builder = new ConfigBuilder();

    builder.config = {
      n_ctx: profile.recommended.n_ctx,
      n_batch: profile.recommended.n_batch,
      n_threads: profile.recommended.n_threads,
      n_gpu_layers: profile.recommended.n_gpu_layers,
      use_mmap: true,
      use_mlock: false,
    };

    return builder;
  }

  withModel(path: string): this {
    this.config.model = path;
    return this;
  }

  withContextSize(n_ctx: number): this {
    this.config.n_ctx = n_ctx;
    return this;
  }

  withBatchSize(n_batch: number): this {
    this.config.n_batch = n_batch;
    return this;
  }

  withThreads(n_threads: number): this {
    this.config.n_threads = n_threads;
    return this;
  }

  withGPU(n_gpu_layers: number): this {
    this.config.n_gpu_layers = n_gpu_layers;
    return this;
  }

  withCacheTypes(k: CacheType, v: CacheType): this {
    this.config.cache_type_k = k;
    this.config.cache_type_v = v;
    return this;
  }

  withOverrides(overrides: Partial<RuntimeConfig>): this {
    Object.assign(this.config, overrides);
    return this;
  }

  build(): RuntimeConfig {
    if (!this.config.model) {
      throw new Error("Model path is required");
    }

    if (!this.config.n_ctx || this.config.n_ctx <= 0) {
      throw new Error("Invalid context size");
    }

    return this.config as RuntimeConfig;
  }
}
