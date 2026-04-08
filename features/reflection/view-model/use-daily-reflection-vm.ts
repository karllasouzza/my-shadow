/**
 * T028: Daily reflection ViewModel using React hooks
 *
 * Manages state and business logic for daily reflection screen using custom hooks.
 */

import { useCallback, useEffect, useState } from "react";
import { getReflectionCascadeDelete } from "../../../shared/storage/reflection-cascade-delete";
import { AppError } from "../../../shared/utils/app-error";
import { GuidedQuestionSet } from "../model/guided-question-set";
import { ReflectionEntry } from "../model/reflection-entry";
import { getReflectionRepository } from "../repository/reflection-repository";
import { getReflectionService } from "../service/reflection-service";

export interface DailyReflectionViewModelState {
  // Data
  reflections: ReflectionEntry[];
  currentReflection: ReflectionEntry | null;
  currentQuestions: GuidedQuestionSet | null;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  isGenerating: boolean;
  error: AppError | null;

  // Content editing
  editingContent: string;
  editingMoodTags: string[];
  editingTriggerTags: string[];

  // Delete confirmation
  showDeleteConfirm: boolean;
  deleteConfirmationToken: string | null;
}

export interface UseDailyReflectionViewModel {
  state: DailyReflectionViewModelState;
  actions: {
    // Reflection actions
    createReflection: (
      content: string,
      moodTags?: string[],
      triggerTags?: string[],
    ) => Promise<void>;
    loadReflections: () => Promise<void>;
    selectReflection: (id: string) => Promise<void>;
    updateContent: (content: string) => void;
    setMoodTags: (tags: string[]) => void;
    setTriggerTags: (tags: string[]) => void;

    // Question generation
    generateQuestions: (reflectionId: string) => Promise<void>;
    clearError: () => void;

    // Delete
    initiateDelete: () => void;
    confirmDelete: () => Promise<void>;
    cancelDelete: () => void;
  };
}

export const useDailyReflectionViewModel = (): UseDailyReflectionViewModel => {
  const service = getReflectionService();
  const repository = getReflectionRepository();
  const cascadeDelete = getReflectionCascadeDelete();

  const [state, setState] = useState<DailyReflectionViewModelState>({
    reflections: [],
    currentReflection: null,
    currentQuestions: null,
    isLoading: false,
    isSaving: false,
    isGenerating: false,
    error: null,
    editingContent: "",
    editingMoodTags: [],
    editingTriggerTags: [],
    showDeleteConfirm: false,
    deleteConfirmationToken: null,
  });

  // Load reflections on mount
  useEffect(() => {
    loadReflections();
  }, []);

  const loadReflections = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    const result = await repository.getAll();

    if (result.success) {
      setState((s) => ({
        ...s,
        reflections: result.data,
        isLoading: false,
      }));
    } else {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: result.error,
      }));
    }
  }, []);

  const createReflection = useCallback(
    async (content: string, moodTags?: string[], triggerTags?: string[]) => {
      setState((s) => ({ ...s, isSaving: true, error: null }));

      const result = await service.createReflection(
        content,
        undefined,
        moodTags,
        triggerTags,
      );

      if (result.success) {
        const entry = result.data;
        setState((s) => ({
          ...s,
          isSaving: false,
          currentReflection: entry,
          editingContent: "",
          editingMoodTags: [],
          editingTriggerTags: [],
          reflections: [entry, ...s.reflections],
        }));
      } else {
        setState((s) => ({
          ...s,
          isSaving: false,
          error: result.error,
        }));
      }
    },
    [service],
  );

  const selectReflection = useCallback(async (id: string) => {
    setState((s) => ({ ...s, isLoading: true }));

    const result = await repository.getById(id);
    if (result.success && result.data) {
      const questions = await repository.getQuestionSetsByReflection(id);
      const latestQuestions = questions.success ? questions.data[0] : null;

      setState((s) => ({
        ...s,
        isLoading: false,
        currentReflection: result.data!,
        currentQuestions: latestQuestions,
        editingContent: result.data!.content,
        editingMoodTags: result.data!.moodTags,
        editingTriggerTags: result.data!.triggerTags,
      }));
    } else {
      setState((s) => ({ ...s, isLoading: false, error: result.error }));
    }
  }, []);

  const updateContent = useCallback((content: string) => {
    setState((s) => ({ ...s, editingContent: content }));
  }, []);

  const setMoodTags = useCallback((tags: string[]) => {
    setState((s) => ({ ...s, editingMoodTags: tags }));
  }, []);

  const setTriggerTags = useCallback((tags: string[]) => {
    setState((s) => ({ ...s, editingTriggerTags: tags }));
  }, []);

  const generateQuestions = useCallback(
    async (reflectionId: string) => {
      setState((s) => ({ ...s, isGenerating: true, error: null }));

      const result = await service.generateGuidedQuestions(
        reflectionId,
        true,
        30,
      );

      if (result.success) {
        setState((s) => ({
          ...s,
          isGenerating: false,
          currentQuestions: result.data.questionSet,
        }));
      } else {
        setState((s) => ({
          ...s,
          isGenerating: false,
          error: result.error,
        }));
      }
    },
    [service],
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const initiateDelete = useCallback(() => {
    const token = Math.random().toString(36).substring(2);
    setState((s) => ({
      ...s,
      showDeleteConfirm: true,
      deleteConfirmationToken: token,
    }));
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!state.currentReflection) return;

    setState((s) => ({ ...s, isSaving: true }));

    const result = await cascadeDelete.deleteReflectionCascade(
      state.currentReflection.id,
    );

    if (result.success) {
      setState((s) => ({
        ...s,
        isSaving: false,
        currentReflection: null,
        currentQuestions: null,
        showDeleteConfirm: false,
        deleteConfirmationToken: null,
        reflections: s.reflections.filter(
          (r) => r.id !== state.currentReflection!.id,
        ),
      }));
      await loadReflections();
    } else {
      setState((s) => ({
        ...s,
        isSaving: false,
        showDeleteConfirm: false,
        error: result.error,
      }));
    }
  }, [state.currentReflection]);

  const cancelDelete = useCallback(() => {
    setState((s) => ({
      ...s,
      showDeleteConfirm: false,
      deleteConfirmationToken: null,
    }));
  }, []);

  return {
    state,
    actions: {
      createReflection,
      loadReflections,
      selectReflection,
      updateContent,
      setMoodTags,
      setTriggerTags,
      generateQuestions,
      clearError,
      initiateDelete,
      confirmDelete,
      cancelDelete,
    },
  };
};
