import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as FileSystem from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import { Agent } from "./(tabs)/agent";

const PAGE_SIZE = 10;

// Always use local time for today (midnight)
const getToday = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Tomorrow at midnight (start of next day)
const getTomorrow = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
};

// Format date as DD/MM/YYYY in local time
const formatDateDDMMYYYY = (date?: Date | null) => {
    if (!date) return "";
    // Use local time
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};


const formatDate = (date?: Date | null) => {
    if (!date) return "";
    // Short format: DD/MM/YY
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
};

// Helper for filename: format as YYYYMMDD
const formatDateYYYYMMDD = (date?: Date | null) => {
    if (!date) return "";
    // Use local time
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
};

// Helper to get a unique key for a bill (for FlatList)
const getBillKey = (item: any) => {
    if (item.id !== undefined && item.id !== null && item.bill_number !== undefined && item.bill_number !== null) {
        return `id_${item.id}_bill_${item.bill_number}`;
    }
    if (item.id !== undefined && item.id !== null) return `id_${item.id}`;
    if (item.bill_number !== undefined && item.bill_number !== null) return `bill_${item.bill_number}`;
    if (item.date_time) return `dt_${item.date_time}_${Math.random()}`;
    return Math.random().toString(36).slice(2);
};

// Helper to get a unique key for a booking detail (for FlatList)
const getBookingDetailKey = (d: any, parentBill: any, idx: number) => {
    if (d.id !== undefined && d.id !== null && parentBill && parentBill.id !== undefined && parentBill.id !== null) {
        return `bdid_${d.id}_pbid_${parentBill.id}`;
    }
    if (d.id !== undefined && d.id !== null) return `bdid_${d.id}`;
    if (parentBill && parentBill.bill_number !== undefined && parentBill.bill_number !== null) {
        return `bill_${parentBill.bill_number}_idx_${idx}`;
    }
    if (parentBill && parentBill.id !== undefined && parentBill.id !== null) {
        return `billid_${parentBill.id}_idx_${idx}`;
    }
    return `rand_${Math.random().toString(36).slice(2)}_${idx}`;
};

// --- NEW: Booking Type/SubType Filter Items ---
const bookingTypeSubTypeOptions = [
    { label: "Single Digit", value: "single_digit", key: "booking_details__type" },
    { label: "Double Digit", value: "double_digit", key: "booking_details__type" },
    { label: "Triple Digit", value: "triple_digit", key: "booking_details__type" },
    { label: "A", value: "A", key: "booking_details__sub_type" },
    { label: "B", value: "B", key: "booking_details__sub_type" },
    { label: "C", value: "C", key: "booking_details__sub_type" },
    { label: "AB", value: "AB", key: "booking_details__sub_type" },
    { label: "BC", value: "BC", key: "booking_details__sub_type" },
    { label: "AC", value: "AC", key: "booking_details__sub_type" },
    { label: "SUPER", value: "SUPER", key: "booking_details__sub_type" },
    { label: "BOX", value: "BOX", key: "booking_details__sub_type" },
];

const SalesReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    // Use local time for initial dates
    const [fromDate, setFromDate] = useState<Date | null>(getToday());
    const [toDate, setToDate] = useState<Date | null>(getTomorrow());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [fullView, setFullView] = useState(false);
    const [allGame, setAllGame] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState("");
    const [printing, setPrinting] = useState(false);

    // --- NEW: Booking Type/SubType Filter State ---
    const [selectedBookingTypeSubType, setSelectedBookingTypeSubType] = useState<any>(null);

    // Pagination state
    const [page, setPage] = useState(0);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const cachedAgents = queryClient.getQueryData<Agent[]>(["agents"]);
    const cachedDealers = queryClient.getQueryData<Agent[]>(["dealers"]);

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

    // Debounce search input
    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(handle);
    }, [search]);

    // Build query string for API
    const buildQuery = useCallback((offset = 0, limit = PAGE_SIZE) => {
        const params: Record<string, string> = {};

        // Always use local time for date filters, and set time to start/end of day
        if (fromDate) {
            // Format as yyyy/mm/dd
            const year = fromDate.getFullYear();
            const month = String(fromDate.getMonth() + 1).padStart(2, "0");
            const day = String(fromDate.getDate()).padStart(2, "0");
            params["date_time__gte"] = `${year}-${month}-${day}`;
        }
        if (toDate) {
            // Format as yyyy/mm/dd
            const year = toDate.getFullYear();
            const month = String(toDate.getMonth() + 1).padStart(2, "0");
            const day = String(toDate.getDate()).padStart(2, "0");
            params["date_time__lte"] = `${year}-${month}-${day}`;
        }
        // --- NEW: Add booking_details__type or booking_details__sub_type filter if selected ---
        if (selectedBookingTypeSubType && selectedBookingTypeSubType.value) {
            params[selectedBookingTypeSubType.key] = selectedBookingTypeSubType.value;
        }
        console.log("params", params);

        params["offset"] = String(offset);
        if (fullView) params["full_view"] = "true";
        if (debouncedSearch) params["search"] = debouncedSearch;
        if (selectedDraw?.id && !allGame) params["draw_session__draw__id"] = String(selectedDraw.id);

        if (user?.user_type === "ADMIN" && selectedFilter) {
            params["booked_dealer__id"] = selectedFilter;
        }
        if (user?.user_type === "DEALER" && selectedFilter) {
            params["booked_agent__id"] = selectedFilter;
        }
        params["limit"] = String(limit);

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    }, [fromDate, toDate, selectedDraw, allGame, user?.user_type, selectedFilter, fullView, debouncedSearch, selectedBookingTypeSubType]);

    const query = buildQuery();

    // Store all loaded pages' data
    const [allData, setAllData] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [totalBillCount, setTotalBillCount] = useState<number>(0);
    const [totalDealerAmount, setTotalDealerAmount] = useState<number>(0);
    const [totalAgentAmount, setTotalAgentAmount] = useState<number>(0);
    const [totalCustomerAmount, setTotalCustomerAmount] = useState<number>(0);

    // Reset pagination and data when filters change
    const resetPagination = () => {
        setPage(0);
        setAllData([]);
        setTotalCount(0);
        setTotalBillCount(0);
        setTotalDealerAmount(0);
        setTotalAgentAmount(0);
        setTotalCustomerAmount(0);
    };

    // Reset on filter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const filterDeps = [fromDate, toDate, selectedDraw?.id, allGame, user?.user_type, selectedFilter, debouncedSearch, selectedBookingTypeSubType];
    // Reset when any filter changes
    useMemo(() => {
        resetPagination();
        // eslint-disable-next-line
    }, filterDeps);

    // Fetch paginated data
    const {
        data,
        isLoading,
        error,
        refetch,
        isFetching,
    } = useQuery<any>({
        queryKey: ["/draw-booking/sales-report/", buildQuery()],
        queryFn: async () => {
            const res = await api.get(`/draw-booking/sales-report/?${buildQuery()}`);
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    console.log("data", data?.results?.data);

    // Handle query result side effects (mimic onSuccess)
    useMemo(() => {
        if (!data) return;
        if (page === 0) {
            setAllData(data.results?.data || []);
        } else {
            setAllData((prev) => {
                const prevMap = new Map<string, any>();
                prev.forEach((item: any) => {
                    prevMap.set(getBillKey(item), item);
                });
                (data.results?.data || []).forEach((item: any) => {
                    prevMap.set(getBillKey(item), item);
                });
                return Array.from(prevMap.values());
            });
        }
        setTotalCount(data.count || 0);
        setTotalBillCount(data.results?.total_bill_count ?? data.total_bill_count ?? 0);
        setTotalDealerAmount(data.results?.total_dealer_amount ?? data.total_dealer_amount ?? 0);
        setTotalAgentAmount(data.results?.total_agent_amount ?? data.total_agent_amount ?? 0);
        setTotalCustomerAmount(data.results?.total_customer_amount ?? data.total_customer_amount ?? 0);
        // eslint-disable-next-line
    }, [data]);

    const filteredResult = allData;

    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && (allData.length > 0);

    // Pagination: load more handler
    const handleLoadMore = async () => {
        if (isFetchingMore || isLoading) return;
        if ((page + 1) * PAGE_SIZE >= totalCount) return;
        setIsFetchingMore(true);
        try {
            const nextPage = page + 1;
            const res = await api.get(`/draw-booking/sales-report/?${buildQuery(nextPage * PAGE_SIZE, PAGE_SIZE)}`);
            const newData = res.data.results?.data || [];

            setAllData(prev => {
                const prevMap = new Map<string, any>();
                prev.forEach((item: any) => {
                    prevMap.set(getBillKey(item), item);
                });
                newData.forEach((item: any) => {
                    prevMap.set(getBillKey(item), item);
                });
                return Array.from(prevMap.values());
            });

            setPage(nextPage);
            setTotalCount(res.data.count || 0);
            setTotalBillCount(res.data.results?.total_bill_count ?? res.data.total_bill_count ?? totalBillCount);
            setTotalDealerAmount(res.data.results?.total_dealer_amount ?? res.data.total_dealer_amount ?? totalDealerAmount);
            setTotalAgentAmount(res.data.results?.total_agent_amount ?? res.data.total_agent_amount ?? totalAgentAmount);
            setTotalCustomerAmount(res.data.results?.total_customer_amount ?? res.data.total_customer_amount ?? totalCustomerAmount);
        } catch (err) {
            // Optionally handle error
        } finally {
            setIsFetchingMore(false);
        }
    };

    // For PDF, use same local time logic for date filters
    const printBuildQuery = useCallback(() => {
        const params: Record<string, string> = {};

        if (fromDate) {
            const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0);
            params["date_time__gte"] = d.toISOString();
        }
        if (toDate) {
            const d = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999);
            params["date_time__lte"] = d.toISOString();
        }
        params["full_view"] = "true";
        if (selectedDraw?.id) params["draw_session__draw__id"] = String(selectedDraw.id);

        if (user?.user_type === "ADMIN" && selectedFilter) {
            params["booked_dealer__id"] = selectedFilter;
        }
        if (user?.user_type === "DEALER" && selectedFilter) {
            params["booked_agent__id"] = selectedFilter;
        }
        // --- NEW: Add booking_details__type or booking_details__sub_type filter if selected ---
        if (selectedBookingTypeSubType && selectedBookingTypeSubType.value) {
            params[selectedBookingTypeSubType.key] = selectedBookingTypeSubType.value;
        }

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    }, [fromDate, toDate, selectedDraw, user?.user_type, selectedFilter, selectedBookingTypeSubType]);

    // PDF generation: use allData (all loaded pages) if no search, else filteredResult
    const generatePdf = async () => {
        setPrinting(true);
        try {
            const query = printBuildQuery();
            const res = await api.get(`/draw-booking/sales-report/?${query}`);
            let allResults = res.data.results?.data || [];
            let pdfData = allResults;

            if (!pdfData || pdfData.length === 0) {
                alert("No data available to generate PDF.");
                setPrinting(false);
                return;
            }

            const tableRows = pdfData.flatMap((bill: any) =>
                bill.booking_details ? bill.booking_details.map((detail: any) => `
                    <tr>
                        ${(user?.user_type === "ADMIN" || user?.user_type === "DEALER") ?
                        `<td>${bill?.booked_by?.username || 'N/A'
                        }</td>` : ""
                    }
                        <td>${bill.bill_number || ''}</td>
                        <td>${detail.number}</td>
                        <td>${detail.count}</td>
                        <td>${amountHandler(Number(detail.customer_amount))}</td>
                    </tr>
                `).join('') : ''
            ).join('');

            const totalAmount = res?.data?.results?.total_customer_amount || 0

            const now = new Date();
            const formattedDate = formatDateDDMMYYYY(fromDate);
            const formattedTime = now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }).toUpperCase();

            const cleanDrawName = (selectedDraw?.name || "Draw")
                .replace(/[^a-zA-Z0-9]/g, "_")
                .replace(/_+/g, "_")
                .replace(/^_+|_+$/g, "");

            const fromStr = formatDateDDMMYYYY(fromDate);
            const toStr = formatDateDDMMYYYY(toDate);

            const safePdfFileName = `SalesReport_${cleanDrawName}_${fromStr}_to_${toStr}.pdf`.replace(/[\/\\?%*:|"<>]/g, "_");

            const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; font-size: 10px; }
              .header { 
                text-align: center; 
                margin-bottom: 15px; 
                background: linear-gradient(90deg, #6D28D9 0%, #7C3AED 100%);
                padding: 18px 0 10px 0;
                border-radius: 8px 8px 0 0;
                color: #fff;
              }
              .header h1 { 
                font-size: 18px; 
                margin: 0; 
                color: #FFD700;
                letter-spacing: 1px;
                text-shadow: 1px 1px 2px #4B0082;
              }
              .header p { 
                font-size: 12px; 
                margin: 0; 
                color: #E0E7FF;
              }
              table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 10px;
                background: #F3F4F6;
                border-radius: 0 0 8px 8px;
                overflow: hidden;
              }
              th, td { 
                border: 1px solid #A78BFA; 
                padding: 5px; 
                text-align: center; 
              }
              th { 
                font-weight: bold; 
                background: #C7D2FE;
                color: #3730A3;
              }
              .footer { 
                text-align: right; 
                margin-top: 20px; 
                font-size: 12px; 
                font-weight: bold; 
                color: #6D28D9;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${selectedDraw?.name || ""}</h1>
              <p>${formattedDate}</p>
            </div>
            <table>
              <thead>
                <tr>
                  ${(user?.user_type === "ADMIN" || user?.user_type === "DEALER") ? '<th>Booked By</th>' : ''}
                  <th>Bill Number</th>
                  <th>Number</th>
                  <th>Count</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            <div class="footer">
              <p>Total Amount: ${amountHandler(Number(totalAmount))}</p>
            </div>
          </body>
        </html>
        `;

            const file = await printToFileAsync({
                html: html,
                base64: false,
                width: 595,
                height: 842,
            });

            const newPdfUri = `${FileSystem.cacheDirectory}${safePdfFileName}`;
            let finalPdfUri = file.uri;

            try {
                if (file.uri !== newPdfUri) {
                    await FileSystem.moveAsync({
                        from: file.uri,
                        to: newPdfUri,
                    });
                    finalPdfUri = newPdfUri;
                }
            } catch (moveErr: any) {
                console.log("PDF move error:", moveErr);
                alert("Could not save PDF with the desired filename. The file will be shared with a temporary name.");
            }

            await shareAsync(finalPdfUri, {
                dialogTitle: 'Share Sales Report',
                UTI: 'com.adobe.pdf',
                mimeType: 'application/pdf',
            });
        } catch (err) {
            console.log("PDF generation error:", err);
            alert("An error occurred while creating the PDF.");
        } finally {
            setPrinting(false);
        }
    };

    // Delete individual booking detail with confirmation
    const handleDeleteBookingDetail = (detail: any, parentBill: any) => {
        if (!detail?.id) return;
        Alert.alert(
            "Delete Booking Detail",
            `Are you sure you want to delete booking detail with id "${detail.id}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/draw-booking/booking-detail-manage/${detail.id}/`);
                            // Optimistically remove from local list
                            setAllData(prev => prev.map((b: any) => {
                                if ((parentBill?.bill_number && b.bill_number === parentBill.bill_number) || (parentBill?.id && b.id === parentBill.id)) {
                                    const updatedDetails = (b.booking_details || []).filter((d: any) => d.id !== detail.id);
                                    return { ...b, booking_details: updatedDetails };
                                }
                                return b;
                            }));
                            // Refresh server data to update totals
                            queryClient.invalidateQueries({ queryKey: ["/draw-booking/sales-report/"] });
                            refetch();
                        } catch (err) {
                            Alert.alert("Delete Failed", "Could not delete booking detail.");
                        }
                    }
                }
            ]
        );
    };

    // Delete a booking (entire bill) with confirmation
    const handleDeleteBooking = (booking: any) => {
        if (!booking?.bill_number) return;
        Alert.alert(
            "Delete Booking",
            `Are you sure you want to delete booking "${booking.bill_number}"? This will remove all booking details under this bill.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/draw-booking/delete/${booking.bill_number}/`);
                            // Optimistically remove from local list
                            setAllData(prev => prev.filter((b: any) => b.bill_number !== booking.bill_number));
                            // Refresh server data
                            queryClient.invalidateQueries({ queryKey: ["/draw-booking/sales-report/"] });
                            refetch();
                        } catch (err) {
                            Alert.alert("Delete Failed", "Could not delete booking.");
                        }
                    }
                }
            ]
        );
    };

    // Determine if there are more items to load
    const hasMore = (page + 1) * PAGE_SIZE < totalCount;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">
                {/* Filters */}
                <View className="gap-3">
                    <TextInput
                        placeholder="Search..."
                        value={search}
                        keyboardType="numeric"
                        onChangeText={setSearch}
                        className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:border-violet-500"
                        placeholderTextColor="#9ca3af"
                    />

                    <View>
                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">From</Text>
                                <TouchableOpacity
                                    onPress={() => setShowFromPicker(true)}
                                    className="border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                                >
                                    <Text className={fromDate ? "text-gray-900 font-medium" : "text-gray-500"}>
                                        {fromDate ? formatDateDDMMYYYY(fromDate) : "Select Date"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">To</Text>
                                <TouchableOpacity
                                    onPress={() => setShowToPicker(true)}
                                    className="border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                                >
                                    <Text className={toDate ? "text-gray-900 font-medium" : "text-gray-500"}>
                                        {toDate ? formatDateDDMMYYYY(toDate) : "Select Date"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* --- NEW: Booking Type/SubType Dropdown Filter --- */}
                    <View className="mb-2">
                        <Dropdown
                            data={bookingTypeSubTypeOptions}
                            labelField="label"
                            valueField="value"
                            value={selectedBookingTypeSubType?.value || ""}
                            onChange={item => {
                                setPage(0)
                                setSelectedBookingTypeSubType(item);
                            }}
                            placeholder="Filter by Type/SubType"
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
                                selectedBookingTypeSubType ? (
                                    <TouchableOpacity
                                        onPress={() => {
                                            setPage(0)
                                            setSelectedBookingTypeSubType(null)
                                        }}
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

                    {user?.user_type === "ADMIN" && (
                        <View className="mb-2">
                            <Dropdown
                                data={dealers.map((dealer) => ({
                                    label: dealer.username,
                                    value: dealer.id,
                                }))}
                                labelField="label"
                                valueField="value"
                                value={selectedFilter}
                                onChange={item => {
                                    setSelectedFilter(item.value)
                                }}
                                placeholder="Select Dealer"
                                style={{
                                    borderColor: "#9ca3af",
                                    borderWidth: 1,
                                    borderRadius: 6,
                                    paddingHorizontal: 8,
                                    padding: 10
                                }}
                                search
                                searchPlaceholder="Search..."
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
                                    selectedFilter ? (
                                        <TouchableOpacity
                                            onPress={() => setSelectedFilter("")}
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
                                value={selectedFilter}
                                onChange={item => {
                                    setSelectedFilter(item.value)
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
                                    selectedFilter ? (
                                        <TouchableOpacity
                                            onPress={() => setSelectedFilter("")}
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

                    <TouchableOpacity
                        onPress={generatePdf}
                        className="bg-violet-600 p-3 rounded-lg items-center"
                        disabled={printing}
                        style={printing ? { opacity: 0.7 } : undefined}
                    >
                        {printing ? (
                            <View className="flex-row items-center">
                                <ActivityIndicator size="small" color="#fff" />
                                <Text className="text-white font-bold ml-2">Printing...</Text>
                            </View>
                        ) : (
                            <Text className="text-white font-bold">Print Report</Text>
                        )}
                    </TouchableOpacity>

                    <View className="flex-row justify-between items-center   px-2">
                        <View className="flex-row items-center rounded-lg ">
                            <Text className="text-sm text-gray-700 font-medium mr-2">Full View</Text>
                            <Switch
                                value={fullView}
                                onValueChange={(val) => {
                                    if (val) {
                                        setPage(0)
                                    }
                                    setFullView(val)
                                }}
                                trackColor={{ false: "#e5e7eb", true: "#a78bfa" }}
                                thumbColor={fullView ? "#7c3aed" : "#f4f3f4"}
                                ios_backgroundColor="#e5e7eb"
                                style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                            />
                        </View>
                        <View className="flex-row items-center ">
                            <Text className="text-sm text-gray-700 font-medium mr-2">All Game</Text>
                            <Switch
                                value={allGame}
                                onValueChange={setAllGame}
                                trackColor={{ false: "#e5e7eb", true: "#a78bfa" }}
                                thumbColor={allGame ? "#7c3aed" : "#f4f3f4"}
                                ios_backgroundColor="#e5e7eb"
                                style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                            />
                        </View>
                    </View>
                </View>

                {/* --- Main Content Area --- */}
                {!selectedDraw?.id ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">
                            No draw selected. Please choose one.
                        </Text>
                    </View>
                ) : (isLoading && !isFetchingMore) ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#7c3aed" />
                        <Text className="mt-3 text-gray-600">Loading sales data...</Text>
                    </View>
                ) : error ? (
                    // Only show error if not loading
                    !isLoading && (
                        <View className="flex-1 bg-red-50 border border-red-200 px-4 py-3 rounded-lg justify-center items-center">
                            <Text className="text-red-700 font-medium">
                                Error loading report.
                            </Text>
                        </View>
                    )
                ) : (
                    <>
                        <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden mt-4">
                            <FlatList
                                data={filteredResult || []}
                                keyExtractor={getBillKey}
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
                                        <Text className="w-1 text-xs font-semibold text-right text-gray-600 uppercase"></Text>
                                    </View>
                                )}
                                renderItem={({ item, index }) => (
                                    <View className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <View className="flex-row px-4 py-3 items-center border-b border-gray-100">
                                            <View className="flex-[1.1] flex-col justify-center">
                                                <Text className="text-[10px] text-gray-800 font-medium">{formatDate(new Date(item.date_time))}</Text>
                                                <Text className="text-[9px] text-gray-500 mt-0.5">
                                                    {new Date(item.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true, })}
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
                                                            {item.booked_by?.username}
                                                        </Text>
                                                        {item?.booked_by?.user_type && (
                                                            <Text
                                                                className="text-xs text-center text-violet-700"
                                                                numberOfLines={1}
                                                                ellipsizeMode="tail"
                                                                style={{ minWidth: 0 }}
                                                            >
                                                                {item.booked_by.user_type}
                                                            </Text>
                                                        )}

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
                                                )
                                            }
                                            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_number}</Text>
                                            <Text className="flex-1 text-sm text-center text-gray-700">{item.bill_count}</Text>
                                            <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">₹{amountHandler(Number(user?.user_type === 'AGENT' ? item.agent_amount : item.dealer_amount))}</Text>
                                            <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">₹{amountHandler(Number(item.customer_amount))}</Text>
                                            {
                                                user?.superuser && (
                                                    <View className="w-4 items-end">
                                                        <TouchableOpacity onPress={() => handleDeleteBooking(item)} hitSlop={10}>
                                                            <Ionicons name="trash-outline" size={17} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )
                                            }
                                        </View>

                                        {fullView && Array.isArray(item.booking_details) && item.booking_details.length > 0 && (
                                            <FlatList
                                                data={item?.booking_details || []}
                                                keyExtractor={(d, idx) => getBookingDetailKey(d, item, idx)}
                                                renderItem={({ item: d, index: dIdx }) => (
                                                    <View className="flex-row px-4 py-2 bg-amber-50/20 border-b border-amber-100 last:border-b-0 items-center">
                                                        {
                                                            user?.user_type !== 'AGENT' &&
                                                            <Text className="flex-[1.2] text-[10px] text-center text-gray-600"></Text>
                                                        }
                                                        <Text className="flex-[1.1] text-[10px] text-gray-600">{d.sub_type} {d.number}</Text>
                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">₹{amountHandler(Number(d.amount))}</Text>

                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">{d.count}</Text>
                                                        <Text className="flex-1 text-[10px] text-right text-violet-600">₹{amountHandler(Number(user?.user_type === 'AGENT' ? d.agent_amount : d.dealer_amount))}</Text>
                                                        <Text className="flex-1 text-[10px] text-right text-emerald-600">₹{amountHandler(Number(d.customer_amount))}</Text>
                                                        {
                                                            user?.superuser && (
                                                                <View className="ms-2">
                                                                    <TouchableOpacity onPress={() => handleDeleteBookingDetail(d, item)} hitSlop={10}>
                                                                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                                    </TouchableOpacity>
                                                                </View>
                                                            )
                                                        }
                                                    </View>
                                                )}
                                                initialNumToRender={5}
                                                maxToRenderPerBatch={10}
                                                windowSize={5}
                                                removeClippedSubviews={true}
                                                scrollEnabled={false}
                                            />
                                        )}
                                    </View>
                                )}
                                ListEmptyComponent={
                                    <View className="flex-1 justify-center items-center py-16">
                                        <Text className="text-gray-500 text-base">No sales data for current filters.</Text>
                                    </View>
                                }
                                // Remove infinite scroll
                                // onEndReached={handleLoadMore}
                                // onEndReachedThreshold={0.5}

                                ListFooterComponent={
                                    <>
                                        {isFetchingMore && (
                                            <View className="py-4 items-center">
                                                <ActivityIndicator size="small" color="#7c3aed" />
                                            </View>
                                        )}
                                        {!isFetchingMore && hasMore && (
                                            <View className="py-4 items-center">
                                                <TouchableOpacity
                                                    onPress={handleLoadMore}
                                                    className="bg-violet-600 px-6 py-2 rounded-lg"
                                                    disabled={isFetchingMore}
                                                    style={isFetchingMore ? { opacity: 0.7 } : undefined}
                                                >
                                                    <Text className="text-white font-bold">Load More</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </>
                                }
                                refreshing={isFetching}
                                onRefresh={() => {
                                    setPage(0);
                                    refetch();
                                }}
                            />
                        </View>
                    </>
                )}

                {shouldShowTotalFooter && (
                    <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                        <View className="flex-row">
                            <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                {totalBillCount || 0}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                ₹{amountHandler(Number((user?.user_type === "ADMIN" || user?.user_type === "DEALER") ? totalDealerAmount?.toFixed(0) : totalAgentAmount?.toFixed(0) || 0))}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                ₹{amountHandler(Number(totalCustomerAmount?.toFixed(0) || 0))}
                            </Text>
                        </View>
                    </View>
                )}

                {showFromPicker && (
                    <DateTimePicker
                        mode="date"
                        value={fromDate || getToday()}
                        onChange={(event, date) => {
                            if (date) {
                                // Always use local time, ignore timezone offset
                                const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                setFromDate(selectedDate);
                            }
                            setShowFromPicker(false);
                        }}
                    />
                )}
                {showToPicker && (
                    <DateTimePicker
                        mode="date"
                        value={toDate || getTomorrow()}
                        onChange={(event, date) => {
                            if (date) {
                                // Always use local time, ignore timezone offset
                                const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                                setToDate(selectedDate);
                            }
                            setShowToPicker(false);
                        }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default SalesReportScreen;