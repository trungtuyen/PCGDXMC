import {Client, type QueryResultRow} from 'pg';

type Role='super_admin'|'national_admin'|'province_admin'|'commune_admin';
type JsonObject=Record<string,unknown>;

interface Claims extends JsonObject{
  sub:string;
  username:string;
  name:string;
  role:Role;
  provinceKey:string;
  communeCode:string;
  iat:number;
  exp:number;
}

interface UserRow extends QueryResultRow{
  user_id:string;
  username:string;
  display_name:string|null;
  role:Role;
  province_key:string|null;
  commune_code:string|null;
  active:boolean;
}

interface ScopeTarget{
  role:Role;
  province_key:string|null;
  commune_code:string|null;
}

class ApiError extends Error{
  readonly status:number;
  readonly code:string;
  constructor(status:number,code:string){super(code);this.status=status;this.code=code}
}

const ROLES=new Set<Role>(['super_admin','national_admin','province_admin','commune_admin']);
const MAX_BODY_BYTES=2*1024*1024;

function isRecord(value:unknown):value is JsonObject{return !!value&&typeof value==='object'&&!Array.isArray(value)}
function text(value:unknown){return typeof value==='string'?value.trim():''}
function bool(value:unknown,defaultValue=false){return typeof value==='boolean'?value:defaultValue}
function clampInt(value:unknown,min:number,max:number,defaultValue:number){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):defaultValue}
function isUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)}
function isRole(value:unknown):value is Role{return typeof value==='string'&&ROLES.has(value as Role)}
function slug(value:unknown){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)}

function requestId(request:Request){return request.headers.get('cf-ray')||crypto.randomUUID()}
function allowedOrigins(env:Env){return new Set(String(env.CORS_ORIGINS||'https://trungtuyen.github.io').split(',').map(v=>v.trim()).filter(Boolean))}
function corsOrigin(request:Request,env:Env){const origin=request.headers.get('Origin');return origin&&allowedOrigins(env).has(origin)?origin:''}
function responseHeaders(request:Request,env:Env){
  const headers=new Headers({
    'Cache-Control':'no-store',
    'Content-Type':'application/json; charset=utf-8',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy':'no-referrer',
    'Strict-Transport-Security':'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY'
  });
  const origin=corsOrigin(request,env);
  if(origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin')}
  return headers;
}
function json(request:Request,env:Env,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:responseHeaders(request,env)})}

async function readBody(request:Request){
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.toLowerCase().includes('application/json'))throw new ApiError(415,'content_type_must_be_application_json');
  const declared=Number(request.headers.get('content-length')||0);
  if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES)throw new ApiError(413,'payload_too_large');
  let value:unknown;
  try{value=await request.json()}catch{throw new ApiError(400,'invalid_json')}
  if(!isRecord(value))throw new ApiError(400,'json_object_required');
  return value;
}

async function withClient<T>(env:Env,work:(client:Client)=>Promise<T>){
  const client=new Client({connectionString:env.HYPERDRIVE.connectionString});
  await client.connect();
  try{return await work(client)}finally{await client.end()}
}

