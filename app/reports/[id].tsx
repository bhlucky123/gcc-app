import { useAuthStore } from '@/store/auth';
import api from '@/utils/axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Check, Copy, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Clipboard, Linking, Platform, RefreshControl, SafeAreaView, ScrollView, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';

const fmt = (val: number | string | null | undefined) => {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (isNaN(n)) return '';
  return n.toLocaleString('en-IN');
};

const fmtCurrency = (val: number | null | undefined) => {
  if (val == null) return '₹0.00';
  return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const SummaryRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <View className="flex-row justify-between py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
    <Text className="text-sm text-gray-500">{label}</Text>
    <Text className="text-sm font-bold" style={{ color: color || '#1e293b' }}>{value}</Text>
  </View>
);

const Report = () => {
  const local = useLocalSearchParams();
  const navigation = useNavigation();
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
    refetch,
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

  useEffect(() => {
    if (data?.dealer_name) {
      navigation.setOptions({ title: `Report (${data.dealer_name})` });
    }
  }, [data?.dealer_name, navigation]);

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
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <View style={{ backgroundColor: '#eef2ff', borderRadius: 20, padding: 20 }}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
        <Text className="mt-4 text-gray-500 font-semibold">Loading report...</Text>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6">
        <View className="bg-red-50 rounded-2xl p-6 items-center" style={{ borderWidth: 1, borderColor: '#fecaca' }}>
          <Text className="text-red-600 font-bold text-base">Failed to load report</Text>
          <Text className="text-red-400 text-sm mt-1">Please try again later</Text>
        </View>
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
    if (Platform.OS === 'android') {
      ToastAndroid.show('Report copied!', ToastAndroid.SHORT);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = buildCopyText();
    const encoded = encodeURIComponent(text);
    Linking.openURL(`whatsapp://send?text=${encoded}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 pb-10">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            colors={["#4f46e5"]}
            tintColor="#4f46e5"
          />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-center">
          {isFetching && (
            <Text className='text-center'>Refershing...</Text>
          )}
        </View>

        {/* Date picker row */}
        <View className="px-4 mb-3">
          <View
            className="flex-row items-center rounded-2xl px-2 py-2"
            style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}
          >
            <TouchableOpacity
              onPress={goToPrevDay}
              activeOpacity={0.7}
              style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
              }}
            >
              <Text className="text-lg font-bold text-gray-700">‹</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
              className="flex-1 mx-2 items-center py-2.5 rounded-xl"
              style={{ backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
            >
              <Text className="text-base font-bold text-gray-800">
                {formatDateDisplay(selectedDate)}
              </Text>
              {isToday && (
                <View className="mt-1 px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#eef2ff' }}>
                  <Text className="text-[10px] font-bold" style={{ color: '#4f46e5' }}>TODAY</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={goToNextDay}
              activeOpacity={0.7}
              disabled={isToday}
              style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
                opacity: isToday ? 0.3 : 1,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
              }}
            >
              <Text className="text-lg font-bold text-gray-700">›</Text>
            </TouchableOpacity>
          </View>
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

        {/* Action buttons */}
        <View className="px-4 mb-3">
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleCopy}
              activeOpacity={0.75}
              disabled={!data}
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
              style={{
                backgroundColor: copied ? '#059669' : '#4f46e5',
                opacity: !data ? 0.4 : 1,
              }}
            >
              {copied ? (
                <Check size={16} color="#fff" strokeWidth={3} />
              ) : (
                <Copy size={16} color="#fff" strokeWidth={2.5} />
              )}
              <Text className="text-white font-bold text-sm ml-2">
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleWhatsAppShare}
              activeOpacity={0.75}
              disabled={!data}
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
              style={{
                backgroundColor: '#25D366',
                opacity: !data ? 0.4 : 1,
              }}
            >
              <Share2 size={16} color="#fff" strokeWidth={2.5} />
              <Text className="text-white font-bold text-sm ml-2">
                WhatsApp
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sales Details Table */}
        {sales_details && sales_details.length > 0 && (
          <View className="px-4 mb-3">
            <View
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            >
              <View className="px-4 py-3" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                <Text className="text-sm font-bold text-gray-700">Sales Details</Text>
              </View>
              <View className="flex-row px-4 py-2.5" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                <Text className="flex-1 text-xs font-bold text-gray-400">TIME</Text>
                <Text className="text-xs font-bold text-gray-400 text-right" style={{ width: 80 }}>SELL</Text>
                <Text className="text-xs font-bold text-gray-400 text-right" style={{ width: 80 }}>PRIZE</Text>
              </View>
              {sales_details.map((item: any, idx: number) => (
                <View
                  key={idx}
                  className="flex-row px-4 py-3"
                  style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbfc', borderBottomWidth: idx < sales_details.length - 1 ? 1 : 0, borderBottomColor: '#f1f5f9' }}
                >
                  <Text className="flex-1 text-sm font-semibold text-gray-800">{item?.draw_name || item?.name || item?.time || ''}</Text>
                  <Text className="text-sm font-bold text-gray-900 text-right" style={{ width: 80 }}>
                    {fmt(item?.sell ?? item?.total_sell)}
                  </Text>
                  <Text className="text-sm font-bold text-right" style={{ width: 80, color: '#b45309' }}>
                    {fmt(item?.price ?? item?.total_price)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Summary */}
        <View className="px-4 mb-3">
          <View
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
          >
            <View className="px-4 py-3" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
              <Text className="text-sm font-bold text-gray-700">Summary</Text>
            </View>
            <View className="px-4">
              <SummaryRow label="Total Sell" value={fmtCurrency(summary?.total_sell)} color="#4f46e5" />
              <SummaryRow label="Total Prize" value={fmtCurrency(summary?.total_price)} color="#b45309" />
              <SummaryRow label="Agent Commission" value={fmtCurrency(summary?.agent_comm)} />
              <SummaryRow label="Today's Balance" value={fmtCurrency(summary?.today_balance)} />
              <SummaryRow label="Old Balance" value={fmtCurrency(summary?.old_balance)} />
              <SummaryRow label="Received Amount" value={fmtCurrency(summary?.received_amount)} color="#047857" />
              <SummaryRow label="Paid Amount" value={fmtCurrency(summary?.paid_amount)} color="#dc2626" />
            </View>
            <View className="mx-4 my-3 rounded-xl px-4 py-3" style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }}>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-bold text-gray-700">Total Balance</Text>
                <Text className="text-lg font-extrabold" style={{ color: '#047857' }}>
                  {fmtCurrency(summary?.total_balance)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bank details */}
        {admin_bank_account_details && (
          <View className="px-4 mb-3">
            <View
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            >
              <View className="px-4 py-3" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                <Text className="text-sm font-bold text-gray-700">Bank Account Details</Text>
              </View>
              <View className="px-4 py-3">
                <Text className="text-sm text-gray-700 leading-5">
                  {admin_bank_account_details}
                </Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default Report;
