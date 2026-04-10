import { MODEL_CATALOG } from "./data";
import { ModelCatalogEntry } from "./types";

export function findModelById(id: string): ModelCatalogEntry | undefined {
  return MODEL_CATALOG.find((model) => model.id === id);
}
