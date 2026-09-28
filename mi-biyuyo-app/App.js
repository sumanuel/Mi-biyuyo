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
  { name: "Dashboard", label: "Inicio", icon: "home" },
  { name: "Transactions", label: "Movimientos", icon: "wallet" },
  { name: "Categories", label: "Categorías", icon: "grid" },
  { name: "Profile", label: "Perfil", icon: "person" },
];

function TabBar({ state, descriptors, navigation }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.tabBarWrap,
        { backgroundColor: colors.tabBar, borderColor: colors.border },
      ]}
    >
      {state.routes.map((route, index) => {
        const meta = NAV_TABS.find((t) => t.name === route.name) || {
          label: route.name,
          icon: "ellipse",
        };
        const focused = state.index === index;
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={() => navigation.navigate(route.name)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.tabIconWrap,
                focused && { backgroundColor: colors.accentSoft },
              ]}
            >
              <Ionicons
                name={focused ? meta.icon : `${meta.icon}-outline`}
                size={s(22)}
                color={focused ? colors.accent : colors.muted}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color: focused ? colors.accent : colors.muted },
              ]}
            >
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
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
            <Stack.Screen
              name="AddTransaction"
              component={AddTransactionScreen}
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="TransactionDetail"
              component={TransactionDetailScreen}
            />
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
    paddingBottom: Platform.OS === "ios" ? s(20) : s(8),
    paddingTop: s(8),
    paddingHorizontal: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: "#1E1B4B",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  tabItem: { flex: 1, alignItems: "center", gap: s(3) },
  tabIconWrap: {
    width: s(40),
    height: s(28),
    borderRadius: s(14),
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: { fontSize: rf(10), fontWeight: "600" },
});
