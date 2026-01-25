import Calculator from "@/components/calculator";
import { config } from "@/utils/config";
import { router } from "expo-router";
import { useEffect } from "react";

export default function CalculatorScreen() {
    useEffect(() => {
        if (config.userType === "ADMIN") {
            router.replace("/login");
        }
    }, []);

    if (config.userType === "ADMIN") {
        // Optionally, you can return null or a loading indicator
        return null;
    }

    return (
        <Calculator />
    );
}