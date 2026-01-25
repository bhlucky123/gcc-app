/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./App.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#8B5CF6',     // Vibrant Purple
        secondary: '#22C55E',   // Emerald Green
        gold: '#FFD700',        // Classic Gold
        royal: '#1E3A8A',       // Royal Blue
        dark: '#111827',        // Charcoal Black
        light: '#F9FAFB',       // Very Light Gray
        accent: '#F59E0B',      // Amber for highlights
        error: '#EF4444',       // Red for errors
      },
    },
  },
  plugins: [],
}