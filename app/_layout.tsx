import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import "react-native-reanimated";
import "../global.css";

import ReactQueryProvider from "@/providers/react-query-provider";
import useDrawStore from "@/store/draw";
import { getThemeColors } from "@/utils/color";
import { AlertNotificationRoot } from 'react-native-alert-notification';


export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  const { selectedDraw } = useDrawStore();

  const colorTheme = selectedDraw?.color_theme;
  const themeColors = getThemeColors(colorTheme);

  if (!loaded) {
    return null;
  }

  return (
    <ReactQueryProvider>
      <AlertNotificationRoot>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="options"
            options={{
              headerShown: true,
              title: "Draw Options",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="book"
            options={{
              headerShown: true,
              title: "Book Ticket",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="sales-report"
            options={{
              headerShown: true,
              title: "Sales Report",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="daily-report"
            options={{
              headerShown: true,
              title: "Daily Report",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="winnings"
            options={{
              headerShown: true,
              title: "Winnings",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="last-sale"
            options={{
              headerShown: true,
              title: "Last Sale",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="result"
            options={{
              headerShown: true,
              title: "Result",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="limit-count"
            options={{
              headerShown: true,
              title: "Limit Count",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="my-commission"
            options={{
              headerShown: true,
              title: "My Commission",
              headerStyle: { backgroundColor: themeColors.headerBackground },
              headerTitleStyle: {
                color: themeColors.headerTitle,
                fontWeight: "bold",
                fontSize: 22,
              },
              headerTintColor: themeColors.headerTint,
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen name="agent/[agentId]" options={{
            headerShown: false,
          }} />

          <Stack.Screen name="report/[id]" options={{
            headerShown: false,
          }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AlertNotificationRoot>
    </ReactQueryProvider>
  );
}
