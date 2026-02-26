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

// Full-width pill tab
const PillTabs = ({
    options,
    selected,
    onSelect,
    disabled,
}: {
    options: { value: string; label: string }[];
    selected: string;
    onSelect: (value: string) => void;
    disabled?: boolean;
}) => (
    <View className="flex-row gap-2">
        {options.map((opt) => {
            const active = selected === opt.value;
            return (
                <TouchableOpacity
                    key={opt.value}
                    onPress={() => onSelect(opt.value)}
                    disabled={disabled}
                    activeOpacity={0.7}
                    className={`flex-1 py-2.5 rounded-lg items-center ${active ? "bg-blue-600" : "bg-white border border-gray-200"}`}
                >
                    <Text className={`text-sm font-bold ${active ? "text-white" : "text-gray-600"}`}>
                        {opt.label}
                    </Text>
                </TouchableOpacity>
            );
        })}
    </View>
);

// Table row item
const LimitCountRow = memo(
    ({
        item,
        updateLimitMutation,
        onDeletePress,
        showDealer,
    }: {
        item: LimitCount;
        updateLimitMutation: any;
        onDeletePress: (item: LimitCount) => void;
        showDealer: boolean;
    }) => {
        const [editCount, setEditCount] = useState(item.count.toString());
        const [isEditing, setIsEditing] = useState(false);

        const displayNumber =
            item.limit_type === "range"
                ? `${item.range_start}-${item.range_end}`
                : item.number;

        const typeLabel = item.number_type
            ? { single_digit: "1D", double_digit: "2D", triple_digit: "3D" }[item.number_type]
            : "";

        return (
            <View className="flex-row items-center border-b border-gray-100 bg-white px-4 py-4"
                style={{ minHeight: 56 }}
            >
                {/* Number — takes all available space */}
                <View className="flex-1 mr-3">
                    <Text className="text-lg font-bold text-gray-900">{displayNumber}</Text>
                </View>
                {/* Type */}
                <View style={{ width: 40 }}>
                    <Text className="text-sm font-semibold text-gray-500">{typeLabel}</Text>
                </View>
                {/* Dealer */}
                {showDealer && (
                    <View className="flex-1 mr-3" style={{ minWidth: 60 }}>
                        <Text className="text-sm text-gray-500" numberOfLines={1}>
                            {item.dealer_details?.username || "—"}
                        </Text>
                    </View>
                )}
                {/* Count */}
                <View style={{ width: 65 }}>
                    {isEditing ? (
                        <TextInput
                            className="text-center text-sm font-bold bg-blue-50 rounded-lg px-2 py-2 border border-blue-200"
                            style={{ color: "#1D4ED8" }}
                            value={editCount}
                            onChangeText={setEditCount}
                            keyboardType="number-pad"
                            autoFocus
                            returnKeyType="done"
                        />
                    ) : (
                        <Text className="text-lg font-bold text-green-600 text-center">
                            {item.count}
                        </Text>
                    )}
                </View>
                {/* Actions */}
                <View style={{ width: 80 }} className="flex-row justify-end gap-2">
                    {isEditing ? (
                        <>
                            <TouchableOpacity
                                className="bg-green-500 px-3 py-2 rounded-lg"
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
                                        number_type: item?.number_type || "single_digit"
                                    });
                                    setIsEditing(false);
                                }}
                                activeOpacity={0.7}
                            >
                                <Text className="text-white font-bold text-sm">OK</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-gray-200 px-3 py-2 rounded-lg"
                                onPress={() => {
                                    setEditCount(item.count.toString());
                                    setIsEditing(false);
                                }}
                                activeOpacity={0.7}
                            >
                                <Text className="text-gray-500 font-bold text-sm">X</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                className="bg-gray-100 px-3 py-2 rounded-lg"
                                onPress={() => setIsEditing(true)}
                                activeOpacity={0.7}
                            >
                                <Text className="text-gray-700 font-semibold text-sm">Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="bg-red-50 px-2.5 py-2 rounded-lg"
                                onPress={() => onDeletePress(item)}
                                activeOpacity={0.7}
                            >
                                <Text className="text-red-500 font-bold text-base leading-none">✕</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        );
    }
);

