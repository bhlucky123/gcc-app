import { useAuthStore } from '@/store/auth';
import api from '@/utils/axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from "expo-router";
import { useState } from 'react';
import { ActivityIndicator, Clipboard, Platform, SafeAreaView, ScrollView, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';

const fmt = (val: number | string | null | undefined) => {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (isNaN(n)) return '';
  return n.toLocaleString('en-IN');
};

const formatDateYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateDisplay = (d: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const Report = () => {
  const local = useLocalSearchParams();
  const [copied, setCopied] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const id = Array.isArray(local?.id)
    ? local.id[0] || ""
    : local?.id || "";

  const { user } = useAuthStore();

  const {
    data,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ["sales-report", id, formatDateYMD(selectedDate)],
    queryFn: async () => {
      const body: any = { dealer_id: id };
      body.date = formatDateYMD(selectedDate);
      const res = await api.post("/draw-result/sales-report-api/", body);
      return res.data;
    },
    enabled: !!id,
  });

  const onDateChange = (_event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d <= today) {
      setSelectedDate(d);
    }
  };

  const isToday = formatDateYMD(selectedDate) === formatDateYMD(new Date());

  if (isLoading && !data) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-gray-700">Loading report...</Text>
      </SafeAreaView>
    );
  }

  if (error && !data) {
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

  const buildCopyText = () => {
    let text = '';

    text += `📊 DAILY SALES REPORT – ${date_display || ''}\n\n`;
    text += `👤 Name: ${dealer_name || ''}\n\n`;

    text += `🕒 Sales Details:\n\n`;
    text += `Time   | Sell         | Price \n`;
    text += `------------------------------------\n`;
    if (sales_details && sales_details.length > 0) {
      for (const item of sales_details) {
        const name = item?.draw_name || item?.name || item?.time || '';
        const sell = fmt(item?.sell ?? item?.total_sell);
        const price = fmt(item?.price ?? item?.total_price);
        text += `${name} | ${sell}  | ${price}\n`;
      }
    }

    text += `\n📌 Summary:\n\n`;
    text += `Total Sell: ${fmt(summary?.total_sell)}\n\n`;
    text += `Total Prize: ${fmt(summary?.total_price)}\n\n`;
    text += `Agent Comm: ${fmt(summary?.agent_comm)}\n\n`;
    text += `Today's Balance: ${fmt(summary?.today_balance)}\n\n`;
    text += `Old Balance: ${fmt(summary?.old_balance)}\n\n`;
    text += `Received Amount: ${fmt(summary?.received_amount)}\n\n`;
    text += `Paid Amount: ${fmt(summary?.paid_amount)}\n\n`;
    text += `Total Balance: ${fmt(summary?.total_balance)}\n\n`;

    text += `------------------------------------\n`;
    if (admin_bank_account_details) {
      text += `${admin_bank_account_details}\n`;
    }

    return text;
  };

  const handleCopy = () => {
    const text = buildCopyText();
    Clipboard.setString(text);
    ToastAndroid.show('Report copied!', ToastAndroid.SHORT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 px-4 py-6"
        style={{ paddingTop: Platform.OS === 'android' ? 40 : 0 }}
      >
        {/* Title + Copy */}
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-800">Sales Report</Text>
          <TouchableOpacity
            onPress={handleCopy}
            activeOpacity={0.8}
            disabled={!data}
            className={`px-5 py-2.5 rounded-lg ${copied ? 'bg-green-500' : 'bg-blue-600'} ${!data ? 'opacity-50' : ''}`}
          >
            <Text className="text-white font-bold text-sm">
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date picker row */}
        <View className="flex-row items-center justify-between bg-gray-50 rounded-xl px-2 py-2 mb-4">
          <TouchableOpacity
            onPress={goToPrevDay}
            activeOpacity={0.7}
            className="bg-white rounded-lg px-4 py-2.5 border border-gray-200"
          >
            <Text className="text-lg font-bold text-gray-700">‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
            className="flex-1 mx-3 items-center py-2.5 bg-white rounded-lg border border-gray-200"
          >
            <Text className="text-base font-bold text-gray-800">
              {formatDateDisplay(selectedDate)}
            </Text>
            {isToday && <Text className="text-xs text-blue-600 font-semibold">Today</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goToNextDay}
            activeOpacity={0.7}
            disabled={isToday}
            className={`bg-white rounded-lg px-4 py-2.5 border border-gray-200 ${isToday ? 'opacity-30' : ''}`}
          >
            <Text className="text-lg font-bold text-gray-700">›</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Loading overlay for date change */}
        {isFetching && (
          <View className="items-center py-3 mb-2">
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        )}

        {/* Dealer info */}
        <View className="mb-4">
          <Text className="text-base text-gray-600">Dealer: <Text className="font-semibold">{dealer_name}</Text></Text>
          <Text className="text-base text-gray-600">Date: <Text className="font-semibold">{date_display}</Text></Text>
        </View>

        {/* Sales Details Table */}
        {sales_details && sales_details.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-700 mb-2">Sales Details</Text>
            <View className="bg-gray-50 rounded-xl overflow-hidden">
              <View className="flex-row bg-gray-200 px-4 py-2.5">
                <Text className="flex-1 text-sm font-bold text-gray-600">Time</Text>
                <Text className="text-sm font-bold text-gray-600 text-right" style={{ width: 80 }}>Sell</Text>
                <Text className="text-sm font-bold text-gray-600 text-right" style={{ width: 80 }}>Price</Text>
              </View>
              {sales_details.map((item: any, idx: number) => (
                <View key={idx} className={`flex-row px-4 py-2.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <Text className="flex-1 text-sm text-gray-800">{item?.draw_name || item?.name || item?.time || ''}</Text>
                  <Text className="text-sm font-semibold text-gray-900 text-right" style={{ width: 80 }}>
                    {fmt(item?.sell ?? item?.total_sell)}
                  </Text>
                  <Text className="text-sm font-semibold text-gray-900 text-right" style={{ width: 80 }}>
                    {fmt(item?.price ?? item?.total_price)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary */}
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

        {/* Bank details */}
        <View className="mb-8">
          <Text className="text-lg font-semibold text-gray-700 mb-2">Admin Bank Account Details</Text>
          <View className="bg-gray-50 rounded-md p-3">
            <Text className="text-sm text-gray-800 whitespace-pre-line">
              {admin_bank_account_details}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Report;
