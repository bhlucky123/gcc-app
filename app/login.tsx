import { useAuthStore } from "@/store/auth";
import { config } from "@/utils/config";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { login, loading, error } = useAuthStore();

  const handleLogin = () => {
    setErrorMsg("");
    if (!username || !password) {
      setErrorMsg("Please enter both username and password.");
      return;
    }

    login({username, password});
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-gradient-to-b from-blue-900 to-blue-600 px-6 py-8 items-center justify-center">
          <View className="w-full max-w-sm bg-white/90 rounded-2xl shadow-lg p-8 space-y-6">
            <View className="items-center mb-2">
              <Text className="text-blue-900 text-3xl font-extrabold tracking-wide mb-1 capitalize">
                {config.userType?.toLocaleLowerCase()} Login
              </Text>
              <Text className="text-gray-500 text-base font-medium">
                Welcome back! Please sign in.
              </Text>
            </View>

            {error && (
              <Text className="text-red-600 text-sm text-center font-medium">
                {error}
              </Text>
            )}

            {errorMsg && (
              <Text className="text-red-600 text-sm text-center font-medium">
                {errorMsg}
              </Text>
            )}

            <View className="space-y-2">
              <Text className="text-gray-700 text-sm font-semibold">Username</Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-base text-black"
                placeholder="Enter username"
                placeholderTextColor="#9ca3af"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                textContentType="username"
              />
            </View>

            <View className="space-y-2">
              <Text className="text-gray-700 text-sm font-semibold">Password</Text>
              <TextInput
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black bg-gray-50 text-base"
                placeholder="Enter password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                textContentType="password"
              />
            </View>

            <TouchableOpacity
              className={`w-full bg-blue-600 p-3 rounded-lg mt-4 flex items-center justify-center shadow-md ${loading ? "opacity-70" : ""
                }`}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white text-lg text-center font-bold tracking-wide">
                  Login
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
