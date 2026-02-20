import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from "react-native";
import { ALERT_TYPE, Dialog } from "react-native-alert-notification";
import { Dropdown } from "react-native-element-dropdown";

type Dealer = { id: number; username: string };

type LimitCount = {
    id: number;
    number: string | null;
    count: number;
    draw: number;
    limit_type: "single_number" | "range";
    range_start: string | null;
    range_end: string | null;
    number_type?: "single_digit" | "double_digit" | "triple_digit";
    dealer_details?: { id: number; username: string; user_type?: string } | null;
};

// Memoized item to avoid hook error and unnecessary re-renders
const LimitCountItem = memo(
    ({
        item,
        updateLimitMutation,
        deleteLimitMutation,
        onDeletePress,
    }: {
        item: LimitCount;
        updateLimitMutation: any;
        deleteLimitMutation: any;
        onDeletePress: (item: LimitCount) => void;
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
                        {item.dealer_details?.username && (
                            <Text className="text-xs text-blue-gray-500 font-medium mt-0.5">
                                Dealer: {item.dealer_details.username}
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
                                        Dialog.show({
                                            type: ALERT_TYPE.WARNING,
                                            title: "Invalid",
                                            textBody: "Please enter a valid count.",
                                            button: "OK",
                                        });
                                        return;
                                    }
                                    updateLimitMutation.mutate({
                                        id: item.id,
                                        count: countNum,
                                        limit_type: item.limit_type,
                                        range_start: item.range_start ?? "",
                                        range_end: item.range_end ?? "",
                                        number: item.number ?? "",
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
                            onPress={() => onDeletePress(item)}
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

    // Filter for list by number_type
    const [filterNumberType, setFilterNumberType] = useState<"all" | "single_digit" | "double_digit" | "triple_digit">("all");
    // Dealer filter for list (admin only)
    const [filterDealerId, setFilterDealerId] = useState<number | "">("");
    // Selected dealer when creating (admin only) - null = global limit
    const [selectedDealerForCreate, setSelectedDealerForCreate] = useState<number | null>(null);

    const { data: dealers = [] as Dealer[] } = useQuery<Dealer[]>({
        queryKey: ["dealers"],
        queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
        enabled: user?.user_type === "ADMIN",
    });

    const [newNumber, setNewNumber] = useState("");
    const [newRangeStart, setNewRangeStart] = useState("");
    const [newRangeEnd, setNewRangeEnd] = useState("");
    const [newCount, setNewCount] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [errorFields, setErrorFields] = useState<("number" | "rangeStart" | "rangeEnd" | "count" | "dealer")[]>([]);

    const clearValidation = () => {
        setValidationError(null);
        setErrorFields([]);
    };

    const { data: limitCounts, isLoading, isFetching, error } = useQuery<LimitCount[]>({
        queryKey: [apiBase, selectedDraw?.id, filterNumberType, filterDealerId],
        queryFn: async () => {
            if (!selectedDraw?.id) return [];
            let url = `${apiBase}/?draw__id=${selectedDraw.id}`;
            if (filterNumberType !== "all") {
                url += `&number_type=${filterNumberType}`;
            }
            if (user?.user_type === "ADMIN" && filterDealerId) {
                url += `&dealer__id=${filterDealerId}`;
            }
            const res = await api.get<LimitCount[]>(url);
            return res.data;
        },
        enabled: !!selectedDraw?.id && !!apiBase,
        placeholderData: (prev) => prev,
    });

    const addLimitMutation = useMutation({
        mutationFn: (payload: {
            number: string;
            count: number;
            limit_type: "single_number" | "range";
            range_start: string;
            range_end: string;
            draw: number;
            number_type: "single_digit" | "double_digit" | "triple_digit";
            dealer?: number | null;
        }) => {
            const body = { ...payload };
            if (user?.user_type === "ADMIN") {
                body.dealer = payload.dealer ?? null;
            }
            return api.post(`${apiBase}/`, body);
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
            clearValidation();
            ToastAndroid.show("Limit count added successfully.", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            setIsSubmitting(false);
            console.log("err", err);

            // Handle dealer-specific config error inline
            const dealerError =
                err?.response?.data?.message?.dealer?.[0] ||
                err?.message?.dealer?.[0];
            if (dealerError) {
                setSelectedDealerForCreate(null);
                setValidationError(dealerError);
                setErrorFields(["dealer"]);
                return;
            }

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
            Dialog.show({
                type: ALERT_TYPE.DANGER,
                title: "Error",
                textBody: errorMsg,
                button: "OK",
            });
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
            Dialog.show({
                type: ALERT_TYPE.DANGER,
                title: "Error",
                textBody: err?.response?.data?.detail || "Failed to update limit count.",
                button: "OK",
            });
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
            Dialog.show({
                type: ALERT_TYPE.DANGER,
                title: "Error",
                textBody: err?.response?.data?.detail || "Failed to delete limit count.",
                button: "OK",
            });
        },
    });

    // Delete confirmation modal
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleteItem, setDeleteItem] = useState<LimitCount | null>(null);

    const handleDeletePress = useCallback((item: LimitCount) => {
        setDeleteItem(item);
        setDeleteModalVisible(true);
    }, []);

    const handleDeleteConfirm = useCallback(() => {
        if (deleteItem) {
            deleteLimitMutation.mutate(deleteItem.id);
            setDeleteModalVisible(false);
            setDeleteItem(null);
        }
    }, [deleteItem, deleteLimitMutation]);

    const handleDeleteCancel = useCallback(() => {
        setDeleteModalVisible(false);
        setDeleteItem(null);
    }, []);

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
        clearValidation();
        let onlyDigits = text.replace(/\D/g, "");
        const maxLen = getDigitsForType(numberType);
        setNewNumber(onlyDigits.slice(0, maxLen));
    };

    const onSetNewRangeStart = (text: string) => {
        clearValidation();
        const onlyDigits = text.replace(/\D/g, "");
        setNewRangeStart(onlyDigits.slice(0, getDigitsForType(numberType)));
    };

    const onSetNewRangeEnd = (text: string) => {
        clearValidation();
        const onlyDigits = text.replace(/\D/g, "");
        setNewRangeEnd(onlyDigits.slice(0, getDigitsForType(numberType)));
    };

    const onSetNewCount = (text: string) => {
        clearValidation();
        setNewCount(text.replace(/\D/g, ""));
    };

    const handleAddLimit = () => {
        clearValidation();
        if (!selectedDraw?.id) {
            setValidationError("Please select a draw first.");
            return;
        }
        const countNum = parseInt(newCount, 10);

        if(!newNumber?.trim() && limitType === "single_number") {
            setValidationError("Number is required.");
            setErrorFields(["number"]);
            return;
        }

        if(!newRangeStart?.trim() && limitType === "range") {
            setValidationError("Range start is required.");
            setErrorFields(["rangeStart"]);
            return;
        }

        if(!newRangeEnd?.trim() && limitType === "range") {
            setValidationError("Range end is required.");
            setErrorFields(["rangeEnd"]);
            return;
        }

        if (isNaN(countNum) || countNum < 0 || !newCount?.trim()) {
            setValidationError("Count is required.");
            setErrorFields(["count"]);
            return;
        }

        if (limitType === "single_number") {
            const trimmedNumber = newNumber.trim();
            const requiredDigits = getDigitsForType(numberType);
            const digitLabel = requiredDigits === 1 ? "single" : requiredDigits === 2 ? "double" : "triple";

            if (!/^\d+$/.test(trimmedNumber) || trimmedNumber.length !== requiredDigits) {
                setValidationError(`${digitLabel} digit number (${requiredDigits} digit${requiredDigits > 1 ? "s" : ""}) is required.`);
                setErrorFields(["number"]);
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
                dealer: user?.user_type === "ADMIN" ? selectedDealerForCreate : undefined,
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
                setValidationError(`Enter valid range (${requiredDigits} digit${requiredDigits > 1 ? "s" : ""} each).`);
                setErrorFields(["rangeStart", "rangeEnd"]);
                return;
            }
            if (parseInt(trimmedStart, 10) > parseInt(trimmedEnd, 10)) {
                setValidationError("Range start must be less than or equal to range end.");
                setErrorFields(["rangeStart", "rangeEnd"]);
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
                number_type: numberType,
                dealer: user?.user_type === "ADMIN" ? selectedDealerForCreate : undefined,
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
                                clearValidation();
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
                        clearValidation();
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

    // Dealer filter for list (admin only)
    const DealerFilter = () =>
        user?.user_type === "ADMIN" ? (
            <View style={{ width: "100%", marginBottom: 10 }}>
                <Text className="text-xs text-blue-gray-500 font-medium mb-1">Filter by dealer</Text>
                <Dropdown
                    data={[{ label: "All dealers", value: "" }, ...dealers.map((d) => ({ label: d.username, value: d.id }))]}
                    labelField="label"
                    valueField="value"
                    value={filterDealerId}
                    placeholder="All dealers"
                    onChange={(item: { value: number | "" }) => setFilterDealerId(item.value)}
                    style={{
                        borderColor: "#c7d5fa",
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: "#fff",
                    }}
                    selectedTextStyle={{ color: "#1e293b", fontSize: 14 }}
                    itemTextStyle={{ color: "#1e293b", fontSize: 14 }}
                />
            </View>
        ) : null;

    // Filter tabs for list
    const FilterTabs = () => (
        <View style={{ width: "100%", marginBottom: 12 }}>
            <View
                style={{
                    width: "100%",
                    flexDirection: "row",
                    backgroundColor: "#EFF6FF",
                    borderRadius: 12,
                    padding: 4,
                }}
            >
                {(["all", "single_digit", "double_digit", "triple_digit"] as const).map((type) => {
                    const selected = filterNumberType === type;
                    return (
                        <TouchableOpacity
                            key={type}
                            style={{
                                flex: 1,
                                paddingVertical: 10,
                                marginHorizontal: 2,
                                borderRadius: 10,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: selected ? "#3B82F6" : "transparent",
                            }}
                            onPress={() => setFilterNumberType(type)}
                            disabled={isLoading}
                        >
                            <Text
                                style={{
                                    fontSize: 14,
                                    fontWeight: "600",
                                    color: selected ? "#FFFFFF" : "#2563EB",
                                }}
                            >
                                {type === "all"
                                    ? "All"
                                    : type === "single_digit"
                                        ? "Single"
                                        : type === "double_digit"
                                            ? "Double"
                                            : "Triple"}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    const renderHeader = () => (
        <View>
            <View className="bg-white rounded-xl p-4 mb-4 shadow shadow-black/10">
                <Text className="text-base font-semibold text-blue-600 mb-1 tracking-tight">
                    Add Limit
                </Text>
                {user?.user_type === "ADMIN" && (
                    <View className="mb-3">
                        <Text className="text-xs text-blue-gray-400 font-medium mb-1 tracking-tight">
                            Dealer (optional - leave empty for global)
                        </Text>
                        <Dropdown
                            data={[{ label: "Global (all dealers)", value: null }, ...dealers.map((d) => ({ label: d.username, value: d.id }))]}
                            labelField="label"
                            valueField="value"
                            value={selectedDealerForCreate}
                            placeholder="Select dealer"
                            onChange={(item: { value: number | null }) => {
                                clearValidation();
                                setSelectedDealerForCreate(item.value);
                            }}
                            style={{
                                borderColor: errorFields.includes("dealer") ? "#DC2626" : "#c7d5fa",
                                borderWidth: 1,
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                backgroundColor: "#fff",
                            }}
                            selectedTextStyle={{ color: "#1e293b", fontSize: 14 }}
                            itemTextStyle={{ color: "#1e293b", fontSize: 14 }}
                        />
                    </View>
                )}
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
                                    style={{
                                        borderWidth: 1,
                                        borderColor: errorFields.includes("number") ? "#DC2626" : "#C7D2FE",
                                    }}
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
                                    style={{
                                        borderWidth: 1,
                                        borderColor: errorFields.includes("rangeStart") ? "#DC2626" : "#C7D2FE",
                                    }}
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
                                    style={{
                                        borderWidth: 1,
                                        borderColor: errorFields.includes("rangeEnd") ? "#DC2626" : "#C7D2FE",
                                    }}
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
                            style={{
                                borderWidth: 1,
                                borderColor: errorFields.includes("count") ? "#DC2626" : "#C7D2FE",
                            }}
                            placeholder="Count"
                            value={newCount}
                            onChangeText={onSetNewCount}
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
                {validationError && (
                    <Text className="text-red-600 text-sm font-medium mt-2">
                        {validationError}
                    </Text>
                )}
            </View>
        </View>
    );

    const renderLimitItem = useCallback(
        ({ item }: { item: LimitCount }) => (
            <LimitCountItem
                item={item}
                updateLimitMutation={updateLimitMutation}
                deleteLimitMutation={deleteLimitMutation}
                onDeletePress={handleDeletePress}
            />
        ),
        [updateLimitMutation, deleteLimitMutation, handleDeletePress]
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
                            ListHeaderComponent={
                                <View>
                                    <DealerFilter />
                                    <FilterTabs />
                                    {isFetching && (
                                        <View className="py-4 items-center">
                                            <ActivityIndicator size="small" color="#2563eb" />
                                        </View>
                                    )}
                                </View>
                            }
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

                {/* Delete confirmation modal */}
                <Modal
                    visible={deleteModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={handleDeleteCancel}
                >
                    <Pressable
                        className="flex-1 justify-center items-center bg-black/40 px-4"
                        onPress={handleDeleteCancel}
                    >
                        <Pressable
                            className="bg-white p-6 rounded-2xl w-full max-w-md shadow-lg"
                            onPress={(e) => e.stopPropagation()}
                        >
                            <View className="items-center mb-4">
                                <View className="w-12 h-12 rounded-full bg-red-100 items-center justify-center mb-3">
                                    <Text className="text-red-600 text-2xl font-bold">!</Text>
                                </View>
                                <Text className="text-xl font-bold text-red-600 text-center">
                                    Delete Limit
                                </Text>
                            </View>
                            <Text className="text-base text-gray-600 mb-6 text-center">
                                {deleteItem?.limit_type === "range"
                                    ? `Are you sure you want to delete the limit for range `
                                    : "Are you sure you want to delete the limit for number "}
                                <Text className="font-semibold text-gray-900">
                                    {deleteItem?.limit_type === "range"
                                        ? `${deleteItem?.range_start ?? ""} - ${deleteItem?.range_end ?? ""}`
                                        : deleteItem?.number ?? ""}
                                </Text>
                                ? This action cannot be undone.
                            </Text>
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={handleDeleteCancel}
                                    className="flex-1 bg-gray-100 py-3 rounded-xl items-center"
                                    activeOpacity={0.8}
                                >
                                    <Text className="text-gray-700 font-bold text-base">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleDeleteConfirm}
                                    className="flex-1 bg-red-600 py-3 rounded-xl items-center"
                                    activeOpacity={0.8}
                                    disabled={deleteLimitMutation.isPending}
                                    style={{ opacity: deleteLimitMutation.isPending ? 0.7 : 1 }}
                                >
                                    <Text className="text-white font-bold text-base">
                                        {deleteLimitMutation.isPending ? "Deleting..." : "Delete"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
};

export default LimitCountScreen;
