import { db } from "./_shared/db.mjs";

function clean(v){ return String(v ?? "").trim(); }
function dateKey(v){
  const s=clean(v);
  return /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s : "";
}
function isFlagged(r){ return r?.flagAplat === true; }

export default async () => {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const q = await client.query("SELECT revision,state FROM paes_state WHERE id=1 FOR UPDATE");
    const row = q.rows[0];
    if (!row?.state) { await client.query("ROLLBACK"); return; }

    const state = row.state;
    state.flagHistory = state.flagHistory && typeof state.flagHistory === "object" ? state.flagHistory : {};
    const sources = [
      ["Carteira Completa", Array.isArray(state.data)?state.data:[], "id"],
      ["Quebra de Carteira", Array.isArray(state.breakData)?state.breakData:[], "idQuebra"],
      ["Serviços Adicionais", Array.isArray(state.additionalData)?state.additionalData:[], "idAdicional"]
    ];

    let added = 0;
    const nowIso = new Date().toISOString();

    for (const [source, rows, idField] of sources) {
      for (const r of rows) {
        if (!isFlagged(r)) continue;
        const planned = dateKey(r.data);
        if (!planned) continue;
        if (!Array.isArray(state.flagHistory[planned])) state.flagHistory[planned] = [];
        const idOrigem = clean(r[idField] || "");
        const key = [source,idOrigem,clean(r.ordem),clean(r.operacao),clean(r.aplat),clean(r.centro),clean(r.tag),planned].join("|");
        if (state.flagHistory[planned].some(x=>x._snapshotKey===key)) continue;

        state.flagHistory[planned].push({
          _snapshotKey:key,
          archivedAt:nowIso,
          origem:source,
          idOrigem,
          ordem:clean(r.ordem),
          operacao:clean(r.operacao),
          aplat:clean(r.aplat),
          centro:clean(r.centro),
          texto:clean(r.texto),
          tag:clean(r.tag),
          data:planned,
          status:clean(r.status),
          if:clean(r.if)
        });
        added++;
      }
    }

    if (!added) { await client.query("ROLLBACK"); return; }

    const next = Number(row.revision||0)+1;
    await client.query(
      "UPDATE paes_state SET revision=$1,state=$2::jsonb,updated_at=now(),updated_by='AUTO-FLAGS' WHERE id=1",
      [next, JSON.stringify(state)]
    );
    await client.query("COMMIT");
    console.log(`Histórico Fleg Aplat: ${added} registro(s) arquivado(s). Revisão ${next}.`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    throw e;
  } finally {
    client.release();
  }
};
