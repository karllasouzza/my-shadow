/**
 * T008: Add reflection UI token mapping
 *
 * Defines NativeWind theme tokens specific to the reflection journal feature.
 * Includes colors for mood tags, trigger tags, generation modes, and introspective states.
 *
 * Integrates with Tailwind's color system as defined in tailwind.config.js
 */

export const REFLECTION_THEME = {
  // Mood tag colors (introspective palette)
  moodColors: {
    introspective: "bg-purple-100 text-purple-800",
    peaceful: "bg-blue-100 text-blue-800",
    contemplative: "bg-indigo-100 text-indigo-800",
    unsettled: "bg-orange-100 text-orange-800",
    conflicted: "bg-amber-100 text-amber-800",
    reflective: "bg-slate-100 text-slate-800",
  },

  // Trigger tag colors
  triggerColors: {
    relationship: "bg-rose-100 text-rose-800",
    work: "bg-cyan-100 text-cyan-800",
    health: "bg-green-100 text-green-800",
    personal: "bg-violet-100 text-violet-800",
    external: "bg-teal-100 text-teal-800",
    other: "bg-gray-100 text-gray-800",
  },

  // Generation mode indicators
  generationMode: {
    normal: "bg-green-100 text-green-800",
    fallback_template: "bg-yellow-100 text-yellow-800",
    retry_result: "bg-blue-100 text-blue-800",
  },

  // Loading and async states
  asyncStates: {
    loading: "opacity-60",
    success: "opacity-100",
    error: "border-l-4 border-red-500 bg-red-50",
  },

  // Jungian shadow work context colors
  shadowWork: {
    lightness: "text-amber-600", // Illuminating shadow
    acceptance: "text-purple-600", // Integration
    growth: "text-green-600", // Transformation
    insight: "text-blue-600", // Understanding
  },

  // Text styles for introspective content
  textVariants: {
    reflection: "text-base text-slate-700 leading-relaxed",
    guidedQuestion: "text-base italic text-slate-700",
    summary: "text-sm text-slate-600",
    recurringPattern: "text-sm font-semibold text-slate-800",
  },

  // Container variants
  containers: {
    reflection: "bg-white rounded-lg p-4 border border-gray-200 shadow-sm",
    questionSet: "bg-blue-50 rounded-lg p-4 border-l-4 border-blue-300",
    review: "bg-purple-50 rounded-lg p-4 border border-purple-200",
  },
} as const;

/**
 * Get mood color styles by mood name
 */
export const getMoodColor = (mood: string): string => {
  const moodKey = mood
    .toLowerCase()
    .replace(/\s+/g, "_") as keyof typeof REFLECTION_THEME.moodColors;
  return (
    REFLECTION_THEME.moodColors[moodKey] ||
    REFLECTION_THEME.moodColors.introspective
  );
};

/**
 * Get trigger color styles by trigger name
 */
export const getTriggerColor = (trigger: string): string => {
  const triggerKey = trigger
    .toLowerCase()
    .replace(/\s+/g, "_") as keyof typeof REFLECTION_THEME.triggerColors;
  return (
    REFLECTION_THEME.triggerColors[triggerKey] ||
    REFLECTION_THEME.triggerColors.other
  );
};

/**
 * Get generation mode color styles
 */
export const getGenerationModeColor = (
  mode: "normal" | "fallback_template" | "retry_result",
): string => {
  return REFLECTION_THEME.generationMode[mode];
};
