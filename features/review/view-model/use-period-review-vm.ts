import { useCallback, useState } from "react";
import type { AppError } from "../../../shared/utils/app-error";
import { getReflectionRepository } from "../../reflection/repository/reflection-repository";
import { getReviewService } from "../service/review-service";

interface ReviewState {
  isLoading: boolean;
  isGenerating: boolean;
  periodStart?: string;
  periodEnd?: string;
  reflectionIds: string[];
  reflectionCount: number;
  isEmptyPeriod: boolean;
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
  const reflectionRepository = getReflectionRepository();
  const [state, setState] = useState<ReviewState>({
    isLoading: false,
    isGenerating: false,
    reflectionIds: [],
    reflectionCount: 0,
    isEmptyPeriod: false,
  });

  const selectPeriod = useCallback(
    async (start: string, end: string) => {
      setState((s) => ({ ...s, isLoading: true }));
      try {
        const reflectionsResult = await reflectionRepository.getByDateRange(
          start,
          end,
        );

        if (!reflectionsResult.success) {
          setState((s) => ({
            ...s,
            isLoading: false,
            error: reflectionsResult.error,
          }));
          return;
        }

        const reflectionIds = reflectionsResult.data.map(
          (reflection) => reflection.id,
        );

        setState((s) => ({
          ...s,
          periodStart: start,
          periodEnd: end,
          reflectionIds,
          reflectionCount: reflectionIds.length,
          isEmptyPeriod: reflectionIds.length === 0,
          review: undefined,
          error: undefined,
          isLoading: false,
        }));
      } catch (error) {
        setState((s) => ({
          ...s,
          error: error as AppError,
          isLoading: false,
        }));
      }
    },
    [reflectionRepository],
  );

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

    if (state.reflectionIds.length === 0) {
      setState((s) => ({
        ...s,
        isEmptyPeriod: true,
        error: undefined,
      }));
      return;
    }

    setState((s) => ({
      ...s,
      isGenerating: true,
      error: undefined,
      isEmptyPeriod: false,
    }));
    try {
      const result = await service.generateFinalReview(
        state.periodStart,
        state.periodEnd,
        state.reflectionIds,
      );

      if (!result.success) {
        setState((s) => ({ ...s, error: result.error, isGenerating: false }));
      } else {
        setState((s) => ({
          ...s,
          review: result.data,
          isGenerating: false,
          isEmptyPeriod: false,
        }));
      }
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error as AppError,
        isGenerating: false,
      }));
    }
  }, [state.periodStart, state.periodEnd, state.reflectionIds, service]);

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
