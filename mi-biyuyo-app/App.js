import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { ExchangeRateProvider } from "./src/contexts/ExchangeRateContext";

import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import ForgotPasswordScreen from "./src/screens/auth/ForgotPasswordScreen";

import DashboardScreen from "./src/screens/main/DashboardScreen";
import TransactionsScreen from "./src/screens/main/TransactionsScreen";
import AddTransactionScreen from "./src/screens/main/AddTransactionScreen";
import TransactionDetailScreen from "./src/screens/main/TransactionDetailScreen";
import CategoriesScreen from "./src/screens/main/CategoriesScreen";
import ExchangeRateScreen from "./src/screens/main/ExchangeRateScreen";
import ProfileScreen from "./src/screens/main/ProfileScreen";

import { rf, s, spacing } from "./src/utils/responsive";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const NAV_TABS = [
  { name: "Dashboard",     label: "Inicio",       icon: "home"           },
  { name: "Transactions",  label: "Historial",    icon: "time"           },
  { name: "AddTransaction",label: "Registrar",    icon: "add",  isFab: true },
  { name: "Categories",    label: "Categorías",   icon: "grid"           },
  { name: "Profile",       label: "Ajustes",      icon: "settings"       },
];

function TabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tabBarWrap, { backgroundColor: colors.tabBar, borderColor: colors.border }]}>
      {state.routes.map((route, index) => {
        const meta = NAV_TABS.find((t) => t.name === route.name) || { label: route.name, icon: "ellipse" };
        const focused = state.index === index;

        if (meta.isFab) {
          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabFabWrap}
              onPress={() => navigation.navigate("AddTransaction")}
              activeOpacity={0.85}
            >
              <View style={[styles.tabFab, { backgroundColor: colors.accent }]}>
                <Ionicons name="add" size={s(28)} color="#fff" />
              </View>
              <Text style={[styles.tabLabel, { color: colors.muted }]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={focused ? meta.icon : `${meta.icon}-outline`}
              size={s(22)}
              color={focused ? colors.accent : colors.muted}
            />
            <Text style={[styles.tabLabel, { color: focused ? colors.accent : colors.muted, fontWeight: focused ? "700" : "500" }]}>
              {meta.label}
            </Text>
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
    >
      <Tab.Screen name="Dashboard"     component={DashboardScreen}     />
      <Tab.Screen name="Transactions"  component={TransactionsScreen}  />
      <Tab.Screen name="AddTransaction" component={AddTransactionScreen} />
      <Tab.Screen name="Categories"    component={CategoriesScreen}    />
      <Tab.Screen name="Profile"       component={ProfileScreen}       />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { colors, isDark } = useTheme();
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.page,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: s(36) }}>💰</Text>
        <Text
          style={{
            color: colors.accent,
            fontSize: rf(20),
            fontWeight: "800",
            marginTop: spacing.sm,
          }}
        >
          Mi Biyuyo
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
      {token ? (
        <ExchangeRateProvider>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
            <Stack.Screen name="ExchangeRate" component={ExchangeRateScreen} />
          </Stack.Navigator>
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
  tabBarWrap: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingBottom: Platform.OS === "ios" ? s(20) : s(6),
    paddingTop: s(8),
    paddingHorizontal: spacing.sm,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  tabItem: { flex: 1, alignItems: "center", gap: s(3), paddingVertical: s(2) },
  tabFabWrap: { flex: 1, alignItems: "center", gap: s(3), marginTop: -s(12) },
  tabFab: { width: s(52), height: s(52), borderRadius: s(26), alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#1B4332", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8 },
  tabLabel: { fontSize: rf(10), fontWeight: "500" },
});
