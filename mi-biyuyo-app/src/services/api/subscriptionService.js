import { createAuthClient } from "./client";

/** Estado del plan y planes a la venta (precio y días). */
export const getSubscription = async (token) => {
  const { data } = await createAuthClient(token).get("/subscription");
  return data;
};
