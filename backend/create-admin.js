import bcrypt from 'bcryptjs';
import pg from 'pg';

const {Pool}=pg;
const DATABASE_URL=process.env.DATABASE_URL;
if(!DATABASE_URL)throw new Error('DATABASE_URL is required');
const username=String(process.env.ADMIN_USERNAME||'').trim().toLowerCase();
const password=String(process.env.ADMIN_PASSWORD||'');
const displayName=String(process.env.ADMIN_DISPLAY_NAME||username).trim();
const role=String(process.env.ADMIN_ROLE||'super_admin').trim();
const provinceKey=String(process.env.ADMIN_PROVINCE_KEY||'').trim()||null;
const communeCode=String(process.env.ADMIN_COMMUNE_CODE||'').trim()||null;
const allowed=new Set(['super_admin','national_admin','province_admin','commune_admin']);
if(!username)throw new Error('ADMIN_USERNAME is required');
if(password.length<12)throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
if(!allowed.has(role))throw new Error('ADMIN_ROLE is invalid');
if(role==='province_admin'&&!provinceKey)throw new Error('ADMIN_PROVINCE_KEY is required for province_admin');
if(role==='commune_admin'&&(!provinceKey||!communeCode))throw new Error('ADMIN_PROVINCE_KEY and ADMIN_COMMUNE_CODE are required for commune_admin');

const passwordHash=await bcrypt.hash(password,12);
const pool=new Pool({connectionString:DATABASE_URL,ssl:process.env.DB_SSL==='false'?false:{rejectUnauthorized:false}});
try{
  const {rows}=await pool.query(`INSERT INTO app_users(username,password_hash,display_name,role,province_key,commune_code,active)
    VALUES($1,$2,$3,$4,$5,$6,true)
    ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash,display_name=EXCLUDED.display_name,role=EXCLUDED.role,province_key=EXCLUDED.province_key,commune_code=EXCLUDED.commune_code,active=true,updated_at=now()
    RETURNING user_id,username,display_name,role,province_key,commune_code`,[username,passwordHash,displayName,role,provinceKey,communeCode]);
  console.log(JSON.stringify({ok:true,user:rows[0]},null,2));
}finally{await pool.end()}