function bytesToBase64Url(bytes:Uint8Array){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function base64UrlToBytes(value:string){const base64=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');const binary=atob(base64);const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out}
function encodeJson(value:unknown){return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)))}
function decodeJson(value:string):unknown{return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)))}
async function jwtKey(secret:string,usage:KeyUsage[]){return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,usage)}
async function signJwt(env:Env,user:UserRow){
  const now=Math.floor(Date.now()/1000),ttl=clampInt(env.JWT_EXPIRES_IN_SECONDS,300,86400,28800);
  const claims:Claims={sub:String(user.user_id),username:user.username,name:user.display_name||user.username,role:user.role,provinceKey:user.province_key||'',communeCode:user.commune_code||'',iat:now,exp:now+ttl};
  const input=`${encodeJson({alg:'HS256',typ:'JWT'})}.${encodeJson(claims)}`;
  const signature=await crypto.subtle.sign('HMAC',await jwtKey(env.JWT_SECRET,['sign']),new TextEncoder().encode(input));
  return {token:`${input}.${bytesToBase64Url(new Uint8Array(signature))}`,claims,expiresIn:ttl};
}
async function verifyJwt(env:Env,token:string){
  const parts=token.split('.');if(parts.length!==3)throw new ApiError(401,'unauthorized');
  const input=`${parts[0]}.${parts[1]}`;
  let valid=false;
  try{valid=await crypto.subtle.verify('HMAC',await jwtKey(env.JWT_SECRET,['verify']),base64UrlToBytes(parts[2]),new TextEncoder().encode(input))}catch{}
  if(!valid)throw new ApiError(401,'unauthorized');
  let raw:unknown;try{raw=decodeJson(parts[1])}catch{throw new ApiError(401,'unauthorized')}
  if(!isRecord(raw)||!isRole(raw.role)||typeof raw.sub!=='string'||typeof raw.username!=='string'||typeof raw.exp!=='number'||raw.exp<=Math.floor(Date.now()/1000))throw new ApiError(401,'unauthorized');
  return {sub:raw.sub,username:raw.username,name:typeof raw.name==='string'?raw.name:raw.username,role:raw.role,provinceKey:typeof raw.provinceKey==='string'?raw.provinceKey:'',communeCode:typeof raw.communeCode==='string'?raw.communeCode:'',iat:typeof raw.iat==='number'?raw.iat:0,exp:raw.exp} satisfies Claims;
}
async function authenticate(request:Request,env:Env){const auth=request.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))throw new ApiError(401,'unauthorized');return verifyJwt(env,auth.slice(7).trim())}

