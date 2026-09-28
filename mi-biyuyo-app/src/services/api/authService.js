import client, { createAuthClient } from "./client";

export const login = async (email, password) => {
  const { data } = await client.post("/auth/login", { email, password });
  return data;
};

export const register = async (name, email, password) => {
  const { data } = await client.post("/auth/register", {
    name,
    email,
    password,
  });
  return data;
};

export const getMe = async (token) => {
  const { data } = await createAuthClient(token).get("/auth/me");
  return data;
};

export const updateProfile = async (token, body) => {
  const { data } = await createAuthClient(token).patch("/auth/me", body);
  return data;
};

export const forgotPassword = async (email) => {
  const { data } = await client.post("/auth/forgot-password", { email });
  return data;
};

export const resetPassword = async (token, password) => {
  const { data } = await client.post("/auth/reset-password", {
    token,
    password,
  });
  return data;
};
