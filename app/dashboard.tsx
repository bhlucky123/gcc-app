import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar, PieChart, TrendingUp, Wallet } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const CHART_BAR_HEIGHT = 100;
const CHART_DAY_WIDTH = 28;
const MIN_BAR_HEIGHT = 4;

type DashboardSummary = {
  sales: number;
  commission: number;
  winnings: number;
  profit: number;
  total_dealer_pending?: number;
};

type DailyItem = {
  date: string; // MM-DD
  sales: number;
  profit: number;
};

type DrawItem = {
  name: string;
  sales: number;
  winnings: number;
  profit: number;
};

type DashboardResponse = {
  summary: DashboardSummary;
  daily: DailyItem[];
  draws: DrawItem[];
};

const DAY_OPTIONS = [7, 15, 30];

const getDefaultCustomDates = () => {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  return { start: sevenDaysAgo, end: today };
};

export default function AdminDashboard() {
  const { start: defaultStart, end: defaultEnd } = getDefaultCustomDates();
  const [days, setDays] = useState<number>(7);
  const [dateRangeMode, setDateRangeMode] = useState<"days" | "custom">("days");
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  const [showDatePicker, setShowDatePicker] = useState<"from" | "to" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const apiParams = useMemo(() => {
    if (dateRangeMode === "custom") {
      return { start_date: formatDateYYYYMMDD(startDate), end_date: formatDateYYYYMMDD(endDate) };
    }
    return { days: Math.max(1, Number(days)) };
  }, [dateRangeMode, startDate, endDate, days]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<DashboardResponse>({
    queryKey: ["admin-dashboard", apiParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRangeMode === "custom") {
        params.set("start_date", formatDateYYYYMMDD(startDate));
        params.set("end_date", formatDateYYYYMMDD(endDate));
      } else {
        params.set("days", String(Math.max(1, Number(days))));
      }
      const res = await api.get(`/draw-result/admin-dashboard/?${params.toString()}`);
      return res.data;
    },
  });

  const onDateChange = useCallback(
    (event: { type: string }, selectedDate?: Date) => {
      setShowDatePicker(null);
      if (event.type !== "set" || !selectedDate) return;
      if (showDatePicker === "from") {
        setStartDate(selectedDate);
        if (selectedDate > endDate) setEndDate(selectedDate);
      } else if (showDatePicker === "to") {
        setEndDate(selectedDate);
        if (selectedDate < startDate) setStartDate(selectedDate);
      }
    },
    [showDatePicker, startDate, endDate]
  );

  const summary = data?.summary;
  const daily = data?.daily ?? [];
  const draws = data?.draws ?? [];

  const maxDailySales = useMemo(
    () => (daily.length ? Math.max(...daily.map((d) => d.sales)) : 0),
    [daily]
  );

  const maxDailyProfit = useMemo(
    () => (daily.length ? Math.max(...daily.map((d) => d.profit)) : 0),
    [daily]
  );

  const maxDrawSales = useMemo(
    () => (draws.length ? Math.max(...draws.map((d) => d.sales)) : 0),
    [draws]
  );

  const maxDrawProfit = useMemo(
    () => (draws.length ? Math.max(...draws.map((d) => d.profit)) : 0),
    [draws]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const formatAmount = (value?: number | null) => {
    if (value == null) return "₹0.00";
    return `₹${value.toFixed(2)}`;
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isFetching}
            onRefresh={onRefresh}
            colors={["#6366f1"]}
            tintColor="#6366f1"
          />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-xl font-extrabold text-gray-900">
              Admin Dashboard
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              Overview of sales, winnings and profit
            </Text>
          </View>
          <View className="w-10 h-10 rounded-full bg-indigo-100 items-center justify-center">
            <BarChart3 size={20} color="#4f46e5" />
          </View>
        </View>

        {/* Date range filter */}
        <View className="px-4 mt-1 mb-3">
          <View
            className="overflow-hidden rounded-2xl"
            style={{
              backgroundColor: "#f8fafc",
              borderWidth: 1,
              borderColor: "#e2e8f0",
              shadowColor: "#64748b",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View className="px-4 py-3">
              <View className="flex-row items-center gap-2 mb-3">
                <View
                  className="w-7 h-7 rounded-lg items-center justify-center"
                  style={{ backgroundColor: "#eef2ff" }}
                >
                  <Calendar size={14} color="#4f46e5" />
                </View>
                <Text className="text-sm font-bold text-gray-800">Date range</Text>
              </View>

              {/* Preset + Custom tabs */}
              <View
                className="flex-row flex-wrap gap-2 p-1 rounded-xl"
                style={{ backgroundColor: "#f1f5f9" }}
              >
                {DAY_OPTIONS.map((option) => {
                  const active = dateRangeMode === "days" && option === days;
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => {
                        setDateRangeMode("days");
                        setDays(option);
                      }}
                      className="flex-1 min-w-[72px]"
                      activeOpacity={0.75}
                    >
                      <View
                        className="py-2.5 rounded-lg items-center"
                        style={{
                          backgroundColor: active ? "#4f46e5" : "transparent",
                          shadowColor: active ? "#4f46e5" : undefined,
                          shadowOffset: active ? { width: 0, height: 2 } : undefined,
                          shadowOpacity: active ? 0.25 : 0,
                          shadowRadius: active ? 4 : 0,
                          elevation: active ? 2 : 0,
                        }}
                      >
                        <Text
                          className={`text-xs font-bold ${
                            active ? "text-white" : "text-gray-600"
                          }`}
                        >
                          {option} days
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={() => setDateRangeMode("custom")}
                  className="flex-1 min-w-[72px]"
                  activeOpacity={0.75}
                >
                  <View
                    className="py-2.5 rounded-lg flex-row items-center justify-center gap-1.5"
                    style={{
                      backgroundColor: dateRangeMode === "custom" ? "#4f46e5" : "transparent",
                      shadowColor: dateRangeMode === "custom" ? "#4f46e5" : undefined,
                      shadowOffset: dateRangeMode === "custom" ? { width: 0, height: 2 } : undefined,
                      shadowOpacity: dateRangeMode === "custom" ? 0.25 : 0,
                      shadowRadius: dateRangeMode === "custom" ? 4 : 0,
                      elevation: dateRangeMode === "custom" ? 2 : 0,
                    }}
                  >
                    <Calendar size={13} color={dateRangeMode === "custom" ? "#fff" : "#64748b"} />
                    <Text
                      className={`text-xs font-bold ${
                        dateRangeMode === "custom" ? "text-white" : "text-gray-600"
                      }`}
                    >
                      Custom
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {dateRangeMode === "custom" ? (
                <View className="mt-3 flex-row items-stretch gap-2">
                  <TouchableOpacity
                    onPress={() => setShowDatePicker("from")}
                    className="flex-1 rounded-xl px-4 py-3 flex-row items-center gap-2"
                    style={{
                      backgroundColor: "#fff",
                      borderWidth: showDatePicker === "from" ? 2 : 1,
                      borderColor: showDatePicker === "from" ? "#6366f1" : "#e2e8f0",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 3,
                      elevation: 1,
                    }}
                    activeOpacity={0.8}
                  >
                    <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center">
                      <Calendar size={16} color="#4f46e5" />
                    </View>
                    <View>
                      <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        From
                      </Text>
                      <Text className="text-base font-bold text-gray-900 mt-0.5">
                        {formatDateDDMMYYYY(startDate)}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View
                    className="w-8 items-center justify-center"
                    style={{ marginHorizontal: -4 }}
                  >
                    <View
                      className="w-6 h-0.5 rounded-full"
                      style={{ backgroundColor: "#c7d2fe" }}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => setShowDatePicker("to")}
                    className="flex-1 rounded-xl px-4 py-3 flex-row items-center gap-2"
                    style={{
                      backgroundColor: "#fff",
                      borderWidth: showDatePicker === "to" ? 2 : 1,
                      borderColor: showDatePicker === "to" ? "#6366f1" : "#e2e8f0",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.05,
                      shadowRadius: 3,
                      elevation: 1,
                    }}
                    activeOpacity={0.8}
                  >
                    <View className="w-9 h-9 rounded-xl bg-indigo-50 items-center justify-center">
                      <Calendar size={16} color="#4f46e5" />
                    </View>
                    <View>
                      <Text className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        To
                      </Text>
                      <Text className="text-base font-bold text-gray-900 mt-0.5">
                        {formatDateDDMMYYYY(endDate)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text className="text-xs text-gray-500 mt-2.5 font-medium">
                  Showing data for the last {days} days
                </Text>
              )}
            </View>

            {showDatePicker != null && (
              <View className="px-4 pb-3">
                <DateTimePicker
                  value={showDatePicker === "from" ? startDate : endDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                  maximumDate={showDatePicker === "from" ? endDate : new Date()}
                  minimumDate={showDatePicker === "to" ? startDate : undefined}
                />
              </View>
            )}
          </View>
        </View>

        {/* Loading / Error */}
        {isLoading ? (
          <View className="mt-10 items-center justify-center">
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : error ? (
          <View className="mt-10 mx-4 p-4 rounded-2xl bg-red-50 border border-red-200">
            <Text className="text-sm font-semibold text-red-700 mb-1">
              Failed to load dashboard
            </Text>
            {/* @ts-ignore */}
            <Text className="text-xs text-red-600">
              {error?.message || "Unknown error"}
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              className="mt-3 self-start px-3 py-1.5 rounded-full bg-red-600"
              activeOpacity={0.8}
            >
              <Text className="text-xs font-semibold text-white">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Summary cards */}
            <View className="mx-4 mt-1 flex-row gap-3">
              <View className="flex-1 bg-indigo-50 border border-indigo-100 rounded-2xl p-3">
                <Text className="text-[11px] text-indigo-700 mb-1">Sales</Text>
                <Text className="text-lg font-extrabold text-indigo-900">
                  {formatAmount(summary?.sales)}
                </Text>
                <Text className="text-[10px] text-indigo-500 mt-1">
                  Total booking amount
                </Text>
              </View>

              <View className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
                <Text className="text-[11px] text-emerald-700 mb-1">
                  Pending Amount
                </Text>
                <Text className="text-lg font-extrabold text-emerald-900">
                  {formatAmount(summary?.total_dealer_pending)}
                </Text>
                <Text className="text-[10px] text-emerald-500 mt-1">
                  Old Balance
                </Text>
              </View>
            </View>

            <View className="mx-4 mt-3 flex-row gap-3">
              <View className="flex-1 bg-amber-50 border border-amber-100 rounded-2xl p-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] text-amber-700">Winnings</Text>
                  <Wallet size={14} color="#b45309" />
                </View>
                <Text className="text-lg font-extrabold text-amber-900">
                  {formatAmount(summary?.winnings)}
                </Text>
                <Text className="text-[10px] text-amber-500 mt-1">
                  Total winnings
                </Text>
              </View>

              <View className="flex-1 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-[11px] text-emerald-700">Profit</Text>
                  <TrendingUp size={14} color="#047857" />
                </View>
                <Text className="text-lg font-extrabold text-emerald-900">
                  {formatAmount(summary?.profit)}
                </Text>
                <Text className="text-[10px] text-emerald-500 mt-1">
                  Sales - commission - winnings
                </Text>
              </View>
            </View>


            {/* Draw breakdown */}
            <View className="mx-4 mt-4 mb-6 bg-white border border-gray-200 rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <PieChart size={16} color="#4b5563" />
                  <Text className="ml-1.5 text-sm font-semibold text-gray-800">
                    Draw breakdown
                  </Text>
                </View>
              </View>

              {draws.length === 0 ? (
                <Text className="text-[11px] text-gray-500 py-2">
                  No draws in this range.
                </Text>
              ) : (
                draws.map((draw) => {
                  const salesPct =
                    maxDrawSales > 0
                      ? Math.max(2, (draw.sales / maxDrawSales) * 100)
                      : 0;
                  const profitPct =
                    maxDrawProfit > 0
                      ? Math.max(2, (draw.profit / maxDrawProfit) * 100)
                      : 0;

                  return (
                    <View
                      key={draw.name}
                      className="mb-4 pb-4 border-b border-gray-100 last:border-b-0 last:pb-0 last:mb-0"
                    >
                      <Text className="text-sm mt-4 font-semibold text-gray-800 mb-1">
                        {draw.name}
                      </Text>
                      <View className="flex-row items-center justify-between mb-1.5">
                        <Text className="text-[11px] text-gray-500">Sales</Text>
                        <Text className="text-[11px] font-medium text-gray-800">
                          {formatAmount(draw.sales)}
                        </Text>
                      </View>
                      <View
                        className="h-2 bg-gray-100 rounded-full overflow-hidden"
                        style={{ marginBottom: 10 }}
                      >
                        <View
                          style={{
                            height: "100%",
                            width: `${salesPct}%`,
                            backgroundColor: "#6366f1",
                            borderRadius: 4,
                          }}
                        />
                      </View>
                      <View className="flex-row items-center justify-between mb-1.5">
                        <Text className="text-[11px] text-gray-500">Profit</Text>
                        <Text className="text-[11px] font-medium text-emerald-700">
                          {formatAmount(draw.profit)}
                        </Text>
                      </View>
                      <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <View
                          style={{
                            height: "100%",
                            width: `${profitPct}%`,
                            backgroundColor: "#34d399",
                            borderRadius: 4,
                          }}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

