import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import pg from 'pg';

const {Pool}=pg;
const app=Fastify({logger:true,bodyLimit:2*1024*1024,requestTimeout:30000});
const PORT=Number(process.env.PORT||8080);
const DATABASE_URL=process.env.DATABASE_URL;
if(!DATABASE_URL)throw new Error('DATABASE_URL is required');
const pool=new Pool({connectionString:DATABASE_URL,max:Number(process.env.DB_POOL_MAX||30),idleTimeoutMillis:30000,connectionTimeoutMillis:10000,ssl:process.env.DB_SSL==='false'?false:{rejectUnauthorized:false}});
const corsOrigins=(process.env.CORS_ORIGINS||'https://trungtuyen.github.io').split(',').map(x=>x.trim()).filter(Boolean);

await app.register(cors,{origin:corsOrigins,credentials:false});
await app.register(compress,{global:true,encodings:['br','gzip','deflate']});
await app.register(rateLimit,{max:Number(process.env.RATE_LIMIT_MAX||600),timeWindow:'1 minute'});
if(process.env.JWT_SECRET)await app.register(jwt,{secret:process.env.JWT_SECRET});

function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7).trim():''}
function slug(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)}
async function authenticate(req,reply){
  if(req.url==='/v1/health')return;
  if(process.env.JWT_SECRET){try{await req.jwtVerify();return}catch(_){return reply.code(401).send({error:'unauthorized'})}}
  const dev=process.env.API_AUTH_TOKEN;
  if(dev&&bearer(req)===dev){req.user={role:'super_admin'};return}
  if(process.env.ALLOW_ANON_AGGREGATES==='true'&&req.method==='GET'&&req.url.startsWith('/v1/aggregates'))return;
  return reply.code(401).send({error:'unauthorized'});
}
app.addHook('preHandler',authenticate);

function role(req){return req.user?.role||req.user?.scope||''}
function userProvince(req){return req.user?.provinceKey||req.user?.province_key||''}
function userCommune(req){return req.user?.communeCode||req.user?.commune_code||''}
function ensureScope(req,reply,province,commune=''){
  const r=role(req);if(r==='super_admin'||r==='national_admin')return true;
  if(r==='province_admin'&&province&&province===userProvince(req))return true;
  if(r==='commune_admin'&&province===userProvince(req)&&commune&&commune===userCommune(req))return true;
  reply.code(403).send({error:'forbidden_scope'});return false;
}
function ensureCommuneDataScope(req,reply,province,commune=''){
  const r=role(req);
  if(r==='super_admin')return true;
  if(r==='commune_admin'&&province===userProvince(req)&&commune&&commune===userCommune(req))return true;
  reply.code(403).send({error:'commune_detail_only'});return false;
}
function clampInt(v,min,max,def){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):def}
function metricObj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function sumMetrics(rows){
  const out={total:0,households:0,villages:0,aged1518:0,tn1518:0,age1560:0,mc1560:0,disabilities:0,issues:0,errorIssues:0,warningIssues:0,schoolErrors:0,ageBands:{}};
  for(const row of rows){const m=metricObj(row.metrics);for(const k of ['total','households','villages','aged1518','tn1518','age1560','mc1560','disabilities','issues','errorIssues','warningIssues','schoolErrors'])out[k]+=Number(m[k])||0;for(const [k,v] of Object.entries(metricObj(m.ageBands)))out.ageBands[k]=(out.ageBands[k]||0)+(Number(v)||0)}
  out.rate1518=out.aged1518?Math.round(out.tn1518/out.aged1518*10000)/100:0;
  out.notMcRate=out.age1560?Math.round((out.age1560-out.mc1560)/out.age1560*10000)/100:0;
  return out;
}
function encodeCursor(row){return Buffer.from(JSON.stringify([row.updated_at,row.person_id])).toString('base64url')}
function decodeCursor(v){try{const [ts,id]=JSON.parse(Buffer.from(String(v||''),'base64url').toString('utf8'));return {ts,id}}catch(_){return null}}

app.get('/v1/health',async()=>({ok:true,service:'pcgdxmc-api',version:'1.0.0',time:new Date().toISOString()}));

app.post('/v1/summaries/upsert',async(req,reply)=>{
  const b=req.body||{},year=clampInt(b.year,2000,2100,0),province=String(b.provinceKey||''),name=String(b.communeName||'').trim();
  const commune=String(b.communeCode||'').trim()||slug(name);
  if(!year||!province||!commune||!name)return reply.code(400).send({error:'missing_scope_fields'});
  if(!ensureCommuneDataScope(req,reply,province,commune))return;
  const metrics=metricObj(b.metrics),client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query(`INSERT INTO commune_summaries(survey_year,province_key,province_name,commune_code,commune_name,schema_version,app_version,metrics,checksum,source_count,generated_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,now())
      ON CONFLICT(survey_year,province_key,commune_code) DO UPDATE SET province_name=EXCLUDED.province_name,commune_name=EXCLUDED.commune_name,schema_version=EXCLUDED.schema_version,app_version=EXCLUDED.app_version,metrics=EXCLUDED.metrics,checksum=EXCLUDED.checksum,source_count=EXCLUDED.source_count,generated_at=EXCLUDED.generated_at,updated_at=now()`,
      [year,province,String(b.provinceName||province),commune,name,clampInt(b.schemaVersion,1,99,1),String(b.appVersion||''),JSON.stringify(metrics),String(b.checksum||''),clampInt(b.sourceCount,0,1000000,0),b.generatedAt?new Date(b.generatedAt):null]);
    await client.query(`INSERT INTO audit_log(actor_id,actor_role,province_key,commune_code,action,entity_type,entity_id,request_id,details) VALUES($1,$2,$3,$4,'UPSERT','commune_summary',$5,$6,$7::jsonb)`,[req.user?.sub||'',role(req),province,commune,`${year}|${province}|${commune}`,req.id,JSON.stringify({checksum:b.checksum||''})]);
    await client.query('COMMIT');return {ok:true,communeCode:commune,updatedAt:new Date().toISOString()};
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
});

