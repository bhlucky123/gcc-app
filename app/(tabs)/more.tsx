import { useAuthStore } from "@/store/auth";
import api from "@/utils/axios";
import { useFocusEffect } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";

// --- Types ---
type BankDetails = {
  id: number;
  user: number;
  bank_details: string;
  user_type?: string;
  name?: string;
};

type BankDetailsResponse = {
  admin_bank_details?: BankDetails;
  dealer_bank_details?: BankDetails;
  agent_bank_details?: BankDetails;
};

type myBalanceResponse = {
  balance_amount?: number;
};

interface PrizeConfig {
  single_digit_prize: number;
  double_digit_prize: number;
  box_direct: number;
  box_indirect: number;
  super_first_prize: number;
  super_second_prize: number;
  super_third_prize: number;
  super_fourth_prize: number;
  super_fifth_prize: number;
  super_complementary_prize: number;
}

export const PRIZE_CONFIG_FIELDS: { key: keyof PrizeConfig; label: string }[] = [
  { key: "single_digit_prize", label: "Single Digit Prize" },
  { key: "double_digit_prize", label: "Double Digit Prize" },
  { key: "box_direct", label: "Box Direct" },
  { key: "box_indirect", label: "Box Indirect" },
  { key: "super_first_prize", label: "Super First Prize" },
  { key: "super_second_prize", label: "Super Second Prize" },
  { key: "super_third_prize", label: "Super Third Prize" },
  { key: "super_fourth_prize", label: "Super Fourth Prize" },
  { key: "super_fifth_prize", label: "Super Fifth Prize" },
  { key: "super_complementary_prize", label: "Super Complementary Prize" },
];

