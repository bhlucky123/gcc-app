import DrawResultForm from "@/components/draw-result-form";
import useDraw from "@/hooks/use-draw";
import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, Ban, Calendar, Clock, Pencil, Plus, X } from "lucide-react-native";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Prize row colours to match screenshot */
const PRIZE_COLOURS = [
    "bg-red-200/60",
    "bg-blue-200/60",
    "bg-amber-200/60",
    "bg-green-200/60",
    "bg-fuchsia-200/60",
];

export type DrawResult = {
    id: number;
    draw: string;
    published_at: string;
    first_prize: string;
    second_prize: string;
    third_prize: string;
    fourth_prize: string;
    fifth_prize: string;
    draw_time: string; // eg: "15:05:00",
    complementary_prizes: string[];
};

function isThreeDigitNumber(str: string) {
    return /^\d{3}$/.test(str);
}

function validateDrawResultFields(data: Partial<DrawResult> & { complementary_prizes?: string[] }) {
    const mainPrizes = [
        data.first_prize,
        data.second_prize,
        data.third_prize,
        data.fourth_prize,
        data.fifth_prize,
    ];
    const mainPrizeEntered = mainPrizes.some((prize) => !!prize && String(prize).trim() !== "");
    const complementaryEntered = Array.isArray(data.complementary_prizes) && data.complementary_prizes.some((val) => !!val && String(val).trim() !== "");

    // If neither main nor complementary prizes are entered, require at least one
    if (!mainPrizeEntered && !complementaryEntered) {
        return "Please enter at least one main prize or one complementary prize.";
    }

    // If any main prize is entered, validate all main prizes
    if (mainPrizeEntered) {
        for (let i = 0; i < mainPrizes.length; i++) {
            if (!mainPrizes[i] || typeof mainPrizes[i] !== "string" || !isThreeDigitNumber(mainPrizes[i]!)) {
                return `Please enter a valid 3-digit number for ${["First", "Second", "Third", "Fourth", "Fifth"][i]} Prize.`;
            }
        }
    }

    // If any complementary prize is entered, validate all complementary prizes
    if (complementaryEntered) {
        if (!Array.isArray(data.complementary_prizes) || data.complementary_prizes.length === 0) {
            return "Please enter all complementary prizes.";
        }
        for (let i = 0; i < data.complementary_prizes.length; i++) {
            const val = data.complementary_prizes[i];
            if (!val || !isThreeDigitNumber(val)) {
                return `Complementary Prize ${i + 1} must be a valid 3-digit number (e.g., 123). Please check your entry.`;
            }
        }
    }

    return null;
}

function canEditResult(published_at: string | undefined | null) {
    if (!published_at) return false;
    const publishedDate = new Date(published_at);
    const now = new Date();
    // Allow edit only if published_at is the same calendar day as today
    return (
        publishedDate.getFullYear() === now.getFullYear() &&
        publishedDate.getMonth() === now.getMonth() &&
        publishedDate.getDate() === now.getDate()
    );
}

// Helper to format time as HH:mm (from "15:05:00" or "15:05")
function formatDrawTime(time: string | undefined | null): string {
    if (!time) return "";
    // Accepts "HH:mm:ss" or "HH:mm"
    const match = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
        let hour = parseInt(match[1], 10);
        const minute = match[2];
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12;
        if (hour === 0) hour = 12;
        return `${hour}:${minute} ${ampm}`;
    }
    return time;
}

