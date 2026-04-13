import { cn } from "@/lib/utils";
import React, { useRef, useState } from "react";
import {
  NativeSyntheticEvent,
  Platform,
  TextInput,
  TextInputContentSizeChangeEventData,
  TextInputProps,
} from "react-native";

interface AutoResizingInputProps extends Omit<
  TextInputProps,
  "multiline" | "style"
> {
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  onSubmitEditing?: () => void;
}

const AutoResizingInput = React.forwardRef<TextInput, AutoResizingInputProps>(
  function AutoResizingInput(
    {
      minHeight = 20,
      maxHeight = 128,
      className,
      onKeyPress,
      onSubmitEditing,
      ...props
    },
    ref,
  ) {
    const [height, setHeight] = useState(minHeight);
    const internalRef = useRef<TextInput>(null);
    const inputRef = (ref ?? internalRef) as React.RefObject<TextInput>;

    const handleContentSizeChange = (
      e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
    ) => {
      const newHeight = Math.min(
        maxHeight,
        Math.max(minHeight, e.nativeEvent.contentSize.height),
      );
      setHeight(newHeight);
    };

    const handleKeyPress = (e: any) => {
      if (
        Platform.OS === "web" &&
        e.nativeEvent.key === "Enter" &&
        !e.nativeEvent.shiftKey
      ) {
        e.preventDefault();
        onSubmitEditing?.();
      }
      onKeyPress?.(e);
    };

    return (
      <TextInput
        ref={inputRef}
        multiline
        onContentSizeChange={handleContentSizeChange}
        onKeyPress={handleKeyPress}
        onSubmitEditing={onSubmitEditing}
        style={{ height: Math.max(minHeight, height) }}
        className={cn("text-base text-foreground", className)}
        {...props}
      />
    );
  },
);

export default AutoResizingInput;
