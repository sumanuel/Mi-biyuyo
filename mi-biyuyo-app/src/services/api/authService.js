import client, { createAuthClient } from "./client";

export const login = async (email, password) => {
  const { data } = await client.post("/auth/login", { email, password });
  return data;
};

export const register = async (name, email, password, country) => {
  const { data } = await client.post("/auth/register", {
    name,
    email,
    password,
    ...(country ? { country } : {}),
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

export const resetPassword = async (email, code, password) => {
  const { data } = await client.post("/auth/reset-password", {
    email,
    code,
    password,
  });
  return data;
};

export const verifyEmail = async (email, code) => {
  const { data } = await client.post("/auth/verify-email", { email, code });
  return data;
};

export const resendCode = async (email) => {
  const { data } = await client.post("/auth/resend-code", { email });
  return data;
};
