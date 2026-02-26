import { PrizeConfigBlock } from "@/components/prize-config";
import useAgent from "@/hooks/use-agent";
import { useAuthStore } from "@/store/auth";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ArrowLeft, Eye, EyeOff, MoveLeft } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Card, PRIZE_CONFIG_FIELDS } from "./more";

// Helper to flatten error object to field: message
function parseApiErrors(errorObj: any): Record<string, string> {
  if (!errorObj || typeof errorObj !== "object") return {};
  const result: Record<string, string> = {};
  for (const key in errorObj) {
    if (Array.isArray(errorObj[key])) {
      result[key] = errorObj[key].join(" ");
    } else if (typeof errorObj[key] === "string") {
      result[key] = errorObj[key];
    } else if (typeof errorObj[key] === "object") {
      // Nested error
      result[key] = JSON.stringify(errorObj[key]);
    }
  }
  return result;
}

// Agent type
export type Agent = {
  id: number;
  password: string;
  last_login: string | null;
  is_superuser: boolean;
  username: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  calculate_str: string;
  secret_pin: number;
  user_type: string;
  commission: number;
  single_digit_number_commission: number;
  cap_amount: number;
  assigned_dealer: number;
  created_user: number;
  groups: any[];
  user_permissions: any[];
};

// Enhanced Form component with better animations and styling
const AgentForm = ({
  onSubmit,
  defaultValues = {},
  onCancel,
  loading = false,
  prizeConfig = null,
}: {
  onSubmit: (data: any, setApiErrors: (errs: Record<string, string>) => void, setGeneralError: (msg: string) => void) => void;
  defaultValues?: Partial<Agent>;
  onCancel: () => void;
  loading?: boolean;
  prizeConfig?: any;
}) => {
  const { user } = useAuthStore()
  const [form, setForm] = useState({
    username: defaultValues.username || "",
    password: "",
    is_active: defaultValues.is_active ?? true,
    calculate_str: defaultValues.calculate_str || "",
    secret_pin: defaultValues.secret_pin?.toString() || "",
    commission: defaultValues.commission?.toString() || "",
    single_digit_number_commission:
      defaultValues.single_digit_number_commission?.toString() || "",
    cap_amount: defaultValues.cap_amount?.toString() || "",
    assigned_dealer: (
      typeof defaultValues.assigned_dealer === "number"
        ? defaultValues.assigned_dealer.toString()
        : user?.id?.toString() || ""
    ),
    is_prize_set: !!prizeConfig,
    single_digit_prize: prizeConfig?.single_digit_prize?.toString() || "",
    double_digit_prize: prizeConfig?.double_digit_prize?.toString() || "",
    box_direct: prizeConfig?.box_direct?.toString() || "",
    box_indirect: prizeConfig?.box_indirect?.toString() || "",
    super_first_prize: prizeConfig?.super_first_prize?.toString() || "",
    super_second_prize: prizeConfig?.super_second_prize?.toString() || "",
    super_third_prize: prizeConfig?.super_third_prize?.toString() || "",
    super_fourth_prize: prizeConfig?.super_fourth_prize?.toString() || "",
    super_fifth_prize: prizeConfig?.super_fifth_prize?.toString() || "",
    super_complementary_prize: prizeConfig?.super_complementary_prize?.toString() || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string>("");
  // Add state for password visibility
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setGeneralError("");
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.assigned_dealer || !form.assigned_dealer.trim()) {
      newErrors.assigned_dealer = "Dealer ID is required";
    }
    if (!form.username.trim()) newErrors.username = "Username is required";
    if (!defaultValues?.id && !form.password.trim())
      newErrors.password = "Password is required";

    if (!form.calculate_str.trim()) {
      newErrors.calculate_str = "Calculate String is required";
    } else {
      // Validate that calculate_str is a valid equation (e.g., only numbers, +, -, *, /, parentheses, spaces)
      const eq = form.calculate_str.trim();
      // Only allow numbers, operators, parentheses, and spaces
      if (!/^[\d+\-*/().\s]+$/.test(eq)) {
        newErrors.calculate_str = "Calculate String must be a valid equation (numbers and + - * / only)";
      } else {
        // Try to evaluate the equation safely
        try {
          // eslint-disable-next-line no-new-func
          // Only evaluate if it doesn't contain double operators or invalid patterns
          // (basic check, not bulletproof)
          // Disallow consecutive operators (except for minus for negative numbers)
          if (/[\+\-\*\/]{2,}/.test(eq.replace(/--/g, ""))) {
            throw new Error();
          }
          // eslint-disable-next-line no-new-func
          // Evaluate using Function constructor (safer than eval, but still not 100% safe)
          // Only for validation, not for actual calculation
          // @ts-ignore
          const result = Function(`"use strict";return (${eq})`)();
          if (typeof result !== "number" || isNaN(result)) {
            throw new Error();
          }
        } catch {
          newErrors.calculate_str = "Calculate String must be a valid equation";
        }
      }
    }
    if (
      !form?.secret_pin)
      newErrors.secret_pin = "Secret PIN is required";
    // if (
    //   form.secret_pin.length !== 4 ||
    //   !/^\d{4}$/.test(form.secret_pin.trim())
    // )
    //   newErrors.secret_pin = "Secret PIN must be 4 digits";
    if (!form?.commission)
      newErrors.commission = "Commission is required";
    if (Number(form.commission) < 0)
      newErrors.commission = "Commission cannot be negative";

    if (!form?.single_digit_number_commission)
      newErrors.single_digit_number_commission = "required";
    if (Number(form.single_digit_number_commission) < 0)
      newErrors.single_digit_number_commission = "Single digit Commission cannot be negative";


    if (!form?.cap_amount) newErrors.cap_amount = "required";
    if (Number(form?.cap_amount) < 0) newErrors.cap_amount = "Cap cannot be negative";

    if (form?.is_prize_set) {
      if (!form?.single_digit_prize)
        newErrors.single_digit_prize = "Single digit prize is required";
      if (!form?.double_digit_prize)
        newErrors.double_digit_prize = "Double digit prize is required";
      if (!form?.box_direct)
        newErrors.box_direct = "Box Direct is required";
      if (!form?.super_first_prize)
        newErrors.super_first_prize = "Super First Prize is required";
      if (!form?.super_second_prize)
        newErrors.super_second_prize = "Super Second Prize is required";
    }

    setErrors(newErrors);
    setGeneralError("");
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const preparedData: any = {
      ...form,
      secret_pin: Number(form.secret_pin),
      commission: Number(form.commission),
      single_digit_number_commission: Number(form.single_digit_number_commission),
      cap_amount: Number(form.cap_amount),
      assigned_dealer: Number(form.assigned_dealer),
    };

    // Attach prize config data separately
    if (form.is_prize_set) {
      preparedData._prizeConfig = {};
      PRIZE_CONFIG_FIELDS.forEach(({ key }) => {
        preparedData._prizeConfig[key] = Number(form[key]) || null;
      });
    }
    preparedData._isPrizeSet = form.is_prize_set;
    preparedData._hadPrizeConfig = !!prizeConfig;

    // Clean prize fields from main payload
    delete preparedData.is_prize_set;
    PRIZE_CONFIG_FIELDS.forEach(({ key }) => {
      delete preparedData[key];
    });

    // Pass setErrors and setGeneralError to onSubmit for error handling
    onSubmit(preparedData, setErrors, setGeneralError);
  };

  const inputFields = [
    { key: "username", label: "Username", keyboardType: "default" as const, secureTextEntry: false, icon: "@" },
    { key: "password", label: "Password", keyboardType: "default" as const, secureTextEntry: true, optional: !!defaultValues?.id, icon: "🔒" },
    { key: "calculate_str", label: "Calculate String", keyboardType: "default" as const, secureTextEntry: false, icon: "🧮" },
    { key: "secret_pin", label: "Secret PIN", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🔐" },
    { key: "commission", label: "Commission", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💰" },
    { key: "single_digit_number_commission", label: "Single Digit Commission", keyboardType: "numeric" as const, secureTextEntry: false, icon: "📊" },
    { key: "cap_amount", label: "Cap Amount", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🎯" },
  ];

  return (
    <View className="flex-1">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View className="bg-white shadow-sm border-b border-gray-100">
        <View className="flex-row items-center justify-between px-6 pt-12 pb-4">
          <TouchableOpacity
            onPress={onCancel}
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center active:scale-95"
            activeOpacity={0.7}
          >
            <MoveLeft />
          </TouchableOpacity>

          <Text className="text-xl font-bold text-gray-800">
            {defaultValues?.id ? "Edit Agent" : "Create Agent"}
          </Text>

          <View className="w-10" />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          className="flex-1 px-6 pt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
        >
          {generalError ? (
            <View className="mb-4">
              <Text className="text-red-600 text-base font-semibold text-center">{generalError}</Text>
            </View>
          ) : null}
          {inputFields.map(({ key, label, keyboardType, secureTextEntry, optional, icon }) => {
            const isFocused = focusedField === key;
            const hasError = !!errors[key];
            const hasValue = !!form[key as keyof typeof form];

            // Password field: add view/hide toggle
            if (key === "password") {
              return (
                <View key={key} className="mb-6">
                  <Text className="text-gray-700 font-semibold mb-2 ml-1">
                    <Text>{icon} </Text>
                    <Text>{label}</Text>
                    {!optional && <Text className="text-red-500"> *</Text>}
                  </Text>
                  <View className={`relative ${hasError ? 'mb-1' : ''}`}>
                    <TextInput
                      placeholder={optional ? `${label} (optional)` : `Enter ${label.toLowerCase()}`}
                      className={`
                        border-2 rounded-xl px-4 py-4 bg-white text-gray-800 font-medium
                        ${hasError
                          ? 'border-red-300 bg-red-50'
                          : isFocused
                            ? 'border-blue-400 bg-blue-50'
                            : hasValue
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-200'
                        }
                        shadow-sm
                      `}
                      value={typeof form[key as keyof typeof form] === "boolean"
                        ? form[key as keyof typeof form]
                          ? "true"
                          : "false"
                        : (form[key as keyof typeof form] as string | undefined)
                      }
                      onChangeText={(text) => handleChange(key, text)}
                      onFocus={() => setFocusedField(key)}
                      onBlur={() => setFocusedField(null)}
                      keyboardType={keyboardType}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      placeholderTextColor="#9CA3AF"
                    />
                    {/* Password view/hide toggle */}
                    <TouchableOpacity
                      onPress={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-100 rounded-full border border-gray-200"
                      style={{
                        zIndex: 10,
                        // The className above handles most styling, but fallback for platforms:
                        ...(Platform.OS === "web"
                          ? { boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }
                          : {}),
                      }}
                      // hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      {showPassword ? (
                        <Eye color="#6b7280" size={20} />
                      ) : (
                        <EyeOff color="#6b7280" size={20} />
                      )}
                    </TouchableOpacity>
                  </View>
                  {hasError && (
                    <Text className="text-red-500 text-sm mt-1 ml-1 font-medium">
                      {errors[key]}
                    </Text>
                  )}
                </View>
              );
            }

            // All other fields
            return (
              <View key={key} className="mb-6">
                <Text className="text-gray-700 font-semibold mb-2 ml-1">
                  <Text>{icon} </Text>
                  <Text>{label}</Text>
                  {!optional && <Text className="text-red-500"> *</Text>}
                </Text>

                <View className={`relative ${hasError ? 'mb-1' : ''}`}>
                  <TextInput
                    placeholder={optional ? `${label} (optional)` : `Enter ${label.toLowerCase()}`}
                    className={`
                      border-2 rounded-xl px-4 py-4 bg-white text-gray-800 font-medium
                      ${hasError
                        ? 'border-red-300 bg-red-50'
                        : isFocused
                          ? 'border-blue-400 bg-blue-50'
                          : hasValue
                            ? 'border-green-300 bg-green-50'
                            : 'border-gray-200'
                      }
                      shadow-sm
                    `}
                    value={
                      typeof form[key as keyof typeof form] === "boolean"
                        ? form[key as keyof typeof form]
                          ? "true"
                          : "false"
                        : (form[key as keyof typeof form] as string | undefined)
                    }
                    onChangeText={(text) => handleChange(key, text)}
                    onFocus={() => setFocusedField(key)}
                    onBlur={() => setFocusedField(null)}
                    keyboardType={key.includes("commission") || key === "cap_amount" || key === "secret_pin" ? "numeric" : keyboardType}
                    secureTextEntry={secureTextEntry}
                    maxLength={key === "secret_pin" ? 4 : undefined}
                    autoCapitalize={key === "username" ? "none" : "sentences"}
                    placeholderTextColor="#9CA3AF"
                  />

                  {/* Success indicator */}
                  {hasValue && !hasError && !isFocused && key !== "password" && (
                    <View className="absolute right-4 top-1/2 -mt-2">
                      <Text className="text-green-500 text-lg">✓</Text>
                    </View>
                  )}
                </View>

                {hasError && (
                  <Text className="text-red-500 text-sm mt-1 ml-1 font-medium">
                    {errors[key]}
                  </Text>
                )}
              </View>
            );
          })}
          {/* Status Toggle */}
          <View className="mb-8">
            <Text className="text-gray-700 font-semibold mb-3 ml-1">
              <Text>🔄</Text>
              <Text> Account Status</Text>
            </Text>
            <TouchableOpacity
              onPress={() => handleChange('is_active', !form.is_active)}
              className={`
                flex-row items-center justify-between p-4 rounded-xl border-2
                ${form.is_active
                  ? 'bg-green-50 border-green-300'
                  : 'bg-gray-50 border-gray-300'
                }
              `}
              activeOpacity={0.8}
            >
              <Text className="text-gray-700 font-medium">Active Account</Text>
              <View className={`
                w-12 h-6 rounded-full p-1
                ${form.is_active ? 'bg-green-500' : 'bg-gray-400'}
              `}>
                <View className={`
                  w-4 h-4 bg-white rounded-full transition-all duration-200
                  ${form.is_active ? 'ml-6' : 'ml-0'}
                `} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Prize Config Toggle */}
          <Card>
            <View>
              <TouchableOpacity
                onPress={() => {
                  handleChange('is_prize_set', !form.is_prize_set);
                }}
                className={`
                  flex-row items-center justify-between p-4 rounded-xl border-2
                  ${form.is_prize_set
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-300'
                  }
                `}
                activeOpacity={0.8}
              >
                <Text className="text-gray-700 font-medium">Prize Config</Text>
                <View className={`
                  w-12 h-6 rounded-full p-1
                  ${form.is_prize_set ? 'bg-green-500' : 'bg-gray-400'}
                `}>
                  <View className={`
                    w-4 h-4 bg-white rounded-full transition-all duration-200
                    ${form.is_prize_set ? 'ml-6' : 'ml-0'}
                  `} />
                </View>
              </TouchableOpacity>
            </View>
            {form.is_prize_set && (
              <PrizeConfigBlock
                form={form}
                errors={errors}
                onChange={(data) => {
                  if (data && Object.keys(data).length > 0) {
                    setErrors({});
                  }
                  setForm((prev) => ({ ...prev, ...data } as any));
                }}
              />
            )}
          </Card>

          <View className="pb-20 my-12 mb-12">
            {/* Added padding-bottom for the submit button */}
            <TouchableOpacity
              className={`bg-blue-600 py-4 rounded-xl shadow-lg active:scale-95 ${loading ? 'opacity-60' : ''}`}
              onPress={handleSubmit}
              activeOpacity={0.9}
              disabled={loading}
            >
              <Text className="text-white text-center font-bold text-lg">
                {loading
                  ? (defaultValues?.id ? "Updating..." : "Creating...")
                  : (defaultValues?.id ? "Update Agent" : "Create Agent")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// Enhanced Agent Card Component
const AgentCard = ({
  item,
  onEdit,
  onDelete,
}: {
  item: Agent;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const { user } = useAuthStore()
  return (
    <View className="bg-white mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden">
      {/* Status bar */}
      <View className={`h-1 ${item.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />

      <View className="p-5">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <View
              className={`w-11 h-11 rounded-full justify-center items-center mr-3 ${item.is_active ? 'bg-green-100' : 'bg-gray-100'
                }`}
            >
              <Text className="text-xl">👤</Text>
            </View>

            <View>
              <Text className="text-lg font-semibold text-gray-800">{item.username}</Text>
              <Text
                className={`text-xs font-medium ${item.is_active ? 'text-green-600' : 'text-gray-500'
                  }`}
              >
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            {
              (user?.user_type === "DEALER") && <TouchableOpacity
                onPress={onEdit}
                className="px-3 py-1.5 bg-gray-100 rounded-md"
                activeOpacity={0.8}
              >
                <Text className="text-gray-800 text-sm">Edit</Text>
              </TouchableOpacity>
            }
            {
              (user?.user_type === "DEALER") &&
              <TouchableOpacity
                onPress={onDelete}
                className="px-3 py-1.5 bg-red-100 rounded-md"
                activeOpacity={0.8}
              >
                <Text className="text-red-600 text-sm">Delete</Text>
              </TouchableOpacity>
            }
          </View>
        </View>

        {/* Info grid */}
        <View className="flex-row justify-between items-center">
          {[
            {
              label: 'Commission',
              value: item.commission != null
                ? `₹${Number(item.commission) >= 100000 ? Number(item.commission).toLocaleString() : item.commission}`
                : '₹0',
              icon: '💰',
              bg: 'bg-green-50',
              iconBg: 'bg-green-200',
              iconColor: 'text-green-600',
            },
            {
              label: 'Cap Amount',
              value: item?.cap_amount != null
                ? `₹${amountHandler(Number(item.cap_amount))}`
                : '₹0',
              icon: '🎯',
              bg: 'bg-blue-50',
              iconBg: 'bg-blue-200',
              iconColor: 'text-blue-600',
            },
            {
              label: 'Single Digit',
              value: item.single_digit_number_commission != null
                ? `₹${Number(item.single_digit_number_commission) >= 100000 ? Number(item.single_digit_number_commission).toLocaleString() : item.single_digit_number_commission}`
                : '₹0',
              icon: '📊',
              bg: 'bg-yellow-50',
              iconBg: 'bg-yellow-200',
              iconColor: 'text-yellow-600',
            },
          ].map(({ label, value, icon, bg, iconBg, iconColor }, index) => (
            <View
              key={index}
              className={`flex-row items-center ${bg} rounded-lg px-2 py-1 mx-1`}
              style={{ minWidth: 0, flexShrink: 1 }}
            >
              {/* <View className={`w-6 h-6 rounded-full ${iconBg} items-center justify-center mr-1`}>
                <Text className={`text-base ${iconColor}`}>{icon}</Text>
              </View> */}
              <View style={{ minWidth: 0 }}>
                <Text className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">
                  {label}
                </Text>
                <Text className="text-xs font-bold text-gray-900" numberOfLines={1} ellipsizeMode="tail">
                  {value}
                </Text>
              </View>
            </View>
          ))}
        </View>


      </View>
    </View>
  );
};


// Main Agent Tab with enhanced UI
export default function AgentTab({ id }: { id?: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editData, setEditData] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string>("");
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const {
    data: agents = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Agent[]>({
    queryKey: ["agents", id],
    queryFn: async () => {
      try {
        let url = "/agent/manage/";
        if (id) {
          url += `?assigned_dealer__id=${encodeURIComponent(id)}`;
        }
        const res = await api.get(url);
        return res.data;
      } catch (err: any) {
        // Try to extract error message
        let msg = "An unexpected error occurred. Please try again.";
        if (err?.response?.data) {
          if (typeof err.response.data === "string") {
            msg = err.response.data;
          } else if (typeof err.response.data === "object") {
            // Try to join all error messages
            const parsed = parseApiErrors(err.response.data);
            msg = Object.values(parsed).join(" ") || msg;
          }
        } else if (err?.message) {
          msg = err.message;
        }
        setListError(msg);
        throw err;
      }
    }
  });

  const { createAgent, editAgent, deleteAgent, saveAgentPrizeConfig, updateAgentPrizeConfig } = useAgent();
  const [editPrizeConfig, setEditPrizeConfig] = useState<any>(null);
  const [loadingPrizeConfig, setLoadingPrizeConfig] = useState(false);

  // Filter agents based on search
  const filteredAgents = agents.filter(agent => {
    const query = searchQuery.toLowerCase();

    // Check username
    if (agent.username && agent.username.toLowerCase().includes(query)) {
      return true;
    }

    // Check commission
    if (
      typeof agent.commission === "number" &&
      agent.commission.toString().toLowerCase().includes(query)
    ) {
      return true;
    }

    // Check single_digit_number_commission
    if (
      typeof agent.single_digit_number_commission === "number" &&
      agent.single_digit_number_commission.toString().toLowerCase().includes(query)
    ) {
      return true;
    }

    // Check cap_amount
    if (
      typeof agent.cap_amount === "number" &&
      agent.cap_amount.toString().toLowerCase().includes(query)
    ) {
      return true;
    }

    return false;
  });

  // Enhanced handleCreate and handleEdit to handle API errors
  const handleCreate = (data: any, setApiErrors: (errs: Record<string, string>) => void, setGeneralError: (msg: string) => void) => {
    const { _prizeConfig, _isPrizeSet, _hadPrizeConfig, ...agentData } = data;
    setLoading(true)
    createAgent(agentData, {
      onSuccess: (newAgent: any) => {
        if (_isPrizeSet && _prizeConfig) {
          saveAgentPrizeConfig(
            { agent: newAgent.id, ..._prizeConfig },
            {
              onSuccess: () => {
                setShowForm(false);
                refetch();
                setLoading(false);
              },
              onError: (err: any) => {
                setLoading(false);
                // Stay on form and show prize config errors
                let errorData = err?.response?.data ?? err?.message ?? err;
                if (errorData && typeof errorData === "object" && "message" in errorData) {
                  errorData = errorData.message;
                }
                if (errorData && typeof errorData === "object") {
                  const apiErrors = parseApiErrors(errorData);
                  setApiErrors(apiErrors);
                  setGeneralError("Agent created but prize config has errors. Please fix and update.");
                } else {
                  setGeneralError("Agent created but prize config failed to save.");
                }
                // Refetch so the new agent shows up, but keep form open for prize fix
                refetch();
              },
            }
          );
        } else {
          setShowForm(false);
          refetch();
          setLoading(false);
        }
      },
      onError: (err: any) => {
        setLoading(false);
        let errorData = err?.response?.data ?? err?.message ?? err;

        if (Array.isArray(errorData) && errorData.length) {
          setGeneralError(errorData[0]?.toString());
          return;
        }

        // Special handling for error shape: { message: [ ... ], status: 400 }
        if (
          errorData &&
          typeof errorData === "object" &&
          Array.isArray(errorData.message) &&
          errorData.status === 400
        ) {
          setGeneralError(errorData.message.join(" "));
          return;
        }

        // If errorData is an object with a "message" key, use that as the error object
        if (errorData && typeof errorData === "object" && "message" in errorData) {
          if (Array.isArray(errorData.message)) {
            setGeneralError(errorData.message.join(" "));
            return;
          } else if (typeof errorData.message === "string") {
            setGeneralError(errorData.message);
            return;
          }
          errorData = errorData.message;
        }

        if (errorData && typeof errorData === "object") {
          // Parse all field errors (the field name can change)
          const apiErrors = parseApiErrors(errorData);
          setApiErrors(apiErrors);

          // Handle non_field_errors or general error messages
          if (errorData.non_field_errors) {
            setGeneralError(
              Array.isArray(errorData.non_field_errors)
                ? errorData.non_field_errors.join(" ")
                : String(errorData.non_field_errors)
            );
          }
        } else if (typeof errorData === "string") {
          setGeneralError(errorData);
        } else {
          setGeneralError("An unexpected error occurred. Please try again.");
        }
      }
    });
  };

  const handleEdit = (data: any, setApiErrors: (errs: Record<string, string>) => void, setGeneralError: (msg: string) => void) => {
    const { _prizeConfig, _isPrizeSet, _hadPrizeConfig, ...restData } = data;

    if (!restData?.password) {
      delete restData.password
    }

    setLoading(true)

    // Fix: If assigned_dealer is an object, extract its id
    let assigned_dealer = restData.assigned_dealer;
    if (assigned_dealer && typeof assigned_dealer === "object" && "id" in assigned_dealer) {
      assigned_dealer = assigned_dealer.id;
    }
    // Ensure assigned_dealer is a number
    assigned_dealer = Number(assigned_dealer);

    editAgent(
      { ...restData, id: editData?.id, assigned_dealer },
      {
        onSuccess: () => {
          if (_isPrizeSet && _prizeConfig) {
            const savePrizeFn = _hadPrizeConfig ? updateAgentPrizeConfig : saveAgentPrizeConfig;
            const prizePayload = _hadPrizeConfig
              ? { agentId: editData?.id, ..._prizeConfig }
              : { agent: editData?.id, ..._prizeConfig };
            savePrizeFn(prizePayload, {
              onSuccess: () => {
                setShowForm(false);
                refetch();
                setEditData(null);
                setEditPrizeConfig(null);
                setLoading(false);
              },
              onError: (err: any) => {
                setLoading(false);
                // Stay on form and show prize config errors
                let errorData = err?.response?.data ?? err?.message ?? err;
                if (errorData && typeof errorData === "object" && "message" in errorData) {
                  errorData = errorData.message;
                }
                if (errorData && typeof errorData === "object") {
                  const apiErrors = parseApiErrors(errorData);
                  setApiErrors(apiErrors);
                  setGeneralError("Agent updated but prize config has errors. Please fix and save again.");
                } else {
                  setGeneralError("Agent updated but prize config failed to save.");
                }
              },
            });
          } else {
            setShowForm(false);
            refetch();
            setEditData(null);
            setEditPrizeConfig(null);
            setLoading(false);
          }
        },
        onError: (err: any) => {
          setLoading(false);
          // Handle error response for agent edit — stay on form
          let errorData = err?.response?.data ?? err?.message ?? err;
          // If errorData is an object with a "message" key, use that as the error object
          if (errorData && typeof errorData === "object" && "message" in errorData) {
            errorData = errorData.message;
          }

          // Check if errorData is an HTML page (string containing <html or <!DOCTYPE)
          if (
            typeof errorData === "string" &&
            (errorData.includes("<html") || errorData.includes("<!DOCTYPE"))
          ) {
            setGeneralError("Something went wrong. Please try again.");
            return;
          }

          if (errorData && typeof errorData === "object") {
            const apiErrors = parseApiErrors(errorData);
            setApiErrors(apiErrors);

            // Handle non_field_errors or general error messages
            if (errorData.non_field_errors) {
              setGeneralError(
                Array.isArray(errorData.non_field_errors)
                  ? errorData.non_field_errors.join(" ")
                  : String(errorData.non_field_errors)
              );
            } else if (typeof errorData.detail === "string") {
              setGeneralError(errorData.detail);
            }
          } else if (typeof errorData === "string") {
            setGeneralError(errorData);
          } else {
            setGeneralError("An unexpected error occurred. Please try again.");
          }
        }
      }
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Agent",
      "This action cannot be undone. Are you sure you want to delete this agent?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: () => {
            deleteAgent(
              { id },
              {
                onSuccess: () => {
                  refetch()
                },
                onError: (err: any) => {
                  let msg = "Failed to delete agent.";
                  if (err?.response?.data) {
                    if (typeof err.response.data === "string") {
                      msg = err.response.data;
                    } else if (typeof err.response.data === "object") {
                      const parsed = parseApiErrors(err.response.data);
                      msg = Object.values(parsed).join(" ") || msg;
                    }
                  } else if (err?.message) {
                    msg = err.message;
                  }
                  Alert.alert("Error", msg);
                }
              }
            );
          },
          style: "destructive",
        },
      ]
    );
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    setListError("");
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (loadingPrizeConfig) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-500 mt-4 font-medium">Loading...</Text>
      </View>
    );
  }

  if (showForm) {
    return (
      <AgentForm
        onSubmit={editData ? handleEdit : handleCreate}
        defaultValues={editData || {}}
        loading={loading}
        prizeConfig={editPrizeConfig}
        onCancel={() => {
          setShowForm(false);
          setEditData(null);
          setEditPrizeConfig(null);
        }}
      />
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View className="bg-white border-b border-gray-200 shadow-sm">
        <View className="px-6 pt-10 pb-6">
          <View className="flex-row justify-between items-center  mb-4" >
            {/* Title */}
            <View className="flex-row gap-2 items-center">
              {
                id &&
                <TouchableOpacity onPress={() => {
                  router.back();
                }}>
                  <ArrowLeft />
                </TouchableOpacity>
              }
              <Text className="text-2xl font-bold text-gray-800">
                Agent Management
              </Text>
            </View>
            {
              (user?.user_type === "DEALER") && <TouchableOpacity
                onPress={() => {
                  setEditData(null);
                  setEditPrizeConfig(null);
                  setShowForm(true);
                }}
                className="w-16 h-16 bg-blue-600 rounded-full shadow-xl items-center justify-center active:scale-95"
                activeOpacity={0.9}
              >
                <Text className="text-white text-2xl font-light">+</Text>
              </TouchableOpacity>}
          </View>

          {/* Search Bar */}
          <View className="relative">
            <TextInput
              placeholder="Search agents..."
              className="bg-gray-100 rounded-lg px-4 py-3 pr-10 text-gray-800"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
            <View className="absolute right-3 top-1/2 -mt-3">
              <Text className="text-gray-400 text-base">🔍</Text>
            </View>
          </View>

          {/* Stats */}
          <View className="flex-row justify-between mt-5">
            {[
              {
                label: 'Total',
                count: agents.length,
                bg: 'bg-gray-50',
                text: 'text-gray-700',
              },
              {
                label: 'Active',
                count: agents.filter(a => a.is_active).length,
                bg: 'bg-green-50',
                text: 'text-green-700',
              },
              {
                label: 'Inactive',
                count: agents.filter(a => !a.is_active).length,
                bg: 'bg-red-50',
                text: 'text-red-700',
              },
            ].map((stat, index) => (
              <View
                key={index}
                className={`flex-1 mx-1 px-4 py-2 rounded-lg ${stat.bg}`}
              >
                <Text className={`text-sm font-medium ${stat.text}`}>{stat.label}</Text>
                <Text className={`text-xl font-bold ${stat.text}`}>{stat.count}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Content */}
      {isLoading || isFetching ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-500 mt-4 font-medium">Loading agents...</Text>
        </View>
      ) : isError || !!listError ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text className="text-6xl mb-4">⚠️</Text>
          <Text className="text-xl font-bold text-gray-800 mb-2">
            Failed to load agents
          </Text>
          <Text className="text-red-600 text-center mb-8">
            {listError ||
              (error && typeof error === "object" && "message" in error
                ? (error as any).message
                : "An unexpected error occurred. Please try again.")}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setListError("");
              refetch();
            }}
            className="bg-blue-600 px-8 py-4 rounded-xl active:scale-95"
            activeOpacity={0.9}
          >
            <Text className="text-white font-bold text-lg">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredAgents.length === 0 ? (
        <View className="flex-1 justify-center items-center px-8">
          <Text className="text-6xl mb-4">👥</Text>
          <Text className="text-xl font-bold text-gray-800 mb-2">
            {searchQuery ? 'No agents found' : 'No agents yet'}
          </Text>
          {user?.user_type === "DEALER" &&
            <View>
              <Text className="text-gray-500 text-center mb-8">
                {searchQuery
                  ? `No agents match "${searchQuery}"`
                  : 'Get started by creating your first agent'
                }
              </Text>
              {!searchQuery && (
                <TouchableOpacity
                  onPress={() => setShowForm(true)}
                  className="bg-blue-600 px-8 py-4 rounded-xl w-fit active:scale-95"
                  activeOpacity={0.9}
                >
                  <Text className="text-white font-bold text-lg w-fit text-center">Create First Agent</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          {/* Allow pull to refresh even on empty */}
          <FlatList
            data={[]}
            renderItem={null}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            style={{ width: 0, height: 0 }}
          />
        </View>
      ) : (
        <FlatList
          data={filteredAgents || []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AgentCard
              item={{
                ...item,
                assigned_dealer:
                  typeof item.assigned_dealer === "object" && item.assigned_dealer !== null && "id" in item.assigned_dealer
                    ? item.assigned_dealer.id
                    : item.assigned_dealer,
              }}
              onEdit={async () => {
                // Fix: If assigned_dealer is an object, extract its id for the form
                const agentForEdit = {
                  ...item,
                  assigned_dealer:
                    typeof item.assigned_dealer === "object" && item.assigned_dealer !== null && "id" in item.assigned_dealer
                      ? item.assigned_dealer.id
                      : item.assigned_dealer,
                };
                setEditData(agentForEdit);
                // Fetch existing prize config
                setLoadingPrizeConfig(true);
                try {
                  const res = await api.get(`/agent/prize-configuration/${item.id}/`);
                  setEditPrizeConfig(res.data);
                } catch {
                  setEditPrizeConfig(null);
                }
                setLoadingPrizeConfig(false);
                setShowForm(true);
              }}
              onDelete={() => handleDelete(item.id.toString())}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}