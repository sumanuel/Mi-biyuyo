import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authService from "../services/api/authService";

const TOKEN_KEY = "@mb_token";
const USER_KEY = "@mb_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (t && u) {
          setToken(t);
          setUser(JSON.parse(u));
          // Refresh user from API silently
          try {
            const fresh = await authService.getMe(t);
            setUser(fresh);
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
          } catch {}
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { token: t, user: u } = await authService.login(email, password);
    setToken(t);
    setUser(u);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, t],
      [USER_KEY, JSON.stringify(u)],
    ]);
  }, []);

  // Crea la cuenta: todavía no hay sesión, primero se verifica el correo con un código
  const register = useCallback(
    (name, email, password) => authService.register(name, email, password),
    [],
  );

  const verifyEmail = useCallback(async (email, code) => {
    const { token: t, user: u } = await authService.verifyEmail(email, code);
    setToken(t);
    setUser(u);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, t],
      [USER_KEY, JSON.stringify(u)],
    ]);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  }, []);

  const updateUser = useCallback(
    async (data) => {
      const updated = await authService.updateProfile(token, data);
      setUser(updated);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
    },
    [token],
  );

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        login,
        register,
        verifyEmail,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
