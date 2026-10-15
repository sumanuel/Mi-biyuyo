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

/** Elimina una categoría propia; si tiene movimientos, reassignTo indica a cuál pasarlos. */
export const deleteCategory = async (token, id, reassignTo) => {
  const { data } = await createAuthClient(token).delete(`/categories/${id}`, {
    params: reassignTo ? { reassign_to: reassignTo } : undefined,
  });
  return data;
};

export const reorderCategories = async (token, ids) => {
  const { data } = await createAuthClient(token).put("/categories/order", {
    ids,
  });
  return data;
};

/** Oculta o muestra una categoría (propia o predeterminada) en «Nuevo movimiento». */
export const setCategoryHidden = async (token, id, hidden) => {
  const { data } = await createAuthClient(token).put(
    `/categories/${id}/visibility`,
    { hidden },
  );
  return data;
};
