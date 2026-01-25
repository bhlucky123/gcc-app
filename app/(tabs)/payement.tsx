import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";

type DataResponse = {
    results: AgentOrDealer[];
    count: number;
    next: string | null;
    previous: string | null;
};

type AgentOrDealer = {
    id: number;
    name: string;
    balance_amount: number;
    to_dealer?: boolean;
};

// Helper to format date for display (dd-mm-yyyy)
function formatDateDisplay(yyyy_mm_dd: string | undefined): string {
    if (!yyyy_mm_dd) return "";
    let [yyyy, mm, dd] = ["", "", ""];
    if (/^\d{4}-\d{2}-\d{2}$/.test(yyyy_mm_dd)) {
        [yyyy, mm, dd] = yyyy_mm_dd.split("-");
    } else {
        const d = new Date(yyyy_mm_dd);
        if (!isNaN(d.getTime())) {
            yyyy = String(d.getFullYear());
            mm = String(d.getMonth() + 1).padStart(2, "0");
            dd = String(d.getDate()).padStart(2, "0");
        }
    }
    if (yyyy && mm && dd) {
        return `${dd}-${mm}-${yyyy}`;
    }
    return yyyy_mm_dd;
}

// Helper to format date for server (yyyy-mm-dd)
function formatDateServer(date: Date | string): string {
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

export default function PaymentTab() {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalItem, setModalItem] = useState<AgentOrDealer | null>(null);
    const [modalAmount, setModalAmount] = useState<string>("");
    const todayDateString = formatDateServer(new Date());
    const [modalDate, setModalDate] = useState<string>(todayDateString);
    const [showModalDatePicker, setShowModalDatePicker] = useState(false);

    const limit = 10;
    // Infinity scroll state
    // NOTE: This will now track offset instead of page!
    const [offset, setOffset] = useState(0);
    const [allData, setAllData] = useState<AgentOrDealer[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [next, setNext] = useState<string | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Now, implement search
    // 'search' is the actual search term being used for fetching.
    // 'searchInput' is the input box tracked value so user can edit freely, and triggers 'search' via debounce.
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState(""); // instant input, debounced into 'search'
    const [refreshing, setRefreshing] = useState(false);

    // Data and query loading
    const [queryLoading, setQueryLoading] = useState(true);

    // Debounce search input (300ms)
    const searchDebounceTimeout = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        if (searchDebounceTimeout.current) {
            clearTimeout(searchDebounceTimeout.current);
        }
        // @ts-expect-error type-off
        searchDebounceTimeout.current = setTimeout(() => {
            setSearch(searchInput.trim());
        }, 300);
        return () => {
            if (searchDebounceTimeout.current) {
                clearTimeout(searchDebounceTimeout.current);
            }
        };
    }, [searchInput]);

    // Fetch function for a "page" (returns Promise<DataResponse>)
    // Now: pageToFetch is an offset (should be 0 for first, 10 for second, etc)
    const fetchPage = async (offsetToFetch: number) => {
        let endpoint = "";
        if (user?.user_type === "ADMIN") endpoint = "/draw-payment/dealers-with-pending-balance/";
        else if (user?.user_type === "DEALER") endpoint = "/draw-payment/agents-with-pending-balance/";
       
        function buildQuery(params: Record<string, any>): string {
            const esc = encodeURIComponent;
            const query = Object.entries(params)
                .filter(([, v]) => v !== undefined && v !== null && v !== "")
                .map(([k, v]) => `${esc(k)}=${esc(v)}`)
                .join("&");
            return query ? `?${query}` : "";
        }
        const params = {
            search: search || undefined,
            limit,
            offset: offsetToFetch,
        };

        //console.log("API CALLED:", `${endpoint}${buildQuery(params)}`);
        const res = await api.get(`${endpoint}${buildQuery(params)}`);
        return res.data as DataResponse;
    };

    // Initial fetch and search: loads first page and resets
    useEffect(() => {
        let ignore = false;
        if(!search){
            setQueryLoading(true);
            setAllData([]);
            setTotalCount(0);
            setNext(null);
            setOffset(0);
        }
        (async () => {
            if (!user?.user_type) return setQueryLoading(false);
            try {
                const data = await fetchPage(0); // offset=0 for first fetch
                if (ignore) return;
                setAllData(data.results);
                setTotalCount(data.count);
                setNext(data.next);
            } finally {
                if (!ignore) setQueryLoading(false);
            }
        })();
        return () => { ignore = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.user_type, search]);
    

    // Load more handler (loads next "page" --> add limit to offset)
    const handleLoadMore = useCallback(async () => {
        if (isLoadingMore || !next) return;
        setIsLoadingMore(true);
        try {
            const nextOffset = offset + limit;
            const data = await fetchPage(nextOffset);
            //console.log("data", data)
            // Deduplicate data by 'id' to ensure unique items
            setAllData(prev => {
                const all = [...prev, ...(data?.results || [])];
                const idSet = new Set<number>();
                const deduped: AgentOrDealer[] = [];
                for (const item of all) {
                    if (!idSet.has(item.id)) {
                        idSet.add(item.id);
                        deduped.push(item);
                    }
                }
                return deduped;
            });
            setOffset(nextOffset);
            setTotalCount(data.count);
            setNext(data.next);
        } catch (e) {
            // optionally handle error
        }
        setIsLoadingMore(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoadingMore, next, offset, user?.user_type, search]);

    // On pull-to-refresh, reload page 1 (offset 0) and reset
    const onRefresh = async () => {
        setRefreshing(true);
        try {
            if (!user?.user_type) return;
            const data = await fetchPage(0);
            setAllData(data.results);
            setOffset(0);
            setTotalCount(data.count);
            setNext(data.next);
        } catch (err) {
            // Optionally handle error
        }
        setRefreshing(false);
    };

    // Mutations and modal handlers (unchanged)
    const dealerToAdminPaymentMutation = useMutation({
        mutationFn: async ({
            dealerId,
            amount,
            date_received,
            to_dealer
        }: {
            dealerId: number;
            amount: number;
            date_received: string;
            to_dealer?: boolean;
        }) => {
            const payload = { amount, date_received, to_dealer };
            return api.post(`/draw-payment/dealer-to-administrator/${dealerId}/`, payload);
        },
        onSuccess: () => {
            // After update, refetch first page!
            onRefresh();
            setModalVisible(false);
            ToastAndroid.show("Dealer balance updated successfully", ToastAndroid.SHORT);
        },
        onError: (error: any) => {
            let msg = "Failed to update dealer balance";
            if (error?.response?.data?.date_received) {
                msg = error.response.data.date_received.join("\n");
            } else if (error?.response?.data?.dealer) {
                msg = error.response.data.dealer.join("\n");
            } else if (error?.message?.error) {
                msg = error?.message?.error;
            }
            Alert.alert("Error", msg);
        }
    });

    const agentToDealerPaymentMutation = useMutation({
        mutationFn: async ({
            agentId,
            amount,
            date_received,
        }: {
            agentId: number;
            amount: number;
            date_received: string;
        }) => {
            return api.post(`/draw-payment/agent-to-dealer/${agentId}/`, {
                amount,
                date_received,
            });
        },
        onSuccess: () => {
            // After update, refetch first page!
            onRefresh();
            setModalVisible(false);
            ToastAndroid.show("Agent balance updated successfully", ToastAndroid.SHORT);
        },
        onError: (error: any) => {
            let msg = "Failed to update agent balance";
            if (error?.response?.data?.date_received) {
                msg = error.response.data.date_received.join("\n");
            } else if (error?.response?.data?.agent) {
                msg = error.response.data.agent.join("\n");
            } else if (error?.message?.error) {
                msg = error?.message?.error;
            }
            Alert.alert("Error", msg);
        }
    });

    const openUpdateModal = useCallback((item: AgentOrDealer) => {
        setModalItem(item);
        setModalAmount("");
        setModalDate(todayDateString);
        setModalVisible(true);
    }, [todayDateString]);

    const handleModalDateChange = (_event: any, selectedDate?: Date) => {
        setShowModalDatePicker(Platform.OS === "ios");
        if (selectedDate) {
            setModalDate(formatDateServer(selectedDate));
        }
    };

    const handleModalSubmit = () => {
        if (!modalItem) return;
        const amount = Number(modalAmount);
        const date_received = modalDate || formatDateServer(new Date());

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date_received)) {
            Alert.alert("Invalid Date", "Please select a valid date in YYYY-MM-DD format.");
            return;
        }
        // if (!amount || amount <= 0) {
        //     Alert.alert("Invalid Amount", "Please enter a valid amount.");
        //     return;
        // }
        if (user?.user_type === "ADMIN") {
            dealerToAdminPaymentMutation.mutate({ dealerId: modalItem.id, amount, date_received, to_dealer: modalItem?.to_dealer });
        } else if (user?.user_type === "DEALER") {
            agentToDealerPaymentMutation.mutate({ agentId: modalItem.id, amount, date_received });
        }
    };

    // Render list of agents or dealers
    const renderItem = ({ item }: { item: AgentOrDealer }) => (
        <View
            key={item.id}
            style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                padding: 16,
                marginVertical: 8,
                marginHorizontal: 16,
                flexDirection: "column",
                elevation: 1,
            }}
        >
            <Text style={{ fontWeight: "bold", fontSize: 16, color: "#1e293b" }}>
                {item.name}
            </Text>
            <Text style={{ color: "#334155", marginTop: 4 }}>
                Balance: <Text style={{ fontWeight: "bold" }}>₹ {item.balance_amount.toLocaleString()}</Text>
            </Text>
           <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                    <TouchableOpacity
                        onPress={() => {
                            openUpdateModal(item)
                        }}
                        style={{
                            backgroundColor: "#2563eb",
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            flex: 1,
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>
                            Update Balance
                        </Text>
                    </TouchableOpacity>
                </View>

            {/* {
                item?.balance_amount < 0 && user?.user_type === "ADMIN" && (<View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                    <TouchableOpacity
                        onPress={() => {
                            openUpdateModal({ ...item, to_dealer: true })
                        }}
                        style={{
                            backgroundColor: "red",
                            paddingVertical: 8,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            flex: 1,
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>
                            Pay Balance
                        </Text>
                    </TouchableOpacity>
                </View>)
            } */}
        </View>
    );

    // Loading state: only on initial load.
    if (queryLoading) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#2563eb" />
                <Text className="mt-2 text-base text-white">Loading balances…</Text>
            </View>
        );
    }

    // No data state
    return (
        <View className="flex-1 pt-8 pb-20">
            {/* Search input */}
            <View
                style={{
                    marginHorizontal: 16,
                    marginBottom: 10,
                    borderRadius: 8,
                    backgroundColor: "#f3f4f6",
                    flexDirection: "row",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#cbd5e1",
                    paddingHorizontal: 12,
                }}
            >
                <TextInput
                    placeholder={`Search...`}
                    value={searchInput}
                    onChangeText={setSearchInput}
                    style={{
                        flex: 1,
                        height: 40,
                        color: "#1e293b",
                        fontSize: 16,
                    }}
                    placeholderTextColor="#94a3b8"
                    returnKeyType="search"
                    autoCorrect={false}
                />
                {(!!searchInput) && (
                    <TouchableOpacity onPress={() => setSearchInput("")} style={{paddingHorizontal: 8, height: 40, justifyContent: "center"}}>
                        <Text style={{fontSize: 20, color: "#64748b"}}>×</Text>
                    </TouchableOpacity>
                )}
            </View>

            {allData.length === 0 ? (
                <Text className="text-center text-gray-300 mt-10">
                    No {user?.user_type === "ADMIN" ? "dealers" : "agents"} with pending balance.
                </Text>
            ) : (
                <>
                    <FlatList
                        data={allData}
                        keyExtractor={(item) => String(item.id)}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 32 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={["#2563eb"]}
                                tintColor="#2563eb"
                            />
                        }
                        ListFooterComponent={
                            (allData.length < totalCount && !!next) ? (
                                <View style={{ alignItems: "center", marginVertical: 12 }}>
                                    <TouchableOpacity
                                        style={{
                                            backgroundColor: "#2563eb",
                                            borderRadius: 8,
                                            paddingHorizontal: 24,
                                            paddingVertical: 12,
                                            minWidth: 120,
                                            alignItems: "center",
                                            opacity: isLoadingMore ? 0.7 : 1,
                                        }}
                                        onPress={handleLoadMore}
                                        disabled={isLoadingMore}
                                    >
                                        {isLoadingMore ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                                                Load More
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : null
                        }
                    />
                </>
            )}

            {/* Modal for updating balance */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setModalVisible(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.3)",
                        justifyContent: "center",
                        alignItems: "center",
                    }}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : undefined}
                        style={{
                            width: "90%",
                            maxWidth: 400,
                            backgroundColor: "#fff",
                            borderRadius: 16,
                            padding: 24,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 8,
                            elevation: 5,
                        }}
                    >
                        <ScrollView
                            contentContainerStyle={{ flexGrow: 1 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={{ fontWeight: "bold", fontSize: 18, color: "#1e293b", marginBottom: 8, textAlign: "center" }}>
                                {user?.user_type === "ADMIN" ? "Update Dealer Balance" : "Update Agent Balance"}
                            </Text>
                            <Text style={{ color: "#334155", marginBottom: 12, textAlign: "center" }}>
                                {modalItem?.name}
                            </Text>
                            <Text style={{ color: "#64748b", marginBottom: 4 }}>
                                Current Balance: <Text style={{ fontWeight: "bold" }}>₹ {modalItem?.balance_amount?.toLocaleString()}</Text>
                            </Text>
                            <TextInput
                                placeholder="Amount"
                                keyboardType="numeric"
                                value={modalAmount}
                                onChangeText={setModalAmount}
                                style={{
                                    backgroundColor: "#f3f4f6",
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: "#cbd5e1",
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    marginTop: 12,
                                    marginBottom: 12,
                                    fontSize: 16,
                                }}
                                placeholderTextColor="#9ca3af"

                            />
                            <TouchableOpacity
                                onPress={() => setShowModalDatePicker(true)}
                                style={{
                                    backgroundColor: "#f3f4f6",
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: "#cbd5e1",
                                    paddingHorizontal: 10,
                                    paddingVertical: 10,
                                    marginBottom: 12,
                                    justifyContent: "center",
                                }}
                                activeOpacity={0.85}
                            >
                                <Text style={{ color: modalDate ? "#0f172a" : "#64748b", fontSize: 16 }}>
                                    {modalDate
                                        ? formatDateDisplay(modalDate)
                                        : "Select Date"}
                                </Text>
                            </TouchableOpacity>
                            {showModalDatePicker && (
                                <DateTimePicker
                                    value={
                                        modalDate
                                            ? new Date(modalDate)
                                            : new Date()
                                    }
                                    mode="date"
                                    display={Platform.OS === "ios" ? "spinner" : "default"}
                                    onChange={handleModalDateChange}
                                    maximumDate={new Date()}
                                />
                            )}
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
                                <Pressable
                                    onPress={() => setModalVisible(false)}
                                    style={{
                                        backgroundColor: "#e5e7eb",
                                        paddingVertical: 10,
                                        paddingHorizontal: 24,
                                        borderRadius: 8,
                                    }}
                                >
                                    <Text style={{ color: "#334155", fontWeight: "bold" }}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleModalSubmit}
                                    style={{
                                        backgroundColor: "#2563eb",
                                        paddingVertical: 10,
                                        paddingHorizontal: 24,
                                        borderRadius: 8,
                                    }}
                                    disabled={
                                        (user?.user_type === "ADMIN" && dealerToAdminPaymentMutation.isPending) ||
                                        (user?.user_type === "DEALER" && agentToDealerPaymentMutation.isPending)
                                    }
                                >
                                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                                        {((user?.user_type === "ADMIN" && dealerToAdminPaymentMutation.isPending) ||
                                            (user?.user_type === "DEALER" && agentToDealerPaymentMutation.isPending))
                                            ? "Updating..."
                                            : "Update"}
                                    </Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}