// --- Reusable Components ---
export function Card({ title, children, style = {} }: { title?: string; children: React.ReactNode; style?: any }) {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 18,
        padding: 18,
        marginBottom: 18,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        width: "100%",
        ...style,
      }}
    >
      {title && (
        <Text
          style={{
            fontSize: 17,
            fontWeight: "bold",
            color: "#2563eb",
            marginBottom: 10,
            letterSpacing: 0.5,
          }}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

// --- NEW SELF-CONTAINED BANK DETAILS COMPONENT ---
const BankDetailsBlock = React.memo(
  ({
    label,
    details,
    type,
    canEdit,
    canAdd,
    refetch,
  }: {
    label: string;
    details: BankDetails | undefined | null;
    type: "admin" | "dealer" | "agent";
    canEdit: boolean;
    canAdd: boolean;
    refetch: () => void;
  }) => {
    const { user } = useAuthStore();
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(details?.bank_details || "");
    const [error, setError] = useState<string | null>(null);

    const { mutate, isPending } = useMutation({
      mutationFn: async (bank_details: string) => {
        if (!user?.id) throw new Error("No user id");
        let url = "/draw-payment/bank-details/";
        let method: "patch" | "post" = "post";
        if (details?.id) {
          url += `${details.id}/`;
          method = "patch";
        }
        const payload: any = {
          bank_details,
          user: user.id,
          user_type: type.toUpperCase(),
        };

        if (method === "patch") {
          return api.patch(url, payload);
        } else {
          return api.post(url, payload);
        }
      },
      onSuccess: () => {
        setIsEditing(false);
        setError(null);
        ToastAndroid.show("Bank details updated", ToastAndroid.SHORT);
        refetch(); // Refetch the bank details list
      },
      onError: () => setError("Failed to update bank details"),
    });

    const handleSave = () => {
      if (!inputValue.trim()) {
        setError("Bank details cannot be empty.");
        return;
      }
      setError(null);
      mutate(inputValue.trim());
    };

    const handleEditClick = () => {
      setInputValue(details?.bank_details || "");
      setIsEditing(true);
    };

    return (
      <Card title={label}>
        {!isEditing ? (
          <>
            <View style={{ minHeight: 40, marginBottom: 8 }}>
              {details?.bank_details ? (
                <Text style={{ color: "#22223b", fontSize: 16 }}>{details.bank_details}</Text>
              ) : (
                <Text style={{ color: "#9ca3af", fontSize: 15 }}>No bank details added.</Text>
              )}
            </View>
            {(canEdit && details) || (canAdd && !details) ? (
              <TouchableOpacity
                style={{
                  marginTop: 8,
                  backgroundColor: "#e0e7ef",
                  paddingVertical: 9,
                  borderRadius: 8,
                  alignItems: "center",
                }}
                onPress={handleEditClick}
              >
                <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                  {details ? "Edit" : "Add"} {label}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <>
            <TextInput
              placeholder="Enter bank details"
              value={inputValue}
              onChangeText={setInputValue}
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#cbd5e1",
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
                marginBottom: 8,
                minHeight: 60,
              }}
              multiline
              numberOfLines={3}
              autoFocus={true}
              scrollEnabled
            />
            {error && <Text style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>{error}</Text>}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: "#2563eb",
                  paddingVertical: 10,
                  paddingHorizontal: 22,
                  borderRadius: 8,
                }}
                onPress={handleSave}
                disabled={isPending}
              >
                {isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: "#f3f4f6",
                  paddingVertical: 10,
                  paddingHorizontal: 22,
                  borderRadius: 8,
                }}
                onPress={() => setIsEditing(false)}
              >
                <Text style={{ color: "#22223b", fontWeight: "bold", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Card>
    );
  }
);

// --- Admin Username/Password Update Component ---
function AdminCredentialsBlock() {
  const { user } = useAuthStore();
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async (payload: { username: string; password: string }) => {
      return api.put("/user/user-password/", payload);
    },
    onSuccess: () => {
      ToastAndroid.show("Admin credentials updated", ToastAndroid.SHORT);
      setPassword("");
      setError(null);
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Failed to update credentials"
      );
    },
  });

  const handleUpdate = () => {
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    setError(null);
    mutate({ username: username.trim(), password: password });
  };

  return (
    <View style={{
      backgroundColor: "#fff",
      borderRadius: 18,
      padding: 18,
      marginBottom: 18,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: "#e5e7eb",
      width: "100%",
      alignItems: "center",
      gap: 10,
    }}>
      <Text style={{ fontSize: 17, fontWeight: "bold", color: "#2563eb", marginBottom: 10, letterSpacing: 0.5, alignItems: 'flex-start' }}>
        Update Username & Password
      </Text>
      <TextInput
        placeholder="Username"
        placeholderTextColor="#9ca3af"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={{
          backgroundColor: "#f3f4f6",
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#cbd5e1",
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
          marginBottom: 8,
          width: "100%",
        }}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#9ca3af"
        value={password}
        onChangeText={setPassword}
        // secureTextEntry
        style={{
          backgroundColor: "#f3f4f6",
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#cbd5e1",
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
          marginBottom: 8,
          width: "100%",
          color: '#000'
        }}
      />
      {error && (
        <Text style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>{error}</Text>
      )}
      <Pressable
        style={{
          backgroundColor: "#2563eb",
          borderRadius: 8,
          paddingVertical: 12,
          alignItems: "center",
          width: "100%",
          marginTop: 4,
        }}
        android_ripple={{ color: "#1e40af" }}
        onPress={handleUpdate}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Update</Text>
        )}
      </Pressable>
    </View>
  );
}

