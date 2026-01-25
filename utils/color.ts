

// Utility to lighten a hex color
function lightenColor(hex: string, percent: number) {
    // Remove hash if present
    hex = hex.replace(/^#/, "");
    // Parse r,g,b
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r = Math.round(r + (255 - r) * percent);
    g = Math.round(g + (255 - g) * percent);
    b = Math.round(b + (255 - b) * percent);

    // Clamp and convert back to hex
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    return (
        "#" +
        r.toString(16).padStart(2, "0") +
        g.toString(16).padStart(2, "0") +
        b.toString(16).padStart(2, "0")
    );
}

const DEFAULT_THEME = {
    headerBackground: "#e0e7ff", // indigo-100
    headerTitle: "#3730a3", // indigo-800
    headerTint: "#6366f1", // indigo-500
};

export function getThemeColors(colorTheme?: string) {
    if (
        colorTheme &&
        /^#[0-9a-fA-F]{6}$/.test(colorTheme)
    ) {
        // Use the colorTheme as the main color, and a lighter version for background
        return {
            headerBackground: lightenColor(colorTheme, 0.85), // 85% lighter
            headerTitle: colorTheme,
            headerTint: colorTheme,
        };
    }
    return DEFAULT_THEME;
}