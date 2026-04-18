import { useFocusEffect } from "@react-navigation/native";
import { SystemBars } from "react-native-edge-to-edge";

import { useMemo } from "react";
import { FocusAwareBarsProps } from "./focus-aware-bars.types";

export const FocusAwareBars = ({ colorScheme }: FocusAwareBarsProps) => {
  const inverseColorScheme = useMemo(
    () => (colorScheme === "light" ? "dark" : "light"),
    [colorScheme],
  );

  useFocusEffect(() => {
    SystemBars.setStyle({
      navigationBar: inverseColorScheme || "light",
      statusBar: inverseColorScheme || "light",
    });
  });

  return <SystemBars style={inverseColorScheme || "light"} />;
};
