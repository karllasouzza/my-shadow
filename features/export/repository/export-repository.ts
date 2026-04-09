/**
 * T050: Export Repository
 * Data access layer for export bundles
 */

import { Result, createError, err, ok } from "../../../shared/utils/app-error";
import { ExportBundle, ExportBundleRecord } from "../model/export-bundle";

const bundles = new Map<string, ExportBundleRecord>();

export class ExportRepository {
  async getById(id: string): Promise<Result<ExportBundle>> {
    const record = bundles.get(id);
    if (!record) {
      return err(createError("NOT_FOUND", `Export bundle ${id} not found`));
    }
    return ok(ExportBundle.fromRecord(record));
  }

  async getByPeriod(
    periodStart: string,
    periodEnd: string,
  ): Promise<Result<ExportBundle[]>> {
    const results: ExportBundle[] = [];
    for (const record of bundles.values()) {
      if (
        record.periodStart === periodStart &&
        record.periodEnd === periodEnd
      ) {
        results.push(ExportBundle.fromRecord(record));
      }
    }
    return ok(results);
  }

  async save(bundle: ExportBundle): Promise<Result<ExportBundle>> {
    const record = bundle.toRecord();
    bundles.set(bundle.id, record);
    return ok(bundle);
  }

  async delete(id: string): Promise<Result<void>> {
    if (!bundles.has(id)) {
      return err(createError("NOT_FOUND", `Export bundle ${id} not found`));
    }
    bundles.delete(id);
    return ok(undefined);
  }

  async listAll(): Promise<Result<ExportBundle[]>> {
    const results: ExportBundle[] = [];
    for (const record of bundles.values()) {
      results.push(ExportBundle.fromRecord(record));
    }
    return ok(results);
  }

  async clear(): Promise<Result<void>> {
    bundles.clear();
    return ok(undefined);
  }
}

let repositoryInstance: ExportRepository | null = null;

export function getExportRepository(): ExportRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ExportRepository();
  }
  return repositoryInstance;
}
