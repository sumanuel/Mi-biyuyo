import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, StyleSheet, AppState } from "react-native";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as NativeSplash from "expo-splash-screen";
import OnboardingScreen, {
  ONBOARDING_KEY,
} from "./src/screens/auth/OnboardingScreen";
import BiometricLockScreen from "./src/screens/auth/BiometricLockScreen";
import { getBiometricLockEnabled } from "./src/services/biometricAuthService";
import { GuideProvider } from "./src/contexts/GuideContext";
import GettingStartedScreen from "./src/screens/main/GettingStartedScreen";
import HelpCenterScreen from "./src/screens/main/HelpCenterScreen";
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
  const { isDark, colors } = useTheme();
  const { token, loading, restored, logout } = useAuth();
  const [lockChecked, setLockChecked] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Introducción: se muestra solo la primera vez (se puede repetir desde Ajustes)
  useEffect(() => {
    (async () => {
      try {
        const done = await AsyncStorage.getItem(ONBOARDING_KEY);
        setShowOnboarding(!done);
      } catch {}
      setOnboardingReady(true);
    })();
  }, []);

  // Bloqueo con huella/Face ID (se activa en Ajustes): se pide al abrir la app con una
  // sesión guardada y cada vez que vuelve de segundo plano. No aplica sin sesión.
  useEffect(() => {
    let cancelled = false;
    if (loading) return undefined;
    if (!token) {
      setIsLocked(false);
      setLockChecked(true);
      return undefined;
    }
    (async () => {
      const enabled = await getBiometricLockEnabled();
      if (cancelled) return;
      setIsLocked(enabled && restored);
      setLockChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, token, restored]);

  useEffect(() => {
    if (!token) return undefined;
    let previous = AppState.currentState;
    const sub = AppState.addEventListener("change", async (next) => {
      if (/background/.test(previous) && next === "active") {
        if (await getBiometricLockEnabled()) {
          setIsLocked(true);
        }
      }
      previous = next;
    });
    return () => sub.remove();
  }, [token]);

  if (loading || !lockChecked || !onboardingReady) return <SplashScreen />;

  if (showOnboarding) {
    return (
      <>
        <StatusBar style={isDark ? "light" : "dark"} />
        <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
      </>
    );
  }

  // El fondo de la ventana sigue el tema (evita franjas blancas bajo la barra de navegación)
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: colors.page,
      card: colors.surface,
    },
  };

  // La pantalla de huella se dibuja ENCIMA de la app (no en su lugar): así el formulario o la
  // pantalla en la que estabas se conservan intactos al desbloquear.
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer theme={navTheme}>
        <StatusBar style={isDark ? "light" : "dark"} />
        {token ? (
          <ExchangeRateProvider>
            <DataProvider>
              <GuideProvider>
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
                      <Stack.Screen
                        name="ItemDates"
                        component={ItemDatesScreen}
                      />
                      <Stack.Screen
                        name="Transfer"
                        component={TransferScreen}
                      />
                      <Stack.Screen
                        name="ExchangeRate"
                        component={ExchangeRateScreen}
                      />
                      <Stack.Screen name="Profile" component={ProfileScreen} />
                      <Stack.Screen name="About" component={AboutScreen} />
                      <Stack.Screen
                        name="GettingStarted"
                        component={GettingStartedScreen}
                      />
                      <Stack.Screen
                        name="HelpCenter"
                        component={HelpCenterScreen}
                      />
                      <Stack.Screen
                        name="Onboarding"
                        component={OnboardingReplay}
                      />
                      <Stack.Screen
                        name="RateNotifications"
                        component={RateNotificationsScreen}
                      />
                    </Stack.Navigator>
                    <Toast />
                    <DailyRateWatcher />
                  </View>
                </RateNotificationsProvider>
              </GuideProvider>
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
      {token && isLocked ? (
        <View style={StyleSheet.absoluteFill}>
          <BiometricLockScreen
            onUnlock={() => setIsLocked(false)}
            onSignOut={logout}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Introducción abierta otra vez desde Ajustes. */
function OnboardingReplay({ navigation }) {
  return <OnboardingScreen replay onComplete={() => navigation.goBack()} />;
}

function ThemedRoot({ children }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>{children}</View>
  );
}

NativeSplash.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  useEffect(() => {
    if (fontsLoaded) NativeSplash.hideAsync().catch(() => {});
  }, [fontsLoaded]);
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedRoot>
            <AppNavigator />
          </ThemedRoot>
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
