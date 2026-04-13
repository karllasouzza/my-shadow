import Color from "color";
import colors from "tailwindcss/colors";

/**
 * Converts a Tailwind-style color string to its corresponding value.
 * Supports both shaded colors (e.g., 'blue-500') and special color names (e.g., 'black', 'white').
 *
 * @param colorString - A string in the format 'colorName-shade' or a special color name
 * @returns The resolved color value (hex string or CSS keyword)
 * @throws Error if the format is invalid or the color is not found in Tailwind
 *
 * @example
 * ```typescript
 * // Shaded colors
 * const blue = getTailwindColor('blue-500');    // '#3b82f6'
 * const red = getTailwindColor('red-600');      // '#dc2626'
 *
 * // Special colors (no shade)
 * const black = getTailwindColor('black');      // '#000'
 * const white = getTailwindColor('white');      // '#fff'
 * const transparent = getTailwindColor('transparent'); // '#00000000'
 * ```
 */
export const getTailwindColor = (colorString: string): string => {
  // Cores especiais do Tailwind que não usam o formato colorName-shade
  const specialColors: Record<string, string> = {
    transparent: "#00000000",
    black: colors.black,
    white: colors.white,
  };

  // Verifica se é uma cor especial
  if (colorString in specialColors) {
    return specialColors[colorString];
  }

  // Valida se a string está no formato colorName-shade
  const colorParts = colorString.split("-");

  if (colorParts.length !== 2) {
    throw new Error(
      `Invalid color format: '${colorString}'. Expected format: colorName-shade (e.g., blue-500) or special color (black, white, transparent)`,
    );
  }

  const [colorName, colorShade] = colorParts;

  // Verifica se a cor existe no objeto colors do Tailwind
  if (!(colorName in colors)) {
    throw new Error(`Color '${colorName}' not found in Tailwind colors`);
  }

  const colorGroup = colors[colorName as keyof typeof colors];

  // Verifica se o colorGroup é um objeto válido e contém o shade
  if (
    typeof colorGroup !== "object" ||
    colorGroup === null ||
    !(colorShade in colorGroup)
  ) {
    throw new Error(`Shade '${colorShade}' not found for color '${colorName}'`);
  }

  const color = (colorGroup as Record<string, string>)[colorShade];

  if (!color) {
    throw new Error(`Color value not found for '${colorString}'`);
  }

  return color;
};

/**
 * Attempts to convert a Tailwind color string to a hex value, returning a fallback on error.
 *
 * @param colorString - String in 'colorName-shade' format (e.g., 'blue-500')
 * @param fallback - Fallback color to return on error (default: '#000000')
 * @returns The hexadecimal color value or the fallback
 *
 * @example
 * ```typescript
 * const color = getTailwindColorSafe('blue-500', '#ffffff'); // '#3b82f6'
 * const invalid = getTailwindColorSafe('invalid-color', '#ffffff'); // '#ffffff'
 * ```
 */
export const getTailwindColorSafe = (
  colorString: string,
  fallback = "#000000",
): string => {
  try {
    return getTailwindColor(colorString);
  } catch {
    return fallback;
  }
};

/**
 * Type for theme objects that contain CSS variables.
 * Represents the return shape of `vars()` from NativeWind with color variables.
 */
export type ThemeVars = Record<string, string>;

/**
 * Extracts the value of a CSS variable from a theme object.
 *
 * @param themeVars - Object containing the theme's CSS variables (e.g., result of `themes[theme][scheme]`)
 * @param varName - CSS variable name (e.g., '--color-background', '--color-primary')
 * @returns The color value in RGB format (e.g., 'rgb(255, 255, 255)')
 * @throws Error if the variable is not found in the theme object
 *
 * @example
 * ```typescript
 * const themeVars = themes['default']['light'];
 * const bgColor = getThemeColor(themeVars, '--color-background'); // 'rgb(255, 255, 255)'
 * const primaryColor = getThemeColor(themeVars, '--color-primary'); // 'rgb(0, 0, 0)'
 * ```
 */
