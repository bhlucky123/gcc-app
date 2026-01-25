import { Clipboard } from "lucide-react-native";
import { useRef, useState } from "react";
import * as RNClipboard from "react-native"; // For Clipboard.getString()
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

type PrizeKey = "first_prize" | "second_prize" | "third_prize" | "fourth_prize" | "fifth_prize";
const PRIZE_LABELS: Record<PrizeKey, string> = {
    first_prize: "First Prize",
    second_prize: "Second Prize",
    third_prize: "Third Prize",
    fourth_prize: "Fourth Prize",
    fifth_prize: "Fifth Prize",
};
const PRIZE_COLOURS = [
    "bg-red-200/60",
    "bg-blue-200/60",
    "bg-amber-200/60",
    "bg-green-200/60",
    "bg-fuchsia-200/60",
];

type Props = {
    onSubmit: (data: any) => void;
    initialData?: any;
    loading: boolean
};

const DrawResultForm = ({ onSubmit, initialData,loading }: Props) => {
    const [form, setForm] = useState({
        first_prize: initialData?.first_prize || '',
        second_prize: initialData?.second_prize || '',
        third_prize: initialData?.third_prize || '',
        fourth_prize: initialData?.fourth_prize || '',
        fifth_prize: initialData?.fifth_prize || '',
        complementary_prizes: (() => {
            let prizes = initialData?.complementary_prizes ?? [];
            if (!Array.isArray(prizes)) prizes = [];
            if (prizes.length < 30) {
                return [...prizes, ...Array(30 - prizes.length).fill('')];
            } else if (prizes.length > 30) {
                return prizes.slice(0, 30);
            }
            return prizes;
        })(),
    });

    // Refs for main prize inputs
    const mainPrizeRefs = [
        useRef<TextInput>(null),
        useRef<TextInput>(null),
        useRef<TextInput>(null),
        useRef<TextInput>(null),
        useRef<TextInput>(null),
    ];

    // Refs for complementary prize inputs
    const complementaryRefs = Array.from({ length: 30 }, () => useRef<TextInput>(null));

    const handleInput = (key: PrizeKey, value: string, idx: number) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        // If 3 digits, focus next input
        if (value.length === 3 && idx < mainPrizeRefs.length - 1) {
            setTimeout(() => {
                mainPrizeRefs[idx + 1].current?.focus();
            }, 10);
        }
    };

    const handleComplementaryChange = (index: number, value: string) => {
        const updated = [...form.complementary_prizes];
        updated[index] = value;
        setForm((prev) => ({ ...prev, complementary_prizes: updated }));
        // If 3 digits, focus next input
        if (value.length === 3 && index < complementaryRefs.length - 1) {
            setTimeout(() => {
                complementaryRefs[index + 1].current?.focus();
            }, 10);
        }
    };

    // Handler for the "Paste" button - now reads from clipboard using RNClipboard.Clipboard.getString()
    const handlePasteComplementary = async () => {
        try {
            // RNClipboard.Clipboard.getString() returns a Promise<string>
            // @ts-ignore
            const clipboardContent = await RNClipboard.Clipboard.getString();
            // Try to extract 30 numbers (3 digits each) from the clipboard
            // Accepts: "123 456 789 ..." or "123,456,789" or "123\n456\n789" etc.
            let prizes = clipboardContent
                .replace(/[^0-9\s,]/g, "") // remove non-numeric, non-separator chars
                .split(/[\s,]+/)
                .filter(Boolean)
                .map((x: string) => x.trim())
                .filter((x: string) => x.length > 0);

            // If any prize is longer than 3 digits, split it into 3-digit chunks
            let expanded: string[] = [];
            for (const p of prizes) {
                if (p.length === 3) {
                    expanded.push(p);
                } else if (p.length > 3) {
                    // Split into 3-digit groups
                    for (let i = 0; i < p.length; i += 3) {
                        const chunk = p.slice(i, i + 3);
                        if (chunk.length === 3) expanded.push(chunk);
                    }
                }
            }
            
            // Sort the prizes from low to high (numerically)
            expanded.sort((a, b) => parseInt(a) - parseInt(b));

            console.log("expanded", expanded);
            
            
            // Only take the first 30
            expanded = expanded.slice(0, 30);

            if (expanded.length < 30) {
                Alert.alert(
                    "Not enough prizes",
                    `Found only ${expanded.length} prizes in clipboard. 30 required.`
                );
                // Optionally, fill the rest with empty strings
                while (expanded.length < 30) expanded.push("");
            }

            setForm((prev) => ({
                ...prev,
                complementary_prizes: expanded,
            }));

            // Focus the first empty complementary input after paste
            setTimeout(() => {
                const firstEmpty = expanded.findIndex((v) => !v);
                if (firstEmpty !== -1) {
                    complementaryRefs[firstEmpty].current?.focus();
                }
            }, 100);

        } catch (err) {
            Alert.alert("Paste Error", "Failed to read from clipboard.");
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, backgroundColor: "#f9fafb" }} // bg-gray-50
            keyboardVerticalOffset={80}
        >
            <View className="flex-1 bg-gray-50">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: 80 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Prize table style inputs */}
                    <View className="mx-4 mt-6 border border-gray-300 rounded-lg overflow-hidden">
                        {(Object.keys(PRIZE_LABELS) as PrizeKey[]).map((key, idx) => (
                            <View
                                key={key}
                                className={`flex-row items-center ${PRIZE_COLOURS[idx]} border-b border-gray-300`}
                            >
                                <Text className="w-10 text-center py-1.5 text-[11px] font-medium border-r border-gray-300 bg-white/20">
                                    {idx + 1}
                                </Text>
                                <Text className="flex-1 py-1.5 text-[12px] font-bold text-center text-gray-800">
                                    {PRIZE_LABELS[key]}
                                </Text>
                                <View className="w-24 border-l border-gray-300 px-2 py-1.5">
                                    <TextInput
                                        ref={mainPrizeRefs[idx]}
                                        className="text-center text-[13px] font-mono font-bold text-gray-900 bg-white rounded-md border border-gray-300 px-2 py-1"
                                        keyboardType="numeric"
                                        placeholder="e.g. 123"
                                        value={typeof form[key] === "string" ? form[key] : ""}
                                        onChangeText={(text) => handleInput(key, text, idx)}
                                        maxLength={3}
                                        returnKeyType={idx < mainPrizeRefs.length - 1 ? "next" : "done"}
                                        blurOnSubmit={idx === mainPrizeRefs.length - 1}
                                        onSubmitEditing={() => {
                                            if (idx < mainPrizeRefs.length - 1) {
                                                mainPrizeRefs[idx + 1].current?.focus();
                                            }
                                        }}
                                        placeholderTextColor="#9ca3af"

                                    />
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Complementary grid style inputs */}
                    <View className="mx-4 flex-row items-center mt-8 mb-2">
                        <Text className="flex-1 text-base font-semibold text-gray-700 tracking-wide">
                            Complementary Prizes
                        </Text>
                        <TouchableOpacity
                            onPress={handlePasteComplementary}
                            className="ml-2 flex-row items-center bg-green-100 border border-green-400 px-3 py-1.5 rounded-lg"
                            activeOpacity={0.8}
                            style={{
                                shadowColor: "#16a34a",
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.08,
                                shadowRadius: 2,
                            }}
                        >
                            <Clipboard color="#16a34a" size={18} /> 
                            <Text className="ml-1 text-green-700 text-xs font-semibold">Paste</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="mx-4 border border-gray-300 rounded-lg overflow-hidden mb-10">
                        <View className="flex-row border-b border-gray-200">
                            {Array.from({ length: 3 }).map((_, colIdx) => (
                                <View key={`col-${colIdx}`} className="flex-1">
                                    {Array.from({ length: Math.ceil(form.complementary_prizes.length / 3) }).map((_, rowIdx) => {
                                        const idx = rowIdx + colIdx * Math.ceil(form.complementary_prizes.length / 3);
                                        const val = form.complementary_prizes[idx] || "";
                                        return (
                                            <View
                                                key={`prize-${colIdx}-${rowIdx}`}
                                                className={`border-b border-gray-200 ${colIdx < 2 ? "border-r border-gray-200" : ""} px-2 py-2 bg-white`}
                                                style={{ minWidth: 0 }}
                                            >
                                                {idx < form.complementary_prizes.length ? (
                                                    <TextInput
                                                        ref={complementaryRefs[idx]}
                                                        className="text-center text-[13px] font-mono font-bold text-gray-900 bg-gray-50 rounded-md border border-gray-300 px-2 py-1"
                                                        keyboardType="numeric"
                                                        placeholder={`Prize ${idx + 1}`}
                                                        value={val}
                                                        onChangeText={(text) => handleComplementaryChange(idx, text)}
                                                        maxLength={3}
                                                        returnKeyType={idx < complementaryRefs.length - 1 ? "next" : "done"}
                                                        blurOnSubmit={idx === complementaryRefs.length - 1}
                                                        onSubmitEditing={() => {
                                                            if (idx < complementaryRefs.length - 1) {
                                                                complementaryRefs[idx + 1].current?.focus();
                                                            }
                                                        }}
                                                        placeholderTextColor="#9ca3af"
                                                    />
                                                ) : (
                                                    <View />
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
                {/* Submit button bar */}
                <View
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "white",
                        paddingHorizontal: 16,
                        paddingBottom: 34,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderColor: "#e5e7eb", // border-gray-200
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: -2 },
                        shadowOpacity: 0.06,
                        shadowRadius: 4,
                        elevation: 8,
                    }}
                >
                    <TouchableOpacity
                        className="bg-green-700 px-4 py-3 rounded-xl items-center justify-center shadow-lg"
                        onPress={() => {
                            if (!loading) onSubmit(form);
                        }}
                        activeOpacity={0.85}
                        style={{
                            elevation: 4,
                            shadowColor: "#15803d",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 4,
                        }}
                        disabled={loading}
                    >
                        {loading ? (
                            <Text className="text-white font-bold text-center text-base tracking-wide">Submitting...</Text>
                        ) : (
                            <Text className="text-white font-bold text-center text-base tracking-wide">Submit</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

export default DrawResultForm