/**
 * T040: Period review ViewModel
 *
 * Manages review generation state and user actions for period review screen
 */

import { useCallback, useState } from "react";
import type { AppError } from "../../../shared/utils/app-error";
import { getReviewService } from "../service/review-service";

interface ReviewState {
  isLoading: boolean;
  isGenerating: boolean;
  periodStart?: string;
  periodEnd?: string;
  review?: {
    id: string;
    summary: string;
    patterns: string[];
    triggers: string[];
    prompts: string[];
  };
  error?: AppError;
}

export function usePeriodReviewViewModel() {
  const service = getReviewService();
  const [state, setState] = useState<ReviewState>({
    isLoading: false,
    isGenerating: false,
  });

  const selectPeriod = useCallback(async (start: string, end: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      // In real app, would fetch reflections for period
      setState((s) => ({
        ...s,
        periodStart: start,
        periodEnd: end,
        isLoading: false,
      }));
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error as AppError,
        isLoading: false,
      }));
    }
  }, []);

  const generateReview = useCallback(async () => {
    if (!state.periodStart || !state.periodEnd) {
      setState((s) => ({
        ...s,
        error: {
          code: "VALIDATION_ERROR",
          message: "Selecione um período primeiro",
        },
      }));
      return;
    }

    setState((s) => ({ ...s, isGenerating: true, error: undefined }));
    try {
      const result = await service.generateFinalReview(
        state.periodStart,
        state.periodEnd,
        ["refl_mock"], // Mock reflection IDs
      );

      if (!result.success) {
        setState((s) => ({ ...s, error: result.error, isGenerating: false }));
      } else {
        setState((s) => ({
          ...s,
          review: result.data,
          isGenerating: false,
        }));
      }
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error as AppError,
        isGenerating: false,
      }));
    }
  }, [state.periodStart, state.periodEnd, service]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: undefined }));
  }, []);

  const clearReview = useCallback(() => {
    setState((s) => ({ ...s, review: undefined }));
  }, []);

  return {
    state,
    actions: {
      selectPeriod,
      generateReview,
      clearError,
      clearReview,
    },
  };
}
