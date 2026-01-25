import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { getToday, getTommorow } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View
} from "react-native";

// Helper to format numbers as 1.5 lac, 3.4 cr, etc.
function formatIndianNumber(num: number | string): string {
    let n = typeof num === "string" ? parseFloat(num) : num;
    if (isNaN(n)) return String(num);

    if (n >= 1e7) {
        // Crore
        return (n / 1e7).toFixed(2).replace(/\.00$/, "") + " cr";
    } else if (n >= 1e5) {
        // Lakh
        return (n / 1e5).toFixed(2).replace(/\.00$/, "") + " lac";
    } else if (n >= 1e3) {
        // Thousand
        return (n / 1e3).toFixed(2).replace(/\.00$/, "") + "k";
    }
    return n.toFixed(2).replace(/\.00$/, "");
}

// Helper to format date as dd/mm/yyyy
function formatDateDDMMYYYY(date: Date | string): string {
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

type BookedBy = {
    id: number;
    username: string;
    user_type: "DEALER" | "AGENT" | "ADMIN";
    commission: number;
    single_digit_number_commission: number;
    cap_amount: number;
};

export type CommissionEntry = {
    bill_number: number;
    draw: string;
    date_time: string;
    booked_by: BookedBy;
    total_amount: number;
    total_count: number;
    dealer_commission: number;
    agent_commission: number;
};

// Table row using nativewind classes
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
                    : // Try to parse and format if string is a number
                    (typeof item === "string" && !isNaN(Number(item)) && item.trim() !== ""
                        ? formatIndianNumber(Number(item))
                        : item)}
            </Text>
        ))}
    </View>
);

