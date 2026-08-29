const base=String(process.env.TARGET_URL||'').replace(/\/$/,'');
if(!base)throw new Error('TARGET_URL is required');
const token=String(process.env.AUTH_TOKEN||'');
const concurrency=Math.max(1,Math.min(500,Number(process.env.CONCURRENCY)||50));
const requests=Math.max(concurrency,Math.min(100000,Number(process.env.REQUESTS)||2000));
const year=Number(process.env.SURVEY_YEAR)||new Date().getFullYear();
const path=process.env.TEST_PATH||`/v1/aggregates?level=national&year=${year}`;
const times=[];let ok=0,failed=0,next=0;
const start=performance.now();
async function worker(){while(true){const i=next++;if(i>=requests)return;const t=performance.now();try{const r=await fetch(base+path,{headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}});if(!r.ok)throw new Error(String(r.status));await r.arrayBuffer();ok++}catch(_){failed++}finally{times.push(performance.now()-t)}}}
await Promise.all(Array.from({length:concurrency},worker));
times.sort((a,b)=>a-b);const elapsed=(performance.now()-start)/1000;const q=p=>times[Math.min(times.length-1,Math.floor(times.length*p))]||0;
const result={target:base+path,requests,concurrency,ok,failed,seconds:Number(elapsed.toFixed(2)),rps:Number((requests/elapsed).toFixed(2)),latencyMs:{p50:Number(q(.50).toFixed(2)),p95:Number(q(.95).toFixed(2)),p99:Number(q(.99).toFixed(2)),max:Number((times.at(-1)||0).toFixed(2))}};
console.log(JSON.stringify(result,null,2));
if(failed/requests>0.01||q(.95)>Number(process.env.P95_LIMIT_MS||1500))process.exitCode=2;
