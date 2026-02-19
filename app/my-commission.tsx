import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { getToday, getTommorow } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Switch,
    Text,
    TouchableOpacity,
    View
} from "react-native";

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatIndianNumber(num: number | string): string {
    const n = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(n)) return String(num);
    if (n >= 1e7) return (n / 1e7).toFixed(2).replace(/\.00$/, "") + " cr";
    if (n >= 1e5) return (n / 1e5).toFixed(2).replace(/\.00$/, "") + " lac";
    if (n >= 1e3) return (n / 1e3).toFixed(2).replace(/\.00$/, "") + "k";
    return n.toFixed(2).replace(/\.00$/, "");
}

function formatDateDDMMYYYY(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

const COMMISSION_PATH = "/draw-booking/commission/";

/**
 * Parse the API "next" URL into path + params so we always use our axios baseURL
 * and send the same auth headers (avoids 401 on fetchNextPage when next is a full/different origin URL).
 */
function getPathAndQuery(nextUrl: string): { path: string; params: Record<string, string> } {
    try {
        const url = new URL(nextUrl, "https://dummy.com");
        const params: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
            params[key] = value;
        });
        const path =
            url.pathname && url.pathname !== "/" ? url.pathname : COMMISSION_PATH;
        return { path, params };
    } catch {
        return { path: COMMISSION_PATH, params: {} };
    }
}

// ---------------------------------------------------------------------------
// Types (paginated API)
// ---------------------------------------------------------------------------

type BookedBy = {
    id: number;
    username: string;
};

export type CommissionEntry = {
    bill_number: number;
    draw: string;
    date_time: string;
    booked_by: BookedBy;
    total_amount: number;
    total_count: number;
    dealer_amount: number;
    agent_amount: number;
};

export type CommissionTotals = {
    total_booking_count: number;
    total_dealer_amount: number;
    total_agent_amount: number;
    total_customer_amount: number;
};

type CommissionPageResponse = {
    count: number;
    next: string | null;
    previous: string | null;
    results: CommissionEntry[];
} & CommissionTotals;

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