export default function MyCommissionScreen() {
    // --- STATE MANAGEMENT ---
    const [fromDate, setFromDate] = useState<Date>(getToday());
    const [toDate, setToDate] = useState<Date>(getTommorow());
    const [allGames, setAllGames] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState<"from" | "to" | null>(null);
    const { user } = useAuthStore()

    const { selectedDraw } = useDrawStore();

    // --- DATA FETCHING ---
    const buildQuery = useCallback(() => {
        const params: Record<string, any> = {};
        if (fromDate) params.date_time__gte = fromDate.toISOString();
        if (toDate) params.date_time__lte = toDate.toISOString();
        if (selectedDraw?.id && !allGames) params.draw_session__draw = selectedDraw.id;
        return params;
        // eslint-disable-next-line
    }, [fromDate, toDate, allGames, selectedDraw?.id]);

    const { data, isLoading, error } = useQuery<CommissionEntry[], { status: number; message: string }>({
        queryKey: ["/draw-booking/commission/", buildQuery()],
        queryFn: async () => {
            const params = buildQuery();
            const search = Object.keys(params).length
                ? "?" + new URLSearchParams(params as any).toString()
                : "";
            try {
                const res = await api.get<CommissionEntry[]>(`/draw-booking/commission/${search}`);
                return res.data;
            } catch (err: any) {
                // Try to extract status and message from error
                const status = err?.status ?? 500;
                const message =
                    err?.response?.data?.message ||
                    err?.response?.data?.detail ||
                    err?.message ||
                    "Failed to fetch commission data.";
                throw { status, message: status === 500 ? "Failed to fetch commission data." : message };
            }
        },
    });

    console.log("data ", data, error?.status, error?.message);


    // --- DATA PROCESSING ---
    const summaryData = useMemo(() => {
        if (!data) return null;
        const totalCount = data.reduce((sum, entry) => sum + entry.total_count, 0);
        const totalAmount = data.reduce((sum, entry) => sum + entry.total_amount, 0);
        const saleCommission = data.reduce((sum, entry) => sum + (user?.user_type === "DEALER" ? entry.dealer_commission : entry.agent_commission), 0);

        return {
            subDealer: data.length > 0 ? data[0].booked_by.username : "N/A",
            game: "ALL",
            totalCount,
            saleCommission,
            total: totalAmount,
        };
    }, [data]);

    // --- UI RENDERING ---

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (event.type === "dismissed") {
            setShowDatePicker(null);
            return;
        }
        const currentDate = selectedDate || (showDatePicker === "from" ? fromDate : toDate);
        setShowDatePicker(null);

        if (showDatePicker === "from") {
            setFromDate(currentDate);
        } else if (showDatePicker === "to") {
            setToDate(currentDate);
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <View className="mt-16 flex items-center">
                    <ActivityIndicator size="large" color="#222" />
                </View>
            );
        }

        if (error) {
            return (
                <Text className="text-center mt-16 text-base text-red-600">
                    Failed to load data. Please try again. Error: {(error as Error).message}
                </Text>
            );
        }

        if (!data || data.length === 0) {
            return (
                <Text className="text-center mt-16 text-base text-gray-400">
                    No commission data found for the selected filters.
                </Text>
            );
        }

        return (
            <>
                {/* --- SUMMARY TABLE --- */}
                <View className="mb-6">
                    <Text className="text-lg font-bold mb-1 border-gray-200 pb-1 text-gray-800 tracking-wide">
                        SUMMARY
                    </Text>
                    <View className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                        <TableRow
                            data={[
                                ...(user?.user_type === "DEALER" ? ["Booked by"] : []),
                                "GAME",
                                "TOT CNT",
                                "SALE C",
                                // "TOTAL"
                            ]}
                            className="bg-gray-100"
                            textClassName="font-bold text-gray-800"
                        />
                        {summaryData && (
                            <TableRow
                                data={[
                                    ...(user?.user_type === "DEALER" ? [summaryData.subDealer] : []),
                                    summaryData.game,
                                    summaryData.totalCount,
                                    summaryData.saleCommission,
                                    // summaryData.total,
                                ]}
                                className="bg-white"
                                textClassName="text-gray-900"
                            />
                        )}
                        <TableRow
                            data={[
                                ...(user?.user_type === "DEALER" ? ["Total", ""] : ["Total"]),
                                amountHandler(Number(summaryData?.totalCount || 0)),
                                amountHandler(Number(summaryData?.saleCommission || 0)),
                                // amountHandler(Number(summaryData?.total || 0)),
                            ]}
                            className="bg-gray-200"
                            textClassName="font-bold text-gray-900"
                        />
                    </View>
                </View>

                {/* --- DETAILED TABLE --- */}
                <View className="mb-6">
                    <Text className="text-lg font-bold mb-1 border-gray-200 pb-1 text-gray-800 tracking-wide">
                        DETAILED
                    </Text>
                    <View className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                        <TableRow
                            data={[
                                ...(user?.user_type === "DEALER" ? ["Booked By"] : []),
                                "GAME",
                                "DATE",
                                "TOT CNT",
                                "SALE C",
                                // "TOTAL",
                            ]}
                            className="bg-gray-100"
                            textClassName="font-bold text-gray-800"
                        />
                        {data.map((entry, index) => (
                            <TableRow
                                key={index}
                                data={[
                                    ...(user?.user_type === "DEALER" ? [entry.booked_by.username] : []),
                                    entry.draw,
                                    formatDateDDMMYYYY(entry.date_time),
                                    entry.total_count,
                                    entry?.[user?.user_type === "DEALER" ? "dealer_commission" : "agent_commission"],
                                    // entry.total_amount || 0,
                                ]}
                                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                textClassName="text-gray-900"
                            />
                        ))}
                        {summaryData && (
                            <TableRow
                                data={[
                                    "Total",
                                    "",
                                    // ...(user?.user_type === "AGENT" ? [""] : []),
                                    summaryData.totalCount,
                                    amountHandler(Number(summaryData.saleCommission)),
                                ]}
                                className="bg-gray-200"
                                textClassName="font-bold text-gray-900"
                            />
                        )}
                    </View>
                </View>
            </>
        );
    };

    return (
        <ScrollView className="flex-1 bg-gray-50 px-2 py-2 mb-12">
            {/* --- FILTERS --- */}
            <View className="bg-white p-4 rounded-xl mb-6 shadow-md">
                <View className="flex-row justify-between mb-4">
                    <TouchableOpacity
                        onPress={() => setShowDatePicker("from")}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 mr-2 bg-gray-50"
                        activeOpacity={0.7}
                    >
                        <Text className="text-gray-700 font-medium text-center">
                            From:{" "}
                            <Text className="text-black font-semibold">
                                {formatDateDDMMYYYY(fromDate)}
                            </Text>
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setShowDatePicker("to")}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 ml-2 bg-gray-50"
                        activeOpacity={0.7}
                    >
                        <Text className="text-gray-700 font-medium text-center">
                            To:{" "}
                            <Text className="text-black font-semibold">
                                {formatDateDDMMYYYY(toDate)}
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        testID="dateTimePicker"
                        value={showDatePicker === "from" ? fromDate : toDate}
                        mode={"date"}
                        is24Hour={true}
                        display="default"
                        onChange={onDateChange}
                    />
                )}

                <View className="flex-row items-center justify-between">
                    <Text className="text-base text-gray-700 font-medium">All Games</Text>
                    <Switch
                        trackColor={{ false: "#e5e7eb", true: "#222" }}
                        thumbColor={allGames ? "#444" : "#f4f3f4"}
                        onValueChange={() => setAllGames((prev) => !prev)}
                        value={allGames}
                    />
                </View>
            </View>

            {renderContent()}
        </ScrollView>
    );
}
