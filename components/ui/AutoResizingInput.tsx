import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Platform,
  StyleProp,
  ViewStyle,
  TextStyle,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from 'react-native';

interface AutoResizingInputProps {
  onSend?: (text: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

const AutoResizingInput: React.FC<AutoResizingInputProps> = ({
  onSend,
  placeholder = 'Type your message...',
  minHeight = 36,
  maxHeight = 140,
  containerStyle,
  inputStyle,
}) => {
  const [text, setText] = useState('');
  const [height, setHeight] = useState(minHeight);
  const inputRef = useRef<TextInput | null>(null);

  const handleContentSizeChange = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
    const newHeight = Math.min(maxHeight, Math.max(minHeight, e.nativeEvent.contentSize.height));
    setHeight(newHeight);
  };

  const handleKeyPress = (e: any) => {
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      if (text.trim()) {
        onSend?.(text.trim());
        setText('');
        setHeight(minHeight);
      }
    }
  };

  return (
    <View style={[{ paddingHorizontal: 16, paddingVertical: 8 }, containerStyle]}>
      <TextInput
        ref={inputRef}
        value={text}
        onChangeText={setText}
        multiline
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        onContentSizeChange={handleContentSizeChange}
        onKeyPress={handleKeyPress}
        style={[
          {
            fontSize: 16,
            lineHeight: 20,
            height: Math.max(minHeight, height),
            color: '#FFFFFF',
            backgroundColor: '#111827',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
          },
          inputStyle,
        ]}
      />
    </View>
  );
};

export default AutoResizingInput;
