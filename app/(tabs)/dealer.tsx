import { PrizeConfigBlock } from "@/components/prize-config";
import useDealer from "@/hooks/use-dealer";
import { useAuthStore } from "@/store/auth";
import { amountHandler } from "@/utils/amount";
import api from "@/utils/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Eye, EyeOff, MoveLeft } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
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
import { Card } from "./more";

// Dealer type
type Dealer = {
    id: number;
    // password?: string;
    username: string;
    is_active: boolean;
    calculate_str: string;
    secret_pin: number;
    commission: number;
    single_digit_number_commission: number;
    cap_amount: number;

    is_prize_set?: boolean;
    "box_direct": string,
    "box_indirect": string,
    "double_digit_prize": string,
    "single_digit_prize": string,
    "super_complementary_prize": string,
    "super_fifth_prize": string,
    "super_first_prize": string,
    "super_fourth_prize": string,
    "super_second_prize": string,
    "super_third_prize": string
};

const CALC_OPERATORS = [
    { label: "+", value: "+" },
    { label: "-", value: "-" },
    { label: "*", value: "*" },
    { label: "/", value: "/" },
];

// Eye icon SVG (simple inline, no extra dependency)
const EyeIcon = ({ visible }: { visible: boolean }) => (
    <View style={{ width: 24, height: 24, justifyContent: "center", alignItems: "center" }}>
        {visible ? (
            // Open eye
            <Eye color="#6b7280" size={20} />
        ) : (
            // Closed eye
            <EyeOff color="#6b7280" size={20} />
        )}
    </View>
);

