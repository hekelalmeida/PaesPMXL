import { db, json } from "./_shared/db.mjs";
import { requireAuth } from "./_shared/auth.mjs";

export default async (req) => {
  const a = await requireAuth(req);
  if (a.error) return a.error;
  try {
    const { rows } = await db().query("SELECT revision,updated_at,updated_by FROM paes_state WHERE id=1");
    return json(rows[0] || { revision: 0 });
  } catch (e) {
    console.error(e);
    return json({ error: "Falha ao verificar atualização." }, 500);
  }
};

export const config = { path: "/api/revision" };
