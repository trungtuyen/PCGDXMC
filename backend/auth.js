import bcrypt from 'bcryptjs';

const ROLES=new Set(['super_admin','national_admin','province_admin','commune_admin']);
const clean=v=>String(v||'').trim();

export async function registerAuthRoutes(app,pool){
  app.post('/v1/auth/login',{config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
    if(!process.env.JWT_SECRET)return reply.code(503).send({error:'jwt_not_configured'});
    const username=clean(req.body?.username).toLowerCase();
    const password=String(req.body?.password||'');
    if(!username||password.length<8)return reply.code(400).send({error:'invalid_credentials'});
    const {rows}=await pool.query(`SELECT user_id,username,password_hash,display_name,role,province_key,commune_code,active FROM app_users WHERE username=$1 LIMIT 1`,[username]);
    const user=rows[0];
    if(!user?.active||!(await bcrypt.compare(password,user.password_hash)))return reply.code(401).send({error:'invalid_credentials'});
    if(!ROLES.has(user.role))return reply.code(403).send({error:'invalid_role'});
    const claims={sub:String(user.user_id),username:user.username,name:user.display_name||user.username,role:user.role,provinceKey:user.province_key||'',communeCode:user.commune_code||''};
    const token=app.jwt.sign(claims,{expiresIn:process.env.JWT_EXPIRES_IN||'8h'});
    await pool.query(`UPDATE app_users SET last_login_at=now(),updated_at=now() WHERE user_id=$1`,[user.user_id]);
    await pool.query(`INSERT INTO audit_log(actor_id,actor_role,province_key,commune_code,action,entity_type,entity_id,request_id,details) VALUES($1,$2,$3,$4,'LOGIN','session',$1,$5,'{}'::jsonb)`,[String(user.user_id),user.role,user.province_key,user.commune_code,req.id]);
    return {token,expiresIn:process.env.JWT_EXPIRES_IN||'8h',user:{username:user.username,displayName:user.display_name||user.username,role:user.role,provinceKey:user.province_key||'',communeCode:user.commune_code||''}};
  });

  app.get('/v1/me',async req=>({user:{id:req.user?.sub||'',username:req.user?.username||'',displayName:req.user?.name||req.user?.username||'',role:req.user?.role||'',provinceKey:req.user?.provinceKey||'',communeCode:req.user?.communeCode||''}}));
}