app.get('/v1/aggregates',async(req,reply)=>{
  const q=req.query||{},level=['commune','province','national'].includes(q.level)?q.level:'commune',year=clampInt(q.year,2000,2100,new Date().getFullYear());
  let province=String(q.province||''),commune=String(q.commune||'');const r=role(req);
  if(r==='province_admin')province=userProvince(req);
  if(r==='commune_admin'){province=userProvince(req);commune=userCommune(req)}
  if(level!=='national'&&!province)return reply.code(400).send({error:'province_required'});
  if(level==='national'&&r!=='super_admin'&&r!=='national_admin'&&!(process.env.ALLOW_ANON_AGGREGATES==='true'&&!r))return reply.code(403).send({error:'forbidden_scope'});
  if(level==='province'&&r&&r!=='super_admin'&&r!=='national_admin'&&province!==userProvince(req))return reply.code(403).send({error:'forbidden_scope'});
  if(level==='commune'&&r&&r!=='super_admin'&&r!=='national_admin'&&!ensureScope(req,reply,province,commune||userCommune(req)))return;
  const params=[year],where=['survey_year=$1'];if(province){params.push(province);where.push(`province_key=$${params.length}`)}if(commune){params.push(commune);where.push(`commune_code=$${params.length}`)}
  const {rows}=await pool.query(`SELECT survey_year AS year,province_key AS "provinceKey",province_name AS "provinceName",commune_code AS "communeCode",commune_name AS "communeName",metrics,checksum,updated_at AS "updatedAt" FROM commune_summaries WHERE ${where.join(' AND ')} ORDER BY province_name,commune_name`,params);
  return {source:'server',year,level,rows,metrics:sumMetrics(rows)};
});

app.get('/v1/persons',async(req,reply)=>{
  const q=req.query||{},province=String(q.province||userProvince(req)||''),commune=String(q.commune||userCommune(req)||''),limit=clampInt(q.limit,1,100,50),cursor=decodeCursor(q.cursor);
  if(!province||!commune)return reply.code(400).send({error:'province_and_commune_required'});
  if(!ensureCommuneDataScope(req,reply,province,commune))return;
  const params=[province,commune];let after='';if(cursor){params.push(cursor.ts,cursor.id);after=` AND (updated_at,person_id) > ($3::timestamptz,$4::uuid)`}
  params.push(limit+1);const lim=`$${params.length}`;
  const {rows}=await pool.query(`SELECT person_id,province_key,commune_code,school_id,household_key,full_name,birth_date,sex,updated_at,row_version,payload FROM persons WHERE province_key=$1 AND commune_code=$2 AND deleted_at IS NULL${after} ORDER BY updated_at,person_id LIMIT ${lim}`,params);
  const hasMore=rows.length>limit,items=hasMore?rows.slice(0,limit):rows,nextCursor=hasMore?encodeCursor(items[items.length-1]):null;
  return {items,nextCursor};
});

app.post('/v1/persons/batch',async(req,reply)=>{
  const body=req.body||{},province=String(body.provinceKey||''),commune=String(body.communeCode||''),items=Array.isArray(body.items)?body.items:[];
  if(!province||!commune)return reply.code(400).send({error:'province_and_commune_required'});if(!ensureCommuneDataScope(req,reply,province,commune))return;
  if(!items.length||items.length>200)return reply.code(400).send({error:'batch_size_must_be_1_to_200'});
  const client=await pool.connect();let upserted=0;
  try{await client.query('BEGIN');for(const x of items){const id=String(x.personId||'');if(!id)continue;await client.query(`INSERT INTO persons(province_key,person_id,commune_code,school_id,household_key,full_name,birth_date,sex,updated_at,row_version,payload)
    VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,now(),1,$9::jsonb)
    ON CONFLICT(province_key,person_id) DO UPDATE SET commune_code=EXCLUDED.commune_code,school_id=EXCLUDED.school_id,household_key=EXCLUDED.household_key,full_name=EXCLUDED.full_name,birth_date=EXCLUDED.birth_date,sex=EXCLUDED.sex,payload=EXCLUDED.payload,updated_at=now(),row_version=persons.row_version+1`,
    [province,id,commune,x.schoolId||null,x.householdKey||null,String(x.fullName||''),x.birthDate||null,x.sex??null,JSON.stringify(metricObj(x.payload))]);upserted++}await client.query('COMMIT');return {ok:true,upserted}}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
});

app.setErrorHandler((err,req,reply)=>{req.log.error({err},'request failed');if(err.code==='23505')return reply.code(409).send({error:'conflict'});return reply.code(500).send({error:'internal_error',requestId:req.id})});

app.addHook('onClose',async()=>{await pool.end()});
await app.listen({port:PORT,host:'0.0.0.0'});
