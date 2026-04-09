import "@testing-library/jest-native/extend-expect";
import "react-native-gesture-handler/jestSetup";

// Silence native animated helper warning (guarded for non-jest runners)
if (typeof (globalThis as any).jest !== "undefined") {
  (globalThis as any).jest.mock(
    "react-native/Libraries/Animated/NativeAnimatedHelper",
  );
}

// Provide a simple mock for react-native-reanimated used in some components
try {
  if (typeof (globalThis as any).jest !== "undefined") {
    (globalThis as any).jest.mock("react-native-reanimated", () =>
      require("react-native-reanimated/mock"),
    );
  }
} catch (e) {
  // If the mock package isn't installed yet, ignore; setup will be useful once deps installed.
}
