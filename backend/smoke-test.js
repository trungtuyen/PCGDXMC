import assert from 'node:assert/strict';
const base=String(process.env.TARGET_URL||'http://127.0.0.1:8080').replace(/\/$/,'');
const username=process.env.SMOKE_USERNAME||'ci-admin',password=process.env.SMOKE_PASSWORD||'Ci-Test-Password-123!';
async function req(path,opts={}){const r=await fetch(base+path,{...opts,headers:{Accept:'application/json',...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});const body=await r.json();if(!r.ok)throw new Error(`${r.status} ${JSON.stringify(body)}`);return body}
const health=await req('/v1/health');assert.equal(health.ok,true);
const login=await req('/v1/auth/login',{method:'POST',body:JSON.stringify({username,password})});assert.ok(login.token);assert.equal(login.user.role,'super_admin');
const h={Authorization:`Bearer ${login.token}`};const me=await req('/v1/me',{headers:h});assert.equal(me.user.role,'super_admin');
const uname=`ci-province-${Date.now()}`;const created=await req('/v1/admin/users',{method:'POST',headers:h,body:JSON.stringify({username:uname,password:'Province-Test-123!',displayName:'CI Province',role:'province_admin',provinceKey:'thai-nguyen',communeCode:''})});assert.equal(created.user.role,'province_admin');
await req('/v1/summaries/upsert',{method:'POST',headers:h,body:JSON.stringify({year:2026,provinceKey:'thai-nguyen',provinceName:'Tỉnh Thái Nguyên',communeCode:'ci-xa',communeName:'Xã CI',schemaVersion:1,appVersion:'ci',metrics:{total:100,households:30,aged1518:20,tn1518:18,age1560:70,mc1560:2,issues:0},sourceCount:1})});
const agg=await req('/v1/aggregates?level=province&province=thai-nguyen&year=2026',{headers:h});assert.ok(agg.metrics.total>=100);assert.ok(Array.isArray(agg.rows));
console.log(JSON.stringify({ok:true,health:health.version,createdRole:created.user.role,aggregateTotal:agg.metrics.total},null,2));