export const getThemeColor = (
  themeVars: ThemeVars,
  varName: string,
): string => {
  const color = themeVars?.[varName];

  if (!color || typeof color !== "string") {
    throw new Error(`Theme variable '${varName}' not found in theme object`);
  }

  return color;
};

/**
 * Safe version of `getThemeColor` that returns a fallback on error.
 *
 * @param themeVars - Object containing theme CSS variables
 * @param varName - CSS variable name
 * @param fallback - Fallback color (default: 'rgb(0, 0, 0)')
 * @returns The resolved color value or the fallback
 */
export const getThemeColorSafe = ({
  themeVars,
  varName,
  fallback = "rgb(0, 0, 0)",
}: {
  themeVars: ThemeVars;
  varName: string;
  fallback?: string;
}): string => {
  try {
    return getThemeColor(themeVars, varName);
  } catch {
    // Silently return fallback when theme variable is not found
    return fallback;
  }
};

/**
 * Resolves a color from any supported format:
 * - Tailwind colors: 'blue-500', 'red-600'
 * - Theme variables: '--color-background', '--color-primary'
 * - Direct colors: '#ffffff', 'rgb(255, 255, 255)'
 *
 * @param colorInput - Color string in any supported format
 * @param themeVars - Optional theme object to resolve CSS variables
 * @param fallback - Fallback color to return on error (default: '#000000')
 * @returns The resolved color value
 *
 * @example
 * ```typescript
 * // Tailwind color
 * const blue = resolveColor('blue-500'); // '#3b82f6'
 *
 * // Theme variable
 * const bg = resolveColor('--color-background', themeVars); // 'rgb(255, 255, 255)'
 *
 * // Direct color
 * const white = resolveColor('#ffffff'); // '#ffffff'
 *
 * // With fallback
 * const color = resolveColor('invalid', undefined, '#000000'); // '#000000'
 * ```
 */
export const resolveColor = (
  colorInput: string,
  themeVars?: ThemeVars,
  fallback = "#000000",
): string => {
  try {
    // Se começa com '--', é uma variável de tema CSS
    if (colorInput.startsWith("--")) {
      if (!themeVars) {
        throw new Error(
          "Theme variables object is required for CSS variable colors",
        );
      }
      return getThemeColorSafe({ themeVars, varName: colorInput, fallback });
    }

    // Se começa com '#' ou 'rgb', é uma cor direta
    if (colorInput.startsWith("#") || colorInput.startsWith("rgb")) {
      return colorInput;
    }

    // Caso contrário, tenta como cor Tailwind (ex: 'blue-500')
    return getTailwindColor(colorInput);
  } catch {
    return fallback;
  }
};

/**
 * Resolves a theme variable (e.g., '--color-background') to a hexadecimal value.
 * Uses the `color` package to parse various formats and normalize to `#rrggbb`.
 */
export const getThemeColorHex = ({
  themeVars,
  varName,
  fallback = "#000000",
}: {
  themeVars: ThemeVars;
  varName: string;
  fallback?: string;
}): string => {
  try {
    const raw = themeVars?.[varName];
    if (!raw) return fallback;

    const str = String(raw).trim();

    // Direct hex / rgb / hsl strings
    if (/^#/.test(str) || /^rgba?\(/i.test(str) || /^hsla?\(/i.test(str)) {
      return Color(str).hex().toLowerCase();
    }

    // If raw is channel-only like '138 5% 38%', normalize into an hsl() string
    const parts = str.match(/-?\d+\.?\d*%?/g);
    if (parts && parts.length >= 3) {
      let [h, s, l] = parts;
      if (!/%$/.test(s)) s = `${s}%`;
      if (!/%$/.test(l)) l = `${l}%`;
      const hslString = `hsl(${h}, ${s}, ${l})`;
      return Color(hslString).hex().toLowerCase();
    }

    // Fallback: let Color attempt to parse any remaining format
    return Color(str).hex().toLowerCase();
  } catch (err) {
    return fallback;
  }
};
