(function(global){
  'use strict';

  const FLAG='pcgdxmc_local_mode_v1';
  const SCOPE_KEY='pcgdxmc_management_scope';
  const API_ORIGIN='https://pcgdxmc-api.pcgdxmc-api.workers.dev';
  const LOCAL_USER={id:'local-device',username:'local',displayName:'Chế độ cục bộ',role:'commune_admin',provinceKey:'',communeCode:'',localMode:true};
  let patched=false;

  function active(){return sessionStorage.getItem(FLAG)==='1'}
  function notify(){global.dispatchEvent(new CustomEvent('pcgd-auth-changed',{detail:{user:active()?LOCAL_USER:null,localMode:active()}}))}
  function saveLocalScope(){
    let scope={level:'commune',provinceKey:'thai-nguyen',communeCode:'',communeName:''};
    try{scope={...scope,...JSON.parse(localStorage.getItem(SCOPE_KEY)||'{}')}}catch(_){}
    scope.level='commune';
    localStorage.setItem(SCOPE_KEY,JSON.stringify(scope));
  }
  function localOnlyError(){return new Error('Chế độ cục bộ không đọc hoặc gửi dữ liệu lên máy chủ. Hãy đăng nhập tài khoản được cấp nếu muốn đồng bộ.')}

  function patchFetch(){
    if(global.__pcgdLocalFetchPatched)return;
    const nativeFetch=global.fetch.bind(global);
    global.fetch=function(input,init){
      if(active()){
        try{
          const raw=typeof input==='string'||input instanceof URL?String(input):String(input?.url||'');
          const url=new URL(raw,global.location.href);
          if(url.origin===API_ORIGIN)return Promise.reject(localOnlyError());
        }catch(_){}
      }
      return nativeFetch(input,init);
    };
    global.__pcgdLocalFetchPatched=true;
  }

  function patchAuth(){
    const auth=global.PCGDAuth;if(!auth||patched)return false;
    patched=true;
    const original={user:auth.user.bind(auth),token:auth.token.bind(auth),request:auth.request.bind(auth),logout:auth.logout.bind(auth)};

    auth.user=()=>active()?LOCAL_USER:original.user();
    auth.token=()=>active()?'':original.token();
    auth.request=(path,opts)=>active()?Promise.reject(localOnlyError()):original.request(path,opts);
    auth.isLocalMode=active;
    auth.enterLocalMode=()=>{
      original.logout();
      sessionStorage.setItem(FLAG,'1');
      saveLocalScope();
      notify();
      global.PCGDNational?.renderAggregate?.();
      return LOCAL_USER;
    };
    auth.logout=()=>{
      sessionStorage.removeItem(FLAG);
      original.logout();
    };
    return true;
  }

  function ensureStyle(){
    if(document.getElementById('pcgdLocalModeStyle'))return;
    const style=document.createElement('style');style.id='pcgdLocalModeStyle';style.textContent=`
      #pcgdLocalModeBtn{width:100%;min-height:46px;margin-top:10px;border:1px solid #8ab5aa;border-radius:9px;background:#f2faf7;color:#176a5a;font-size:14px;font-weight:800;cursor:pointer;touch-action:manipulation}
      #pcgdLocalModeBtn:hover{background:#e8f7f1}.pcgd-local-note{margin-top:7px;text-align:center;font-size:11px;line-height:1.45;color:#667c87}
      body[data-pcgd-local="true"] #pcgdRoleBar .tl-role-inner{border-color:#9bc9b8;background:#f4fbf8}
    `;document.head.appendChild(style);
  }

  function injectButton(){
    const login=document.getElementById('pcgdPortalLoginBtn');
    if(!login||document.getElementById('pcgdLocalModeBtn'))return false;
    ensureStyle();
    const btn=document.createElement('button');btn.id='pcgdLocalModeBtn';btn.type='button';btn.textContent='Dùng cục bộ cấp xã';
    const note=document.createElement('div');note.className='pcgd-local-note';note.textContent='Không cần tài khoản · không đồng bộ máy chủ · dữ liệu chỉ lưu trên thiết bị này.';
    login.insertAdjacentElement('afterend',btn);btn.insertAdjacentElement('afterend',note);
    btn.addEventListener('click',()=>{
      if(!patchAuth())return;
      global.PCGDAuth.enterLocalMode();
      document.body.dataset.pcgdLocal='true';
    });
    return true;
  }

  function refreshMarker(){
    if(active())document.body.dataset.pcgdLocal='true';else document.body.removeAttribute('data-pcgd-local');
  }

  function init(){
    patchFetch();
    if(!patchAuth()){setTimeout(init,80);return}
    refreshMarker();injectButton();
    if(active()){saveLocalScope();notify()}
    const timer=setInterval(()=>{refreshMarker();if(injectButton())clearInterval(timer)},250);
    setTimeout(()=>clearInterval(timer),15000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
