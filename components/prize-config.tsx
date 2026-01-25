
import { PRIZE_CONFIG_FIELDS } from "@/app/(tabs)/more";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from "react-native";

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

export const PrizeConfigBlock: React.FC<{ onChange: (data: PrizeConfig | null) => void, form: any, errors: Record<string, string> }> = ({ onChange, form, errors }) => {
    console.log("form", form);

    const [prizeConfigForm, setPrizeConfigForm] = useState<PrizeConfig>({ ...form });
    const [prizeConfigError, setPrizeConfigError] = useState<string | null>(null);

    // Trigger onChange when prizeConfigForm changes
    useEffect(() => {
        // if(validate()){
        onChange(prizeConfigForm);
        // }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prizeConfigForm]);

    const validate = () => {
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
            return false;
        }
        setPrizeConfigError(null);
        return true
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0} // Adjust as needed if header overlaps
        >
            <View className="mt-5 ">
                {PRIZE_CONFIG_FIELDS.map(({ key, label }) => {
                    const hasError = !!errors[key];
                    return (
                        <View key={key} style={{ marginBottom: 20, paddingBottom: 2 }}>
                            <Text style={{ color: "#22223b", fontSize: 15, marginBottom: 10 }}>{label}</Text>
                            <TextInput
                                value={prizeConfigForm?.[key]?.toString() ?? ""}
                                onChangeText={(val) => {
                                    setPrizeConfigForm((prev) => {
                                        const num = Number(val.replace(/[^0-9]/g, ""));
                                        // If prev is null, initialize all fields to empty string except edited field
                                        if (!prev) {
                                            const newForm: any = {};
                                            PRIZE_CONFIG_FIELDS.forEach(({ key: k }) => {
                                                newForm[k] = "";
                                            });
                                            newForm[key] = num;
                                            return newForm as PrizeConfig;
                                        }
                                        return { ...prev, [key]: num };
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
                            {hasError && (
                                <Text className="text-red-500 text-sm mt-1 ml-1 font-medium">
                                    {errors[key]}
                                </Text>
                            )}
                        </View>
                    )
                }
                )}
                {prizeConfigError && (
                    <Text style={{ color: "#dc2626", fontSize: 13, marginBottom: 6 }}>{prizeConfigError}</Text>
                )}
            </View>
        </KeyboardAvoidingView>
    );
};

