import { useCalculator } from "@/hooks/use-calculator";
import { router } from "expo-router";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

const Calculator = () => {
  const {
    display,
    handleNumberInput,
    handleOperator,
    handleClear,
    handleEqual,
    handleDelete,
    pinInput,
    isLoading,
    isError,
    error,
    refetch
  } = useCalculator();

  return (
    <View className="flex-1 bg-gray-900 p-4 justify-end mb-12">


      {isError && (
        <View className="mb-4 bg-red-700 rounded p-2">
          <Text className="text-white text-center">
            {typeof error === "object" && error?.message
              ? error.message
              : "An error occurred. Please try again."}
          </Text>
        </View>
      )}

      <View className="mb-6">
        <Text className="text-white text-right text-5xl font-bold">
          {display || pinInput}
        </Text>
      </View>

      <View className="flex-row mb-4">
        <TouchableOpacity
          className="flex-1 bg-gray-700 rounded-full p-6 items-center justify-center mr-2"
          // onPress={handleClear}
          onPress={()=>{ 
            handleClear()
            refetch()
          }}
        >
          <Text className="text-white text-2xl font-bold">C</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-700 rounded-full p-6 items-center justify-center mr-2"
          onPress={handleDelete}
        >
          <Text className="text-white text-2xl font-bold">⌫</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-700 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleOperator("%")}
        >
          <Text className="text-white text-2xl font-bold">%</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-accent-500 rounded-full p-6 items-center justify-center"
          onPress={() => handleOperator("/")}
        >
          <Text className="text-white text-2xl font-bold">÷</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-4">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("7")}
        >
          <Text className="text-white text-2xl font-bold">7</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("8")}
        >
          <Text className="text-white text-2xl font-bold">8</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("9")}
        >
          <Text className="text-white text-2xl font-bold">9</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-accent-500 rounded-full p-6 items-center justify-center"
          onPress={() => handleOperator("*")}
        >
          <Text className="text-white text-2xl font-bold">×</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-4">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("4")}
        >
          <Text className="text-white text-2xl font-bold">4</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("5")}
        >
          <Text className="text-white text-2xl font-bold">5</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("6")}
        >
          <Text className="text-white text-2xl font-bold">6</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-accent-500 rounded-full p-6 items-center justify-center"
          onPress={() => handleOperator("-")}
        >
          <Text className="text-white text-2xl font-bold">−</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row mb-4">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("1")}
        >
          <Text className="text-white text-2xl font-bold">1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("2")}
        >
          <Text className="text-white text-2xl font-bold">2</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("3")}
        >
          <Text className="text-white text-2xl font-bold">3</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-accent-500 rounded-full p-6 items-center justify-center"
          onPress={() => handleOperator("+")}
        >
          <Text className="text-white text-2xl font-bold">+</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row">
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput("0")}
        >
          <Text className="text-white text-2xl font-bold">0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-800 rounded-full p-6 items-center justify-center mr-2"
          onPress={() => handleNumberInput(".")}
        >
          <Text className="text-white text-2xl font-bold">.</Text>
        </TouchableOpacity>

        {/* 2. UPDATE THE EQUALS BUTTON */}
        <TouchableOpacity
          className={`flex-2 rounded-full p-6 items-center justify-center ${isError ? "bg-red-500" : "bg-primary-500"
            }`}
          style={{ flex: 2 }}
          onPress={handleEqual}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text className="text-white text-2xl font-bold">=</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Calculator;
