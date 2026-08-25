import { db, json } from "./_shared/db.mjs";
import { requireAuth, canEdit } from "./_shared/auth.mjs";

export default async (req) => {
  const a = await requireAuth(req);
  if (a.error) return a.error;
  const user = a.user;

  try {
    if (req.method === "GET") {
      const { rows } = await db().query("SELECT revision,state,updated_at,updated_by FROM paes_state WHERE id=1");
      const row = rows[0] || { revision: 0, state: null };
      return json(row);
    }

    if (req.method === "PUT") {
      if (!canEdit(user)) return json({ error: "Acesso somente para visualização." }, 403);
      const { state, expectedRevision } = await req.json();
      if (!state || typeof state !== "object") return json({ error: "Estado inválido." }, 400);

      const client = await db().connect();
      try {
        await client.query("BEGIN");
        const current = await client.query("SELECT revision FROM paes_state WHERE id=1 FOR UPDATE");
        const revision = Number(current.rows[0]?.revision || 0);
        if (Number(expectedRevision || 0) !== revision) {
          await client.query("ROLLBACK");
          return json({ error: "A PAES foi atualizada por outro usuário.", revision }, 409);
        }
        const next = revision + 1;
        await client.query(
          `UPDATE paes_state SET revision=$1,state=$2::jsonb,updated_at=now(),updated_by=$3 WHERE id=1`,
          [next, JSON.stringify(state), user.login]
        );
        await client.query("COMMIT");
        return json({ revision: next, updatedBy: user.login });
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    return json({ error: "Método não permitido." }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "Falha ao acessar a PAES online." }, 500);
  }
};

export const config = { path: "/api/state" };
