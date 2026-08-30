(function(global){
  'use strict';
  const DEFAULT_API_BASE='https://pcgdxmc-api.pcgdxmc-api.workers.dev';
  const API_KEY='pcgdxmc_api_base',TOKEN_KEY='pcgdxmc_api_token',USER_KEY='pcgdxmc_session_user',SCOPE_KEY='pcgdxmc_management_scope';
  const API_TIMEOUT_MS=20000,RETRY_DELAY_MS=650;
  const nativeGet=Storage.prototype.getItem,nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
  Storage.prototype.getItem=function(k){if(this===localStorage&&k===TOKEN_KEY)return nativeGet.call(sessionStorage,k)||'';return nativeGet.call(this,k)};
  Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===TOKEN_KEY){nativeSet.call(sessionStorage,k,String(v||''));return}return nativeSet.call(this,k,v)};
  Storage.prototype.removeItem=function(k){if(this===localStorage&&k===TOKEN_KEY){nativeRemove.call(sessionStorage,k);return}return nativeRemove.call(this,k)};

  const $=id=>document.getElementById(id),clean=v=>String(v||'').trim(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function apiBase(){
    const configured=clean(nativeGet.call(localStorage,API_KEY)||'');
    const candidate=configured||DEFAULT_API_BASE;
    try{
      const url=new URL(candidate,global.location.href);
      if(global.location.protocol==='https:'&&url.protocol!=='https:')return DEFAULT_API_BASE;
      return url.toString().replace(/\/$/,'');
    }catch(_){return DEFAULT_API_BASE}
  }
  function token(){return clean(nativeGet.call(sessionStorage,TOKEN_KEY)||'')}
  function user(){try{return JSON.parse(nativeGet.call(sessionStorage,USER_KEY)||'null')}catch(_){return null}}
  function saveSession(t,u){nativeSet.call(sessionStorage,TOKEN_KEY,t);nativeSet.call(sessionStorage,USER_KEY,JSON.stringify(u||{}))}
  function clearSession(){nativeRemove.call(sessionStorage,TOKEN_KEY);nativeRemove.call(sessionStorage,USER_KEY)}
  function notify(){global.dispatchEvent(new CustomEvent('pcgd-auth-changed',{detail:{user:user()}}))}
  function notifyNetwork(){global.dispatchEvent(new CustomEvent('pcgd-network-changed',{detail:{online:navigator.onLine!==false}}))}
  function roleLabel(r){return ({super_admin:'Quản trị hệ thống',national_admin:'Quản trị toàn quốc',province_admin:'Quản trị tỉnh/thành',commune_admin:'Quản trị xã/phường'})[r]||r||'Chưa đăng nhập'}
  function networkMessage(error){
    if(navigator.onLine===false)return 'Thiết bị đang mất kết nối Internet. Hãy bật 4G/5G hoặc Wi‑Fi rồi thử lại.';
    if(error?.name==='AbortError')return 'Mạng đang chậm hoặc chập chờn. Hệ thống đã hết thời gian chờ, vui lòng thử lại.';
    if(error instanceof TypeError)return 'Không kết nối được máy chủ. Hãy kiểm tra 4G/5G hoặc Wi‑Fi rồi thử lại.';
    return error?.message||'Không thể kết nối máy chủ.';
  }
  async function fetchOnce(url,options){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);
    try{return await fetch(url,{...options,signal:controller.signal,mode:'cors',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'})}
    finally{clearTimeout(timer)}
  }
  async function json(path,opts={}){
    const base=apiBase();if(!base)throw new Error('Chưa cấu hình URL máy chủ API.');
    if(navigator.onLine===false)throw new Error('Thiết bị đang mất kết nối Internet. Hãy bật 4G/5G hoặc Wi‑Fi rồi thử lại.');
    const method=String(opts.method||'GET').toUpperCase();
    const headers={'Accept':'application/json',...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})};if(token())headers.Authorization=`Bearer ${token()}`;
    const attempts=(method==='GET'||path==='/v1/auth/login')?2:1;
    let lastError=null;
    for(let attempt=1;attempt<=attempts;attempt++){
      try{
        const res=await fetchOnce(base+path,{...opts,method,headers});
        let body=null;try{body=await res.json()}catch(_){}
        if(!res.ok){
          if((res.status===502||res.status===503||res.status===504)&&attempt<attempts){await sleep(RETRY_DELAY_MS*attempt);continue}
          throw new Error(body?.error==='invalid_credentials'?'Sai tài khoản hoặc mật khẩu.':body?.error==='origin_not_allowed'?'Thiết bị đang mở từ địa chỉ web không được phép. Vui lòng dùng trang PCGD-XMC chính thức.':body?.error||`API ${res.status}`)
        }
        return body;
      }catch(error){
        lastError=error;
        const networkFailure=error?.name==='AbortError'||error instanceof TypeError;
        if(networkFailure&&attempt<attempts){await sleep(RETRY_DELAY_MS*attempt);continue}
        if(networkFailure)throw new Error(networkMessage(error));
        throw error;
      }
    }
    throw new Error(networkMessage(lastError));
  }
  async function login(username,password){const r=await json('/v1/auth/login',{method:'POST',body:JSON.stringify({username,password})});saveSession(r.token,r.user);applyRoleScope(r.user);render();notify();global.PCGDNational?.flushQueue?.();global.PCGDNational?.renderAggregate?.();return r.user}
  function logout(){clearSession();render();notify();global.PCGDNational?.renderAggregate?.()}
  function applyRoleScope(u){if(!u)return;let s={level:'commune',provinceKey:u.provinceKey||'thai-nguyen',communeCode:u.communeCode||'',communeName:''};if(u.role==='province_admin')s.level='province';if(u.role==='national_admin'||u.role==='super_admin')s.level='national';nativeSet.call(localStorage,SCOPE_KEY,JSON.stringify(s))}
  function lockScope(u){const level=$('managementLevel'),province=$('provinceSelect'),code=$('communeCode');if(!level||!province)return;level.disabled=false;province.disabled=false;if(!u)return;if(u.role==='province_admin'){level.value='province';level.disabled=true;province.value=u.provinceKey||province.value;province.disabled=true}if(u.role==='commune_admin'){level.value='commune';level.disabled=true;province.value=u.provinceKey||province.value;province.disabled=true;if(code){code.value=u.communeCode||'';code.disabled=true}}}
  function render(){const box=$('pcgdAuthBox');if(!box)return;const u=user();if(u){box.innerHTML=`<div class="pa-user"><div><strong>${escapeHtml(u.displayName||u.username)}</strong><span>${escapeHtml(roleLabel(u.role))}</span></div><button id="pcgdLogoutBtn" class="secondary" type="button">Đăng xuất</button></div>`;$('pcgdLogoutBtn').onclick=logout;lockScope(u);return}box.innerHTML=`<div class="pa-grid"><input id="pcgdLoginUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Tài khoản"><input id="pcgdLoginPass" type="password" autocomplete="current-password" placeholder="Mật khẩu"><button id="pcgdLoginBtn" class="primary" type="button">Đăng nhập</button></div><div id="pcgdAuthMsg" class="pa-msg">Có thể đăng nhập bằng Wi‑Fi, 4G hoặc 5G.</div>`;$('pcgdLoginBtn').onclick=async()=>{const b=$('pcgdLoginBtn'),m=$('pcgdAuthMsg');b.disabled=true;m.textContent=navigator.onLine===false?'Thiết bị đang ngoại tuyến.':'Đang đăng nhập…';try{await login(clean($('pcgdLoginUser').value),$('pcgdLoginPass').value);m.textContent='Đăng nhập thành công.'}catch(e){m.textContent=e.message}finally{b.disabled=false}};$('pcgdLoginPass').addEventListener('keydown',e=>{if(e.key==='Enter')$('pcgdLoginBtn').click()});lockScope(null)}
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function inject(){const panel=$('nationalScopePanel');if(!panel){setTimeout(inject,100);return}if($('pcgdAuthBox'))return;const style=document.createElement('style');style.textContent=`#pcgdAuthBox{margin-top:10px;border-top:1px dashed #ced9de;padding-top:10px}.pa-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:7px}.pa-grid input{height:40px;border:1px solid #ccd6dc;border-radius:7px;padding:0 9px;font-size:16px}.pa-msg{font-size:11px;color:#637984;margin-top:6px}.pa-user{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#eef7f1;padding:8px 10px;border-radius:7px}.pa-user strong,.pa-user span{display:block}.pa-user span{font-size:11px;color:#537064;margin-top:2px}@media(max-width:560px){.pa-grid{grid-template-columns:1fr}.pa-grid button{min-height:44px}.pa-user{align-items:flex-start}}`;document.head.appendChild(style);const box=document.createElement('div');box.id='pcgdAuthBox';const details=panel.querySelector('.nat-config');if(details)details.insertAdjacentElement('beforebegin',box);else panel.appendChild(box);render();const tokenInput=$('apiTokenInput');if(tokenInput?.parentElement)tokenInput.parentElement.style.display='none'}
  async function restore(){if(!token())return;try{const r=await json('/v1/me');saveSession(token(),r.user);applyRoleScope(r.user)}catch(_){clearSession()}}
  async function init(){await restore();inject();notify();notifyNetwork();global.addEventListener('online',()=>{notifyNetwork();render()});global.addEventListener('offline',()=>{notifyNetwork();render()})}
  global.PCGDAuth={login,logout,user,token,apiBase,request:json,online:()=>navigator.onLine!==false};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error));else init().catch(console.error);
})(window);
