import { createAuthClient } from "./client";

/** Anuncios vigentes para este usuario (los de la campanita), del más nuevo al más viejo. */
export const getAnnouncements = async (token) => {
  const { data } = await createAuthClient(token).get("/announcements");
  return data;
};
