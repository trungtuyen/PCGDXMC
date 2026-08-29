import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

const {Pool}=pg;
const DATABASE_URL=process.env.DATABASE_URL;if(!DATABASE_URL)throw new Error('DATABASE_URL is required');
const dir=path.dirname(fileURLToPath(import.meta.url));
const pool=new Pool({connectionString:DATABASE_URL,ssl:process.env.DB_SSL==='false'?false:{rejectUnauthorized:false}});
async function runFile(file){const sql=await fs.readFile(file,'utf8');if(sql.trim())await pool.query(sql)}
try{
  await runFile(path.join(dir,'schema.sql'));
  const mdir=path.join(dir,'migrations');let files=[];try{files=(await fs.readdir(mdir)).filter(x=>x.endsWith('.sql')).sort()}catch(_){}
  for(const f of files){console.log(`Applying ${f}`);await runFile(path.join(mdir,f))}
  console.log(JSON.stringify({ok:true,migrations:files.length}));
}finally{await pool.end()}
