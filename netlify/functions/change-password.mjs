import { db, json } from "./_shared/db.mjs";
import { requireAuth, makePassword } from "./_shared/auth.mjs";

export default async (req) => {
  const a = await requireAuth(req);
  if (a.error) return a.error;
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { newPassword } = await req.json();
    const password = String(newPassword || "");

    if (password.length < 6) return json({ error: "A nova senha deve ter pelo menos 6 caracteres." }, 400);
    if (password === "1234") return json({ error: "A nova senha não pode ser 1234." }, 400);

    const p = makePassword(password);
    await db().query(
      `UPDATE paes_users
       SET password_salt=$1,password_hash=$2,must_change_password=FALSE,updated_at=now()
       WHERE id=$3`,
      [p.salt, p.hash, a.user.id]
    );

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Falha ao alterar a senha." }, 500);
  }
};

export const config = { path: "/api/change-password" };
