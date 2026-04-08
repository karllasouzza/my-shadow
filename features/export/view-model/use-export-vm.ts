/**
 * T051: Export ViewModel
 * React hook managing markdown export workflow state
 */

import { useCallback, useState } from "react";
import { ExportBundle } from "../model/export-bundle";
import {
    MarkdownExportService,
    getMarkdownExportService,
} from "../service/markdown-export-service";

interface ExportState {
  isLoading: boolean;
  isExporting: boolean;
  periodStart?: string;
  periodEnd?: string;
  selectedReflectionIds: string[];
  selectedQuestionSetIds: string[];
  selectedReviewIds: string[];
  bundle?: ExportBundle;
  error?: string;
}

export function useExportViewModel(service?: MarkdownExportService) {
  const exportService = service || getMarkdownExportService();

  const [state, setState] = useState<ExportState>({
    isLoading: false,
    isExporting: false,
    selectedReflectionIds: [],
    selectedQuestionSetIds: [],
    selectedReviewIds: [],
  });

  const selectPeriod = useCallback((start: string, end: string) => {
    setState((prev) => ({
      ...prev,
      periodStart: start,
      periodEnd: end,
      error: undefined,
    }));
  }, []);

  const toggleReflectionId = useCallback((id: string) => {
    setState((prev) => {
      const ids = prev.selectedReflectionIds.includes(id)
        ? prev.selectedReflectionIds.filter((rid) => rid !== id)
        : [...prev.selectedReflectionIds, id];
      return { ...prev, selectedReflectionIds: ids };
    });
  }, []);

  const toggleQuestionSetId = useCallback((id: string) => {
    setState((prev) => {
      const ids = prev.selectedQuestionSetIds.includes(id)
        ? prev.selectedQuestionSetIds.filter((qid) => qid !== id)
        : [...prev.selectedQuestionSetIds, id];
      return { ...prev, selectedQuestionSetIds: ids };
    });
  }, []);

  const toggleReviewId = useCallback((id: string) => {
    setState((prev) => {
      const ids = prev.selectedReviewIds.includes(id)
        ? prev.selectedReviewIds.filter((rid) => rid !== id)
        : [...prev.selectedReviewIds, id];
      return { ...prev, selectedReviewIds: ids };
    });
  }, []);

  const generateExport = useCallback(async () => {
    if (!state.periodStart || !state.periodEnd) {
      setState((prev) => ({
        ...prev,
        error: "Selecione um período antes de exportar",
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isExporting: true,
      error: undefined,
    }));

    try {
      const result = await exportService.generateExport({
        periodStart: state.periodStart,
        periodEnd: state.periodEnd,
        reflectionIds: state.selectedReflectionIds,
        questionSetIds: state.selectedQuestionSetIds,
        reviewIds: state.selectedReviewIds,
      });

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isExporting: false,
          error: result.error.message,
        }));
        return;
      }

      // Fetch the generated bundle
      const bundleResult = await exportService.getExport(result.data.id);
      if (bundleResult.success) {
        setState((prev) => ({
          ...prev,
          isExporting: false,
          bundle: bundleResult.data,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isExporting: false,
          error: "Não foi possível recuperar o bundle exportado",
        }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isExporting: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      }));
    }
  }, [
    state.periodStart,
    state.periodEnd,
    state.selectedReflectionIds,
    state.selectedQuestionSetIds,
    state.selectedReviewIds,
    exportService,
  ]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: undefined }));
  }, []);

  const clearExport = useCallback(() => {
    setState((prev) => ({
      ...prev,
      bundle: undefined,
      selectedReflectionIds: [],
      selectedQuestionSetIds: [],
      selectedReviewIds: [],
      periodStart: undefined,
      periodEnd: undefined,
    }));
  }, []);

  return {
    state,
    selectPeriod,
    toggleReflectionId,
    toggleQuestionSetId,
    toggleReviewId,
    generateExport,
    clearError,
    clearExport,
  };
}
