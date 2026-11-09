import { createAuthClient } from "./client";

/** Estado del plan y planes a la venta (precio y días). */
export const getSubscription = async (token) => {
  const { data } = await createAuthClient(token).get("/subscription");
  return data;
};

/** Cómo pagar: cuentas de cobro activas y lo que cuesta cada plan en USD y en bolívares. */
export const getReceivers = async (token) => {
  const { data } = await createAuthClient(token).get("/subscription/receivers");
  return data;
};

/** «Ya pagué»: informa un pago para que lo revisen. */
export const createPayment = async (token, body) => {
  const { data } = await createAuthClient(token).post("/subscription/payments", body);
  return data;
};

/** Mis pagos y su estado. */
export const getPayments = async (token) => {
  const { data } = await createAuthClient(token).get("/subscription/payments");
  return data;
};

/** Canjear un código: suma sus días de Premium. */
export const redeemCode = async (token, code) => {
  const { data } = await createAuthClient(token).post("/subscription/redeem", { code });
  return data;
};
