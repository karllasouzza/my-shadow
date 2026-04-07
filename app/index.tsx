import { View, Text } from 'react-native';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">My Shadow</Text>
      <Text className="mt-2 text-lg text-gray-600">NativeWind is working!</Text>
    </View>
  );
}
