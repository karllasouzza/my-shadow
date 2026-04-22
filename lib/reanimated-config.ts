import { configureReanimatedLogger } from "react-native-reanimated";

// Disable strict mode to suppress the "Writing to `value` during component
// render" warning. All actual writes are in useEffect / gesture worklets,
// but the strict-mode checker can still fire false positives during hot
// reload. Enable strict: true during debugging sessions to catch real leaks.
configureReanimatedLogger({ strict: false });

export {};

