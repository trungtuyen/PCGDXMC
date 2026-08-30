import bcrypt from 'bcryptjs';

const ROLES=new Set(['super_admin','national_admin','province_admin','commune_admin']);
const clean=v=>String(v||'').trim();
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
function actor(req){return {id:String(req.user?.sub||''),role:req.user?.role||'',provinceKey:req.user?.provinceKey||'',communeCode:req.user?.communeCode||''}}
function canManage(a,target){
  if(a.role==='super_admin'||a.role==='national_admin')return target.role==='province_admin';
  if(a.role==='province_admin')return target.role==='commune_admin'&&target.province_key===a.provinceKey;
  return false;
}
function validateScope(role,provinceKey,communeCode){
  if(!ROLES.has(role))return false;
  if(role==='province_admin')return !!provinceKey;
  if(role==='commune_admin')return !!provinceKey&&!!communeCode;
  return true;
}
async function audit(pool,req,action,entityId,details={}){const a=actor(req);await pool.query(`INSERT INTO audit_log(actor_id,actor_role,province_key,commune_code,action,entity_type,entity_id,request_id,details) VALUES($1,$2,$3,$4,$5,'app_user',$6,$7,$8::jsonb)`,[a.id,a.role,a.provinceKey||null,a.communeCode||null,action,entityId,req.id,JSON.stringify(details)])}

export async function registerAuthRoutes(app,pool){
  app.post('/v1/auth/login',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
    if(!process.env.JWT_SECRET)return reply.code(503).send({error:'jwt_not_configured'});
    const username=clean(req.body?.username).toLowerCase(),password=String(req.body?.password||'');
    if(!username||password.length<8)return reply.code(400).send({error:'invalid_credentials'});
    const {rows}=await pool.query(`SELECT user_id,username,password_hash,display_name,role,province_key,commune_code,active FROM app_users WHERE username=$1 LIMIT 1`,[username]);const user=rows[0];
    if(!user?.active||!(await bcrypt.compare(password,user.password_hash)))return reply.code(401).send({error:'invalid_credentials'});
    if(!ROLES.has(user.role))return reply.code(403).send({error:'invalid_role'});
    const claims={sub:String(user.user_id),username:user.username,name:user.display_name||user.username,role:user.role,provinceKey:user.province_key||'',communeCode:user.commune_code||''};
    const token=app.jwt.sign(claims,{expiresIn:process.env.JWT_EXPIRES_IN||'8h'});
    await pool.query(`UPDATE app_users SET last_login_at=now(),updated_at=now() WHERE user_id=$1`,[user.user_id]);
    await pool.query(`INSERT INTO audit_log(actor_id,actor_role,province_key,commune_code,action,entity_type,entity_id,request_id,details) VALUES($1,$2,$3,$4,'LOGIN','session',$1,$5,'{}'::jsonb)`,[String(user.user_id),user.role,user.province_key,user.commune_code,req.id]);
    return {token,expiresIn:process.env.JWT_EXPIRES_IN||'8h',user:{id:String(user.user_id),username:user.username,displayName:user.display_name||user.username,role:user.role,provinceKey:user.province_key||'',communeCode:user.commune_code||''}};
  });

  app.get('/v1/me',async req=>({user:{id:req.user?.sub||'',username:req.user?.username||'',displayName:req.user?.name||req.user?.username||'',role:req.user?.role||'',provinceKey:req.user?.provinceKey||'',communeCode:req.user?.communeCode||''}}));

  app.get('/v1/admin/users',async(req,reply)=>{
    const a=actor(req);if(!['super_admin','national_admin','province_admin'].includes(a.role))return reply.code(403).send({error:'forbidden'});
    let sql=`SELECT user_id AS id,username,display_name AS "displayName",role,province_key AS "provinceKey",commune_code AS "communeCode",active,last_login_at AS "lastLoginAt",created_at AS "createdAt" FROM app_users`,params=[];
    if(a.role==='super_admin'||a.role==='national_admin')sql+=` WHERE role='province_admin'`;
    if(a.role==='province_admin'){params=[a.provinceKey];sql+=` WHERE role='commune_admin' AND province_key=$1`}
    sql+=` ORDER BY province_key NULLS FIRST,commune_code NULLS FIRST,username LIMIT 5000`;
    return {users:(await pool.query(sql,params)).rows};
  });

  app.post('/v1/admin/users',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(req,reply)=>{
    const a=actor(req),b=req.body||{},username=clean(b.username).toLowerCase(),password=String(b.password||''),displayName=clean(b.displayName||username),role=clean(b.role),provinceKey=clean(b.provinceKey)||null,communeCode=clean(b.communeCode)||null;
    if(!/^[a-z0-9._-]{3,64}$/.test(username))return reply.code(400).send({error:'invalid_username'});
    if(password.length<12)return reply.code(400).send({error:'password_too_short'});
    if(!validateScope(role,provinceKey,communeCode))return reply.code(400).send({error:'invalid_scope'});
    const target={role,province_key:provinceKey,commune_code:communeCode};if(!canManage(a,target))return reply.code(403).send({error:'forbidden_role_assignment'});
    const hash=await bcrypt.hash(password,12);
    try{const {rows}=await pool.query(`INSERT INTO app_users(username,password_hash,display_name,role,province_key,commune_code,active) VALUES($1,$2,$3,$4,$5,$6,true) RETURNING user_id AS id,username,display_name AS "displayName",role,province_key AS "provinceKey",commune_code AS "communeCode",active`,[username,hash,displayName,role,provinceKey,communeCode]);await audit(pool,req,'CREATE_USER',String(rows[0].id),{username,role,provinceKey,communeCode});return reply.code(201).send({user:rows[0]})}catch(e){if(e.code==='23505')return reply.code(409).send({error:'username_exists'});throw e}
  });

  app.patch('/v1/admin/users/:id',{config:{rateLimit:{max:120,timeWindow:'1 minute'}}},async(req,reply)=>{
    const id=String(req.params?.id||'');if(!uuid(id))return reply.code(400).send({error:'invalid_user_id'});const a=actor(req);
    const {rows}=await pool.query(`SELECT user_id,username,display_name,role,province_key,commune_code,active FROM app_users WHERE user_id=$1`,[id]);const target=rows[0];if(!target)return reply.code(404).send({error:'user_not_found'});if(!canManage(a,target))return reply.code(403).send({error:'forbidden'});
    const b=req.body||{};if(b.active===false&&id===a.id)return reply.code(400).send({error:'cannot_disable_self'});
    const displayName=b.displayName===undefined?target.display_name:clean(b.displayName);let hash=null;if(b.password!==undefined){const p=String(b.password||'');if(p.length<12)return reply.code(400).send({error:'password_too_short'});hash=await bcrypt.hash(p,12)}
    const active=b.active===undefined?target.active:!!b.active;
    const {rows:updated}=await pool.query(`UPDATE app_users SET display_name=$2,active=$3,password_hash=COALESCE($4,password_hash),updated_at=now() WHERE user_id=$1 RETURNING user_id AS id,username,display_name AS "displayName",role,province_key AS "provinceKey",commune_code AS "communeCode",active,last_login_at AS "lastLoginAt"`,[id,displayName,active,hash]);await audit(pool,req,'UPDATE_USER',id,{active,passwordReset:!!hash});return {user:updated[0]};
  });
}
