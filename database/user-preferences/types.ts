import { themes } from "@/lib/themes";

export type UserPreferences = {
  theme: keyof typeof themes;
  colorScheme: "light" | "dark" | "system";
  backgroundColor: string;
};
