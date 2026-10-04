import { createAuthClient } from "./client";

export const getLedger = async (token) => {
  const { data } = await createAuthClient(token).get("/ledger");
  return data;
};

export const getReceipt = async (token, transactionId) => {
  const { data } = await createAuthClient(token).get(
    `/ledger/receipt/${transactionId}`,
  );
  return data;
};

export const createEntity = async (token, body) => {
  const { data } = await createAuthClient(token).post("/entities", body);
  return data;
};

export const updateEntity = async (token, id, body) => {
  const { data } = await createAuthClient(token).put(`/entities/${id}`, body);
  return data;
};

export const deleteEntity = async (token, id) => {
  const { data } = await createAuthClient(token).delete(`/entities/${id}`);
  return data;
};

export const createTransfer = async (token, body) => {
  const { data } = await createAuthClient(token).post("/transfers", body);
  return data;
};

export const deleteTransfer = async (token, id) => {
  const { data } = await createAuthClient(token).delete(`/transfers/${id}`);
  return data;
};

export const reorderEntities = async (token, ids) => {
  const { data } = await createAuthClient(token).put("/entities/order", {
    ids,
  });
  return data;
};

export const createPlanned = async (token, body) => {
  const { data } = await createAuthClient(token).post("/planned", body);
  return data;
};

export const updatePlanned = async (token, id, body) => {
  const { data } = await createAuthClient(token).put(`/planned/${id}`, body);
  return data;
};

export const deletePlanned = async (token, id) => {
  const { data } = await createAuthClient(token).delete(`/planned/${id}`);
  return data;
};
