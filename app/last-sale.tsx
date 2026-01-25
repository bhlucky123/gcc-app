import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { formatDateDDMMYYYY } from "@/utils/date";
import { Entypo, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Helper for today/tomorrow
const getToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
const getTommorow = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
};

// Helper to get sub type options based on number
function getSubTypeOptions(number: string) {
    if (!number) return [];
    const num = number.replace(/\D/g, "");
    if (num.length === 3) {
        return ["SUPER", "BOX"];
    } else if (num.length === 2) {
        return ["AB", "BC", "AC"];
    } else if (num.length === 1) {
        return ["A", "B", "C"];
    }
    return [];
}

// --- Optimized FlatList for FullView ---
// We will flatten the data for FlatList when fullView is enabled
function flattenData(data, fullView) {
    if (!fullView || !Array.isArray(data)) return data || [];
    // Each booking (bill) and its details become a single flat list
    // We'll use a type field to distinguish between bill and detail
    const flat = [];
    data.forEach((bill, billIdx) => {
        flat.push({ type: "bill", bill, key: `bill_${bill.bill_number ?? billIdx}` });
        if (Array.isArray(bill.booking_details)) {
            bill.booking_details.forEach((detail, detailIdx) => {
                flat.push({
                    type: "detail",
                    detail,
                    parentBill: bill,
                    key: `bill_${bill.bill_number ?? billIdx}_detail_${detail.id ?? detailIdx}`,
                });
            });
        }
    });
    return flat;
}

const LastSaleReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [fromDate, setFromDate] = useState<Date | null>(getToday());
    const [toDate, setToDate] = useState<Date | null>(getTommorow());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [fullView, setFullView] = useState(false);

    const { user } = useAuthStore();

    // For edit/delete modal
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editDetail, setEditDetail] = useState<any>(null);
    const [editLoading, setEditLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // For booking delete modal
    const [deleteBookingModalVisible, setDeleteBookingModalVisible] = useState(false);
    const [deleteBookingItem, setDeleteBookingItem] = useState<any>(null);
    const [deleteBookingLoading, setDeleteBookingLoading] = useState(false);

    // Edit form state
    const [editNumber, setEditNumber] = useState("");
    const [editCount, setEditCount] = useState("");
    const [editSubType, setEditSubType] = useState("");
    const [editErrors, setEditErrors] = useState<{ number?: string; count?: string; subType?: string; non_field?: string }>({});

    // For action menu (3-dot) per booking detail
    const [actionMenuVisible, setActionMenuVisible] = useState(false);
    const [actionMenuDetail, setActionMenuDetail] = useState<any>(null);
    const [actionMenuPosition, setActionMenuPosition] = useState<{ x: number; y: number } | null>(null);

    // Store the number length and subType options at the time of opening the edit modal
    const editNumberLengthRef = useRef<number>(0);
    const editSubTypeOptionsRef = useRef<string[]>([]);

    const queryClient = useQueryClient();
    const buildQuery = () => {
        const params: Record<string, string> = {};
        const formatDateYYYYMMDD = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };
        if (fromDate) params["date_time__gte"] = formatDateYYYYMMDD(fromDate);
        if (toDate) params["date_time__lte"] = formatDateYYYYMMDD(toDate);
        if (fullView) params["full_view"] = "true";
        if (selectedDraw?.id) params["draw_session__draw__id"] = String(selectedDraw.id);

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    };

    const { data, isLoading, isFetching, error, refetch } = useQuery({
        queryKey: ["/draw-booking/sales-report/", buildQuery()],
        queryFn: async () => {
            const res = await api.get(`/draw-booking/sales-report/?${buildQuery()}`);
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    // Open edit modal for a booking detail
    const openEditModal = (detail: any) => {
        setEditDetail(detail);
        const numberStr = detail.number?.toString() || "";
        setEditNumber(numberStr);
        setEditCount(detail.count?.toString() || "");
        setEditSubType(detail.sub_type || "");
        setEditErrors({});
        // Store the number length and subType options at the time of opening
        editNumberLengthRef.current = numberStr.length;
        editSubTypeOptionsRef.current = getSubTypeOptions(numberStr);
        setEditModalVisible(true);
    };

    // Validate number and count
    const validateEditForm = () => {
        let errors: { number?: string; count?: string; subType?: string; non_field?: string } = {};
        const number = editNumber.trim();
        const count = editCount.trim();
        const subType = editSubType.trim();

        // Number validation: must be digits, and must have the same length as when modal opened
        if (!number) {
            errors.number = "Number is required";
        } else if (!/^\d+$/.test(number)) {
            errors.number = "Number must be digits only";
        } else if (number.length !== editNumberLengthRef.current) {
            errors.number = `Number must be ${editNumberLengthRef.current} digit${editNumberLengthRef.current > 1 ? "s" : ""}`;
        }

        // Count validation: must be positive integer
        if (!count) {
            errors.count = "Count is required";
        } else if (!/^\d+$/.test(count) || parseInt(count, 10) <= 0) {
            errors.count = "Count must be a positive integer";
        } else {
            // Additional validation: if number is single digit, count must be >= 5
            if (number.length === 1 && parseInt(count, 10) < 5) {
                errors.count = "For single digit number, count must be at least 5";
            }
        }

        // SubType validation: must be one of the allowed options (from when modal opened)
        const options = editSubTypeOptionsRef.current;
        if (options.length > 0 && !options.includes(subType)) {
            errors.subType = "Select a valid sub type";
        }

        setEditErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Handle edit submit
    const handleEditSubmit = async () => {
        if (!editDetail?.id) return;
        if (!validateEditForm()) return;
        setEditLoading(true);
        try {
            await api.patch(`/draw-booking/booking-detail-manage/${editDetail.id}/`, {
                number: editNumber,
                count: Number(editCount),
                sub_type: editSubType,
            });
            setEditModalVisible(false);
            setEditDetail(null);
            setEditLoading(false);
            // Refetch sales report
            queryClient.invalidateQueries({ queryKey: ["/draw-booking/sales-report/"] });
            refetch();
        } catch (err: any) {
            setEditLoading(false);
            console.log("err", err);

            // Try to extract error messages from API response
            let errorMsg = "Could not update booking detail.";
            let newErrors: { number?: string; count?: string; subType?: string; non_field?: string } = {};

            // The error is returned directly as the error object, not under err.response.data
            // Example: { message: { non_field_errors: [...] }, status: 400 }
            const data = err?.message ? err : (typeof err === "object" ? err : null);

            if (data?.message) {
                // Handle non_field_errors
                if (data.message.non_field_errors && Array.isArray(data.message.non_field_errors) && data.message.non_field_errors.length > 0) {
                    newErrors.non_field = data.message.non_field_errors.join(" ");
                    errorMsg = data.message.non_field_errors.join(" ");
                }
                // Handle count errors
                if (data.message.count && Array.isArray(data.message.count) && data.message.count.length > 0) {
                    newErrors.count = data.message.count.join(" ");
                    errorMsg = data.message.count.join(" ");
                }
                // Handle number errors
                if (data.message.number && Array.isArray(data.message.number) && data.message.number.length > 0) {
                    newErrors.number = data.message.number.join(" ");
                    errorMsg = data.message.number.join(" ");
                }
                // Handle sub_type errors
                if (data.message.sub_type && Array.isArray(data.message.sub_type) && data.message.sub_type.length > 0) {
                    newErrors.subType = data.message.sub_type.join(" ");
                    errorMsg = data.message.sub_type.join(" ");
                }
            } else if (err?.message) {
                // Fallback for network or unexpected errors
                errorMsg = typeof err.message === "string" ? err.message : errorMsg;
            }

            setEditErrors(prev => ({ ...prev, ...newErrors }));

            // Show alert for non_field or unknown errors
            if (newErrors.non_field || (!newErrors.count && !newErrors.number && !newErrors.subType)) {
                Alert.alert("Edit Failed", errorMsg);
            }
        }
    };

    // Handle delete booking detail
    const handleDelete = async () => {
        if (!editDetail?.id) return;
        Alert.alert(
            "Delete Booking Detail",
            "Are you sure you want to delete this booking detail?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setDeleteLoading(true);
                        try {
                            await api.delete(`/draw-booking/booking-detail-manage/${editDetail.id}/`);
                            setEditModalVisible(false);
                            setEditDetail(null);
                            setDeleteLoading(false);
                            queryClient.invalidateQueries({ queryKey: ["/draw-booking/sales-report/"] });
                            refetch();
                        } catch (err: any) {
                            setDeleteLoading(false);
                            Alert.alert("Delete Failed", "Could not delete booking detail.");
                        }
                    }
                }
            ]
        );
    };

    // Handle delete booking (entire booking, not just detail)
    const handleDeleteBooking = async () => {
        if (!deleteBookingItem?.bill_number) return;
        setDeleteBookingLoading(true);
        try {
            await api.delete(`/draw-booking/delete/${deleteBookingItem.bill_number}/`);
            setDeleteBookingModalVisible(false);
            setDeleteBookingItem(null);
            setDeleteBookingLoading(false);
            queryClient.invalidateQueries({ queryKey: ["/draw-booking/sales-report/"] });
            refetch();
        } catch (err: any) {
            setDeleteBookingLoading(false);
            Alert.alert("Delete Failed", "Could not delete booking.");
        }
    };

    // Open action menu for a booking detail (3-dot)
    const openActionMenu = (detail: any, event: any) => {
        setActionMenuDetail(detail);
        setActionMenuVisible(true);
    };

    // Close action menu
    const closeActionMenu = () => {
        setActionMenuVisible(false);
        setActionMenuDetail(null);
        setActionMenuPosition(null);
    };

    // When selecting Edit from action menu
    const handleActionEdit = () => {
        if (actionMenuDetail) {
            openEditModal(actionMenuDetail);
        }
        closeActionMenu();
    };

    // When selecting Delete from action menu
    const handleActionDelete = () => {
        if (actionMenuDetail) {
            setEditDetail(actionMenuDetail);
            closeActionMenu();
            Alert.alert(
                "Delete Booking Detail",
                `Are you sure you want to delete booking "${actionMenuDetail.id}" detail?`,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                            setDeleteLoading(true);
                            try {
                                await api.delete(`/draw-booking/booking-detail-manage/${actionMenuDetail.id}/`);
                                setEditModalVisible(false);
                                setEditDetail(null);
                                setDeleteLoading(false);
                                queryClient.invalidateQueries({ queryKey: ["/draw-booking/sales-report/"] });
                                refetch();
                            } catch (err: any) {
                                setDeleteLoading(false);
                                Alert.alert("Delete Failed", "Could not delete booking detail.");
                            }
                        }
                    }
                ]
            );
        }
    };

    // Open delete booking modal
    const openDeleteBookingModal = (booking: any) => {
        setDeleteBookingItem(booking);
        setDeleteBookingModalVisible(true);
    };

    // Determine if we should show the total footer
    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && data;

    // Memoize sub type options for edit modal (should NOT change as user types, only when modal opens)
    const subTypeOptions = useMemo(() => {
        return editSubTypeOptionsRef.current;
    }, [editModalVisible]); // Only update when modal opens/closes

    // If subType is not valid for the number, reset it (only when modal opens)
    if (
        editModalVisible &&
        editSubType &&
        subTypeOptions.length > 0 &&
        !subTypeOptions.includes(editSubType)
    ) {
        setEditSubType(subTypeOptions[0]);
    }

    // --- Proper loading overlay while fetching data ---
    // Show a full-screen loading overlay when fetching data (not just initial load)
    const showLoadingOverlay = !!selectedDraw?.id && (isLoading || isFetching);

    // --- Optimized FlatList data and renderItem ---
    // Memoize the flattened data for fullView
    const flatListData = useMemo(() => {
        if (!fullView) return data?.results?.data || [];
        return flattenData(data?.results?.data, fullView);
    }, [data, fullView]);

    // Memoize renderItem for FlatList
    const renderItem = useCallback(
        ({ item, index }) => {
            // If not fullView, render as before (bill row)
            if (!fullView) {
                return (
                    <View className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <View className="flex-row ps-3 pe-2 py-3 items-center border-b border-gray-100">
                            <View className="flex-[1.1] flex-col justify-center">
                                <Text className="text-[10px] text-gray-800 font-medium">{formatDateDDMMYYYY(new Date(item.date_time))}</Text>
                                <Text className="text-[9px] text-gray-500 mt-0.5">
                                    {new Date(item.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, })}
                                </Text>
                            </View>
                            {
                                user?.user_type !== 'AGENT' && (
                                    <View className="flex-[1.2]">
                                        <Text
                                            className="flex-[1.2] text-sm text-center text-gray-700"
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                            style={{ minWidth: 0 }}
                                        >
                                            {item?.booked_by?.username}
                                        </Text>
                                        {item?.booked_by?.user_type && (
                                            <Text
                                                className="text-xs text-center text-green-600"
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                                style={{ minWidth: 0 }}
                                            >
                                                {item.booked_by.user_type}
                                            </Text>
                                        )}
                                    </View>
                                )
                            }
                            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_number}</Text>
                            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_count}</Text>
                            <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">₹{amountHandler(Number(user?.user_type === 'AGENT' ? item.agent_amount : item.dealer_amount))}</Text>
                            <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">₹{amountHandler(Number(item.customer_amount))}</Text>
                            <Text className="flex-[0.1] text-sm text-right text-emerald-700 font-semibold"></Text>
                            {/* Booking delete button */}
                            {
                                (user?.user_type !== "ADMIN" || user?.superuser) &&
                                <View className="w-4 items-end">
                                    <Pressable
                                        onPress={() => openDeleteBookingModal(item)}
                                        hitSlop={10}
                                    >
                                        <Ionicons name="trash-outline" size={17} color="#ef4444" />
                                    </Pressable>
                                </View>
                            }
                        </View>
                        {/* Show booking_details as sublist if fullView is off (legacy, but not needed) */}
                    </View>
                );
            }

            // --- fullView: render bill or detail row in a single FlatList ---
            if (item.type === "bill") {
                const bill = item.bill;
                const idx = index;
                return (
                    <View className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <View className="flex-row ps-3 pe-2 py-3 items-center border-b border-gray-100">
                            <View className="flex-[1.1] flex-col justify-center">
                                <Text className="text-[10px] text-gray-800 font-medium">{formatDateDDMMYYYY(new Date(bill.date_time))}</Text>
                                <Text className="text-[9px] text-gray-500 mt-0.5">
                                    {new Date(bill.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, })}
                                </Text>
                            </View>
                            {
                                user?.user_type !== 'AGENT' && (
                                    <View className="flex-[1.2]">
                                        <Text
                                            className="flex-[1.2] text-sm text-center text-gray-700"
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                            style={{ minWidth: 0 }}
                                        >
                                            {bill?.booked_by?.username}
                                        </Text>
                                        {bill?.booked_by?.user_type && (
                                            <Text
                                                className="text-xs text-center text-green-600"
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                                style={{ minWidth: 0 }}
                                            >
                                                {bill.booked_by.user_type}
                                            </Text>
                                        )}
                                    </View>
                                )
                            }
                            <Text className="flex-1 text-sm text-center text-gray-700">{bill.bill_number}</Text>
                            <Text className="flex-1 text-sm text-center text-gray-700">{bill.bill_count}</Text>
                            <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">₹{amountHandler(Number(user?.user_type === 'AGENT' ? bill.agent_amount : bill.dealer_amount))}</Text>
                            <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">₹{amountHandler(Number(bill.customer_amount))}</Text>
                            <Text className="flex-[0.1] text-sm text-right text-emerald-700 font-semibold"></Text>
                            {/* Booking delete button */}
                            {
                                (user?.user_type !== "ADMIN" || user?.superuser) &&
                                <View className="w-4 items-end">
                                    <Pressable
                                        onPress={() => openDeleteBookingModal(bill)}
                                        hitSlop={10}
                                    >
                                        <Ionicons name="trash-outline" size={17} color="#ef4444" />
                                    </Pressable>
                                </View>
                            }
                        </View>
                    </View>
                );
            } else if (item.type === "detail") {
                const d = item.detail;
                const parentBill = item.parentBill;
                return (
                    <View className={`flex-row ps-3 py-2 ${user?.user_type === "ADMIN" && 'pe-3'}  bg-amber-50/20 border-b border-amber-100 last:border-b-0 items-center`}>
                        {
                            user?.user_type !== 'AGENT' &&
                            <Text className="flex-[1.2] text-[10px] text-center text-gray-600"></Text>
                        }
                        <Text className="flex-[1.1] text-[10px] text-gray-600">{d.sub_type} {d.number}</Text>
                        <Text className="flex-1 text-[10px] text-center text-gray-600">₹{amountHandler(Number(d.amount))}</Text>
                        <Text className="flex-1 text-[10px] text-center text-gray-600">{d.count}</Text>
                        <Text className="flex-1 text-[10px] text-right text-violet-600">₹{amountHandler(Number(user?.user_type === 'AGENT' ? d.agent_amount : d.dealer_amount))}</Text>
                        <Text className="flex-1 text-[10px] text-right text-emerald-600">₹{amountHandler(Number(d.customer_amount))}</Text>
                        {/* 3-dot action menu */}
                        {
                            (user?.user_type !== "ADMIN" || user?.superuser) &&
                            <View className="ms-2 ">
                                <Pressable
                                    onPress={(e) => openActionMenu(d, e)}
                                >
                                    <Entypo name="dots-three-vertical" size={16} color="#7c3aed" />
                                </Pressable>
                            </View>
                        }
                    </View>
                );
            }
            return null;
        },
        [fullView, user, openDeleteBookingModal, openActionMenu, amountHandler]
    );

    // Memoize keyExtractor for FlatList
    const keyExtractor = useCallback(
        (item, index) => {
            if (fullView) {
                return item.key || index.toString();
            }
            return item?.bill_number?.toString() || index?.toString();
        },
        [fullView]
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">

                {/* --- Loading Overlay --- */}
                {showLoadingOverlay && (
                    <View
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 100,
                            backgroundColor: "rgba(255,255,255,0.7)",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                        pointerEvents="auto"
                    >
                        <ActivityIndicator size="large" color="#7c3aed" />
                        <Text className="mt-3 text-gray-600">Loading sales data...</Text>
                    </View>
                )}

                {/* --- Full View Switch --- */}
                <View className="flex-row items-center mb-3">
                    <Switch
                        value={fullView}
                        onValueChange={setFullView}
                        thumbColor={fullView ? "#7c3aed" : "#ccc"}
                        trackColor={{ false: "#d1d5db", true: "#c7d2fe" }}
                    />
                    <Text className="ml-2 text-base text-gray-700 font-medium">Full View</Text>
                </View>

                {/* --- Main Content Area --- */}
                {!selectedDraw?.id ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">
                            No draw selected. Please choose one.
                        </Text>
                    </View>
                ) : error ? (
                    <View className="flex-1 bg-red-50 border border-red-200 px-4 py-3 rounded-lg justify-center items-center">
                        <Text className="text-red-700 font-medium">
                            Error loading report.
                        </Text>
                    </View>
                ) : (
                    <>
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                            <FlatList
                                data={flatListData}
                                keyExtractor={keyExtractor}
                                ListHeaderComponent={() => (
                                    <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-4 py-3">
                                        <Text className="flex-[1.1] text-xs font-semibold text-gray-600 uppercase">Date</Text>
                                        {
                                            user?.user_type !== 'AGENT' && (
                                                <Text className="flex-[1.2] text-xs font-semibold text-center text-gray-600 uppercase">Booked</Text>)}
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Bill No.</Text>
                                        <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Cnt</Text>
                                        <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">{user?.user_type === 'AGENT' ? 'D. Amt' : 'Amt'}</Text>
                                        <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">C. Amt</Text>
                                        {/* <Text className="w-3 text-xs font-semibold text-right text-gray-600 uppercase"></Text> */}
                                        {/* Booking delete column header */}
                                        <Text className="w-1 text-xs font-semibold text-right text-gray-600 uppercase"></Text>
                                    </View>
                                )}
                                renderItem={renderItem}
                                ListEmptyComponent={
                                    <View className="flex-1 justify-center items-center py-16">
                                        <Text className="text-gray-500 text-base">
                                            No sales data for current filters.
                                        </Text>
                                    </View>
                                }
                                // --- Optimization props for large lists ---
                                initialNumToRender={fullView ? 20 : 10}
                                maxToRenderPerBatch={fullView ? 30 : 10}
                                windowSize={fullView ? 15 : 5}
                                removeClippedSubviews={true}
                                getItemLayout={fullView
                                    ? (data, index) => {
                                        // Bill row: 56, detail row: 36 (approx)
                                        // We'll estimate by type
                                        const item = data[index];
                                        const height = item?.type === "bill" ? 56 : 36;
                                        let offset = 0;
                                        for (let i = 0; i < index; i++) {
                                            offset += data[i]?.type === "bill" ? 56 : 36;
                                        }
                                        return { length: height, offset, index };
                                    }
                                    : undefined
                                }
                                // scrollEnabled always true for FlatList
                            />
                        </View>
                    </>
                )}

                {/* --- Total Footer (always at the bottom if applicable) --- */}
                {shouldShowTotalFooter && (
                    <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                        <View className="flex-row">
                            <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                {data?.results?.total_bill_count || 0}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                ₹{amountHandler(Number(data?.results?.total_dealer_amount || 0))}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                ₹{amountHandler(Number(data?.results?.total_customer_amount || 0))}
                            </Text>
                        </View>
                    </View>
                )}

                {/* --- Action Menu Modal (3-dot) --- */}
                <Modal
                    visible={actionMenuVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={closeActionMenu}
                >
                    <Pressable
                        style={{
                            flex: 1,
                            backgroundColor: "rgba(0,0,0,0.2)",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                        onPress={closeActionMenu}
                    >
                        <View
                            style={{
                                backgroundColor: "#fff",
                                borderRadius: 12,
                                minWidth: 180,
                                paddingVertical: 8,
                                elevation: 6,
                                shadowColor: "#000",
                                shadowOpacity: 0.1,
                                shadowRadius: 8,
                                shadowOffset: { width: 0, height: 2 },
                            }}
                        >
                            {
                                user?.user_type !== "ADMIN" && (
                                    <TouchableOpacity
                                        onPress={handleActionEdit}
                                        style={{
                                            flexDirection: "row",
                                            alignItems: "center",
                                            paddingVertical: 12,
                                            paddingHorizontal: 20,
                                        }}
                                    >
                                        <Ionicons name="create-outline" size={18} color="#7c3aed" style={{ marginRight: 10 }} />
                                        <Text style={{ fontSize: 16, color: "#222" }}>Edit</Text>
                                    </TouchableOpacity>
                                )
                            }
                            {
                                user?.user_type !== "ADMIN" && (
                                    <View style={{ height: 1, backgroundColor: "#eee", marginHorizontal: 10 }} />
                                )
                            }
                            <TouchableOpacity
                                onPress={handleActionDelete}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 12,
                                    paddingHorizontal: 20,
                                }}
                            >
                                <Ionicons name="trash-outline" size={18} color="#ef4444" style={{ marginRight: 10 }} />
                                <Text style={{ fontSize: 16, color: "#ef4444" }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>

                {/* --- Delete Booking Modal --- */}
                <Modal
                    visible={deleteBookingModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setDeleteBookingModalVisible(false)}
                >
                    <View className="flex-1 justify-center items-center bg-black/40 px-4">
                        <View className="bg-white p-6 rounded-2xl w-full max-w-md shadow-lg">
                            <Text className="text-xl font-bold mb-4 text-center text-red-700">
                                Delete Booking
                            </Text>
                            <Text className="text-base text-gray-700 mb-6 text-center">
                                Are you sure you want to delete booking "<Text style={{ color: "#ef4444", fontWeight: "bold" }}>{deleteBookingItem?.bill_number}</Text>" ? This will remove all booking details under this bill.
                            </Text>
                            <View className="flex-row justify-between mt-4">
                                <TouchableOpacity
                                    onPress={handleDeleteBooking}
                                    className="bg-red-600 rounded px-4 py-2 flex-1 mr-2"
                                    disabled={deleteBookingLoading}
                                    style={{ opacity: deleteBookingLoading ? 0.7 : 1 }}
                                >
                                    <Text className="text-white text-center font-bold text-base">
                                        {deleteBookingLoading ? "Deleting..." : "Delete"}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setDeleteBookingModalVisible(false)}
                                    className="bg-gray-200 rounded px-4 py-2 flex-1 ml-2"
                                    disabled={deleteBookingLoading}
                                >
                                    <Text className="text-gray-700 text-center font-bold text-base">
                                        Cancel
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* --- Edit Modal for Booking Detail --- */}
                <Modal
                    visible={editModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setEditModalVisible(false)}
                >
                    <View className="flex-1 justify-center items-center bg-black/40 px-4">
                        <View className="bg-white p-6 rounded-2xl w-full max-w-md shadow-lg">
                            <Text className="text-xl font-bold mb-4 text-center text-violet-800">
                                Edit Booking Detail
                            </Text>
                            {/* Show non-field error if present */}
                            {editErrors.non_field ? (
                                <Text className="text-xs text-red-500 mb-2 text-center">{editErrors.non_field}</Text>
                            ) : null}
                            <View className="mb-3">
                                <Text className="mb-1 font-semibold text-gray-700">Number</Text>
                                <TextInput
                                    placeholder="Number"
                                    keyboardType="numeric"
                                    value={editNumber}
                                    onChangeText={text => {
                                        // Only allow digits, but do not change subType options or number length
                                        setEditNumber(text.replace(/[^0-9]/g, ""));
                                    }}
                                    className="border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 text-base"
                                    autoFocus
                                    returnKeyType="next"
                                    placeholderTextColor="#9ca3af"
                                    maxLength={editNumberLengthRef.current || 3}
                                />
                                {editErrors.number ? (
                                    <Text className="text-xs text-red-500 mt-1">{editErrors.number}</Text>
                                ) : null}
                                {editNumber && editNumber.length !== editNumberLengthRef.current && (
                                    <Text className="text-xs text-yellow-600 mt-1">
                                        Number must be {editNumberLengthRef.current} digit{editNumberLengthRef.current > 1 ? "s" : ""}
                                    </Text>
                                )}
                            </View>
                            <View className="mb-3">
                                <Text className="mb-1 font-semibold text-gray-700">Count</Text>
                                <TextInput
                                    placeholder="Count"
                                    keyboardType="numeric"
                                    value={editCount}
                                    onChangeText={text => setEditCount(text.replace(/[^0-9]/g, ""))}
                                    className="border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 text-base"
                                    returnKeyType="next"
                                    placeholderTextColor="#9ca3af"
                                />
                                {editErrors.count ? (
                                    <Text className="text-xs text-red-500 mt-1">{editErrors.count}</Text>
                                ) : null}
                                {/* Show warning if single digit number and count < 5 */}
                                {editNumber && editNumber.length === 1 && editCount && /^\d+$/.test(editCount) && parseInt(editCount, 10) < 5 && (
                                    <Text className="text-xs text-yellow-600 mt-1">
                                        For single digit number, count must be at least 5
                                    </Text>
                                )}
                            </View>
                            <View className="mb-3">
                                <Text className="mb-1 font-semibold text-gray-700">Sub Type</Text>
                                {subTypeOptions.length > 0 ? (
                                    <View className="flex-row flex-wrap gap-2">
                                        {subTypeOptions.map(option => (
                                            <TouchableOpacity
                                                key={option}
                                                onPress={() => setEditSubType(option)}
                                                className={`px-3 py-1 rounded-lg border ${editSubType === option ? "bg-violet-700 border-violet-700" : "bg-gray-100 border-gray-300"}`}
                                                style={{ marginRight: 8, marginBottom: 8 }}
                                            >
                                                <Text className={editSubType === option ? "text-white font-semibold" : "text-gray-700 font-semibold"}>
                                                    {option}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <Text className="text-gray-400 text-sm">Enter a valid number to select sub type</Text>
                                )}
                                {editErrors.subType ? (
                                    <Text className="text-xs text-red-500 mt-1">{editErrors.subType}</Text>
                                ) : null}
                            </View>
                            <View className="flex-row justify-between mt-4">
                                <TouchableOpacity
                                    onPress={handleEditSubmit}
                                    className="bg-violet-700 rounded px-4 py-2 flex-1 mr-2"
                                    disabled={editLoading}
                                    style={{ opacity: editLoading ? 0.7 : 1 }}
                                >
                                    <Text className="text-white text-center font-bold text-base">
                                        {editLoading ? "Saving..." : "Save"}
                                    </Text>
                                </TouchableOpacity>
                                {/* The delete button is not shown here, as delete is now in the 3-dot menu */}
                            </View>
                            <TouchableOpacity
                                onPress={() => setEditModalVisible(false)}
                                className="mt-4"
                            >
                                <Text className="text-center text-gray-500 underline">Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* --- Date Pickers --- */}
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

export default LastSaleReportScreen;