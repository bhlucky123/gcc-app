import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";

type LimitCount = {
    id: number;
    number: string;
    count: number;
    draw: number;
    limit_type: "single_number" | "range";
    range_start: string;
    range_end: string;
    number_type?: "single_digit" | "double_digit" | "triple_digit";
};

// Memoized item to avoid hook error and unnecessary re-renders
const LimitCountItem = memo(
    ({
        item,
        updateLimitMutation,
        deleteLimitMutation,
    }: {
        item: LimitCount;
        updateLimitMutation: any;
        deleteLimitMutation: any;
    }) => {
        const [editCount, setEditCount] = useState(item.count.toString());
        const [isEditing, setIsEditing] = useState(false);

        // For range, show the range as a string
        const displayNumber =
            item.limit_type === "range"
                ? `${item.range_start} - ${item.range_end}`
                : item.number;

        // Show number type if available (single/double/triple)
        const displayNumberType =
            item.number_type
                ? {
                    single_digit: "Single Digit",
                    double_digit: "Double Digit",
                    triple_digit: "Triple Digit",
                  }[item.number_type]
                : undefined;

        return (
            <View className="bg-white rounded-xl mb-3 shadow shadow-black/10">
                <View className="flex-row items-end py-4 px-4">
                    <View className="flex-1">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-0.5 tracking-tight">
                            {item.limit_type === "range" ? "Range" : "Number"}
                        </Text>
                        <Text className="text-xl text-blue-gray-900 font-bold tracking-wide">
                            {displayNumber}
                        </Text>
                        {displayNumberType && (
                            <Text className="text-xs text-blue-600 font-semibold mt-0.5">
                                {displayNumberType}
                            </Text>
                        )}
                    </View>
                    <View className="flex-1">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-0.5 tracking-tight">
                            Count
                        </Text>
                        {isEditing ? (
                            <TextInput
                                className="text-lg text-blue-600 font-semibold bg-blue-50 rounded px-2 py-1 border border-blue-100 min-w-[60px]"
                                value={editCount}
                                onChangeText={setEditCount}
                                keyboardType="number-pad"
                                placeholder="Count"
                                placeholderTextColor="#b0b0b0"
                                returnKeyType="done"
                            />
                        ) : (
                            <Text className="text-xl text-blue-600 font-bold tracking-wide">
                                {item.count}
                            </Text>
                        )}
                    </View>
                    <View className="flex-row items-center ml-2 space-x-1.5">
                        {isEditing ? (
                            <TouchableOpacity
                                className="bg-green-500 py-2 px-4 rounded justify-center items-center mr-0.5"
                                onPress={() => {
                                    const countNum = parseInt(editCount, 10);
                                    if (isNaN(countNum) || countNum < 0) {
                                        Alert.alert("Invalid", "Please enter a valid count.");
                                        return;
                                    }
                                    updateLimitMutation.mutate({
                                        id: item.id,
                                        count: countNum,
                                        limit_type: item.limit_type,
                                        range_start: item.range_start,
                                        range_end: item.range_end,
                                        number: item.number,
                                        number_type: item?.number_type || "single_digit" // fallback
                                    });
                                    setIsEditing(false);
                                }}
                            >
                                <Text className="text-white font-bold text-base tracking-tight">
                                    Save
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                className="bg-blue-50 py-1.5 px-4 rounded border border-blue-100 justify-center items-center mr-0.5"
                                onPress={() => setIsEditing(true)}
                            >
                                <Text className="text-blue-600 font-bold text-base tracking-tight">
                                    Edit
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            className="bg-red-50 py-1.5 px-3 rounded border border-red-100 justify-center items-center"
                            onPress={() => {
                                Alert.alert(
                                    "Delete",
                                    item.limit_type === "range"
                                        ? `Delete limit for range ${item.range_start} - ${item.range_end}?`
                                        : `Delete limit for number ${item.number}?`,
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Delete",
                                            style: "destructive",
                                            onPress: () => deleteLimitMutation.mutate(item.id),
                                        },
                                    ]
                                );
                            }}
                        >
                            <Text className="text-red-500 font-black text-lg tracking-tight">✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }
);

// API path: admin uses limit-number-count, dealer uses dealer-limit-number-count
const LIMIT_API_BASE =
    (userType: string | undefined) =>
    userType === "DEALER"
        ? "/draw/dealer-limit-number-count"
        : "/draw/limit-number-count";

const LimitCountScreen = () => {
    const { user } = useAuthStore();
    const { selectedDraw } = useDrawStore();
    const queryClient = useQueryClient();
    const apiBase = LIMIT_API_BASE(user?.user_type);

    // UI state for adding new limit
    const [limitType, setLimitType] = useState<"single_number" | "range">("single_number");
    const [numberType, setNumberType] = useState<"single_digit" | "double_digit" | "triple_digit">("single_digit");

    const [newNumber, setNewNumber] = useState("");
    const [newRangeStart, setNewRangeStart] = useState("");
    const [newRangeEnd, setNewRangeEnd] = useState("");
    const [newCount, setNewCount] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: limitCounts, isLoading, error } = useQuery<LimitCount[]>({
        queryKey: [apiBase, selectedDraw?.id],
        queryFn: async () => {
            if (!selectedDraw?.id) return [];
            const res = await api.get<LimitCount[]>(
                `${apiBase}/?draw__id=${selectedDraw.id}`
            );
            return res.data;
        },
        enabled: !!selectedDraw?.id && !!apiBase,
    });

    const addLimitMutation = useMutation({
        mutationFn: (payload: {
            number: string;
            count: number;
            limit_type: "single_number" | "range";
            range_start: string;
            range_end: string;
            draw: number;
            number_type: "single_digit" | "double_digit" | "triple_digit"
        }) => {
            return api.post(`${apiBase}/`, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [apiBase, selectedDraw?.id],
            });
            setNewNumber("");
            setNewRangeStart("");
            setNewRangeEnd("");
            setNewCount("");
            setIsSubmitting(false);
            ToastAndroid.show("Limit count added successfully.", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            setIsSubmitting(false);
            console.log("err", err);
            let errorMsg = err?.message?.__all__?.[0] ||
                err?.response?.data?.non_field_errors?.[0] ||
                err?.message?.non_field_errors?.[0] ||
                "Failed to add limit count.";
            if (
                errorMsg === "The fields draw, number must make a unique set." ||
                errorMsg === "The fields draw, range_start, range_end must make a unique set."
            ) {
                errorMsg = "This number or range is already limited for the selected draw.";
            }
            Alert.alert("Error", errorMsg);
        },
    });

    const updateLimitMutation = useMutation({
        mutationFn: (payload: {
            id: number;
            count: number;
            limit_type: "single_number" | "range";
            range_start: string;
            range_end: string;
            number: string;
            number_type: "single_digit" | "double_digit" | "triple_digit"
        }) => {
            // PATCH only count, but keep other info for UI
            // Pass number_type, even if UI only PATCHes `count`
            return api.patch(`/draw/limit-number-count/${payload.id}/`, {
                count: payload.count,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["/draw/limit-number-count/", selectedDraw?.id],
            });
            ToastAndroid.show("Limit count updated.", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to update limit count."
            );
        },
    });

    const deleteLimitMutation = useMutation({
        mutationFn: (id: number) => {
            return api.delete(`${apiBase}/${id}/`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [apiBase, selectedDraw?.id],
            });
            ToastAndroid.show("Limit count deleted.", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            Alert.alert(
                "Error",
                err?.response?.data?.detail || "Failed to delete limit count."
            );
        },
    });

    // Utility to get digit length
    const getDigitsForType = (type: "single_digit" | "double_digit" | "triple_digit") => {
        switch (type) {
            case "single_digit": return 1;
            case "double_digit": return 2;
            case "triple_digit": return 3;
            default: return 1;
        }
    };

    // Filter input so that only up-to-N digits can be entered, and numbers only
    const onSetNewNumber = (text: string) => {
        let onlyDigits = text.replace(/\D/g, "");
        const maxLen = getDigitsForType(numberType);
        setNewNumber(onlyDigits.slice(0, maxLen));
    };

    const onSetNewRangeStart = (text: string) => {
        const onlyDigits = text.replace(/\D/g, "");
        setNewRangeStart(onlyDigits.slice(0, getDigitsForType(numberType)));
    };

    const onSetNewRangeEnd = (text: string) => {
        const onlyDigits = text.replace(/\D/g, "");
        setNewRangeEnd(onlyDigits.slice(0, getDigitsForType(numberType)));
    };

    const handleAddLimit = () => {
        if (!selectedDraw?.id) {
            Alert.alert("No Draw", "Please select a draw.");
            return;
        }
        const countNum = parseInt(newCount, 10);

        if (isNaN(countNum) || countNum < 0) {
            Alert.alert("Invalid", "Please enter a valid count.");
            return;
        }

        if (limitType === "single_number") {
            const trimmedNumber = newNumber.trim();
            const requiredDigits = getDigitsForType(numberType);

            if (!/^\d+$/.test(trimmedNumber) || trimmedNumber.length !== requiredDigits) {
                Alert.alert(
                    "Invalid",
                    `Please enter a valid ${requiredDigits === 1 ? "single" : requiredDigits === 2 ? "double" : "triple"} digit number.`
                );
                return;
            }
            setIsSubmitting(true);
            addLimitMutation.mutate({
                number: trimmedNumber,
                count: countNum,
                limit_type: "single_number",
                range_start: "",
                range_end: "",
                draw: selectedDraw.id,
                number_type: numberType,
            });
        } else {
            // range
            const trimmedStart = newRangeStart.trim();
            const trimmedEnd = newRangeEnd.trim();
            const requiredDigits = getDigitsForType(numberType);

            if (
                !/^\d+$/.test(trimmedStart) ||
                !/^\d+$/.test(trimmedEnd) ||
                trimmedStart.length !== requiredDigits ||
                trimmedEnd.length !== requiredDigits
            ) {
                Alert.alert("Invalid", `Please enter valid and equal length (${requiredDigits}) range start and end.`);
                return;
            }
            if (parseInt(trimmedStart, 10) > parseInt(trimmedEnd, 10)) {
                Alert.alert("Invalid", "Range start should be less than or equal to range end.");
                return;
            }
            setIsSubmitting(true);
            addLimitMutation.mutate({
                number: "",
                count: countNum,
                limit_type: "range",
                range_start: trimmedStart,
                range_end: trimmedEnd,
                draw: selectedDraw.id,
                number_type: numberType, // range is now tracked with numberType
            });
        }
    };

    // --- Better styled Multi-level Tabs ---
    const tabColors = {
        activeBg: "bg-blue-600",
        inactiveBg: "bg-white",
        activeText: "text-white",
        inactiveText: "text-blue-600",
        border: "border border-blue-200",
        rounded: "rounded-full",
        shadow: "shadow shadow-blue-600/10"
    };

    // Top-level: Single/Double/Triple digit tab
    // Reduced size: less padding, smaller font, tighter radii/margins

    const NumberTypeTabs = () => (
        <View className="flex-row justify-center my-2">
            <View
                style={{
                    flexDirection: "row",
                    backgroundColor: "#EFF6FF",
                    borderRadius: 20,
                    padding: 2,
                    shadowColor: "#3B82F6",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 3,
                }}
            >
                {(["single_digit", "double_digit", "triple_digit"] as const).map((type, idx, arr) => {
                    const selected = numberType === type;
                    const roundedLeft = idx === 0 ? 14 : 6;
                    const roundedRight = idx === arr.length-1 ? 14 : 6;
                    return (
                        <TouchableOpacity
                            key={type}
                            className={[
                                "mx-0.5",
                                selected ? "bg-blue-500" : "bg-white",
                            ].join(" ")}
                            style={{
                                paddingHorizontal: 12,
                                paddingVertical: 5,
                                borderTopLeftRadius: roundedLeft,
                                borderBottomLeftRadius: roundedLeft,
                                borderTopRightRadius: roundedRight,
                                borderBottomRightRadius: roundedRight,
                                marginLeft: idx === 0 ? 0 : 2,
                                marginRight: idx === arr.length-1 ? 0 : 2,
                                borderWidth: selected ? 0 : 1,
                                borderColor: selected ? "#2563eb" : "#c7d5fa",
                                elevation: selected ? 2 : 0,
                                shadowColor: selected ? "#2563eb" : undefined,
                                shadowOpacity: selected ? 0.08 : 0,
                                shadowRadius: selected ? 4 : 0,
                            }}
                            activeOpacity={0.9}
                            onPress={() => {
                                setNumberType(type);
                                setNewNumber("");
                                setNewRangeStart("");
                                setNewRangeEnd("");
                            }}
                            disabled={isSubmitting}
                        >
                            <Text
                                className={[
                                    "font-bold text-[13px]",
                                    selected ? "text-white" : "text-blue-600",
                                ].join(" ")}
                                style={{
                                    letterSpacing: 1,
                                    color: selected ? "#fff" : "#2563eb"
                                }}
                            >
                                {type === "single_digit"
                                    ? "Single Digit"
                                    : type === "double_digit"
                                        ? "Double Digit"
                                        : "Triple Digit"}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    // 2nd-level: single number / range tab
    const LimitTypeTabs = () => (
        <View className="flex-row justify-center my-2">
            {(["single_number", "range"] as const).map((type, idx, arr) => (
                <TouchableOpacity
                    key={type}
                    className={[
                        "px-5 py-2 mx-0.5",
                        tabColors.rounded,
                        tabColors.shadow,
                        tabColors.border,
                        limitType === type ? "bg-blue-500" : "bg-blue-100",
                        idx === 0 ? "ml-0" : "",
                        idx === arr.length - 1 ? "mr-0" : ""
                    ].join(" ")}
                    style={{
                        borderTopLeftRadius: idx === 0 ? 22 : 10,
                        borderBottomLeftRadius: idx === 0 ? 22 : 10,
                        borderTopRightRadius: idx === arr.length - 1 ? 22 : 10,
                        borderBottomRightRadius: idx === arr.length - 1 ? 22 : 10,
                        elevation: limitType === type ? 2 : 0
                    }}
                    onPress={() => {
                        setLimitType(type);
                        setNewNumber(""); setNewRangeStart(""); setNewRangeEnd("");
                    }}
                    disabled={isSubmitting}
                >
                    <Text
                        className={[
                            "font-bold text-base tracking-tight",
                            limitType === type ? "text-white" : "text-blue-600"
                        ].join(" ")}
                        style={{letterSpacing: 1}}
                    >
                        {type === "single_number" ? "Single Number" : "Range"}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const renderHeader = () => (
        <View>
            <View className="bg-white rounded-xl p-4 mb-4 shadow shadow-black/10">
                <Text className="text-base font-semibold text-blue-600 mb-1 tracking-tight">
                    Add Limit
                </Text>
                <NumberTypeTabs />
                <LimitTypeTabs />

                <View className="flex-row items-end space-x-2 mt-2">
                    {limitType === "single_number" ? (
                        <>
                            <View className="flex-1">
                                <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                                    Number
                                </Text>
                                <TextInput
                                    className="rounded bg-blue-50 text-base text-blue-gray-900 px-3 py-2 mr-1 shadow shadow-blue-600/10"
                                    placeholder="Number"
                                    value={newNumber}
                                    onChangeText={onSetNewNumber}
                                    keyboardType="number-pad"
                                    editable={!isSubmitting}
                                    placeholderTextColor="#b0b0b0"
                                    maxLength={getDigitsForType(numberType)}
                                    returnKeyType="next"
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            <View className="flex-1">
                                <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                                    Range Start
                                </Text>
                                <TextInput
                                    className="rounded bg-blue-50 text-base text-blue-gray-900 px-3 py-2 mr-1 shadow shadow-blue-600/10"
                                    placeholder="Start"
                                    value={newRangeStart}
                                    onChangeText={onSetNewRangeStart}
                                    keyboardType="number-pad"
                                    editable={!isSubmitting}
                                    placeholderTextColor="#b0b0b0"
                                    maxLength={getDigitsForType(numberType)}
                                    returnKeyType="next"
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                                    Range End
                                </Text>
                                <TextInput
                                    className="rounded bg-blue-50 text-base text-blue-gray-900 px-3 py-2 mr-1 shadow shadow-blue-600/10"
                                    placeholder="End"
                                    value={newRangeEnd}
                                    onChangeText={onSetNewRangeEnd}
                                    keyboardType="number-pad"
                                    editable={!isSubmitting}
                                    placeholderTextColor="#b0b0b0"
                                    maxLength={getDigitsForType(numberType)}
                                    returnKeyType="next"
                                />
                            </View>
                        </>
                    )}
                    <View className="flex-1">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                            Count
                        </Text>
                        <TextInput
                            className="rounded bg-blue-50 text-base text-blue-gray-900 px-3 py-2 mr-1 shadow shadow-blue-600/10"
                            placeholder="Count"
                            value={newCount}
                            onChangeText={setNewCount}
                            keyboardType="number-pad"
                            editable={!isSubmitting}
                            placeholderTextColor="#b0b0b0"
                            returnKeyType="done"
                        />
                    </View>
                    <TouchableOpacity
                        className={`bg-blue-600 py-2 px-3 rounded justify-center items-center min-w-[70px] ml-0.5 shadow shadow-blue-600/20 ${isSubmitting ? "opacity-60" : ""
                            }`}
                        onPress={handleAddLimit}
                        disabled={isSubmitting}
                    >
                        <Text className="text-white font-bold text-base tracking-wide">
                            {isSubmitting ? "Adding..." : "Add"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    const renderLimitItem = useCallback(
        ({ item }: { item: LimitCount }) => (
            <LimitCountItem
                item={item}
                updateLimitMutation={updateLimitMutation}
                deleteLimitMutation={deleteLimitMutation}
            />
        ),
        [updateLimitMutation, deleteLimitMutation]
    );

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-blue-50"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <SafeAreaView className="flex-1 p-4  bg-blue-50">
                {isLoading ? (
                    <ActivityIndicator size="large" style={{ marginTop: 32 }} color="#2563eb" />
                ) : error ? (
                    <Text className="text-red-500 text-center mt-8 text-base font-semibold">
                        Failed to load limit counts.
                    </Text>
                ) : (
                    <View className="flex-1">
                        {renderHeader()}
                        <FlatList
                            data={limitCounts || []}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderLimitItem}
                            ListEmptyComponent={
                                <Text className="text-blue-gray-400 text-center mt-8 text-base font-medium">
                                    No limit counts found.
                                </Text>
                            }
                            contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                        />
                    </View>
                )}
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

export default LimitCountScreen;
