import { useAuthStore } from '@/store/auth';
import api from '@/utils/axios';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from 'react-native';

const Report = () => {
  const local = useLocalSearchParams();

  // Ensure agentId is always a string
  const id = Array.isArray(local?.id)
    ? local.id[0] || ""
    : local?.id || "";

  const {user} = useAuthStore();


  const {
    data,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["sales-report"],
    queryFn: async () => {
      const res = await api.post("/draw-result/sales-report-api/", {dealer_id: id});
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-gray-700">Loading report...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-red-600 font-bold">Failed to load report.</Text>
      </SafeAreaView>
    );
  }

  const {
    dealer_name,
    date_display,
    sales_details = [],
    admin_bank_account_details,
    summary,
  } = data || {};

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-4 py-6">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-800 mb-2">Sales Report</Text>
          <Text className="text-base text-gray-600">Dealer: <Text className="font-semibold">{dealer_name}</Text></Text>
          <Text className="text-base text-gray-600">Date: <Text className="font-semibold">{date_display}</Text></Text>
        </View>
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-700 mb-2">Summary</Text>
          <View className="bg-gray-100 rounded-xl p-4 mb-2">
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-700">Total Sell</Text>
              <Text className="font-semibold">₹{summary?.total_sell?.toFixed(2) ?? '0.00'}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-700">Total Price</Text>
              <Text className="font-semibold">₹{summary?.total_price?.toFixed(2) ?? '0.00'}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-700">Agent Commission</Text>
              <Text className="font-semibold">₹{summary?.agent_comm?.toFixed(2) ?? '0.00'}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-700">Today's Balance</Text>
              <Text className="font-semibold">₹{summary?.today_balance?.toFixed(2) ?? '0.00'}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-700">Old Balance</Text>
              <Text className="font-semibold">₹{summary?.old_balance?.toFixed(2) ?? '0.00'}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-700">Received Amount</Text>
              <Text className="font-semibold">₹{summary?.received_amount?.toFixed(2) ?? '0.00'}</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-gray-700">Paid Amount</Text>
              <Text className="font-semibold">₹{summary?.paid_amount?.toFixed(2) ?? '0.00'}</Text>
            </View>
            <View className="border-t border-gray-200 mt-2 pt-2 flex-row justify-between">
              <Text className="text-gray-900 font-bold text-base">Total Balance</Text>
              <Text className="font-bold text-base text-green-700">
                ₹{summary?.total_balance?.toFixed(2) ?? '0.00'}
              </Text>
            </View>
          </View>
        </View>
        <View className="mb-8">
          <Text className="text-lg font-semibold text-gray-700 mb-2">Admin Bank Account Details</Text>
          <View className="bg-gray-50 rounded-md p-3">
            <Text className="text-sm text-gray-800 whitespace-pre-line">
              {admin_bank_account_details}
            </Text>
          </View>
        </View>
        {/* <View>
          <Text className="text-lg font-semibold text-gray-700 mb-2">Sales Details</Text>
          {(!sales_details || sales_details.length === 0) ? (
            <Text className="text-gray-500 italic mb-4">No sales details available.</Text>
          ) : (
            // This should be expanded in future to show sales_details if available
            <Text className="text-gray-600">[Sales details here]</Text>
          )}
        </View> */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Report;