// API path
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

    const [limitType, setLimitType] = useState<"single_number" | "range">("single_number");
    const [numberType, setNumberType] = useState<"single_digit" | "double_digit" | "triple_digit">("single_digit");
    const [filterNumberType, setFilterNumberType] = useState<"all" | "single_digit" | "double_digit" | "triple_digit">("all");
    const [filterDealerId, setFilterDealerId] = useState<number | "">("");
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
            ToastAndroid.show("Limit added.", ToastAndroid.SHORT);
        },
        onError: (err: any) => {
            setIsSubmitting(false);
            console.log("err", err);

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
            return api.patch(`/draw/limit-number-count/${payload.id}/`, {
                count: payload.count,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["/draw/limit-number-count/", selectedDraw?.id],
            });
            ToastAndroid.show("Limit updated.", ToastAndroid.SHORT);
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
            ToastAndroid.show("Limit deleted.", ToastAndroid.SHORT);
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

    const getDigitsForType = (type: "single_digit" | "double_digit" | "triple_digit") => {
        switch (type) {
            case "single_digit": return 1;
            case "double_digit": return 2;
            case "triple_digit": return 3;
            default: return 1;
        }
    };

    const onSetNewNumber = (text: string) => {
        clearValidation();
        let onlyDigits = text.replace(/\D/g, "");
        setNewNumber(onlyDigits.slice(0, getDigitsForType(numberType)));
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

        if (!newNumber?.trim() && limitType === "single_number") {
            setValidationError("Number is required.");
            setErrorFields(["number"]);
            return;
        }

        if (!newRangeStart?.trim() && limitType === "range") {
            setValidationError("Range start is required.");
            setErrorFields(["rangeStart"]);
            return;
        }

        if (!newRangeEnd?.trim() && limitType === "range") {
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

    const borderColor = (hasError: boolean) => hasError ? "#EF4444" : "#E5E7EB";

    const isAdmin = user?.user_type === "ADMIN";

    const renderHeader = () => (
        <View className="bg-white rounded-lg p-4 mb-3 border border-gray-100">
            {/* Dealer (admin only) */}
            {isAdmin && (
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
                        borderWidth: 1,
                        borderColor: borderColor(errorFields.includes("dealer")),
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: "#fff",
                        marginBottom: 10,
                    }}
                    selectedTextStyle={{ color: "#1F2937", fontSize: 14 }}
                    itemTextStyle={{ color: "#1F2937", fontSize: 14 }}
                    placeholderStyle={{ color: "#9CA3AF", fontSize: 14 }}
                />
            )}

            {/* Number type */}
            <View className="mb-3">
                <PillTabs
                    options={[
                        { value: "single_digit", label: "1 Digit" },
                        { value: "double_digit", label: "2 Digit" },
                        { value: "triple_digit", label: "3 Digit" },
                    ]}
                    selected={numberType}
                    onSelect={(v) => {
                        clearValidation();
                        setNumberType(v as any);
                        setNewNumber("");
                        setNewRangeStart("");
                        setNewRangeEnd("");
                    }}
                    disabled={isSubmitting}
                />
            </View>

            {/* Limit type */}
            <View className="mb-3">
                <PillTabs
                    options={[
                        { value: "single_number", label: "Number" },
                        { value: "range", label: "Range" },
                    ]}
                    selected={limitType}
                    onSelect={(v) => {
                        clearValidation();
                        setLimitType(v as any);
                        setNewNumber("");
                        setNewRangeStart("");
                        setNewRangeEnd("");
                    }}
                    disabled={isSubmitting}
                />
            </View>

            {/* Inputs row */}
            <View className="flex-row items-end gap-2 mb-3">
                {limitType === "single_number" ? (
                    <TextInput
                        className="flex-1 bg-white rounded-lg px-3 py-3 text-base text-gray-900"
                        style={{ borderWidth: 1, borderColor: borderColor(errorFields.includes("number")) }}
                        placeholder="Number"
                        value={newNumber}
                        onChangeText={onSetNewNumber}
                        keyboardType="number-pad"
                        editable={!isSubmitting}
                        placeholderTextColor="#9CA3AF"
                        maxLength={getDigitsForType(numberType)}
                    />
                ) : (
                    <>
                        <TextInput
                            className="flex-1 bg-white rounded-lg px-3 py-3 text-base text-gray-900"
                            style={{ borderWidth: 1, borderColor: borderColor(errorFields.includes("rangeStart")) }}
                            placeholder="Start"
                            value={newRangeStart}
                            onChangeText={onSetNewRangeStart}
                            keyboardType="number-pad"
                            editable={!isSubmitting}
                            placeholderTextColor="#9CA3AF"
                            maxLength={getDigitsForType(numberType)}
                        />
                        <TextInput
                            className="flex-1 bg-white rounded-lg px-3 py-3 text-base text-gray-900"
                            style={{ borderWidth: 1, borderColor: borderColor(errorFields.includes("rangeEnd")) }}
                            placeholder="End"
                            value={newRangeEnd}
                            onChangeText={onSetNewRangeEnd}
                            keyboardType="number-pad"
                            editable={!isSubmitting}
                            placeholderTextColor="#9CA3AF"
                            maxLength={getDigitsForType(numberType)}
                        />
                    </>
                )}
                <TextInput
                    className="bg-white rounded-lg px-3 py-3 text-base text-gray-900"
                    style={{ borderWidth: 1, borderColor: borderColor(errorFields.includes("count")), width: 80 }}
                    placeholder="Count"
                    value={newCount}
                    onChangeText={onSetNewCount}
                    keyboardType="number-pad"
                    editable={!isSubmitting}
                    placeholderTextColor="#9CA3AF"
                />
            </View>

            {/* Validation error */}
            {validationError && (
                <Text className="text-red-500 text-sm mb-2">{validationError}</Text>
            )}

            {/* Add button — full width */}
            <TouchableOpacity
                className={`bg-blue-600 rounded-lg py-3.5 items-center justify-center ${isSubmitting ? "opacity-50" : ""}`}
                onPress={handleAddLimit}
                disabled={isSubmitting}
                activeOpacity={0.8}
            >
                {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                ) : (
                    <Text className="text-white font-bold text-base">Add Limit</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    const renderLimitItem = useCallback(
        ({ item }: { item: LimitCount }) => (
            <LimitCountRow
                item={item}
                updateLimitMutation={updateLimitMutation}
                onDeletePress={handleDeletePress}
                showDealer={isAdmin}
            />
        ),
        [updateLimitMutation, handleDeletePress, isAdmin]
    );

    const TableHeader = () => (
        <View className="flex-row items-center bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
            <View className="flex-1 mr-3">
                <Text className="text-sm font-bold text-gray-500 uppercase">Number</Text>
            </View>
            <View style={{ width: 40 }}>
                <Text className="text-sm font-bold text-gray-500 uppercase">Type</Text>
            </View>
            {isAdmin && (
                <View className="flex-1 mr-3" style={{ minWidth: 60 }}>
                    <Text className="text-sm font-bold text-gray-500 uppercase">Dealer</Text>
                </View>
            )}
            <View style={{ width: 65 }}>
                <Text className="text-sm font-bold text-gray-500 uppercase text-center">Count</Text>
            </View>
            <View style={{ width: 80 }}>
                <Text className="text-sm font-bold text-gray-500 uppercase text-right">Actions</Text>
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-gray-50"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <SafeAreaView className="flex-1">
                {/* Header */}
                {/* <View className="bg-white px-5 pb-3 border-b border-gray-100"
                    style={{ paddingTop: Platform.OS === "android" ? 44 : 8 }}
                >
                    {selectedDraw && (
                        <Text className="text-xs text-gray-400 mt-0.5">
                            Draw: {selectedDraw?.name || `#${selectedDraw?.id}`}
                        </Text>
                    )}
                </View> */}

                <View className="flex-1 px-4 pt-4">
                    {isLoading ? (
                        <View className="flex-1 justify-center items-center">
                            <ActivityIndicator size="large" color="#3B82F6" />
                        </View>
                    ) : error ? (
                        <View className="flex-1 justify-center items-center">
                            <Text className="text-gray-500 text-sm">Failed to load limit counts.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={limitCounts || []}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderLimitItem}
                            ListHeaderComponent={
                                <View>
                                    {renderHeader()}

                                    {/* Filters row */}
                                    <View className="mb-3">
                                        <PillTabs
                                            options={[
                                                { value: "all", label: "All" },
                                                { value: "single_digit", label: "1 Digit" },
                                                { value: "double_digit", label: "2 Digit" },
                                                { value: "triple_digit", label: "3 Digit" },
                                            ]}
                                            selected={filterNumberType}
                                            onSelect={(v) => setFilterNumberType(v as any)}
                                            disabled={isLoading}
                                        />
                                        {isFetching && (
                                            <View className="items-center mt-2">
                                                <ActivityIndicator size="small" color="#3B82F6" />
                                            </View>
                                        )}
                                    </View>

                                    {isAdmin && (
                                        <Dropdown
                                            data={[{ label: "All dealers", value: "" }, ...dealers.map((d) => ({ label: d.username, value: d.id }))]}
                                            labelField="label"
                                            valueField="value"
                                            value={filterDealerId}
                                            placeholder="All dealers"
                                            onChange={(item: { value: number | "" }) => setFilterDealerId(item.value)}
                                            style={{
                                                borderWidth: 1,
                                                borderColor: "#E5E7EB",
                                                borderRadius: 6,
                                                paddingHorizontal: 10,
                                                paddingVertical: 6,
                                                backgroundColor: "#fff",
                                                marginBottom: 8,
                                            }}
                                            selectedTextStyle={{ color: "#1F2937", fontSize: 12 }}
                                            itemTextStyle={{ color: "#1F2937", fontSize: 12 }}
                                            placeholderStyle={{ color: "#9CA3AF", fontSize: 12 }}
                                        />
                                    )}

                                    {/* Table header */}
                                    <TableHeader />
                                </View>
                            }
                            ListEmptyComponent={
                                <View className="items-center py-8 bg-white rounded-b-lg">
                                    <Text className="text-gray-400 text-xs">No limits found.</Text>
                                </View>
                            }
                            contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        />
                    )}
                </View>

                {/* Delete modal */}
                <Modal
                    visible={deleteModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={handleDeleteCancel}
                >
                    <Pressable
                        className="flex-1 justify-center items-center bg-black/40 px-5"
                        onPress={handleDeleteCancel}
                    >
                        <Pressable
                            className="bg-white w-full rounded-2xl p-6"
                            style={{ maxWidth: 360 }}
                            onPress={(e) => e.stopPropagation()}
                        >
                            <Text className="text-lg font-bold text-gray-900 text-center mb-2">
                                Delete Limit
                            </Text>
                            <Text className="text-sm text-gray-500 text-center mb-5">
                                Delete limit for{" "}
                                <Text className="font-bold text-gray-800">
                                    {deleteItem?.limit_type === "range"
                                        ? `${deleteItem?.range_start ?? ""} - ${deleteItem?.range_end ?? ""}`
                                        : deleteItem?.number ?? ""}
                                </Text>
                                ? This cannot be undone.
                            </Text>
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={handleDeleteCancel}
                                    className="flex-1 bg-gray-100 py-3 rounded-xl items-center"
                                    activeOpacity={0.8}
                                >
                                    <Text className="text-gray-600 font-bold text-sm">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleDeleteConfirm}
                                    className="flex-1 bg-red-500 py-3 rounded-xl items-center"
                                    activeOpacity={0.8}
                                    disabled={deleteLimitMutation.isPending}
                                    style={{ opacity: deleteLimitMutation.isPending ? 0.6 : 1 }}
                                >
                                    <Text className="text-white font-bold text-sm">
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
