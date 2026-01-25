import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { getToday, getTommorow } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Switch,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import { Agent } from "./(tabs)/agent";

// Update WinnerReport type to allow dealer/agent to be string or object (for type safety)
type WinnerReport = {
    customer_name: string;
    bill_number: number;
    prize: number;
    win_number: string;
    count: string;
    lsk: string;
    draw: string;
    dealer: string | { id: number; username: string; user_type: string; commission: number; single_digit_number_commission: number; cap_amount: number };
    agent: string | { id: number; username: string; user_type: string; commission: number; single_digit_number_commission: number; cap_amount: number } | null;
    booking_datetime?: string; // Add this if your API returns a date field
};

type PaginatedResult<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: {
        data: T[];
        total_winning_prize: number;
    };
};

// Helper function to format date as dd/mm/yyyy
function formatDateToDDMMYYYY(date: Date | string | undefined | null): string {
    if (!date) return "";
    let d: Date;
    if (typeof date === "string") {
        d = new Date(date);
    } else {
        d = date;
    }
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

const PAGE_SIZE = 10;

const WinnersReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState<Date>(getToday());
    const [toDate, setToDate] = useState<Date>(getTommorow());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [allGame, setAllGame] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState("");
    const [selectedDealer, setSelectedDealer] = useState("");

    // Pagination state
    const [offset, setOffset] = useState(0);
    const [data, setData] = useState<WinnerReport[]>([]);
    const [count, setCount] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [fetchingMore, setFetchingMore] = useState(false);
    const [loadingInitial, setLoadingInitial] = useState(false);
    const [error, setError] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);

    const { user, token } = useAuthStore();

    // Reset pagination offset when filters change
    useEffect(() => {
        setOffset(0);
        setData([]);
        setCount(0);
    }, [
        fromDate?.toISOString?.(),
        toDate?.toISOString?.(),
        allGame,
        selectedDraw?.id,
        selectedAgent,
        selectedDealer
    ]);
    
    // QueryClient for caching
    const queryClient = useQueryClient();
    const cachedAgents = queryClient.getQueryData<Agent[]>(["agents"]);
    const cachedDealers = queryClient.getQueryData<Agent[]>(["dealers"]);

    // Fetch agents if user is DEALER
    const {
        data: agents = [],
        isLoading: isAgentLoading,
    } = useQuery<Agent[]>({
        queryKey: ["agents"],
        queryFn: () => api.get("/agent/manage/").then((res) => res.data),
        enabled: user?.user_type === "DEALER" && !cachedAgents,
        initialData: user?.user_type === "DEALER" ? cachedAgents : undefined,
    });

    // Fetch dealers if user is ADMIN
    const {
        data: dealers = [],
        isLoading: isDealerLoading,
    } = useQuery<Agent[]>({
        queryKey: ["dealers"],
        queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
        enabled: user?.user_type === "ADMIN" && !cachedDealers,
        initialData: user?.user_type === "ADMIN" ? cachedDealers : undefined,
    });

    // Build query params
    const buildQuery = (offsetVal: number = 0, limitVal: number = PAGE_SIZE) => {
        const params: Record<string, string> = {};
        if (fromDate) params["date_time__gte"] = fromDate.toISOString();
        if (toDate) params["date_time__lte"] = toDate.toISOString();
        // if (fullView) params["full_view"] = "true";
        if (user?.user_type === "DEALER" && selectedAgent)
            params["booked_agent__id"] = selectedAgent;
        if (user?.user_type === "ADMIN" && selectedDealer)
            params["booked_dealer__id"] = selectedDealer;
        if (selectedDraw?.id && !allGame) params["booking_detail__booking__draw_session__draw__id"] = String(selectedDraw.id);

        params["offset"] = String(offsetVal);
        params["limit"] = String(limitVal);

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    };

    // Fetch data function for pagination (returns the response, not just .results)
    const fetchPaginated = useCallback(
        async (offsetVal: number = 0, append: boolean = false) => {
            if (!selectedDraw?.id) {
                setData([]);
                setCount(0);
                return;
            }
            try {
                //TODO
                // console.log("fetching..")
                if (!append) setLoadingInitial(true);
                setFetchingMore(append);
                setError(null);
                const res = await api.get<PaginatedResult<WinnerReport>>(`/draw-result/winners/?${buildQuery(offsetVal)}`);
                const { results, count: total } = res.data;
                setCount(total);
                setTotalAmount(results?.total_winning_prize || 0)
                if (append) {
                    setData(prev => [...prev, ...results?.data || []]);
                } else {
                    setData(results?.data || []);
                }
            } catch (e) {
                setError(e);
            } finally {
                setLoadingInitial(false);
                setFetchingMore(false);
                setRefreshing(false);
            }
        },
        [
            fromDate, toDate, allGame, selectedDraw?.id, 
            selectedAgent, selectedDealer, user?.user_type
        ]
    );

    // Fetch data whenever pagination or filter changes
    useEffect(() => {
        fetchPaginated(offset, offset > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        offset, fromDate?.toISOString?.(), toDate?.toISOString?.(), 
        allGame, selectedDraw?.id, selectedAgent, selectedDealer
    ]);

    // Load more handler
    const handleLoadMore = () => {
        // Only fetch more if there's potentially more data
        if (fetchingMore || loadingInitial || data.length >= count) return;
        setOffset(prev => prev + PAGE_SIZE);
    };

    // Refresh handler (pull-to-refresh)
    const handleRefresh = () => {
        setRefreshing(true);
        setOffset(0);
        fetchPaginated(0, false);
    };

    // Filter by search (bill number)
    const filteredData = useMemo(() => {
        if (!search) return data;
        return data.filter(item =>
            item.bill_number?.toString().includes(search)
        );
    }, [data, search]);

    // Calculate totals (on ALL loaded so far)
    const totals = useMemo(() => {
        let totalPrize = 0;
        let totalCount = 0;
        let totalAmount = 0;
        filteredData.forEach(item => {
            const count = Number(item.count) || 0;
            const prize = Number(item.prize) || 0;
            totalPrize += prize;
            totalCount += count;
            totalAmount += prize;
        });
        return {
            totalPrize,
            totalCount,
            totalAmount,
            totalBills: filteredData.length,
        };
    }, [filteredData]);

    const shouldShowTotalFooter = !!selectedDraw?.id && !loadingInitial && !error && filteredData.length > 0;

    // Helper to safely get username from dealer/agent (string or object)
    const getUsername = (userField: any) => {
        if (!userField) return "";
        if (typeof userField === "string") return userField;
        if (typeof userField === "object" && userField.username) return userField.username;
        return "";
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">
                {/* Filters */}
                <View className="gap-3 mb-3">
                    {/* <TextInput
                        placeholder="Search by Bill No."
                        value={search}
                        keyboardType="numeric"
                        onChangeText={setSearch}
                        className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:border-violet-500"
                        placeholderTextColor="#9ca3af"
                    /> */}

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => setShowFromPicker(true)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                        >
                            <Text className="text-gray-700">
                                From:{" "}
                                <Text
                                    className={fromDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                >
                                    {formatDateToDDMMYYYY(fromDate) || "Select Date"}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowToPicker(true)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                        >
                            <Text className="text-gray-700">
                                To:{" "}
                                <Text
                                    className={toDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                >
                                    {formatDateToDDMMYYYY(toDate) || "Select Date"}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Show agent/dealer filter only for DEALER or ADMIN */}
                    {user?.user_type === "DEALER" && (
                        <Dropdown
                            data={agents.map((agent) => ({
                                label: agent.username,
                                value: agent.id,
                            }))}
                            labelField="label"
                            valueField="value"
                            value={selectedAgent}
                            onChange={item => setSelectedAgent(item.value)}
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
                    )}
                    {user?.user_type === "ADMIN" && (
                        <Dropdown
                            data={dealers.map((dealer) => ({
                                label: dealer.username,
                                value: dealer.id,
                            }))}
                            labelField="label"
                            valueField="value"
                            value={selectedDealer}
                            onChange={item => setSelectedDealer(item.value)}
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
                    )}

                    <View className="flex-row items-center justify-between px-1 pt-1">
                        <Text className="text-sm text-gray-700">All Game</Text>
                        <Switch
                            value={allGame}
                            onValueChange={setAllGame}
                            trackColor={{ false: "#e5e7eb", true: "#a78bfa" }}
                            thumbColor={allGame ? "#7c3aed" : "#f4f3f4"}
                            ios_backgroundColor="#e5e7eb"
                        />
                    </View>
                </View>

                {/* --- Main Content Area --- */}
                {!selectedDraw?.id ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">
                            No draw selected. Please choose one.
                        </Text>
                    </View>
                ) : loadingInitial ? (
                    <View className="flex-1 justify-center items-center">
                        <View className="bg-white rounded-xl px-6 py-8 shadow-md border border-gray-200 items-center">
                            <ActivityIndicator size="large" color="#7c3aed" />
                            <Text className="mt-4 text-lg font-semibold text-violet-700">Loading Winners Data...</Text>
                            <Text className="mt-1 text-gray-500 text-base">Please wait while we fetch the latest results.</Text>
                        </View>
                    </View>
                ) : error ? (
                    <View className="flex-1 justify-center items-center">
                        <View className="bg-red-50 border border-red-200 px-6 py-8 rounded-xl items-center shadow">
                            <Text className="text-2xl mb-2">😢</Text>
                            <Text className="text-red-700 font-bold text-lg mb-1">
                                Error loading report
                            </Text>
                            <Text className="text-red-600 text-base mb-3">
                                There was a problem fetching the winners data.
                            </Text>
                            <TouchableOpacity
                                onPress={() => fetchPaginated(offset, offset > 0)}
                                className="bg-violet-600 px-4 py-2 rounded-lg"
                            >
                                <Text className="text-white font-semibold">Retry</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                            <FlatList
                                data={filteredData || []}
                                keyExtractor={(item, index) => index?.toString()}
                                ListHeaderComponent={() => (
                                    <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-4 py-3">
                                        <Text className="flex-[1.1] text-xs font-semibold text-gray-600 uppercase">Date</Text>
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Number</Text>
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Dealer</Text>
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Prize</Text>
                                    </View>
                                )}
                                renderItem={({ item, index }) => (
                                    <View
                                        className={[
                                            "px-2 py-2 border-b border-gray-100",
                                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                        ].join(" ")}
                                    >
                                        <View className="flex-row items-center">
                                            {/* Date */}
                                            <View className="flex-[1.1]">
                                                <View>
                                                    {item.booking_datetime && (
                                                        <View className="flex">
                                                            <Text className="text-xs text-gray-700 font-semibold">
                                                                {formatDateToDDMMYYYY(item.booking_datetime)}
                                                            </Text>
                                                            <Text className="text-[10px] text-gray-500">
                                                                {new Date(item.booking_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                            {/* Number */}
                                            <View className="flex-1 items-center">
                                                <Text className="text-base text-center text-emerald-700 font-bold tracking-widest">
                                                    {item.win_number}
                                                </Text>
                                                <Text className="text-xs text-center text-gray-500">
                                                    {item.lsk}
                                                </Text>
                                                <Text className="text-[11px] text-center text-gray-400">
                                                    Count: <Text className="font-semibold">{item.count}</Text>
                                                </Text>
                                            </View>
                                            {/* Dealer */}
                                            <View className="flex-1 items-center">
                                                <View>
                                                    <Text className="text-xs text-center text-gray-700 font-semibold">
                                                        {getUsername(item.dealer)}
                                                    </Text>
                                                    {item?.customer_name && (
                                                        <Text
                                                            className="text-xs text-center text-emerald-700"
                                                            numberOfLines={1}
                                                            ellipsizeMode="tail"
                                                            style={{ minWidth: 0 }}
                                                        >
                                                            {item?.customer_name}
                                                        </Text>
                                                    )}
                                                </View>
                                                {item.agent && (
                                                    <Text className="text-[10px] text-center text-gray-400">
                                                        Agent: {getUsername(item.agent)}
                                                    </Text>
                                                )}
                                            </View>
                                            {/* Prize */}
                                            <View className="flex-1 items-end">
                                                <Text className="text-sm text-center w-full text-violet-700 font-bold">
                                                    ₹{Number(item.prize).toLocaleString()}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}
                                ListEmptyComponent={
                                    <View className="flex-1 justify-center items-center py-16">
                                        <Text className="text-gray-500 text-base">
                                            No Winner's data available.
                                        </Text>
                                    </View>
                                }
                                onEndReached={handleLoadMore}
                                onEndReachedThreshold={0.5}
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                ListFooterComponent={
                                    fetchingMore && filteredData.length < count ? (
                                        <View className="py-4 items-center">
                                            <ActivityIndicator size="small" color="#7c3aed" />
                                            <Text style={{ color: "#7c3aed", marginTop: 8 }}>Loading more...</Text>
                                        </View>
                                    ) : filteredData.length < count ? (
                                        <TouchableOpacity
                                            onPress={handleLoadMore}
                                            className="bg-violet-600 px-4 py-2 rounded-lg m-4 self-center"
                                            style={{ minWidth: 110, alignItems: "center" }}
                                        >
                                            <Text style={{ color: "white", fontWeight: "bold" }}>Load more</Text>
                                        </TouchableOpacity>
                                    ) : null
                                }
                            />
                        </View>

                        {shouldShowTotalFooter && (
                            <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                                <View className="flex-row">
                                    <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                                    {/* <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                        {totals.totalBills}
                                    </Text>
                                    <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                        {totals.totalCount}
                                    </Text> */}
                                    {/* <Text className="flex-1 text-sm text-center font-semibold text-gray-700"> */}
                                        {/* (Unused column, could be left blank or used for something else) */}
                                    {/* </Text> */}
                                    {/* <Text className="flex-1 text-sm text-right font-semibold text-violet-700"> */}
                                        {/* Total Prize */}
                                        {/* ₹{totals.totalPrize.toLocaleString()} */}
                                    {/* </Text> */}
                                    <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                        {/* Total Amount */}
                                        ₹{totalAmount} 
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}

                {showFromPicker && (
                    <DateTimePicker
                        mode="date"
                        value={fromDate || new Date()}
                        onChange={(event, date) => {
                            if (date) setFromDate(date);
                            setShowFromPicker(false);
                        }}
                    />
                )}
                {showToPicker && (
                    <DateTimePicker
                        mode="date"
                        value={toDate || new Date()}
                        onChange={(event, date) => {
                            if (date) setToDate(date);
                            setShowToPicker(false);
                        }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default WinnersReportScreen;