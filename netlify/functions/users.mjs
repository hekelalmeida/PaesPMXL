import { db, json } from "./_shared/db.mjs";
import { requireAuth, isDeveloper, normalizeLogin, makePassword } from "./_shared/auth.mjs";

const VALID = new Set(["developer","bordo","pmb","view"]);

export default async (req, context) => {
  const a = await requireAuth(req);
  if (a.error) return a.error;
  if (!isDeveloper(a.user)) return json({ error: "Acesso exclusivo do Desenvolvedor." }, 403);

  try {
    const url = new URL(req.url);
    const pathLogin = decodeURIComponent(url.pathname.split("/").pop() || "");

    if (req.method === "GET") {
      const { rows } = await db().query("SELECT name,login,role,must_change_password,created_at,updated_at FROM paes_users ORDER BY login");
      return json({ users: rows });
    }

    if (req.method === "POST") {
      const { name, login, password, role, forcePasswordChange } = await req.json();
      const normalized = normalizeLogin(login);
      if (!name || !normalized || !VALID.has(role)) return json({ error: "Dados do usuário inválidos." }, 400);
      const mustChange = normalized === "HSA" ? false : (String(password || "") === "1234" || !!forcePasswordChange);

      const existing = await db().query("SELECT id FROM paes_users WHERE login=$1", [normalized]);
      if (existing.rows[0]) {
        if (password) {
          const p = makePassword(password);
          await db().query(
            "UPDATE paes_users SET name=$1,role=$2,password_salt=$3,password_hash=$4,must_change_password=$5,updated_at=now() WHERE login=$6",
            [name, role, p.salt, p.hash, mustChange, normalized]
          );
        } else {
          await db().query("UPDATE paes_users SET name=$1,role=$2,must_change_password=CASE WHEN $3 THEN TRUE ELSE must_change_password END,updated_at=now() WHERE login=$4", [name, role, !!forcePasswordChange, normalized]);
        }
      } else {
        if (!password) return json({ error: "Informe uma senha para o novo usuário." }, 400);
        const p = makePassword(password);
        await db().query(
          "INSERT INTO paes_users(name,login,role,password_salt,password_hash,must_change_password) VALUES($1,$2,$3,$4,$5,$6)",
          [name, normalized, role, p.salt, p.hash, mustChange]
        );
      }
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      const normalized = normalizeLogin(pathLogin);
      if (!normalized || normalized === "USERS") return json({ error: "Informe o login." }, 400);
      if (normalized === "HSA") return json({ error: "O usuário HSA não pode ser excluído." }, 400);
      await db().query("DELETE FROM paes_users WHERE login=$1", [normalized]);
      return json({ ok: true });
    }

    return json({ error: "Método não permitido." }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "Falha ao gerenciar usuários." }, 500);
  }
};

export const config = { path: ["/api/users", "/api/users/*"] };
