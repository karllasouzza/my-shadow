/**
 * Onboarding: Model configuration domain model
 *
 * Defines the model configuration interface and catalog of available
 * Qwen 2.5 models for on-device inference.
 */

export interface ModelConfiguration {
  id: string;
  displayName: string;
  modelKey: string;
  filePath: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  downloadProgress: number;
  isLoaded: boolean;
  lastUsedAt: string | null;
  customFolderUri: string | null;
}

export interface AvailableModel {
  key: string;
  name: string;
  description: string;
  downloadUrl: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  quantization: string;
}

/**
 * Model catalog with 3 Qwen 2.5 models sorted by quality/capability.
 * URLs are placeholders -- replace with actual hosting URLs.
 */
export const MODEL_CATALOG: AvailableModel[] = [
  {
    key: 'qwen2.5-0.5b-instruct',
    name: 'Qwen 2.5 0.5B',
    description: 'Modelo leve e rapido, ideal para dispositivos com pouca memoria RAM.',
    downloadUrl: 'https://example.com/models/qwen2.5-0.5b-instruct.bin',
    fileSizeBytes: 350 * 1024 * 1024, // ~350 MB
    estimatedRamBytes: 600 * 1024 * 1024, // ~600 MB
    quantization: 'Q4_0',
  },
  {
    key: 'qwen2.5-1.5b-instruct',
    name: 'Qwen 2.5 1.5B',
    description: 'Equilibrio entre qualidade e desempenho para a maioria dos dispositivos.',
    downloadUrl: 'https://example.com/models/qwen2.5-1.5b-instruct.bin',
    fileSizeBytes: 900 * 1024 * 1024, // ~900 MB
    estimatedRamBytes: 1800 * 1024 * 1024, // ~1.8 GB
    quantization: 'Q4_0',
  },
  {
    key: 'qwen2.5-3b-instruct',
    name: 'Qwen 2.5 3B',
    description: 'Modelo de maior qualidade, recomendado para dispositivos com 8GB+ de RAM.',
    downloadUrl: 'https://example.com/models/qwen2.5-3b-instruct.bin',
    fileSizeBytes: 1800 * 1024 * 1024, // ~1.8 GB
    estimatedRamBytes: 3500 * 1024 * 1024, // ~3.5 GB
    quantization: 'Q4_0',
  },
];