const ResultPage: React.FC = () => {
    const { createDrawResult, updateDrawResult, createDrawResultIsPending, updateDrawResultIsPending } = useDraw();
    const { selectedDraw } = useDrawStore();

    const [mode, setMode] = useState<"view" | "edit">("view");
    const [formData, setFormData] = useState<Partial<DrawResult> | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [filterDate, setFilterDate] = useState<Date>(new Date());
    const [formError, setFormError] = useState<string | null>(null);

    const { user } = useAuthStore();

    // Helper to format date as yyyy-mm-dd
    function formatDateServer(date: Date | null): string | null {
        if (!date) return null;
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    const filterDateString = formatDateServer(filterDate);

    const { data: rawData, isLoading, error, refetch } = useQuery<DrawResult[] | { skipped: boolean } | null>({
        queryKey: ["/draw-result/result/", selectedDraw?.id, filterDateString],
        queryFn: async () => {
            const res = await api.get(
                `/draw-result/result/?draw_session__draw__id=${selectedDraw?.id}&draw_session__session_date=${filterDateString ?? ""}`
            );

            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    console.log("rawData", rawData);

    // Handle skipped state
    const isSkipped = !!rawData && typeof rawData === "object" && !Array.isArray(rawData) && (rawData as any).skipped === true;
    const data = !isSkipped && Array.isArray(rawData) ? rawData?.[0] : undefined;

    // Add skip state
    const [skipError, setSkipError] = useState<string | null>(null);
    const [skipLoading, setSkipLoading] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const skipDrawSessionMutation = useMutation({
        mutationFn: (payload: { draw_id: number; session_date: string }) => {
            return api.post("/draw-result/skip-draw-session/", payload);
        },
        onError: (error: any) => {

            let errorMessage = "Failed to skip draw session.";

            if (
                error?.message &&
                typeof error.message === "object" &&
                typeof error.message.message === "string"
            ) {
                errorMessage = error.message.message;
            } else if (error?.detail) {
                errorMessage = error.detail;
            } else if (
                error?.response?.data?.message &&
                typeof error.message === "string"
            ) {
                errorMessage = error.message;
            } else if (
                error?.message &&
                typeof error.message === "string"
            ) {
                errorMessage = error.message;
            } else if (typeof error === "string") {
                errorMessage = error;
            }

            Alert.alert("Error", typeof errorMessage === "string" ? errorMessage : "Failed to skip result.");
            setSkipError(errorMessage);
            setTimeout(() => {
                setSkipError(null);
            }, 3000);
        }
    });

    // ------------------- helpers -------------------
    const handleFormSubmit = async (resultData: any) => {
        setFormError(null);
        // Validate all fields
        const validationError = validateDrawResultFields(resultData);
        if (validationError) {
            setFormError(validationError);
            Alert.alert("Validation Error", validationError);
            return;
        }

        setLoading(true)
        // Remove complementary_prizes if all elements are empty strings
        let submitData = { ...resultData };
        if (
            Array.isArray(submitData.complementary_prizes) &&
            submitData.complementary_prizes.every((item: any) => item === "")
        ) {
            // Remove the key if all are empty strings
            delete submitData.complementary_prizes;
        }

        console.log("submitData", submitData);

        try {
            if (data && data.id) {
                // Update
                await updateDrawResult.mutateAsync({
                    id: data.id,
                    ...submitData,
                });
            } else {
                // Create
                await createDrawResult.mutateAsync({
                    ...submitData,
                    draw_session: selectedDraw?.id,
                });
            }
            setMode("view");
            setFormData(null);
            refetch();
            setLoading(false)
        } catch (err: any) {
            if (Array.isArray(err) && err.length === 1 && err[0] === "No draw session found for today.") {
                setFormError("No draw session found for the selected date. Please check the draw schedule.");
                Alert.alert("No Draw Session", "No draw session found for the selected date. Please check the draw schedule.");
            } else {
                setFormError(typeof err === "string" ? err : "Failed to save result.");
                Alert.alert("Error", typeof err === "string" ? err : "Failed to save result.");
            }

            setLoading(false)

            setTimeout(() => {
                setFormError("");
            }, 3000);
        }
    };

    // Handle skip result
    const handleSkipResult = async () => {
        setSkipError(null);
        setSkipLoading(true);
        if (!selectedDraw?.id || !filterDateString) {
            setSkipError("Draw or date not selected.");
            setSkipLoading(false);
            return;
        }
        Alert.alert(
            "Skip Result",
            "Are you sure you want to skip the result for this draw and date? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel", onPress: () => setSkipLoading(false) },
                {
                    text: "Skip",
                    style: "destructive",
                    onPress: async () => {
                        await skipDrawSessionMutation.mutateAsync({
                            draw_id: selectedDraw.id,
                            session_date: filterDateString,
                        });
                        setSkipLoading(false);
                        refetch();
                        Alert.alert("Skipped", "Result has been marked as skipped for this draw and date.");

                    }
                }
            ]
        );
    };

    // ------------------- states -------------------
    if (!selectedDraw?.id) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50">
                <AlertCircle size={48} color="#a1a1aa" />
                <Text className="mt-3 text-lg text-gray-500 font-semibold">No draw selected</Text>
            </View>
        );
    }

    // If skipped, show skipped message and do not allow add/edit/skip
    if (isSkipped) {
        return (
            <ScrollView className="flex-1">
                {/* Date filter */}
                <View className="px-4 pt-4 flex-row items-end justify-between">
                    {/* Date filter section */}
                    <View className="flex-1 mr-4">
                        <Text className="text-xs font-semibold text-gray-600 mb-1 ml-1 tracking-wider">
                            Date
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowDatePicker(true)}
                            className="flex-row items-center justify-between border border-gray-300 rounded-xl px-4 py-2 bg-white shadow-sm"
                            activeOpacity={0.85}
                        >
                            <Text className="text-base text-gray-800 font-medium">
                                {formatDateDDMMYYYY(filterDate || new Date())}
                            </Text>
                            <View className="ml-2">
                                <Calendar size={20} color="#2563eb" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
                <View className="flex-1 items-center justify-center bg-gray-50 py-16">
                    <Ban size={48} color="#9ca3af" />
                    <Text className="mt-4 text-lg font-semibold text-gray-700 text-center">
                        This result has been skipped for the selected date.
                    </Text>
                    <Text className="mt-2 text-base text-gray-500 text-center">
                        You cannot add or edit a result for this date.
                    </Text>
                </View>
                {/* Date picker modal */}
                {showDatePicker && (
                    <DateTimePicker
                        mode="date"
                        value={filterDate || new Date()}
                        onChange={(_e, d) => {
                            if (d) setFilterDate(d);
                            setShowDatePicker(false);
                        }}
                    />
                )}
            </ScrollView>
        );
    }

    // ------------------- Edit mode -------------------
    if (mode === "edit") {
        return (
            <View className="flex-1 bg-gray-50">
                {/* top bar */}
                <View className="flex-row items-center bg-green-700 px-2 py-3  justify-between">
                    <Text className="text-lg font-bold text-white">{data && data.id ? "Edit Result" : "Add Result"}</Text>
                    <TouchableOpacity onPress={() => { setMode("view"); setFormData(null); setFormError(null); }}>
                        <X size={22} color="#fff" />
                    </TouchableOpacity>
                </View>
                {/* {formError ? (
                    <View className="bg-red-100 px-4 py-2">
                        <Text className="text-red-700 text-sm">{formError}</Text>
                    </View>
                ) : null} */}
                <DrawResultForm
                    initialData={formData || undefined}
                    onSubmit={handleFormSubmit}
                    validate={validateDrawResultFields}
                    loading={loading}
                />
            </View>
        );
    }

    // ------------------- View mode -------------------
    // Always show the date filter and plus button, even if error or loading
    let errorMessage: string = "";
    let isNoResultYet = false;
    if (error || !data) {
        errorMessage =
            (error as any)?.message?.detail ||
            (error as any)?.message ||
            "";
        if (
            typeof errorMessage === "string" &&
            errorMessage.trim() === "No Result matches the given query."
        ) {
            isNoResultYet = true;
        }
    }

    // Only allow add if no result, and only allow edit if result is updated within 1 hour
    const canAdd = user?.user_type === "ADMIN" && !data && !isSkipped;
    const canEditIcon = user?.user_type === "ADMIN" && data && canEditResult(data.published_at) && !isSkipped;

    // Allow skip if admin, no result, and not loading, and not skipped
    const canSkip =
        user?.user_type === "ADMIN" &&
        !data &&
        !isLoading &&
        !!selectedDraw?.id &&
        !!filterDateString &&
        !isSkipped;

    return (
        <ScrollView className="flex-1">
            <SafeAreaView>
            {/* Date filter */}
            <View className="px-4 pt-4 flex-row items-end justify-between">
                {/* Date filter section */}
                <View className="flex-1 mr-4">
                    <Text className="text-xs font-semibold text-gray-600 mb-1 ml-1 tracking-wider">
                        Date
                    </Text>
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        className="flex-row items-center justify-between border border-gray-300 rounded-xl px-4 py-2 bg-white shadow-sm"
                        activeOpacity={0.85}
                    >
                        <Text className="text-base text-gray-800 font-medium">
                            {formatDateDDMMYYYY(filterDate || new Date())}
                        </Text>
                        <View className="ml-2">
                            <Calendar size={20} color="#2563eb" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* FAB to add */}
                {canAdd && (
                    <TouchableOpacity
                        onPress={() => {
                            setFormData({ complementary_prizes: [] });
                            setMode("edit");
                            setFormError(null);
                        }}
                        className="w-14 h-14 rounded-full bg-blue-600 items-center justify-center shadow-lg border-4 border-white"
                        style={{
                            elevation: 6,
                            shadowColor: "#2563eb",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                        }}
                        activeOpacity={0.85}
                    >
                        <Plus size={26} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* Edit icon for update, only if result is updated within 1 hour */}
                {canEditIcon && (
                    <TouchableOpacity
                        onPress={() => {
                            setFormData(data || { complementary_prizes: [] });
                            setMode("edit");
                            setFormError(null);
                        }}
                        className="w-14 h-14 rounded-full bg-yellow-500 items-center justify-center shadow-lg border-4 border-white ml-2"
                        style={{
                            elevation: 6,
                            shadowColor: "#fbbf24",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                        }}
                        activeOpacity={0.85}
                    >
                        <Pencil size={26} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Loading state */}
            {isLoading && (
                <View className="flex-1 items-center justify-center bg-gray-50 py-8">
                    <ActivityIndicator size="large" color="#15803d" />
                    <Text className="mt-2 text-base text-gray-500">Loading…</Text>
                </View>
            )}

            {/* Show "No result published" if not loading and no data */}
            {!isLoading && !data && (
                <View className="flex-1 items-center justify-center bg-gray-50 py-8">
                    <AlertTriangle size={40} color="#f59e42" />
                    <Text className="mt-2 text-base font-semibold text-yellow-700">
                        No result published yet for this draw
                    </Text>
                    {canSkip && (
                        <TouchableOpacity
                            onPress={handleSkipResult}
                            className="w-48 h-12 rounded-full bg-gray-400 items-center justify-center shadow-lg border-4 border-white mt-4"
                            style={{
                                elevation: 6,
                                shadowColor: "#6b7280",
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.2,
                                shadowRadius: 4,
                                opacity: skipLoading ? 0.6 : 1,
                            }}
                            activeOpacity={0.85}
                            disabled={skipLoading}
                        >
                            {skipLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text className="text-white font-semibold text-base">
                                    Skip this result
                                </Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Error handling for other errors */}
            {!isLoading && error && data && (
                <View className="flex-1 items-center justify-center bg-gray-50 py-8">
                    <AlertTriangle size={40} color="#f59e42" />
                    <Text className="mt-2 text-base font-semibold text-red-600">
                        Failed to load result
                    </Text>
                </View>
            )}

            {/* Prize table and draw time */}
            {!isLoading && data && (
                <View className="mx-4 mt-6 border border-gray-300 rounded-lg overflow-hidden">
                    {/* Draw time row */}
                    <View className="flex-row items-center bg-gray-100 border-b border-gray-300 px-3 py-2">
                        <Clock size={22} color="#2563eb" />
                        <Text className="ml-2 text-[15px] font-semibold text-gray-700">
                            Draw Time:
                        </Text>
                        <Text className="ml-2 text-[22px] font-mono font-extrabold text-gray-900">
                            {formatDrawTime(data.draw_time)}
                        </Text>
                    </View>
                    {(
                        [
                            { label: "First Price", value: data.first_prize },
                            { label: "Second Price", value: data.second_prize },
                            { label: "Third Price", value: data.third_prize },
                            { label: "Fourth Price", value: data.fourth_prize },
                            { label: "Fifth Price", value: data.fifth_prize },
                        ] as const
                    ).map((row, idx) => (
                        <View key={row.label} className={`flex-row ${PRIZE_COLOURS[idx]} border-b border-gray-300`}>
                            <Text className="w-10 text-center py-1.5 text-[11px] font-medium border-r border-gray-300 bg-white/20">
                                {idx + 1}
                            </Text>
                            <Text className="flex-1 py-1.5 text-[16px] font-bold text-center text-gray-800">
                                {row.label}
                            </Text>
                            <Text className="w-20 py-1.5 text-[17px] font-mono font-bold text-center border-l border-gray-300">
                                {row.value}
                            </Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Complementary grid */}
            {!isLoading && data && (
                <View className="mx-4 mt-6 mb-10 border border-gray-300 rounded-lg overflow-hidden">
                    {/* Top-to-bottom grid, 3 columns */}
                    <View className="flex-row border-b border-gray-200">
                        {Array.from({ length: 3 }).map((_, colIdx) => (
                            <View key={`col-${colIdx}`} className="flex-1">
                                {Array.from({ length: Math.ceil(data.complementary_prizes.length / 3) }).map((_, rowIdx) => {
                                    const idx = rowIdx + colIdx * Math.ceil(data.complementary_prizes.length / 3);
                                    const prize = data.complementary_prizes[idx];
                                    return (
                                        <Text
                                            key={`prize-${colIdx}-${rowIdx}`}
                                            className={`py-2 text-center text-[15px] font-mono font-bold border-b border-gray-200 ${colIdx < 2 ? "border-r border-gray-200" : ""}`}
                                        >
                                            {prize || ""}
                                        </Text>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Date picker modal */}
            {showDatePicker && (
                <DateTimePicker
                    mode="date"
                    value={filterDate || new Date()}
                    onChange={(_e, d) => {
                        if (d) setFilterDate(d);
                        setShowDatePicker(false);
                    }}
                />
            )}
        </SafeAreaView>
        </ScrollView>
    );
};

export default ResultPage;
