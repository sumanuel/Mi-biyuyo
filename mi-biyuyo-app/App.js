import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";

import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { ExchangeRateProvider } from "./src/contexts/ExchangeRateContext";
import { DataProvider } from "./src/contexts/DataContext";
import { RateNotificationsProvider } from "./src/contexts/RateNotificationsContext";
import DailyRateWatcher from "./src/components/DailyRateWatcher";
import "./src/services/rateWatcher"; // define la tarea en segundo plano de la tasa diaria
import { FONT_ASSETS } from "./src/theme/font";
import { Icon, Txt, Toast } from "./src/components/ui";

import SplashScreen from "./src/screens/auth/SplashScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/auth/ForgotPasswordScreen";

import HomeScreen from "./src/screens/main/HomeScreen";
import EntitiesScreen from "./src/screens/main/EntitiesScreen";
import PickScreen from "./src/screens/main/PickScreen";
import StatsScreen from "./src/screens/main/StatsScreen";
import SettingsScreen from "./src/screens/main/SettingsScreen";
import HistoryScreen from "./src/screens/main/HistoryScreen";
import DebtsScreen from "./src/screens/main/DebtsScreen";
import MovementFormScreen from "./src/screens/main/MovementFormScreen";
import MovementSavedScreen from "./src/screens/main/MovementSavedScreen";
import MovementDetailScreen from "./src/screens/main/MovementDetailScreen";
import DebtDetailScreen from "./src/screens/main/DebtDetailScreen";
import PayScreen from "./src/screens/main/PayScreen";
import EntityDetailScreen from "./src/screens/main/EntityDetailScreen";
import EntityFormScreen from "./src/screens/main/EntityFormScreen";
import ItemsScreen from "./src/screens/main/ItemsScreen";
import ItemDatesScreen from "./src/screens/main/ItemDatesScreen";
import EntityMovementsScreen from "./src/screens/main/EntityMovementsScreen";
import TransferScreen from "./src/screens/main/TransferScreen";
import ExchangeRateScreen from "./src/screens/main/ExchangeRateScreen";
import AboutScreen from "./src/screens/main/AboutScreen";
import ProfileScreen from "./src/screens/main/ProfileScreen";
import RateNotificationsScreen from "./src/screens/main/RateNotificationsScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const NAV_TABS = [
  { name: "Home", label: "Inicio", icon: "home" },
  { name: "Entities", label: "Entidades", icon: "bank" },
  { name: "Pick", label: "Registrar", fab: true },
  { name: "Stats", label: "Estadísticas", icon: "stats" },
  { name: "Settings", label: "Ajustes", icon: "settings" },
];

function TabBar({ state, navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          height: 72 + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {NAV_TABS.map((t) => {
        const focused = activeName === t.name;
        const color = focused ? colors.accent : colors.textSecondary;
        return (
          <TouchableOpacity
            key={t.name}
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(t.name)}
            accessibilityLabel={t.label}
          >
            {t.fab ? (
              <View style={[styles.fab, { backgroundColor: colors.accent }]}>
                <Icon name="plus" size={20} color="#ffffff" stroke={2.4} />
              </View>
            ) : (
              <Icon name={t.icon} size={22} color={color} stroke={2} />
            )}
            <Txt style={{ fontSize: 11, fontWeight: "700", color }}>
              {t.label}
            </Txt>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
      backBehavior="history"
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Entities" component={EntitiesScreen} />
      <Tab.Screen name="Pick" component={PickScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
      {/* Sin botón propio en la barra, pero conservan la barra inferior */}
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Receivables">
        {(props) => <DebtsScreen {...props} type="cobrar" />}
      </Tab.Screen>
      <Tab.Screen name="Payables">
        {(props) => <DebtsScreen {...props} type="pagar" />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isDark } = useTheme();
  const { token, loading } = useAuth();

  if (loading) return <SplashScreen />;

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
      {token ? (
        <ExchangeRateProvider>
          <DataProvider>
            <RateNotificationsProvider>
              <View style={{ flex: 1 }}>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="MainTabs" component={MainTabs} />
                  <Stack.Screen
                    name="MovementForm"
                    component={MovementFormScreen}
                  />
                  <Stack.Screen
                    name="MovementSaved"
                    component={MovementSavedScreen}
                  />
                  <Stack.Screen
                    name="MovementDetail"
                    component={MovementDetailScreen}
                  />
                  <Stack.Screen
                    name="DebtDetail"
                    component={DebtDetailScreen}
                  />
                  <Stack.Screen name="Pay" component={PayScreen} />
                  <Stack.Screen
                    name="EntityDetail"
                    component={EntityDetailScreen}
                  />
                  <Stack.Screen
                    name="EntityForm"
                    component={EntityFormScreen}
                  />
                  <Stack.Screen
                    name="EntityMovements"
                    component={EntityMovementsScreen}
                  />
                  <Stack.Screen name="Items" component={ItemsScreen} />
                  <Stack.Screen name="ItemDates" component={ItemDatesScreen} />
                  <Stack.Screen name="Transfer" component={TransferScreen} />
                  <Stack.Screen
                    name="ExchangeRate"
                    component={ExchangeRateScreen}
                  />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="About" component={AboutScreen} />
                  <Stack.Screen
                    name="RateNotifications"
                    component={RateNotificationsScreen}
                  />
                </Stack.Navigator>
                <Toast />
                <DailyRateWatcher />
              </View>
            </RateNotificationsProvider>
          </DataProvider>
        </ExchangeRateProvider>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  fab: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
