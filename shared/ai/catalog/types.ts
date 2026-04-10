export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  description: string;
  downloadUrl: string;
  fileSizeBytes: number;
  estimatedRamBytes: number;
  quantization: string;
}
