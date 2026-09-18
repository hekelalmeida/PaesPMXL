import { db, json } from "./_shared/db.mjs";
import { requireAuth, isDeveloper } from "./_shared/auth.mjs";

function clean(v){ return String(v ?? "").trim(); }
function isExecStatus(v){
  const s=clean(v).toUpperCase();
  return s.includes("EXECUTADO FINAL") || s.includes("EXECUTADO PAES ANTERIOR");
}
async function ensureTable(client){
  await client.query(`CREATE TABLE IF NOT EXISTS paes_history (
    week TEXT PRIMARY KEY,
    state JSONB NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT NOT NULL
  )`);
}
function summary(row){
  const state=row.state||{};
  const data=Array.isArray(state.data)?state.data:[];
  return {
    week:row.week,
    total:data.length,
    executed:data.filter(r=>isExecStatus(r?.status)).length,
    hh:data.reduce((a,r)=>a+(Number(r?.hh)||0),0),
    archivedAt:row.archived_at,
    archivedBy:row.archived_by,
    updatedAt:row.updated_at,
    updatedBy:row.updated_by
  };
}
export default async (req) => {
  const a=await requireAuth(req);if(a.error)return a.error;
  const user=a.user;
  const url=new URL(req.url);
  const parts=url.pathname.split('/').filter(Boolean);
  const raw=parts.length>=3?decodeURIComponent(parts.slice(2).join('/')):'';
  const week=clean(raw);
  const client=await db().connect();
  try{
    await ensureTable(client);
    if(req.method==='GET'&&!week){
      const {rows}=await client.query('SELECT week,state,archived_at,archived_by,updated_at,updated_by FROM paes_history ORDER BY archived_at DESC');
      return json({history:rows.map(summary)});
    }
    if(req.method==='GET'&&week){
      const {rows}=await client.query('SELECT week,state,archived_at,archived_by,updated_at,updated_by FROM paes_history WHERE week=$1',[week]);
      if(!rows[0])return json({error:'Carteira histórica não encontrada.'},404);
      return json({...summary(rows[0]),state:rows[0].state});
    }
    if(req.method==='POST'&&!week){
      if(!['developer','bordo','pmb'].includes(user.role))return json({error:'Acesso somente para visualização.'},403);
      const body=await req.json();const w=clean(body?.week),state=body?.state;
      if(!w||!state||typeof state!=='object')return json({error:'Histórico inválido.'},400);
      // Congelamento idempotente: repetir uma importação interrompida é seguro
      // quando o snapshot já arquivado é exatamente igual ao estado vigente.
      const existing=await client.query('SELECT state,archived_at FROM paes_history WHERE week=$1',[w]);
      if(existing.rows[0]){
        const same=await client.query('SELECT $1::jsonb = $2::jsonb AS same',[JSON.stringify(existing.rows[0].state),JSON.stringify(state)]);
        if(same.rows[0]?.same)return json({ok:true,week:w,archivedAt:existing.rows[0].archived_at,alreadyArchived:true});
        return json({error:`${w} já existe no histórico online com conteúdo diferente. A importação foi interrompida para proteger o histórico.`},409);
      }
      const q=await client.query(`INSERT INTO paes_history(week,state,archived_by,updated_by)
        VALUES($1,$2::jsonb,$3,$3) RETURNING archived_at`,[w,JSON.stringify(state),user.login]);
      return json({ok:true,week:w,archivedAt:q.rows[0].archived_at,alreadyArchived:false});
    }
    if(req.method==='PUT'&&week){
      if(!isDeveloper(user))return json({error:'Somente o Desenvolvedor pode alterar uma carteira histórica.'},403);
      const body=await req.json();const state=body?.state;
      if(!state||typeof state!=='object')return json({error:'Estado histórico inválido.'},400);
      const q=await client.query('UPDATE paes_history SET state=$2::jsonb,updated_at=now(),updated_by=$3 WHERE week=$1 RETURNING archived_at',[week,JSON.stringify(state),user.login]);
      if(!q.rows[0])return json({error:'Carteira histórica não encontrada.'},404);
      return json({ok:true,week,archivedAt:q.rows[0].archived_at});
    }
    if(req.method==='DELETE'&&week){
      if(!isDeveloper(user))return json({error:'Somente o Desenvolvedor pode excluir uma carteira histórica.'},403);
      await client.query('DELETE FROM paes_history WHERE week=$1',[week]);
      return json({ok:true});
    }
    return json({error:'Método não permitido.'},405);
  }catch(e){console.error(e);return json({error:'Falha ao acessar o histórico online.'},500)}finally{client.release()}
};
export const config={path:["/api/history","/api/history/*"]};