const DealerForm = ({
    onSubmit,
    defaultValues = {},
    onCancel,
    submitting = false
}: {
    onSubmit: (data: any) => void;
    defaultValues?: Partial<Dealer>;
    onCancel: () => void;
    submitting?: boolean
}) => {
    const { user } = useAuthStore();

    // For calculate string config: number, operator, second number
    // During editing, parse out the firstNum, op, secondNum from calculate_str
    let calculateFirstNumInitial = "";
    let calculateOperatorInitial = "+";
    let calculateSecondNumInitial = "";

    if (defaultValues.calculate_str) {
        // calculate_str will be like "+9": only operator and second number
        const match = /^([+\-*/])\s*(\d+)$/.exec(defaultValues.calculate_str);
        if (match) {
            calculateOperatorInitial = match[1];
            calculateSecondNumInitial = match[2];
        }
    }

    const [form, setForm] = useState({
        username: defaultValues.username || "",
        // password: "", // Always start with an empty password for security
        is_active: defaultValues.is_active ?? true,
        // calculate_str is composed in handleSubmit from below:
        calculate_first_number: defaultValues?.id,
        calculate_operator: calculateOperatorInitial,
        calculate_second_number: calculateSecondNumInitial,
        secret_pin: defaultValues.secret_pin?.toString() || "",
        commission: defaultValues.commission?.toString() || "",
        single_digit_number_commission: defaultValues.single_digit_number_commission?.toString() || "",
        cap_amount: defaultValues.cap_amount?.toString() || "",
        is_prize_set: defaultValues?.is_prize_set || false,
        "box_direct": defaultValues?.box_direct || "",
        "box_indirect": defaultValues?.box_indirect || "",
        "double_digit_prize": defaultValues?.double_digit_prize || "",
        "single_digit_prize": defaultValues?.single_digit_prize || "",
        "super_complementary_prize": defaultValues?.super_complementary_prize || "",
        "super_fifth_prize": defaultValues?.super_fifth_prize || "",
        "super_first_prize": defaultValues?.super_first_prize || "",
        "super_fourth_prize": defaultValues?.super_fourth_prize || "",
        "super_second_prize": defaultValues?.super_second_prize || "",
        "super_third_prize": defaultValues?.super_third_prize || ""
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Fetch calculate id if creating new; do not run if editing existing dealer
    const skipCalculateIdFetch = !!defaultValues?.id;
    // Custom fetch logic: Only fetch when the form is opened (component mount), and not cached.
    const [newUserIdData, setNewUserIdData] = useState<number | null>(null);
    const [loadingCalcId, setLoadingCalcId] = useState(false);
    const [errorCalcId, setErrorCalcId] = useState(false);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (!skipCalculateIdFetch && !fetchedRef.current) {
            setLoadingCalcId(true);
            setErrorCalcId(false);
            api.get(`/user/get-new-user-id/?user_type=DEALER`)
                .then((res) => {
                    setNewUserIdData(res.data);
                    fetchedRef.current = true;
                    setLoadingCalcId(false);
                })
                .catch((e) => {
                    setErrorCalcId(true);
                    setLoadingCalcId(false);
                });
        }
        // eslint-disable-next-line
    }, [skipCalculateIdFetch]);

    // On new userId fetched -> set to calculate_first_number
    useEffect(() => {
        if (!skipCalculateIdFetch && newUserIdData && !form.calculate_first_number) {
            setForm(prev => ({
                ...prev,
                calculate_first_number: String(newUserIdData)
            }));
        }
        // eslint-disable-next-line
    }, [newUserIdData, skipCalculateIdFetch]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!form.username.trim()) {
            newErrors.username = "Username is required";
        } else if (/\s/.test(form.username)) {
            newErrors.username = "Username should not contain spaces";
        }
        // Password is only required for new creations
        // if (!defaultValues?.id && !form.password.trim())
        //     newErrors.password = "Password is required";
        // Calculate string validation
        if (!form.calculate_first_number || isNaN(Number(form.calculate_first_number))) {
            newErrors.calculate_str = "First number required";
        }
        if (!form.calculate_operator) {
            newErrors.calculate_str = "Operator is required";
        }
        if (!form.calculate_second_number || isNaN(Number(form.calculate_second_number))) {
            newErrors.calculate_str = "Second number required";
        }
        if (!form.secret_pin.trim())
            newErrors.secret_pin = "required";
        if (!form?.commission)
            newErrors.commission = "required";
        if (Number(form.commission) < 0)
            newErrors.commission = "Commission cannot be negative";
        if (!form?.single_digit_number_commission)
            newErrors.single_digit_number_commission = "required";
        if (Number(form.single_digit_number_commission) < 0)
            newErrors.single_digit_number_commission = "Single digit Commission cannot be negative";
        if (!form?.cap_amount)
            newErrors.cap_amount = "required";
        if (Number(form.cap_amount) < 0)
            newErrors.cap_amount = "Cap amount cannot be negative";

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
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (key: string, value: string | boolean) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setErrors((prev) => ({ ...prev, [key]: "" }));
    };

    const handleSubmit = () => {
        console.log("on submit")
        if (!validate()) {
            return
        }
        // Compose calculate_str: "{firstNum}{op}{secondNum}", eg "12+9"
        const str = `${form.calculate_operator}${form.calculate_second_number}`

        const preparedData: Partial<Dealer> = {
            ...form,
            calculate_str: str,
            secret_pin: Number(form.secret_pin),
            commission: Number(form.commission),
            single_digit_number_commission: Number(form.single_digit_number_commission),
            cap_amount: Number(form.cap_amount),
        };
        console.log("preparedData",preparedData)

        // // Only include password if it's set (for new creation or explicit update)
        // if (form.password.trim() !== "") {
        //     preparedData.password = form.password;
        // } else if (defaultValues.id) {
        //     // If it's an edit and password is empty, ensure it's not sent to avoid accidental overwrite
        //     delete preparedData.password;
        // }

        // Remove our UI fields if they exist to prevent type errors
        delete (preparedData as any).calculate_first_number;
        delete (preparedData as any).calculate_operator;
        delete (preparedData as any).calculate_second_number;

        onSubmit(preparedData);
    };

    // Setup input fields except calculate_str; calculate_str field will be rendered custom below.
    const inputFields = [
        { key: "username", label: "Username", keyboardType: "default" as const, secureTextEntry: false, icon: "👤" },
        // { key: "password", label: "Password", keyboardType: "default" as const, secureTextEntry: true, optional: !!defaultValues?.id, icon: "🔒" },
        // { key: "calculate_str", label: "Calculate String", ...} // Omit, we now custom
        { key: "secret_pin", label: "Secret PIN", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🔑" },
        { key: "commission", label: "Commission", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💰" },
        { key: "single_digit_number_commission", label: "Single Digit Commission", keyboardType: "numeric" as const, secureTextEntry: false, icon: "🎯" },
        { key: "cap_amount", label: "Cap Amount", keyboardType: "numeric" as const, secureTextEntry: false, icon: "💲" },
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
                        <MoveLeft size={24} color="#4B5563" />
                    </TouchableOpacity>

                    <Text className="text-xl font-bold text-gray-800">
                        {defaultValues?.id ? "Edit Dealer" : "Create Dealer"}
                    </Text>

                    <View className="w-10">
                        {/* Spacer */}
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0} // Adjust as needed if header overlaps
            >
                <ScrollView
                    className="flex-1 px-6 pt-6"
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 50 }} // Add padding to the bottom
                >
                    {/* Custom Calculate String Section */}
                    <View className="mb-6">
                        <Text className="text-gray-700 font-semibold mb-2 ml-1">
                            <Text>🧮 </Text>
                            <Text>Calculate String</Text>
                            <Text className="text-red-500"> *</Text>
                        </Text>
                        <View className="flex-row items-center space-x-2">
                            {/* Number fetched from API (first number) */}
                            <View style={{ flex: 1 }}>
                                <Text className="text-xs text-gray-500 mb-1">User ID</Text>
                                <View className={`
                                    border-2 rounded-xl px-4 py-3 bg-gray-100 text-gray-800
                                    ${focusedField === "calculate_first_number" ? "border-blue-300 bg-blue-50" : "border-gray-200"}
                                `}>
                                    <Text className="text-lg font-medium">
                                        {form.calculate_first_number ? form.calculate_first_number : (loadingCalcId ? "Loading..." : (errorCalcId ? "Error" : "--"))}
                                    </Text>
                                </View>
                            </View>

                            {/* Operator dropdown */}
                            <View style={{ marginLeft: 6 }}>
                                <Text className="text-xs text-gray-500 mb-1">Operator</Text>
                                <View className={`
                                    border-2 rounded-xl px-2 py-1 bg-white text-gray-800
                                    ${focusedField === "calculate_operator" ? "border-blue-300 bg-blue-50" : "border-gray-200"}
                                `}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>
                                        {CALC_OPERATORS.map(op => (
                                            <TouchableOpacity
                                                key={op.value}
                                                style={{
                                                    marginHorizontal: 3,
                                                    borderRadius: 8,
                                                    backgroundColor: form.calculate_operator === op.value ? "#3B82F6" : "transparent",
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 6,
                                                }}
                                                onPress={() => handleChange("calculate_operator", op.value)}
                                            >
                                                <Text style={{ color: form.calculate_operator === op.value ? "#fff" : "#222", fontWeight: "bold", fontSize: 18 }}>{op.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            {/* Second number input */}
                            <View style={{ flex: 1, marginLeft: 6 }}>
                                <Text className="text-xs text-gray-500 mb-1">Second Number</Text>
                                <TextInput
                                    placeholder="e.g. 9"
                                    className={`
                                        border-2 rounded-xl px-4 py-3 bg-white
                                        text-gray-800 font-medium
                                        ${focusedField === "calculate_second_number"
                                            ? 'border-blue-400 bg-blue-50'
                                            : (form.calculate_second_number ? 'border-green-300 bg-green-50' : 'border-gray-200')}
                                    `}
                                    value={form.calculate_second_number}
                                    keyboardType="numeric"
                                    onFocus={() => setFocusedField("calculate_second_number")}
                                    onBlur={() => setFocusedField(null)}
                                    onChangeText={text => handleChange("calculate_second_number", text.replace(/[^0-9]/g, ""))}
                                    maxLength={4}
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>
                        {/* Validation error for calculate_str */}
                        {errors.calculate_str && (
                            <Text className="text-red-500 text-sm mt-1 ml-1 font-medium">
                                {errors.calculate_str}
                            </Text>
                        )}
                        <View className="mt-2">
                            <Text className="text-gray-500 text-sm">
                                <Text className="font-semibold">Preview:&nbsp;</Text>
                                <Text className="font-mono text-base text-blue-700">
                                    {form.calculate_first_number && form.calculate_operator && form.calculate_second_number
                                        ? `${form.calculate_first_number}${form.calculate_operator}${form.calculate_second_number}`
                                        : ""}
                                </Text>
                            </Text>
                        </View>
                    </View>

                    {/* Other Inputs */}
                    {inputFields.map(({ key, label, keyboardType, secureTextEntry, optional, icon }) => {
                        const isFocused = focusedField === key;
                        const hasError = !!errors[key];
                        const hasValue = !!form[key as keyof typeof form];

                        // Only for password field: show/hide logic and eye icon
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
                                                        : hasValue // Apply green if it has a value and no error
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
                                                    : (form[key as keyof typeof form] as string)
                                            }
                                            onChangeText={(text) => handleChange(key, text)}
                                            onFocus={() => setFocusedField(key)}
                                            onBlur={() => setFocusedField(null)}
                                            keyboardType={keyboardType}
                                            secureTextEntry={!showPassword}
                                            autoCapitalize="none"
                                            placeholderTextColor="#9CA3AF"
                                        />
                                        {/* Eye icon button */}
                                        <TouchableOpacity
                                            onPress={() => setShowPassword((v) => !v)}
                                            style={{
                                                position: "absolute",
                                                right: 12,
                                                top: "50%",
                                                marginTop: -12,
                                                padding: 4,
                                                zIndex: 10,
                                            }}
                                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <EyeIcon visible={showPassword} />
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
                                                    : hasValue // Apply green if it has a value and no error
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
                                                : (form[key as keyof typeof form] as string)
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

                                    {/* Success indicator (only for non-password fields with a value and no error) */}
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
                            onPress={() => {
                                handleChange('is_active', !form.is_active)
                            }}
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

                    <Card>
                        <View>
                            <TouchableOpacity
                                onPress={() => {
                                    setForm((prev) => ({ ...form, is_prize_set: !prev?.is_prize_set }))
                                }}
                                className={`
                                    flex-row items-center justify-between p-4 rounded-xl border-2
                                    ${form.is_active
                                        ? 'bg-green-50 border-green-300'
                                        : 'bg-gray-50 border-gray-300'
                                    }
                                `}
                                activeOpacity={0.8}
                            >
                                <Text className="text-gray-700 font-medium">Prize Config</Text>
                                <View className={`
                                    w-12 h-6 rounded-full p-1
                                    ${form?.is_prize_set ? 'bg-green-500' : 'bg-gray-400'}
                                `}>
                                    <View className={`
                                        w-4 h-4 bg-white rounded-full transition-all duration-200
                                        ${form?.is_prize_set ? 'ml-6' : 'ml-0'}
                                    `} />
                                </View>
                            </TouchableOpacity>
                        </View>
                        {
                            form?.is_prize_set &&
                            <PrizeConfigBlock form={form} errors={errors} onChange={(data) => {
                                if (Object.keys.length > 0) {
                                    setErrors({})
                                }
                                setForm((prev) => ({ ...prev, ...data } as any))
                            }} />
                        }
                    </Card>

                    <View className="pb-20 my-12 mb-12">
                        {/* Added padding-bottom for the submit button */}
                        <TouchableOpacity
                            className={`bg-blue-600 py-4 rounded-xl shadow-lg active:scale-95 ${submitting ? 'opacity-60' : ''}`}
                            onPress={handleSubmit}
                            activeOpacity={0.9}
                            disabled={submitting}
                        >
                            <Text className="text-white text-center font-bold text-lg">
                                {submitting
                                    ? (defaultValues?.id ? "Updating..." : "Creating...")
                                    : (defaultValues?.id ? "Update Dealer" : "Create Dealer")}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const DealerCard = ({ item, onEdit, onDelete }: { item: Dealer; onEdit: () => void; onDelete: () => void }) => {
    const { user } = useAuthStore();

    return (
        < View className="bg-white mx-4 mb-4 rounded-xl border border-gray-200 overflow-hidden" >
            <View className={`h-1 ${item.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
            <View className="p-5">
                <View className="flex-row justify-between mb-4">
                    <Text className="text-lg font-semibold">{item.username}</Text>
                    <View className="flex-row gap-2">
                        <TouchableOpacity onPress={() => {
                            router.push(`/agent/${item.id}`)
                        }} className="px-3 py-1 bg-gray-100 rounded-md">
                            <Text>Agent</Text>
                        </TouchableOpacity>
                        {
                            user?.user_type === "ADMIN" && <TouchableOpacity onPress={onEdit} className="px-3 py-1 bg-gray-100 rounded-md">
                                <Text>Edit</Text>
                            </TouchableOpacity>
                        }
                        {
                            user?.user_type === "ADMIN" &&
                            <TouchableOpacity onPress={onDelete} className="px-3 py-1 bg-red-100 rounded-md">
                                <Text className="text-red-600">Delete</Text>
                            </TouchableOpacity>}
                    </View>
                </View>
                <View className="flex-row items-center mb-2">
                    <Text className="text-xs text-gray-500 mr-2">💰</Text>
                    <Text className="text-sm text-gray-700 font-medium flex-1">Commission:</Text>
                    <Text className="text-sm text-gray-800 font-bold">
                        ₹{amountHandler(item.commission)}
                    </Text>
                </View>
                <View className="flex-row items-center mb-2">
                    <Text className="text-xs text-gray-500 mr-2">🎯</Text>
                    <Text className="text-sm text-gray-700 font-medium flex-1">Single Digit Comm.:</Text>
                    <Text className="text-sm text-gray-800 font-bold">
                        ₹{amountHandler(item.single_digit_number_commission)}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    <Text className="text-xs text-gray-500 mr-2">💲</Text>
                    <Text className="text-sm text-gray-700 font-medium flex-1">Cap Amount:</Text>
                    <Text className="text-sm text-gray-800 font-bold">
                        ₹{amountHandler(item.cap_amount)}
                    </Text>
                </View>
            </View>

            <View className="flex-row justify-end">
                    {
                        user?.user_type === "ADMIN" &&
                        <TouchableOpacity onPress={() => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            router.push({ pathname: "/reports/[id]", params: { id: String(item.id) } })
                        }} className="px-3 py-1 w-24 mt-3 bg-green-100 rounded-md">
                            <Text className="text-center" >Report</Text>
                        </TouchableOpacity>}
                </View>
        </View >
    )
};

export default function DealerManagement() {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editData, setEditData] = useState<Dealer | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const {
        data: dealers = [],
        isLoading,
        isError,
        error,
        isFetching,
        refetch
    } = useQuery<Dealer[]>({
        queryKey: ["dealers"],
        queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
        retry: false, // Do not retry on error, only call once
    });
    const { createDealer, editDealer, deleteDealer } = useDealer();

    const filteredDealers = dealers.filter(d => d.username.toLowerCase().includes(searchQuery.toLowerCase()));

    console.log("Dealer",filteredDealers)

    const handleCreate = (data: any) => {
        setSubmitting(true)
        createDealer(data, {
            onSuccess: (newDealer) => {
                setSubmitting(false)
                queryClient.setQueryData<any[]>(["dealers"], (old) => [newDealer, ...(old || [])]);
                setShowForm(false);
            },
            onError: (error) => {
                setSubmitting(false)
                let errorMsg = "Failed to create dealer.";

                if (
                    error?.message &&
                    Array.isArray(error.message) &&
                    error.message.length > 0 &&
                    typeof error.message[0] === "string"
                ) {
                    errorMsg = error.message[0];
                } else if (error?.message && typeof error.message === "object") {
                    const field = Object.keys(error.message)[0];
                    if (field && Array.isArray(error.message[field]) && error.message[field][0]) {
                        errorMsg = error.message[field][0];
                    }
                } else if (typeof error?.message === "string") {
                    errorMsg = error.message;
                }
                Alert.alert("Error", errorMsg);
            }
        });
    };

    const handleEdit = (data: any) => {
        setSubmitting(true);
        console.log("on edit",data)
        editDealer({ ...data, id: editData?.id }, {
            onSuccess: (updated) => {
                setShowForm(false);
                setSubmitting(false)
                queryClient.setQueryData<any[]>(["dealers"], (old) =>
                    old?.map(d => (d.id === updated.id ? updated : d)) || []
                );
                setEditData(null);
            },
            onError: (err) => {
                setSubmitting(false);
                let errorMsg = "Failed to update dealer.";

                if (err?.message) {
                    if (Array.isArray(err.message) && err.message.length > 0 && typeof err.message[0] === "string") {
                        errorMsg = err.message[0];
                    } else if (typeof err.message === "string") {
                        if (err.message.trim().startsWith("<!DOCTYPE html") || err.message.trim().startsWith("<html")) {
                            errorMsg = "Something went wrong. Please try again.";
                        } else {
                            errorMsg = err.message;
                        }
                    } else if (typeof err.message === "object" && err.message !== null) {
                        if (Array.isArray((err.message as any).non_field_errors) && (err.message as any).non_field_errors.length > 0) {
                            errorMsg = (err.message as any).non_field_errors.join("\n");
                        } else if ((err.message as any).detail) {
                            errorMsg = (err.message as any).detail;
                        } else {
                            const firstField = Object.keys(err.message)[0];
                            if (
                                firstField &&
                                Array.isArray((err.message as any)[firstField]) &&
                                (err.message as any)[firstField][0]
                            ) {
                                errorMsg = (err.message as any)[firstField][0];
                            } else {
                                errorMsg = JSON.stringify(err.message);
                            }
                        }
                    }
                }

                Alert.alert("Error", errorMsg);
            }
        });
    };

    const handleDelete = (id: string) => {
        Alert.alert("Delete Dealer", "Are you sure?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: () => {
                    deleteDealer({ id }, {
                        onSuccess: () => {
                            refetch()
                        },
                    });
                },
            },
        ]);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    };

    if (isError) {
        return (
            <View className="flex-1 justify-center items-center px-8 bg-white">
                <View className="bg-red-50 border border-red-200 rounded-2xl px-6 py-8 shadow-md items-center w-full">
                    <View className="bg-red-100 rounded-full p-4 mb-4">
                        <Text className="text-3xl">⚠️</Text>
                    </View>
                    <Text className="text-red-600 text-xl font-bold mb-2 text-center">Failed to load dealers</Text>
                    <Text className="text-gray-600 mb-6 text-center">
                        {
                            typeof (error as any)?.message === "object" && (error as any)?.message?.detail
                                ? (error as any).message.detail
                                : (typeof (error as any)?.message === "string"
                                    ? (error as any).message
                                    : "An error occurred while loading dealers. Please try again.")
                        }
                    </Text>
                    <TouchableOpacity
                        onPress={() => refetch()}
                        className="flex-row items-center justify-center bg-blue-600 px-8 py-3 rounded-xl shadow active:scale-95"
                        activeOpacity={0.85}
                    >
                        <Text className="text-white font-bold text-lg mr-2">Retry</Text>
                        <Text className="text-white text-xl">↻</Text>
                    </TouchableOpacity>
                </View>
            </View>
        )
    }
    if (showForm) {
        return <DealerForm onSubmit={editData ? handleEdit : handleCreate} submitting={submitting} defaultValues={editData || {}} onCancel={() => { setShowForm(false); setEditData(null); }} />;
    }

    return (
        <View className="flex-1 bg-gray-50">
            <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
            <View className="bg-white border-b border-gray-200 px-6 pt-10 pb-6">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-2xl font-bold">Dealer Management</Text>
                    <TouchableOpacity onPress={() => { setEditData(null); setShowForm(true); }} className="w-12 h-12 bg-blue-600 rounded-full items-center justify-center">
                        <Text className="text-white text-2xl">+</Text>
                    </TouchableOpacity>
                </View>
                <TextInput
                    placeholder="Search dealers..."
                    className="bg-gray-100 rounded-lg px-4 py-3 text-gray-800"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#9ca3af"
                />
            </View>
            {isLoading && !isFetching ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text className="mt-4 text-gray-500">Loading dealers...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredDealers || []}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 16 }}
                    renderItem={({ item }) => (
                        <DealerCard
                            item={item}
                            onEdit={() => { setEditData(item); setShowForm(true); }}
                            onDelete={() => handleDelete(item.id.toString())}
                        />
                    )}
                    refreshControl={
                        <RefreshControl
                            refreshing={isFetching || refreshing}
                            onRefresh={onRefresh}
                            colors={["#3B82F6"]}
                            tintColor="#3B82F6"
                        />
                    }
                    ListEmptyComponent={
                        <View className="flex-1 justify-center items-center mt-16">
                            <Text className="text-gray-500 text-lg">No dealers found.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}