const TableRow = ({
    data,
    className = "",
    textClassName = "",
}: {
    data: (string | number)[];
    className?: string;
    textClassName?: string;
}) => (
    <View className={`flex-row border-b border-gray-200 ${className}`}>
        {data.map((item, idx) => (
            <Text
                key={idx}
                className={`flex-1 px-2 py-2 text-center text-xs ${textClassName}`}
                numberOfLines={1}
                ellipsizeMode="tail"
            >
                {typeof item === "number"
                    ? formatIndianNumber(item)
                    : typeof item === "string" &&
                        !isNaN(Number(item)) &&
                        item.trim() !== ""
                      ? formatIndianNumber(Number(item))
                      : item}
            </Text>
        ))}
    </View>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MyCommissionScreen() {
    const [fromDate, setFromDate] = useState<Date>(getToday());
    const [toDate, setToDate] = useState<Date>(getTommorow());
    const [allGames, setAllGames] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState<"from" | "to" | null>(null);

    const { user } = useAuthStore();
    const { selectedDraw } = useDrawStore();

    const buildQuery = useCallback(() => {
        const params: Record<string, string | number> = {};
        if (fromDate) params.date_time__gte = fromDate.toISOString();
        if (toDate) params.date_time__lte = toDate.toISOString();
        if (selectedDraw?.id && !allGames) params.draw_session__draw = selectedDraw.id;
        return params;
    }, [fromDate, toDate, allGames, selectedDraw?.id]);

    const {
        data,
        isLoading,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch,
        isRefetching,
    } = useInfiniteQuery({
        queryKey: ["/draw-booking/commission/", buildQuery()],
        queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
            if (pageParam) {
                const pathAndQuery = getPathAndQuery(pageParam);
                const res = await api.get<CommissionPageResponse>(pathAndQuery.path, {
                    params: pathAndQuery.params,
                });
                return res.data;
            }
            const res = await api.get<CommissionPageResponse>("/draw-booking/commission/", {
                params: { ...buildQuery(), limit: PAGE_SIZE },
            });
            return res.data;
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next ?? undefined,
    });

    const commissionList = useMemo(
        () => data?.pages.flatMap((p) => p.results) ?? [],
        [data?.pages]
    );

    const totals: CommissionTotals = useMemo(() => {
        const first = data?.pages?.[0];
        return {
            total_booking_count: first?.total_booking_count ?? 0,
            total_dealer_amount: first?.total_dealer_amount ?? 0,
            total_agent_amount: first?.total_agent_amount ?? 0,
            total_customer_amount: first?.total_customer_amount ?? 0,
        };
    }, [data?.pages]);

    const totalCountFromApi = data?.pages[0]?.count ?? null;

    const onDateChange = useCallback(
        (event: { type: string }, selectedDate?: Date) => {
            if (event.type === "dismissed") {
                setShowDatePicker(null);
                return;
            }
            const current = selectedDate ?? (showDatePicker === "from" ? fromDate : toDate);
            setShowDatePicker(null);
            if (showDatePicker === "from") setFromDate(current);
            else if (showDatePicker === "to") setToDate(current);
        },
        [showDatePicker, fromDate, toDate]
    );

    const loadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const renderRow = useCallback(
        ({ item, index }: { item: CommissionEntry; index: number }) => (
            <TableRow
                data={[
                    ...(user?.user_type === "DEALER" ? [item.booked_by.username] : []),
                    item.draw,
                    formatDateDDMMYYYY(item.date_time),
                    item.total_count,
                    user?.user_type === "DEALER" ? item.dealer_amount : item.agent_amount,
                ]}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                textClassName="text-gray-900"
            />
        ),
        [user?.user_type]
    );

    const keyExtractor = useCallback(
        (item: CommissionEntry, index: number) =>
            `${item.bill_number}-${item.date_time}-${item.draw}-${index}`,
        []
    );

    const stickyListHeader = useMemo(
        () => (
            <View className="mb-0 px-2">
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Detailed
                </Text>
                <View className="bg-white rounded-t-xl border border-b-0 border-gray-200 overflow-hidden">
                    <TableRow
                        data={[
                            ...(user?.user_type === "DEALER" ? ["Booked By"] : []),
                            "GAME",
                            "DATE",
                            "TOTAL CNT",
                            "SALE C",
                        ]}
                        className="bg-gray-100"
                        textClassName="font-bold text-gray-800 text-xs"
                    />
                </View>
            </View>
        ),
        [user?.user_type]
    );

    const listFooterLoading = useMemo(
        () =>
            isFetchingNextPage ? (
                <View className="py-4 items-center bg-white border-x border-gray-200">
                    <ActivityIndicator size="small" color="#222" />
                    <Text className="text-xs text-gray-500 mt-2">Loading more...</Text>
                </View>
            ) : null,
        [isFetchingNextPage]
    );

    const stickyListFooter = useMemo(
        () => (
            <View className="px-2 pt-0 pb-12 -mt-px">
                <View className="bg-white rounded-b-xl border-x border-b border-gray-200 overflow-hidden">
                    <TableRow
                        data={[
                            ...(user?.user_type === "DEALER" ? ["TOT CNT", "DEALER"] : ["TOT CNT", "AGENT"]),
                        ]}
                        className="bg-gray-100"
                        textClassName="font-bold text-gray-800 text-xs"
                    />
                    <TableRow
                        data={[
                            amountHandler(totals.total_booking_count),
                            user?.user_type === "DEALER"
                                ? amountHandler(totals.total_dealer_amount)
                                : amountHandler(totals.total_agent_amount),
                        ]}
                        className="bg-white"
                        textClassName="text-gray-900 font-medium"
                    />
                </View>
                {totalCountFromApi != null && (
                    <Text className="text-center text-xs text-gray-500 mt-2">
                        Showing {commissionList.length} of {totalCountFromApi} records
                    </Text>
                )}
            </View>
        ),
        [
            user?.user_type,
            totals.total_booking_count,
            totals.total_dealer_amount,
            totals.total_agent_amount,
            commissionList.length,
            totalCountFromApi,
        ]
    );

    if (isLoading && commissionList.length === 0) {
        return (
            <View className="flex-1 bg-gray-50 px-2 py-2">
                <FiltersSection
                    fromDate={fromDate}
                    toDate={toDate}
                    allGames={allGames}
                    setShowDatePicker={setShowDatePicker}
                    onDateChange={onDateChange}
                    setAllGames={setAllGames}
                    showDatePicker={showDatePicker}
                />
                <View className="mt-16 flex items-center">
                    <ActivityIndicator size="large" color="#222" />
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View className="flex-1 bg-gray-50 px-2 py-2">
                <FiltersSection
                    fromDate={fromDate}
                    toDate={toDate}
                    allGames={allGames}
                    setShowDatePicker={setShowDatePicker}
                    onDateChange={onDateChange}
                    setAllGames={setAllGames}
                    showDatePicker={showDatePicker}
                />
                <Text className="text-center mt-16 text-base text-red-600">
                    Failed to load data. {(error as { message?: string }).message}
                </Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-50">
            <View className="px-2 pt-2 pb-1">
                <FiltersSection
                    fromDate={fromDate}
                    toDate={toDate}
                    allGames={allGames}
                    setShowDatePicker={setShowDatePicker}
                    onDateChange={onDateChange}
                    setAllGames={setAllGames}
                    showDatePicker={showDatePicker}
                />
            </View>

            {commissionList.length === 0 && !isFetchingNextPage ? (
                <View className="flex-1 justify-center px-4">
                    <Text className="text-center text-base text-gray-400">
                        No commission data found for the selected filters.
                    </Text>
                </View>
            ) : (
                <View className="flex-1">
                    {stickyListHeader}
                    <View className="flex-1 px-2">
                        <View className="flex-1 border-x border-gray-200">
                            <FlatList
                            data={commissionList}
                            keyExtractor={keyExtractor}
                            renderItem={renderRow}
                            ListFooterComponent={listFooterLoading}
                            onEndReached={loadMore}
                            onEndReachedThreshold={0.4}
                            refreshControl={
                                <RefreshControl
                                    refreshing={isRefetching && !isFetchingNextPage}
                                    onRefresh={() => refetch()}
                                    colors={["#222"]}
                                    tintColor="#222"
                                />
                            }
                            contentContainerStyle={{ paddingBottom: 24 }}
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator
                            />
                        </View>
                    </View>
                    {commissionList.length > 0 && stickyListFooter}
                </View>
            )}
        </View>
    );
}

// ---------------------------------------------------------------------------
// Filters (extracted for readability)
// ---------------------------------------------------------------------------

function FiltersSection({
    fromDate,
    toDate,
    allGames,
    setShowDatePicker,
    onDateChange,
    setAllGames,
    showDatePicker,
}: {
    fromDate: Date;
    toDate: Date;
    allGames: boolean;
    setShowDatePicker: (v: "from" | "to" | null) => void;
    onDateChange: (event: { type: string }, selectedDate?: Date) => void;
    setAllGames: (v: boolean | ((p: boolean) => boolean)) => void;
    showDatePicker: "from" | "to" | null;
}) {
    return (
        <View className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <View className="flex-row justify-between gap-3 mb-4">
                <TouchableOpacity
                    onPress={() => setShowDatePicker("from")}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-3 bg-gray-50"
                    activeOpacity={0.7}
                >
                    <Text className="text-gray-500 text-xs font-medium mb-0.5">From</Text>
                    <Text className="text-gray-900 font-semibold text-center">
                        {formatDateDDMMYYYY(fromDate)}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setShowDatePicker("to")}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-3 bg-gray-50"
                    activeOpacity={0.7}
                >
                    <Text className="text-gray-500 text-xs font-medium mb-0.5">To</Text>
                    <Text className="text-gray-900 font-semibold text-center">
                        {formatDateDDMMYYYY(toDate)}
                    </Text>
                </TouchableOpacity>
            </View>
            {showDatePicker != null && (
                <DateTimePicker
                    testID="dateTimePicker"
                    value={showDatePicker === "from" ? fromDate : toDate}
                    mode="date"
                    is24Hour
                    display="default"
                    onChange={onDateChange}
                />
            )}
            <View className="flex-row items-center justify-between pt-1 border-t border-gray-100">
                <Text className="text-sm text-gray-700 font-medium">All Games</Text>
                <Switch
                    trackColor={{ false: "#e5e7eb", true: "#16a34a" }}
                    thumbColor={allGames ? "#fff" : "#f4f3f4"}
                    onValueChange={() => setAllGames((p) => !p)}
                    value={allGames}
                />
            </View>
        </View>
    );
}
