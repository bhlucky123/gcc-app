import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Calendar, Check } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { Agent } from "./(tabs)/agent";

// --- DATE HELPERS (as in sales-report.tsx) ---

function stripTime(date: Date) {
  // Returns a copy of date at 00:00:00 (midnight, local time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const DailyReport = () => {
  const { selectedDraw } = useDrawStore();

  // Default: today, tomorrow
  const today = new Date();
  const [fromDate, setFromDate] = useState<Date>(stripTime(today));
  // set toDate to today+1, but immediately stripTime
  const [toDate, setToDate] = useState<Date>(stripTime(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)));
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [allGames, setAllGames] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuthStore();

  const queryClient = useQueryClient();
  const cachedAgents = queryClient.getQueryData<Agent[]>(["agents"]);
  const cachedDealers = queryClient.getQueryData<Agent[]>(["dealers"]);
  const [selectedDealer, setSelectedDealer] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("");


  // When sending to API, use yyyy-mm-dd (local)
  const buildQuery = () => {
    const params: Record<string, any> = {};
    // Don't include time, just yyyy-mm-dd
    if (fromDate) {
      const year = fromDate.getFullYear();
      const month = String(fromDate.getMonth() + 1).padStart(2, "0");
      const day = String(fromDate.getDate()).padStart(2, "0");
      params["date_time__gte"] = `${year}-${month}-${day}`;
    }
    if (toDate) {
      const year = toDate.getFullYear();
      const month = String(toDate.getMonth() + 1).padStart(2, "0");
      const day = String(toDate.getDate()).padStart(2, "0");
      params["date_time__lte"] = `${year}-${month}-${day}`;
    }
    if (selectedDraw?.id && !allGames) params.draw_session__draw = selectedDraw.id;
    if (user?.user_type === "ADMIN" && selectedDealer) params.dealer = selectedDealer;
    if (user?.user_type === "DEALER" && selectedAgent) params.booked_agent = selectedAgent;
    return params;
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["/draw-booking/daily-report", buildQuery()],
    queryFn: async () => {
      const res = await api.get("/draw-booking/daily-report/", { params: buildQuery() });
      return res.data;
    },
    enabled: !!selectedDraw?.id,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["agents"],
    queryFn: () => api.get("/agent/manage/").then((res) => res.data),
    enabled: user?.user_type === "DEALER" && !cachedAgents,
    initialData: user?.user_type === "DEALER" ? cachedAgents : undefined,
  });

  const { data: dealers = [] } = useQuery<Agent[]>({
    queryKey: ["dealers"],
    queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
    enabled: user?.user_type === "ADMIN" && !cachedDealers,
    initialData: user?.user_type === "ADMIN" ? cachedDealers : undefined,
  });

  // Assign correct BALANCE field on each row
  const REPORT_DATA = data?.report?.map((item: any) => ({
    ...item,
    BALANCE:
      ((user?.user_type === "ADMIN" || user?.user_type === "DEALER")
        ? item?.total_dealer_amount || 0
        : item?.total_agent_amount || 0) - (item?.total_winning_prize || 0) || 0,
  }));
  const SUMMARY_DATA = data?.summary?.map((item: any) => ({
    ...item,
    BALANCE:
      ((user?.user_type === "ADMIN" || user?.user_type === "DEALER")
        ? item?.total_dealer_amount || 0
        : item?.total_agent_amount || 0) - (item?.total_winning_prize || 0) || 0,
  }));

  const renderTableHeader = (cols: string[]) => (
    <View className="flex-row bg-gray-100 border-b border-gray-200 py-2">
      {cols.map((col) => (
        <Text key={col} className="flex-1 text-xs font-semibold text-center text-gray-700 uppercase">
          {col}
        </Text>
      ))}
    </View>
  );

  const renderSummaryRow = (item: any, isTotal = false) => (
    <View
      key={isTotal ? "summary-total" : item.draw + (item.agent?.username || "")}
      className={`flex-row py-2 border-b border-gray-100 ${isTotal ? "bg-gray-100" : "bg-white"}`}
    >
      {isTotal ?
        <Text className="flex-1 text-xs text-center text-gray-800">
          Total
        </Text>
        :
        <Text className="flex-1 text-xs text-center text-gray-800">{item.draw}</Text>
      }
      <Text className="flex-1 text-xs text-center text-gray-800">
        {amountHandler(Number((user?.user_type === "ADMIN" || user?.user_type === "DEALER") ? item.total_dealer_amount : item.total_amount))}
      </Text>
      <>
        <Text className="flex-1 text-xs text-center text-gray-800">{amountHandler(item?.total_winning_prize || 0)}</Text>
        {
          isTotal ? (
            <Text className="flex-1 text-xs text-center text-gray-800">{amountHandler(item?.BALANCE || item?.balance || 0)}</Text>
          ) :
            <Text className="flex-1 text-xs text-center text-gray-800">
              {amountHandler(
                ((user?.user_type === "ADMIN" || user?.user_type === "DEALER")
                  ? item?.total_dealer_amount || 0
                  : item?.total_agent_amount || 0) - (item?.total_winning_prize || 0) || 0
              )}
            </Text>
        }
      </>
    </View>
  );

  const renderDetailRow = (item: any, isTotal = false) => (
    <View
      key={isTotal ? "detail-total" : item.date + item.draw + item.agent?.username}
      className={`flex-row py-2 border-b border-gray-100 ${isTotal ? "bg-gray-100" : "bg-white"}`}
    >
      <Text className="flex-1 text-xs text-center text-gray-800">
        {isTotal ? "Total" : item.date}
      </Text>
      <Text className="flex-1 text-xs text-center text-gray-800">{amountHandler(Number((user?.user_type === "ADMIN" || user?.user_type === "DEALER") ? item.total_dealer_amount : item.total_amount))}</Text>
      <>
        <Text className="flex-1 text-xs text-center text-gray-800">{amountHandler(item?.total_winning_prize || 0)}</Text>
        {
          isTotal ? (
            <Text className="flex-1 text-xs text-center text-gray-800">{amountHandler(item?.BALANCE || item?.balance || 0)}</Text>
          ) :
            <Text className="flex-1 text-xs text-center text-gray-800">
              {amountHandler(
                ((user?.user_type === "ADMIN" || user?.user_type === "DEALER")
                  ? item?.total_dealer_amount || 0
                  : item?.total_agent_amount || 0) - (item?.total_winning_prize || 0) || 0
              )}
            </Text>
        }
      </>
    </View>
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // SUM HELPERS
  function getBalanceSum(rows: any[]) {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((acc, row) => {
      const amount =
        ((user?.user_type === "ADMIN" || user?.user_type === "DEALER")
          ? row?.total_dealer_amount || 0
          : row?.total_agent_amount || 0);
      const prize = row?.total_winning_prize || 0;
      return acc + (amount - prize);
    }, 0);
  }

  function getTotalSale(rows: any[]) {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce(
      (acc, row) =>
        acc +
        (((user?.user_type === "ADMIN" || user?.user_type === "DEALER") ? (row?.total_dealer_amount || 0) : (row?.total_amount || 0))),
      0
    );
  }

  function getTotalWinningPrize(rows: any[]) {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((acc, row) => acc + (row?.total_winning_prize || 0), 0);
  }

  const router = useRouter();

  // --- COMPONENT RENDER ---

  return (
    <View className="flex-1 bg-white">
      {/* Filter section */}
      <View className="px-4 pt-4 space-y-4">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">From Date</Text>
            <TouchableOpacity
              onPress={() => setShowFromPicker(true)}
              className="border border-gray-300 rounded-lg px-3 py-2 flex-row justify-between items-center bg-white"
              activeOpacity={0.7}
              style={{ elevation: 0 }}
            >
              <Text className="text-sm text-gray-600">
                {fromDate ? formatDateDDMMYYYY(fromDate) : "FROM"}
              </Text>
              <Calendar size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">To Date</Text>
            <TouchableOpacity
              onPress={() => setShowToPicker(true)}
              className="border border-gray-300 rounded-lg px-3 py-2 flex-row justify-between items-center bg-white"
              activeOpacity={0.7}
              style={{ elevation: 0 }}
            >
              <Text className="text-sm text-gray-600">
                {toDate ? formatDateDDMMYYYY(toDate) : "TO"}
              </Text>
              <Calendar size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mt-2">
          {user?.user_type === "ADMIN" && (
            <View className="mb-2">
              <Dropdown
                data={dealers.map((dealer) => ({
                  label: dealer.username,
                  value: dealer.id,
                }))}
                labelField="label"
                valueField="value"
                value={selectedDealer}
                onChange={item => {
                  setSelectedDealer(item.value)
                }}
                placeholder="Select Dealer"
                style={{
                  borderColor: "#9ca3af",
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  padding: 10
                }}
                containerStyle={{
                  borderRadius: 6,
                }}
                itemTextStyle={{
                  color: "#000",
                }}
                selectedTextStyle={{
                  color: "#000",
                }}
                renderRightIcon={() =>
                  selectedDealer ? (
                    <TouchableOpacity
                      onPress={() => setSelectedDealer("")}
                      style={{
                        position: "absolute",
                        right: 10,
                        zIndex: 10,
                        backgroundColor: "#fff",
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            </View>
          )}
          {user?.user_type === "DEALER" && (
            <View className="mb-2">
              <Dropdown
                data={agents.map((agent) => ({
                  label: agent.username,
                  value: agent.id,
                }))}
                labelField="label"
                valueField="value"
                value={selectedAgent}
                onChange={item => {
                  setSelectedAgent(item.value)
                }}
                placeholder="Select Agent"
                style={{
                  borderColor: "#9ca3af",
                  borderWidth: 1,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  padding: 10
                }}
                containerStyle={{
                  borderRadius: 6,
                }}
                itemTextStyle={{
                  color: "#000",
                }}
                selectedTextStyle={{
                  color: "#000",
                }}
                renderRightIcon={() =>
                  selectedAgent ? (
                    <TouchableOpacity
                      onPress={() => setSelectedAgent("")}
                      style={{
                        position: "absolute",
                        right: 10,
                        zIndex: 10,
                        backgroundColor: "#fff",
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 12,

                      }}
                    >
                      <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            </View>
          )}
        </View>

        <TouchableOpacity
          className="flex-row items-center gap-2 mt-2"
          activeOpacity={0.7}
          onPress={() => setAllGames((prev) => !prev)}
        >
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: "#16a34a",
              backgroundColor: allGames ? "#16a34a" : "#fff",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            {allGames && (
              <Check
                size={12}
                color="#fff"
                style={{
                  backgroundColor: "transparent",
                }}
              />
            )}
          </View>
          <Text className="text-sm text-gray-700">All Games</Text>
          {/* <TouchableOpacity
            onPress={() => router.push("/report")}
            className="flex-row items-center gap-2 mt-2"
            activeOpacity={0.7}
          >
            <Text className="text-sm text-gray-700">Report</Text>
          </TouchableOpacity> */}
        </TouchableOpacity>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-red-600 text-center text-sm font-semibold">
            {error?.message || "Failed to fetch report."}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 px-4 py-2 bg-green-600 rounded"
            activeOpacity={0.7}
            style={{ elevation: 0 }}
          >
            <Text className="text-white font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Report content */}
      {!isLoading && !error && (
        <ScrollView
          className="mt-4 px-4"
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isFetching}
              onRefresh={onRefresh}
              colors={["#16a34a"]}
              tintColor="#16a34a"
            />
          }
        >
          {/* Summary Table */}
          <View className="border border-gray-200 rounded-lg overflow-hidden bg-white" style={{ elevation: 0 }}>
            <Text className="bg-gray-100 px-3 py-2 font-bold text-sm border-b border-gray-200">SUMMARY</Text>
            {renderTableHeader(["GAME", "SALE", "WIN", "BAL"])}
            {data?.summary?.map((item: any) => renderSummaryRow(item))}
            {SUMMARY_DATA &&
              renderSummaryRow(
                {
                  total_amount: getTotalSale(SUMMARY_DATA),
                  total_dealer_amount: getTotalSale(SUMMARY_DATA), // For ADMIN
                  total_winning_prize: getTotalWinningPrize(SUMMARY_DATA),
                  BALANCE: getBalanceSum(SUMMARY_DATA),
                },
                true
              )}
          </View>

          {/* Detailed Table */}
          <View className="border border-gray-200 rounded-lg mt-6 mb-14 overflow-hidden bg-white" style={{ elevation: 0 }}>
            <Text className="bg-gray-100 px-3 py-2 font-bold text-sm border-b border-gray-200">DETAILED</Text>
            {renderTableHeader(["DATE", "SALE", "WIN", "BAL"])}
            {data?.report?.map((item: any) => renderDetailRow(item))}
            {REPORT_DATA &&
              renderDetailRow(
                {
                  total_amount: getTotalSale(REPORT_DATA),
                  total_dealer_amount: getTotalSale(REPORT_DATA), // For ADMIN
                  total_winning_prize: getTotalWinningPrize(REPORT_DATA),
                  BALANCE: getBalanceSum(REPORT_DATA),
                },
                true
              )}
          </View>
        </ScrollView>
      )}

      {/* Date Pickers */}
      {showFromPicker && (
        <DateTimePicker
          value={fromDate || stripTime(today)}
          mode="date"
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={(event, selected) => {
            setShowFromPicker(false);
            if (event.type === "set" && selected) {
              // Always strip time to midnight local
              const localDate = stripTime(new Date(selected));
              setFromDate(localDate);
              // Optionally, if fromDate > toDate, auto-advance toDate to fromDate
              if (toDate && localDate > toDate) {
                setToDate(localDate);
              }
            }
          }}
          maximumDate={toDate}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={toDate || stripTime(today)}
          mode="date"
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={(event, selected) => {
            setShowToPicker(false);
            if (event.type === "set" && selected) {
              const localDate = stripTime(new Date(selected));
              setToDate(localDate);
              // Optionally, if toDate < fromDate, auto-move fromDate backward
              if (fromDate && localDate < fromDate) {
                setFromDate(localDate);
              }
            }
          }}
          minimumDate={fromDate}
        />
      )}
    </View>
  );
};

export default DailyReport;
