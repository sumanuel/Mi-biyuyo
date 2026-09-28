import { createAuthClient } from "./client";

export const getTransactions = async (token, params = {}) => {
  const { data } = await createAuthClient(token).get("/transactions", {
    params,
  });
  return data;
};

export const getTransaction = async (token, id) => {
  const { data } = await createAuthClient(token).get(`/transactions/${id}`);
  return data;
};

export const createTransaction = async (token, body) => {
  const { data } = await createAuthClient(token).post("/transactions", body);
  return data;
};

export const updateTransaction = async (token, id, body) => {
  const { data } = await createAuthClient(token).put(
    `/transactions/${id}`,
    body,
  );
  return data;
};

export const deleteTransaction = async (token, id) => {
  const { data } = await createAuthClient(token).delete(`/transactions/${id}`);
  return data;
};

export const getPayments = async (token, transactionId) => {
  const { data } = await createAuthClient(token).get(
    `/transactions/${transactionId}/payments`,
  );
  return data;
};

export const createPayment = async (token, transactionId, body) => {
  const { data } = await createAuthClient(token).post(
    `/transactions/${transactionId}/payments`,
    body,
  );
  return data;
};

export const deletePayment = async (token, transactionId, paymentId) => {
  const { data } = await createAuthClient(token).delete(
    `/transactions/${transactionId}/payments/${paymentId}`,
  );
  return data;
};
