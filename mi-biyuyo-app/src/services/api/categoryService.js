import { createAuthClient } from "./client";

export const getCategories = async (token) => {
  const { data } = await createAuthClient(token).get("/categories");
  return data;
};

export const createCategory = async (token, body) => {
  const { data } = await createAuthClient(token).post("/categories", body);
  return data;
};

export const updateCategory = async (token, id, body) => {
  const { data } = await createAuthClient(token).put(`/categories/${id}`, body);
  return data;
};

export const deleteCategory = async (token, id) => {
  const { data } = await createAuthClient(token).delete(`/categories/${id}`);
  return data;
};
