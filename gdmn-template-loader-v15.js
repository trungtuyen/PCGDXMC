(function(global){
  'use strict';
  const nativeFetch=global.fetch.bind(global);
  const manifest={
    'MN-01-TE.xlsx':2,
    'MN-01-TCDK.xlsx':2,
    'MN-01-GV.xlsx':2,
    'MN-01-CSVC.xlsx':2,
    'MN-01-TC.xlsx':2,
    'MN-05-KT.xlsx':2,
    'MN-06-SO-PC.xlsx':6
  };
  const cache=new Map();
  function fileName(url){try{return new URL(url,location.href).pathname.split('/').pop()||''}catch(_){return ''}}
  function decode64(text){const s=text.replace(/\s+/g,''),bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
  async function loadPacked(name){
    if(cache.has(name))return cache.get(name).slice(0);
    const count=manifest[name];if(!count)throw new Error(`Không có template GDMN: ${name}`);
    const base=name.replace(/\.xlsx$/i,'');
    const parts=await Promise.all(Array.from({length:count},async(_,i)=>{
      const r=await nativeFetch(`templates/gdmn/base64/${base}.part${String(i+1).padStart(2,'0')}.txt`,{cache:'force-cache'});
      if(!r.ok)throw new Error(`Thiếu phần ${i+1}/${count} của ${name}`);return r.text();
    }));
    const bytes=decode64(parts.join(''));cache.set(name,bytes.buffer.slice(0));return bytes.buffer.slice(0);
  }
  global.fetch=async function(input,init){
    const url=typeof input==='string'?input:input?.url||'',name=fileName(url);
    if(manifest[name]&&/templates\/gdmn\//.test(String(url))){
      try{const ab=await loadPacked(name);return new Response(ab,{status:200,headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Length':String(ab.byteLength),'X-PCGDMN-Template':'packed-v15'}})}catch(e){return new Response(String(e.message||e),{status:503,statusText:'GDMN template unavailable'})}
    }
    return nativeFetch(input,init);
  };
  global.PCGDGdmnTemplateLoader={version:'1.5.0',manifest,loadPacked};
})(window);
