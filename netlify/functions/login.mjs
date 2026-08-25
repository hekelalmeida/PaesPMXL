import { db, json } from "./_shared/db.mjs";
import { normalizeLogin, makePassword, verifyPassword, createSession } from "./_shared/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const { login, password } = await req.json();
    const normalized = normalizeLogin(login);
    if (!normalized || !password) return json({ error: "Informe login e senha." }, 400);

    let { rows } = await db().query("SELECT * FROM paes_users WHERE login=$1", [normalized]);
    let user = rows[0];

    // Bootstrap seguro do HSA: só cria se ainda não existir.
    if (!user && normalized === "HSA") {
      const initial = process.env.PAES_HSA_INITIAL_PASSWORD;
      if (!initial) return json({ error: "Defina PAES_HSA_INITIAL_PASSWORD no Netlify antes do primeiro login." }, 503);
      if (String(password) !== String(initial)) return json({ error: "Login ou senha inválidos." }, 401);

      const p = makePassword(password);
      const created = await db().query(
        `INSERT INTO paes_users(name,login,role,password_salt,password_hash)
         VALUES('HSA','HSA','developer',$1,$2)
         RETURNING *`,
        [p.salt, p.hash]
      );
      user = created.rows[0];
    }

    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      return json({ error: "Login ou senha inválidos." }, 401);
    }

    const token = await createSession(user.id);
    return json({
      token,
      user: { name: user.name, login: user.login, role: user.role }
    });
  } catch (e) {
    console.error(e);
    return json({ error: "Falha no login." }, 500);
  }
};

export const config = { path: "/api/login" };
