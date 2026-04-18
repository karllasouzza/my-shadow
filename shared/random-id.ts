import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

/**
 * Gera um UUID v4 único
 * Usado principalmente para criar IDs de usuários guest
 *
 * @returns UUID no formato padrão (ex: "550e8400-e29b-41d4-a716-446655440000")
 *
 * @example
 * ```typescript
 * const guestId = generateUUID();
 * // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export const generateUUID = (): string => {
  return uuidv4();
};