function canManage(actor:Claims,target:ScopeTarget){
  if(actor.role==='super_admin')return true;
  if(actor.role==='national_admin')return target.role==='province_admin'||target.role==='commune_admin';
  return actor.role==='province_admin'&&target.role==='commune_admin'&&target.province_key===actor.provinceKey;
}
function validateScope(role:Role,provinceKey:string|null,communeCode:string|null){if(role==='province_admin')return !!provinceKey;if(role==='commune_admin')return !!provinceKey&&!!communeCode;return true}
function ensureCommuneDataScope(actor:Claims,province:string,commune:string){return actor.role==='super_admin'||(actor.role==='commune_admin'&&province===actor.provinceKey&&!!commune&&commune===actor.communeCode)}
function ensureScope(actor:Claims,province:string,commune=''){
  if(actor.role==='super_admin'||actor.role==='national_admin')return true;
  if(actor.role==='province_admin'&&province===actor.provinceKey)return true;
  return actor.role==='commune_admin'&&province===actor.provinceKey&&!!commune&&commune===actor.communeCode;
}
async function audit(client:Client,actor:Claims,id:string,action:string,entityType:string,entityId:string,details:JsonObject={}){await client.query(`INSERT INTO audit_log(actor_id,actor_role,province_key,commune_code,action,entity_type,entity_id,request_id,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,[actor.sub,actor.role,actor.provinceKey||null,actor.communeCode||null,action,entityType,entityId,id,JSON.stringify(details)])}

function metricObject(value:unknown){return isRecord(value)?value:{}}
function metricNumber(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0}
function sumMetrics(rows:Array<{metrics:unknown}>){
  const out:JsonObject={total:0,households:0,villages:0,aged1518:0,tn1518:0,age1560:0,mc1560:0,disabilities:0,issues:0,errorIssues:0,warningIssues:0,schoolErrors:0,ageBands:{}};
  const fields=['total','households','villages','aged1518','tn1518','age1560','mc1560','disabilities','issues','errorIssues','warningIssues','schoolErrors'];
  for(const row of rows){const metrics=metricObject(row.metrics);for(const key of fields)out[key]=metricNumber(out[key])+metricNumber(metrics[key]);const bands=metricObject(metrics.ageBands),target=metricObject(out.ageBands);for(const [key,value] of Object.entries(bands))target[key]=metricNumber(target[key])+metricNumber(value)}
  const aged1518=metricNumber(out.aged1518),tn1518=metricNumber(out.tn1518),age1560=metricNumber(out.age1560),mc1560=metricNumber(out.mc1560);
  out.rate1518=aged1518?Math.round(tn1518/aged1518*10000)/100:0;out.notMcRate=age1560?Math.round((age1560-mc1560)/age1560*10000)/100:0;
  return out;
}
function encodeCursor(row:{updated_at:unknown;person_id:unknown}){return encodeJson([row.updated_at,row.person_id])}
function decodeCursor(value:string|null){if(!value)return null;try{const raw=decodeJson(value);if(Array.isArray(raw)&&raw.length===2&&typeof raw[0]==='string'&&typeof raw[1]==='string')return {ts:raw[0],id:raw[1]}}catch{}return null}

async function login(request:Request,env:Env,id:string){
  const body=await readBody(request),username=text(body.username).toLowerCase(),password=typeof body.password==='string'?body.password:'';
  if(!/^[a-z0-9._-]{3,64}$/.test(username)||password.length<8)throw new ApiError(400,'invalid_credentials');
  return withClient(env,async client=>{
    const {rows}=await client.query<UserRow>(`SELECT user_id,username,display_name,role,province_key,commune_code,active FROM app_users WHERE username=$1 AND active=true AND password_hash=crypt($2,password_hash) LIMIT 1`,[username,password]);
    const user=rows[0];if(!user||!isRole(user.role))throw new ApiError(401,'invalid_credentials');
    const signed=await signJwt(env,user);
    await client.query('BEGIN');
    try{await client.query(`UPDATE app_users SET last_login_at=now(),updated_at=now() WHERE user_id=$1`,[user.user_id]);await audit(client,signed.claims,id,'LOGIN','session',String(user.user_id));await client.query('COMMIT')}catch(error){await client.query('ROLLBACK');throw error}
    return {token:signed.token,expiresIn:signed.expiresIn,user:{id:String(user.user_id),username:user.username,displayName:user.display_name||user.username,role:user.role,provinceKey:user.province_key||'',communeCode:user.commune_code||''}};
  });
}

async function listUsers(env:Env,actor:Claims){
  if(!['super_admin','national_admin','province_admin'].includes(actor.role))throw new ApiError(403,'forbidden');
  return withClient(env,async client=>{let sql=`SELECT user_id AS id,username,display_name AS "displayName",role,province_key AS "provinceKey",commune_code AS "communeCode",active,last_login_at AS "lastLoginAt",created_at AS "createdAt" FROM app_users`,params:Array<string>=[];if(actor.role==='national_admin')sql+=` WHERE role IN ('province_admin','commune_admin')`;if(actor.role==='province_admin'){params=[actor.provinceKey];sql+=` WHERE role='commune_admin' AND province_key=$1`}sql+=` ORDER BY role,province_key NULLS FIRST,commune_code NULLS FIRST,username LIMIT 5000`;return {users:(await client.query(sql,params)).rows}});
}

async function createUser(request:Request,env:Env,actor:Claims,id:string){
  const body=await readBody(request),username=text(body.username).toLowerCase(),password=typeof body.password==='string'?body.password:'',displayName=text(body.displayName)||username,roleValue=text(body.role),provinceKey=text(body.provinceKey)||null,communeCode=text(body.communeCode)||null;
  if(!/^[a-z0-9._-]{3,64}$/.test(username))throw new ApiError(400,'invalid_username');if(password.length<12)throw new ApiError(400,'password_too_short');if(!isRole(roleValue))throw new ApiError(400,'invalid_role');if(!validateScope(roleValue,provinceKey,communeCode))throw new ApiError(400,'invalid_scope');
  const target:ScopeTarget={role:roleValue,province_key:provinceKey,commune_code:communeCode};if(!canManage(actor,target))throw new ApiError(403,'forbidden_role_assignment');
  return withClient(env,async client=>{await client.query('BEGIN');try{const {rows}=await client.query(`INSERT INTO app_users(username,password_hash,display_name,role,province_key,commune_code,active) VALUES($1,crypt($2,gen_salt('bf',12)),$3,$4,$5,$6,true) RETURNING user_id AS id,username,display_name AS "displayName",role,province_key AS "provinceKey",commune_code AS "communeCode",active`,[username,password,displayName,roleValue,provinceKey,communeCode]);await audit(client,actor,id,'CREATE_USER','app_user',String(rows[0].id),{username,role:roleValue,provinceKey,communeCode});await client.query('COMMIT');return {user:rows[0]}}catch(error){await client.query('ROLLBACK');throw error}});
}

async function patchUser(request:Request,env:Env,actor:Claims,id:string,userId:string){
  if(!isUuid(userId))throw new ApiError(400,'invalid_user_id');const body=await readBody(request);
  return withClient(env,async client=>{const {rows}=await client.query<UserRow>(`SELECT user_id,username,display_name,role,province_key,commune_code,active FROM app_users WHERE user_id=$1`,[userId]);const target=rows[0];if(!target)throw new ApiError(404,'user_not_found');if(!canManage(actor,target))throw new ApiError(403,'forbidden');const active=body.active===undefined?target.active:bool(body.active);if(!active&&userId===actor.sub)throw new ApiError(400,'cannot_disable_self');const displayName=body.displayName===undefined?target.display_name:text(body.displayName);const password=body.password===undefined?null:(typeof body.password==='string'?body.password:'');if(password!==null&&password.length<12)throw new ApiError(400,'password_too_short');await client.query('BEGIN');try{const updated=password===null?await client.query(`UPDATE app_users SET display_name=$2,active=$3,updated_at=now() WHERE user_id=$1 RETURNING user_id AS id,username,display_name AS "displayName",role,province_key AS "provinceKey",commune_code AS "communeCode",active,last_login_at AS "lastLoginAt"`,[userId,displayName,active]):await client.query(`UPDATE app_users SET display_name=$2,active=$3,password_hash=crypt($4,gen_salt('bf',12)),updated_at=now() WHERE user_id=$1 RETURNING user_id AS id,username,display_name AS "displayName",role,province_key AS "provinceKey",commune_code AS "communeCode",active,last_login_at AS "lastLoginAt"`,[userId,displayName,active,password]);await audit(client,actor,id,'UPDATE_USER','app_user',userId,{active,passwordReset:password!==null});await client.query('COMMIT');return {user:updated.rows[0]}}catch(error){await client.query('ROLLBACK');throw error}});
}

async function upsertSummary(request:Request,env:Env,actor:Claims,id:string){
  const body=await readBody(request),year=clampInt(body.year,2000,2100,0),province=text(body.provinceKey),name=text(body.communeName),commune=text(body.communeCode)||slug(name);if(!year||!province||!commune||!name)throw new ApiError(400,'missing_scope_fields');if(!ensureCommuneDataScope(actor,province,commune))throw new ApiError(403,'commune_detail_only');const metrics=metricObject(body.metrics);
  return withClient(env,async client=>{await client.query('BEGIN');try{await client.query(`INSERT INTO commune_summaries(survey_year,province_key,province_name,commune_code,commune_name,schema_version,app_version,metrics,checksum,source_count,generated_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,now()) ON CONFLICT(survey_year,province_key,commune_code) DO UPDATE SET province_name=EXCLUDED.province_name,commune_name=EXCLUDED.commune_name,schema_version=EXCLUDED.schema_version,app_version=EXCLUDED.app_version,metrics=EXCLUDED.metrics,checksum=EXCLUDED.checksum,source_count=EXCLUDED.source_count,generated_at=EXCLUDED.generated_at,updated_at=now()`,[year,province,text(body.provinceName)||province,commune,name,clampInt(body.schemaVersion,1,99,1),text(body.appVersion),JSON.stringify(metrics),text(body.checksum),clampInt(body.sourceCount,0,1000000,0),body.generatedAt?new Date(String(body.generatedAt)):null]);await audit(client,actor,id,'UPSERT','commune_summary',`${year}|${province}|${commune}`,{checksum:text(body.checksum)});await client.query('COMMIT');return {ok:true,communeCode:commune,updatedAt:new Date().toISOString()}}catch(error){await client.query('ROLLBACK');throw error}});
}

async function aggregates(url:URL,env:Env,actor:Claims){
  const requested=url.searchParams.get('level'),level=requested==='province'||requested==='national'?requested:'commune',year=clampInt(url.searchParams.get('year'),2000,2100,new Date().getFullYear());let province=text(url.searchParams.get('province')),commune=text(url.searchParams.get('commune'));if(actor.role==='province_admin')province=actor.provinceKey;if(actor.role==='commune_admin'){province=actor.provinceKey;commune=actor.communeCode}if(level!=='national'&&!province)throw new ApiError(400,'province_required');if(level==='national'&&!['super_admin','national_admin'].includes(actor.role))throw new ApiError(403,'forbidden_scope');if(level==='province'&&!['super_admin','national_admin'].includes(actor.role)&&province!==actor.provinceKey)throw new ApiError(403,'forbidden_scope');if(level==='commune'&&!ensureScope(actor,province,commune||actor.communeCode))throw new ApiError(403,'forbidden_scope');
  return withClient(env,async client=>{const params:Array<string|number>=[year],where=['survey_year=$1'];if(province){params.push(province);where.push(`province_key=$${params.length}`)}if(commune){params.push(commune);where.push(`commune_code=$${params.length}`)}const {rows}=await client.query(`SELECT survey_year AS year,province_key AS "provinceKey",province_name AS "provinceName",commune_code AS "communeCode",commune_name AS "communeName",metrics,checksum,updated_at AS "updatedAt" FROM commune_summaries WHERE ${where.join(' AND ')} ORDER BY province_name,commune_name`,params);return {source:'server',year,level,rows,metrics:sumMetrics(rows)}});
}

async function listPersons(url:URL,env:Env,actor:Claims){
  const province=text(url.searchParams.get('province'))||actor.provinceKey,commune=text(url.searchParams.get('commune'))||actor.communeCode,limit=clampInt(url.searchParams.get('limit'),1,100,50),cursor=decodeCursor(url.searchParams.get('cursor'));if(!province||!commune)throw new ApiError(400,'province_and_commune_required');if(!ensureCommuneDataScope(actor,province,commune))throw new ApiError(403,'commune_detail_only');
  return withClient(env,async client=>{const params:Array<string|number>=[province,commune];let after='';if(cursor){params.push(cursor.ts,cursor.id);after=` AND (updated_at,person_id) > ($3::timestamptz,$4::uuid)`}params.push(limit+1);const {rows}=await client.query(`SELECT person_id,province_key,commune_code,school_id,household_key,full_name,birth_date,sex,updated_at,row_version,payload FROM persons WHERE province_key=$1 AND commune_code=$2 AND deleted_at IS NULL${after} ORDER BY updated_at,person_id LIMIT $${params.length}`,params);const hasMore=rows.length>limit,items=hasMore?rows.slice(0,limit):rows;return {items,nextCursor:hasMore?encodeCursor(items[items.length-1]):null}});
}

async function batchPersons(request:Request,env:Env,actor:Claims){
  const body=await readBody(request),province=text(body.provinceKey),commune=text(body.communeCode),rawItems=body.items;if(!province||!commune)throw new ApiError(400,'province_and_commune_required');if(!ensureCommuneDataScope(actor,province,commune))throw new ApiError(403,'commune_detail_only');if(!Array.isArray(rawItems)||rawItems.length<1||rawItems.length>200)throw new ApiError(400,'batch_size_must_be_1_to_200');const items=rawItems.map(item=>{if(!isRecord(item))throw new ApiError(400,'invalid_person');const personId=text(item.personId);if(!isUuid(personId))throw new ApiError(400,'invalid_person_id');return {personId,schoolId:text(item.schoolId)||null,householdKey:text(item.householdKey)||null,fullName:text(item.fullName),birthDate:text(item.birthDate)||null,sex:item.sex===null||item.sex===undefined?null:clampInt(item.sex,0,9,0),payload:metricObject(item.payload)}});
  return withClient(env,async client=>{await client.query('BEGIN');try{for(const item of items)await client.query(`INSERT INTO persons(province_key,person_id,commune_code,school_id,household_key,full_name,birth_date,sex,updated_at,row_version,payload) VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,now(),1,$9::jsonb) ON CONFLICT(province_key,person_id) DO UPDATE SET commune_code=EXCLUDED.commune_code,school_id=EXCLUDED.school_id,household_key=EXCLUDED.household_key,full_name=EXCLUDED.full_name,birth_date=EXCLUDED.birth_date,sex=EXCLUDED.sex,payload=EXCLUDED.payload,updated_at=now(),row_version=persons.row_version+1`,[province,item.personId,commune,item.schoolId,item.householdKey,item.fullName,item.birthDate,item.sex,JSON.stringify(item.payload)]);await client.query('COMMIT');return {ok:true,upserted:items.length}}catch(error){await client.query('ROLLBACK');throw error}});
}

async function handle(request:Request,env:Env){
  const url=new URL(request.url),path=url.pathname,id=requestId(request);
  const origin=request.headers.get('Origin');if(origin&&!allowedOrigins(env).has(origin))throw new ApiError(403,'origin_not_allowed');
  if(request.method==='OPTIONS'){const headers=responseHeaders(request,env);headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');headers.set('Access-Control-Allow-Methods','GET, POST, PATCH, OPTIONS');headers.set('Access-Control-Max-Age','86400');headers.delete('Content-Type');return new Response(null,{status:204,headers})}
  if(request.method==='GET'&&path==='/v1/health')return json(request,env,{ok:true,service:'pcgdxmc-api',version:'1.2.0',runtime:'cloudflare-workers',environment:env.ENVIRONMENT||'production',time:new Date().toISOString()});
  if(request.method==='POST'&&path==='/v1/auth/login')return json(request,env,await login(request,env,id));
  const actor=await authenticate(request,env);
  if(request.method==='GET'&&path==='/v1/me')return json(request,env,{user:{id:actor.sub,username:actor.username,displayName:actor.name,role:actor.role,provinceKey:actor.provinceKey,communeCode:actor.communeCode}});
  if(request.method==='GET'&&path==='/v1/admin/users')return json(request,env,await listUsers(env,actor));
  if(request.method==='POST'&&path==='/v1/admin/users')return json(request,env,await createUser(request,env,actor,id),201);
  const userMatch=path.match(/^\/v1\/admin\/users\/([0-9a-f-]+)$/i);if(request.method==='PATCH'&&userMatch)return json(request,env,await patchUser(request,env,actor,id,userMatch[1]));
  if(request.method==='POST'&&path==='/v1/summaries/upsert')return json(request,env,await upsertSummary(request,env,actor,id));
  if(request.method==='GET'&&path==='/v1/aggregates')return json(request,env,await aggregates(url,env,actor));
  if(request.method==='GET'&&path==='/v1/persons')return json(request,env,await listPersons(url,env,actor));
  if(request.method==='POST'&&path==='/v1/persons/batch')return json(request,env,await batchPersons(request,env,actor));
  throw new ApiError(404,'not_found');
}

export default {
  async fetch(request,env,ctx):Promise<Response>{
    void ctx;
    const started=Date.now(),url=new URL(request.url),id=requestId(request);
    try{const response=await handle(request,env);console.log(JSON.stringify({message:'request',requestId:id,method:request.method,path:url.pathname,status:response.status,durationMs:Date.now()-started}));return response}
    catch(error){const known=error instanceof ApiError?error:null,pgCode=isRecord(error)&&typeof error.code==='string'?error.code:'';const status=known?.status||(pgCode==='23505'?409:500),code=known?.code||(pgCode==='23505'?'conflict':'internal_error');console.error(JSON.stringify({message:'request_failed',requestId:id,method:request.method,path:url.pathname,status,error:error instanceof Error?error.message:String(error)}));return json(request,env,{error:code,...(status===500?{requestId:id}:{})},status)}
  }
} satisfies ExportedHandler<Env>;

