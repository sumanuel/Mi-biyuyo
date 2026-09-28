import { createAuthClient } from "./client";

export const getSummary = async (token, month, year) => {
  const { data } = await createAuthClient(token).get("/stats/summary", {
    params: { month, year },
  });
  return data;
};

export const getByCategory = async (token, params = {}) => {
  const { data } = await createAuthClient(token).get("/stats/by-category", {
    params,
  });
  return data;
};

export const getTrend = async (token, months = 6) => {
  const { data } = await createAuthClient(token).get("/stats/trend", {
    params: { months },
  });
  return data;
};
