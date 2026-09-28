import { createAuthClient } from "./client";

export const getRates = async (token) => {
  const { data } = await createAuthClient(token).get("/exchange-rates");
  return data;
};

export const updateRates = async (token, usd_to_ves, binance_to_ves) => {
  const { data } = await createAuthClient(token).put("/exchange-rates", {
    usd_to_ves,
    binance_to_ves,
  });
  return data;
};

export const fetchExternal = async (token) => {
  const { data } = await createAuthClient(token).post("/exchange-rates/fetch");
  return data;
};