// --- Main Screen Component ---
export default function MoreTab() {
  const { setApplicationStatus, application_status, user } = useAuthStore();

  const [localStatus, setLocalStatus] = useState<boolean | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [activeSection, setActiveSection] = useState<"bank" | "prize" | "toggle">("bank");
  const [isEditingPrizeConfig, setIsEditingPrizeConfig] = useState(false);
  const [prizeConfigForm, setPrizeConfigForm] = useState<PrizeConfig | null>(null);
  const [prizeConfigError, setPrizeConfigError] = useState<string | null>(null);

  // --- New: Per-field error state for dealer prize config ---
  const [dealerPrizeFieldErrors, setDealerPrizeFieldErrors] = useState<Partial<Record<keyof PrizeConfig, string>>>({});

  // --- Refresh state for pull-to-refresh ---
  const [refreshing, setRefreshing] = useState(false);

  const deactivateMutation = useMutation({
    mutationFn: () => api.post("/administrator/deactivate/"),
    onSuccess: () => {
      setApplicationStatus(false);
      ToastAndroid.show("Application deactivated", ToastAndroid.SHORT);
    },
    onError: () => Alert.alert("Error", "Failed to deactivate"),
    onSettled: () => {
      setStatusLoading(false);
      setLocalStatus(null);
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    }
  });

  const activateMutation = useMutation({
    mutationFn: () => api.post("/administrator/activate/"),
    onSuccess: () => {
      setApplicationStatus(true);
      ToastAndroid.show("Application activated", ToastAndroid.SHORT);
    },
    onError: (err: any) => {
      if (err?.message?.message === "Application is already active.") {
        setApplicationStatus(true);
      } else {
        Alert.alert("Error", "Failed to activate");
      }
    },
    onSettled: () => {
      setStatusLoading(false);
      setLocalStatus(null);
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    }
  });

  // --- Prize Config for ADMIN ---
  const { data: prizeConfig, isLoading: isPrizeConfigLoading, refetch: refetchPrizeConfig } = useQuery<PrizeConfig>({
    queryKey: ["/administrator/prize-configuration", user?.id],
    queryFn: async () => {
      const res = await api.get(`/administrator/prize-configuration/${user?.id}/`);
      return res.data as PrizeConfig;
    },
    enabled: user?.user_type === "ADMIN",
  });

  const { mutate: prizeConfigMutation, isPending: isPrizeConfigSaving } = useMutation({
    mutationFn: async (payload: PrizeConfig) => {
      return await api.patch(`/administrator/prize-configuration/${user?.id}/`, payload);
    },
    onSuccess: () => {
      setIsEditingPrizeConfig(false);
      setPrizeConfigError(null);
      refetchPrizeConfig();
      ToastAndroid.show("Prize configuration updated", ToastAndroid.SHORT);
    },
    onError: () => setPrizeConfigError("Failed to update prize configuration"),
  });

  // --- Prize Config for DEALER ---
  const { data: dealerPrizeConfig, isLoading: isDealerPrizeConfigLoading, refetch: refetchDealerPrizeConfig } = useQuery<PrizeConfig>({
    queryKey: ["/dealer/prize-configuration", user?.id],
    queryFn: async () => {
      const res = await api.get(`/dealer/prize-configuration/${user?.id}/`);
      return res.data as PrizeConfig;
    },
    enabled: user?.user_type === "DEALER",
  });

  const { mutate: dealerPrizeConfigMutation, isPending: isDealerPrizeConfigSaving } = useMutation({
    mutationFn: async (payload: PrizeConfig) => {
      return await api.patch(`/dealer/prize-configuration/${user?.id}/`, payload);
    },
    onSuccess: () => {
      setIsEditingPrizeConfig(false);
      setPrizeConfigError(null);
      setDealerPrizeFieldErrors({});
      refetchDealerPrizeConfig();
      ToastAndroid.show("Prize configuration updated", ToastAndroid.SHORT);
    },
    onError: (err: any) => {
      // If error is a field error dict, set per-field errors
      if (err?.message && typeof err.message === "object") {
        const fieldErrors: Partial<Record<keyof PrizeConfig, string>> = {};
        for (const key in err.message) {
          if (Object.prototype.hasOwnProperty.call(err.message, key)) {
            fieldErrors[key as keyof PrizeConfig] = err.message[key];
          }
        }
        setDealerPrizeFieldErrors(fieldErrors);
        setPrizeConfigError("Please correct the errors above.");
      } else {
        setPrizeConfigError("Failed to update prize configuration");
      }
    },
  });

  // --- Bank Details Query ---
  const {
    data: bankDetailsData,
    isLoading: isBankDetailsLoading,
    refetch: refetchBankDetails,
    isFetching: isFetchingBankDetails,
  } = useQuery<BankDetailsResponse>({
    queryKey: ["bank-details", user?.id, user?.user_type],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const res = await api.get("/draw-payment/bank-details/");
        return res.data as BankDetailsResponse;
      } catch (err) {
        return {};
      }
    },
    refetchOnMount: true,
  });

  // --- Refetch admin/dealer bank details on focus for DEALER/AGENT ---
  useFocusEffect(
    useCallback(() => {
      if (user?.user_type === "DEALER" || user?.user_type === "AGENT") {
        // Always refetch on focus for these user types
        refetchBankDetails();
      }
      // No cleanup needed
    }, [user?.user_type, refetchBankDetails])
  );

  const { data: myBalance, isLoading: ismyBalanceLoading, refetch: refetchMyBalance, isFetching: isFetchingMyBalance } = useQuery<myBalanceResponse>({
    queryKey: ["/draw-payment/get-my-pending-balance/"],
    enabled: user?.user_type === "AGENT" || user?.user_type === "DEALER",
    queryFn: async () => {
      try {
        const res = await api.get("/draw-payment/get-my-pending-balance/");
        return res.data as myBalanceResponse;
      } catch (err) {
        return { balance_amount: 0 };
      }
    },
    refetchOnMount: true,
  });

  // --- Prize Config Query Fetching State ---
  const { isFetching: isFetchingPrizeConfig } = useQuery<PrizeConfig>({
    queryKey: ["/administrator/prize-configuration", user?.id],
    queryFn: async () => {
      const res = await api.get(`/administrator/prize-configuration/${user?.id}/`);
      return res.data as PrizeConfig;
    },
    enabled: false, // Only for fetching state, not for data
  });

  // --- Dealer Prize Config Query Fetching State ---
  const { isFetching: isFetchingDealerPrizeConfig } = useQuery<PrizeConfig>({
    queryKey: ["/dealer/prize-configuration", user?.id],
    queryFn: async () => {
      const res = await api.get(`/dealer/prize-configuration/${user?.id}/`);
      return res.data as PrizeConfig;
    },
    enabled: false, // Only for fetching state, not for data
  });

  // --- Pull-to-refresh handler ---
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refetch all relevant data
    const promises: Promise<any>[] = [];
    if (user?.user_type === "ADMIN") {
      promises.push(refetchPrizeConfig());
    }
    if (user?.user_type === "DEALER") {
      promises.push(refetchDealerPrizeConfig());
    }
    promises.push(refetchBankDetails());
    if (user?.user_type === "AGENT" || user?.user_type === "DEALER") {
      promises.push(refetchMyBalance());
    }
    try {
      await Promise.all(promises);
    } catch (e) {
      // ignore
    }
    setRefreshing(false);
  }, [user?.user_type, refetchPrizeConfig, refetchDealerPrizeConfig, refetchBankDetails, refetchMyBalance]);

  const handleToggle = (value: boolean) => {
    if (statusLoading) return;
    if (application_status === value) return;
    setLocalStatus(value);
    setStatusLoading(true);
    statusTimeoutRef.current = setTimeout(() => {
      setStatusLoading(false);
      setLocalStatus(null);
    }, 10000);

    if (value) {
      activateMutation.mutate();
    } else {
      deactivateMutation.mutate();
    }
  };

  // --- UI RENDER FUNCTIONS ---
  function renderBankDetailsSection() {
    if (isBankDetailsLoading) {
      return (
        <Card title="Bank Details">
          <ActivityIndicator />
        </Card>
      );
    }
    if (user?.user_type === "ADMIN") {
      return (
        <>
          <BankDetailsBlock
            label="My Bank Details"
            type="admin"
            details={bankDetailsData?.admin_bank_details}
            canEdit
            canAdd
            refetch={refetchBankDetails}
          />
          <AdminCredentialsBlock />
        </>
      );
    }
    if (user?.user_type === "DEALER") {
      return (
        <>
          <BankDetailsBlock
            label="Admin Bank Details"
            type="admin"
            details={bankDetailsData?.admin_bank_details}
            canEdit={false}
            canAdd={false}
            refetch={refetchBankDetails}
          />
          <BankDetailsBlock
            label="My Bank Details"
            type="dealer"
            details={bankDetailsData?.dealer_bank_details}
            canEdit
            canAdd
            refetch={refetchBankDetails}
          />
        </>
      );
    }
    if (user?.user_type === "AGENT") {
      return (
        <BankDetailsBlock
          label="Dealer Bank Details"
          type="dealer"
          details={bankDetailsData?.dealer_bank_details}
          canEdit={false}
          canAdd={false}
          refetch={refetchBankDetails}
        />
      );
    }
    return null;
  }

  // --- Prize Config Section for ADMIN and DEALER ---
  function renderPrizeConfigSection() {
    // ADMIN
    if (user?.user_type === "ADMIN") {
      if (isEditingPrizeConfig && prizeConfigForm) {
        return (
          <Card title="Edit Prize Configuration" key="prize-config-edit">
            {PRIZE_CONFIG_FIELDS.map(({ key, label }) => (
             <View key={key} style={{ marginBottom: 20, paddingBottom: 2 }}>
                <Text style={{ color: "#22223b", fontSize: 15, marginBottom: 10 }}>{label}</Text>
                <TextInput
                  value={prizeConfigForm[key]?.toString() ?? ""}
                  onChangeText={(val) => {
                    setPrizeConfigForm((prev) =>
                      prev ? { ...prev, [key]: Number(val.replace(/[^0-9]/g, "")) } : prev
                    );
                  }}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: "#f3f4f6",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#cbd5e1",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 16,
                  }}
                  placeholder={`Enter ${label}`}
                  placeholderTextColor="#9ca3af"
                />
              </View>
            ))}
            {prizeConfigError && (
              <Text style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>{prizeConfigError}</Text>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: "#2563eb",
                  paddingVertical: 10,
                  paddingHorizontal: 22,
                  borderRadius: 8,
                }}
                onPress={() => {
                  if (
                    !prizeConfigForm ||
                    PRIZE_CONFIG_FIELDS.some(
                      ({ key }) =>
                        prizeConfigForm[key] === undefined ||
                        prizeConfigForm[key] === null ||
                        isNaN(Number(prizeConfigForm[key]))
                    )
                  ) {
                    setPrizeConfigError("All fields are required and must be numbers");
                    return;
                  }
                  setPrizeConfigError(null);
                  prizeConfigMutation(prizeConfigForm);
                }}
                activeOpacity={0.85}
                disabled={isPrizeConfigSaving}
              >
                {isPrizeConfigSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: "#f3f4f6",
                  paddingVertical: 10,
                  paddingHorizontal: 22,
                  borderRadius: 8,
                }}
                onPress={() => {
                  setIsEditingPrizeConfig(false);
                  setPrizeConfigError(null);
                }}
                activeOpacity={0.85}
                disabled={isPrizeConfigSaving}
              >
                <Text style={{ color: "#22223b", fontWeight: "bold", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      }
      return (
        <Card title="Prize Configuration" key="prize-config">
          {isPrizeConfigLoading ? (
            <ActivityIndicator color="#2563eb" size="small" />
          ) : prizeConfig ? (
            <>
              {PRIZE_CONFIG_FIELDS.map(({ key, label }) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#22223b", fontSize: 15 }}>{label}</Text>
                  <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                    ₹ {prizeConfig[key]?.toLocaleString("en-IN")}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={{
                  marginTop: 10,
                  backgroundColor: "#e0e7ef",
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: "center",
                }}
                onPress={() => {
                  setIsEditingPrizeConfig(true);
                  setPrizeConfigForm(prizeConfig);
                  setPrizeConfigError(null);
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                  Edit Prize Configuration
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ color: "#9ca3af", fontSize: 15 }}>No prize configuration found.</Text>
          )}
        </Card>
      );
    }

    // DEALER
    if (user?.user_type === "DEALER") {
      if (isEditingPrizeConfig && prizeConfigForm) {
        return (
          <Card title="Edit Prize Configuration" key="prize-config-edit">
            {PRIZE_CONFIG_FIELDS.map(({ key, label }) => (
              <View key={key} style={{ marginBottom: 20, paddingBottom: 2 }}>
                <Text style={{ color: "#22223b", fontSize: 15, marginBottom: 10 }}>{label}</Text>
                <TextInput
                  value={prizeConfigForm[key]?.toString() ?? ""}
                  onChangeText={(val) => {
                    // Remove non-numeric characters
                    const numericVal = val.replace(/[^0-9]/g, "");
                    setPrizeConfigForm((prev) =>
                      prev ? { ...prev, [key]: Number(numericVal) } : prev
                    );
                    // Clear error for this field on change
                    setDealerPrizeFieldErrors((prev) => {
                      const { [key]: omit, ...rest } = prev;
                      return rest;
                    });
                  }}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: "#f3f4f6",
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: "#cbd5e1",
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 16,
                  }}
                  placeholder={`Enter ${label}`}
                  placeholderTextColor="#9ca3af"
                />
                {dealerPrizeFieldErrors[key] && (
                  <Text style={{ color: "#dc2626", fontSize: 13, marginTop: 4 }}>
                    {dealerPrizeFieldErrors[key]}
                  </Text>
                )}
              </View>
            ))}
            {prizeConfigError && (
              <Text style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>{prizeConfigError}</Text>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: "#2563eb",
                  paddingVertical: 10,
                  paddingHorizontal: 22,
                  borderRadius: 8,
                }}
                onPress={() => {
                  // Validate all fields
                  if (
                    !prizeConfigForm ||
                    PRIZE_CONFIG_FIELDS.some(
                      ({ key }) =>
                        prizeConfigForm[key] === undefined ||
                        prizeConfigForm[key] === null ||
                        isNaN(Number(prizeConfigForm[key]))
                    )
                  ) {
                    setPrizeConfigError("All fields are required and must be numbers");
                    return;
                  }

                  setPrizeConfigError(null);
                  setDealerPrizeFieldErrors({}); // Clear previous errors

                  dealerPrizeConfigMutation(prizeConfigForm);
                }}
                activeOpacity={0.85}
                disabled={isDealerPrizeConfigSaving}
              >
                {isDealerPrizeConfigSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 15 }}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: "#f3f4f6",
                  paddingVertical: 10,
                  paddingHorizontal: 22,
                  borderRadius: 8,
                }}
                onPress={() => {
                  setIsEditingPrizeConfig(false);
                  setPrizeConfigError(null);
                  setDealerPrizeFieldErrors({});
                }}
                activeOpacity={0.85}
                disabled={isDealerPrizeConfigSaving}
              >
                <Text style={{ color: "#22223b", fontWeight: "bold", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Card>
        );
      }
      return (
        <Card title="Prize Configuration" key="prize-config">
          {isDealerPrizeConfigLoading ? (
            <ActivityIndicator color="#2563eb" size="small" />
          ) : dealerPrizeConfig ? (
            <>
              {PRIZE_CONFIG_FIELDS.map(({ key, label }) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: "#22223b", fontSize: 15 }}>{label}</Text>
                  <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                    ₹ {dealerPrizeConfig[key]?.toLocaleString("en-IN")}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={{
                  marginTop: 10,
                  backgroundColor: "#e0e7ef",
                  paddingVertical: 10,
                  borderRadius: 8,
                  alignItems: "center",
                  marginBottom: 20 
                }}
                onPress={() => {
                  setIsEditingPrizeConfig(true);
                  setPrizeConfigForm(dealerPrizeConfig);
                  setPrizeConfigError(null);
                  setDealerPrizeFieldErrors({});
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15,}}>
                  Edit Prize Configuration
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ color: "#9ca3af", fontSize: 15 }}>No prize configuration found.</Text>
          )}
        </Card>
      );
    }

    // AGENT or others: no prize config
    return null;
  }

  function renderMyBalanceSection() {
    if (user?.user_type === "AGENT" || user?.user_type === "DEALER") {
      return (
        <Card title="My Pending Balance" key="my-balance">
          {ismyBalanceLoading ? (
            <ActivityIndicator color="#2563eb" size="small" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: "#22223b", fontSize: 24, fontWeight: "bold" }}>
                ₹ {myBalance?.balance_amount?.toLocaleString("en-IN") ?? "0"}
              </Text>
              <TouchableOpacity
                onPress={() => refetchMyBalance()}
                style={{
                  marginLeft: 16,
                  backgroundColor: "#e0e7ef",
                  borderRadius: 8,
                  paddingVertical: 7,
                  paddingHorizontal: 18,
                  flexDirection: "row",
                  alignItems: "center",
                }}
                activeOpacity={0.8}
                disabled={isFetchingMyBalance}
              >
                {isFetchingMyBalance ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Text style={{ color: "#2563eb", fontWeight: "bold", fontSize: 15 }}>
                    Refresh
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Card>
      );
    }
    return null;
  }

  function renderAdminTabs() {
    if (user?.user_type !== "ADMIN") return null;
    const tabList = [
      { key: "bank", label: "Bank Details" },
      { key: "prize", label: "Prize Config" },
      { key: "toggle", label: "Activate" },
    ] as const;
    return (
      <View
        style={{
          flexDirection: "row",
          marginBottom: 18,
          width: "100%",
          justifyContent: "space-between",
          backgroundColor: "#f3f4f6",
          borderRadius: 12,
          padding: 4,
        }}
      >
        {tabList.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1,
              backgroundColor: activeSection === tab.key ? "#2563eb" : "transparent",
              borderRadius: 8,
              paddingVertical: 10,
              marginHorizontal: 2,
            }}
            onPress={() => setActiveSection(tab.key)}
            activeOpacity={0.85}
          >
            <Text
              style={{
                color: activeSection === tab.key ? "#fff" : "#2563eb",
                fontWeight: "bold",
                textAlign: "center",
                fontSize: 16,
                letterSpacing: 0.2,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  function renderAdminToggleSection() {
    if (user?.user_type !== "ADMIN") return null;
    const effectiveStatus = localStatus !== null ? localStatus : application_status;
    return (
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: effectiveStatus ? "#22c55e" : "#9ca3af",
              letterSpacing: 1,
            }}
          >
            {effectiveStatus ? "Active" : "Inactive"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Switch
              value={effectiveStatus}
              onValueChange={handleToggle}
              disabled={statusLoading}
              thumbColor={effectiveStatus ? "#4ade80" : "#ffffff"}
              trackColor={{ false: "#d1d5db", true: "#bbf7d0" }}
              ios_backgroundColor="#d1d5db"
              style={{
                transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }],
                marginLeft: 6,
              }}
            />
            {statusLoading && (
              <ActivityIndicator
                size="small"
                color={effectiveStatus ? "#4ade80" : "#d1d5db"}
                style={{ marginLeft: 10 }}
              />
            )}
          </View>
        </View>
      </Card>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f3f4f6" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 0, backgroundColor: "#f3f4f6" }}
        contentContainerStyle={{
          justifyContent: "flex-start",
          alignItems: "center",
          flexGrow: 1,
          paddingTop: 50,
          paddingBottom: 64, // Increased bottom padding for more space
          paddingHorizontal: 10,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2563eb"]}
            tintColor="#2563eb"
          />
        }
      >
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            alignItems: "center",
            paddingBottom: 20, // Extra bottom padding for content
          }}
        >
          {renderMyBalanceSection()}

          {user?.user_type === "ADMIN" && renderAdminTabs()}

          {user?.user_type === "ADMIN" ? (
            <>
              {activeSection === "bank" && renderBankDetailsSection()}
              {activeSection === "prize" && renderPrizeConfigSection()}
              {activeSection === "toggle" && renderAdminToggleSection()}
            </>
          ) : user?.user_type === "DEALER" ? (
            <>
              {renderBankDetailsSection()}
              {renderPrizeConfigSection()}
            </>
          ) : (
            renderBankDetailsSection()
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}