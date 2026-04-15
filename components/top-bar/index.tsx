import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { Button } from "../ui/button";

interface TopBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  /** Ações à esquerda do título (depois do botão voltar) */
  leftAction?: React.ReactNode;
  /** Ações à direita (substituídas pelo modo busca) */
  rightAction?: React.ReactNode;
  className?: string;
}

export const TopBar = ({
  title,
  showBack = false,
  onBack,
  showSearch = false,
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  leftAction,
  rightAction,
  className,
}: TopBarProps) => {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const prevSearchActive = useRef(isSearchActive);

  // Animation values
  const searchBarOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(1);

  const handleCloseSearch = useCallback(() => {
    setIsSearchActive(false);
    onSearchChange?.("");
  }, [onSearchChange]);

  const handleOpenSearch = useCallback(() => {
    setIsSearchActive(true);
  }, []);

  const handleClearSearch = useCallback(() => {
    onSearchChange?.("");
    searchInputRef.current?.focus();
  }, [onSearchChange]);

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const searchBarStyle = useAnimatedStyle(() => ({
    opacity: searchBarOpacity.value,
  }));

  useEffect(() => {
    if (prevSearchActive.current === isSearchActive) return;
    prevSearchActive.current = isSearchActive;

    if (isSearchActive) {
      searchInputRef.current?.focus();

      searchBarOpacity.value = withTiming(1, { duration: 200 });
      titleOpacity.value = withTiming(0, { duration: 150 });
    } else {
      searchBarOpacity.value = withTiming(0, { duration: 200 });
      titleOpacity.value = withDelay(100, withTiming(1, { duration: 300 }));
    }

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isSearchActive) {
          handleCloseSearch();
          return true;
        }
        return false;
      },
    );

    return () => backHandler.remove();
  }, [isSearchActive, searchBarOpacity, titleOpacity, handleCloseSearch]);

  // Helper para renderizar ações com segurança
  const renderActions = (actions: React.ReactNode): React.ReactNode => {
    if (!actions) return null;
    return React.Children.map(actions, (child) => {
      if (!React.isValidElement(child)) return child;
      return child;
    });
  };

  return (
    <View
      className={cn(
        "z-40 flex-row justify-between items-center px-4 py-3 border-border border-b w-full",
        className,
      )}
    >
      {/* === MODO NORMAL (Título visível) === */}
      {!isSearchActive && (
        <>
          {/* Left Section */}
          <View className="flex-row items-center gap-2 flex-1 min-w-0">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                onPress={onBack}
                className="active:opacity-70 shrink-0"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon
                  as={require("lucide-react-native").ArrowLeft}
                  className="text-muted-foreground size-5"
                />
              </Button>
            )}

            {/* Left Actions */}
            {leftAction && (
              <View className="flex-row items-center gap-1 shrink-0">
                {renderActions(leftAction)}
              </View>
            )}

            {/* Title */}
            <Animated.View style={titleStyle} className="flex-1 min-w-0">
              <Text
                className="font-bold text-foreground text-lg"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Text>
            </Animated.View>
          </View>

          {/* Right Section */}
          <View className="flex-row items-center gap-2 shrink-0">
            {showSearch && (
              <Button
                variant="ghost"
                size="icon"
                onPress={handleOpenSearch}
                className="bg-muted/50 active:opacity-70 p-2 rounded-full"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon
                  as={require("lucide-react-native").Search}
                  className="text-primary size-5"
                />
              </Button>
            )}
            {renderActions(rightAction)}
          </View>
        </>
      )}

      {/* === MODO BUSCA (SearchBar visível) === */}
      {isSearchActive && (
        <Animated.View
          style={searchBarStyle}
          className="flex-row items-center gap-2 w-full"
        >
          <Button
            variant="ghost"
            size="icon"
            onPress={handleCloseSearch}
            className="active:opacity-70 shrink-0"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon
              as={require("lucide-react-native").ArrowLeft}
              className="text-muted-foreground size-5"
            />
          </Button>

          <View className="flex-row flex-1 items-center gap-2 px-2 py-1 rounded-xl bg-muted/30">
            <Icon
              as={require("lucide-react-native").Search}
              className="text-muted-foreground size-4 ml-1"
            />
            <Input
              ref={searchInputRef}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChangeText={onSearchChange}
              className="flex-1 bg-transparent shadow-none border-0 px-0"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onPress={handleClearSearch}
                className="active:opacity-70 shrink-0"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon
                  as={require("lucide-react-native").X}
                  className="text-muted-foreground size-4"
                />
              </Button>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
};
