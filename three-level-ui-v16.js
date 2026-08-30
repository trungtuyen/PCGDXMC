(function(global){
  'use strict';

  const AUTH_LEVELS={
    ministry:{label:'Cấp Bộ',roles:new Set(['super_admin','national_admin']),title:'Bảng điều hành cấp Bộ',desc:'Quản lý tài khoản cấp tỉnh và xem số liệu tổng hợp toàn quốc.'},
    province:{label:'Cấp tỉnh',roles:new Set(['province_admin']),title:'Bảng điều hành cấp tỉnh',desc:'Quản lý tài khoản cấp xã và xem số liệu tổng hợp trong tỉnh.'},
    commune:{label:'Cấp xã',roles:new Set(['commune_admin']),title:'Nghiệp vụ cấp xã',desc:'Nhập phiếu điều tra, kiểm tra dữ liệu và lập các biểu PCGD-XMC của xã.'}
  };
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=v=>String(v||'').trim();

  function auth(){return global.PCGDAuth}
  function user(){return auth()?.user?.()||null}
  function levelOf(u){if(!u)return'';if(AUTH_LEVELS.ministry.roles.has(u.role))return'ministry';if(u.role==='province_admin')return'province';if(u.role==='commune_admin')return'commune';return''}
  function roleName(u){const level=levelOf(u);return AUTH_LEVELS[level]?.label||'Không xác định'}

  function ensureStyle(){
    if($('pcgdThreeLevelStyle'))return;
    const st=document.createElement('style');st.id='pcgdThreeLevelStyle';st.textContent=`
      #pcgdLoginPortal{position:fixed;inset:0;z-index:10000;display:none;place-items:center;padding:20px;background:linear-gradient(135deg,#e9f3f7 0%,#f6fbf8 48%,#e8f2f8 100%);font-family:Arial,sans-serif}
      .tl-login-card{width:min(470px,100%);background:#fff;border:1px solid #c7d8e1;border-radius:18px;box-shadow:0 22px 60px rgba(22,65,85,.20);overflow:hidden}
      .tl-login-head{padding:24px 26px 18px;background:linear-gradient(135deg,#0f5f8f,#13806f);color:#fff}.tl-login-head h1{margin:0;font-size:23px}.tl-login-head p{margin:7px 0 0;font-size:12px;line-height:1.5;opacity:.92}
      .tl-login-body{padding:22px 26px 25px}.tl-field{display:flex;flex-direction:column;gap:6px;margin-bottom:13px}.tl-field label{font-size:12px;font-weight:800;color:#314e5d}.tl-field input,.tl-field select{height:44px;border:1px solid #b9cbd5;border-radius:9px;padding:0 12px;background:#fff;font-size:14px;color:#173744;outline:none}.tl-field input:focus,.tl-field select:focus{border-color:#1874a3;box-shadow:0 0 0 3px rgba(24,116,163,.12)}
      #pcgdPortalLoginBtn{width:100%;height:45px;border:0;border-radius:9px;background:#126f98;color:#fff;font-size:14px;font-weight:800;cursor:pointer}#pcgdPortalLoginBtn:disabled{opacity:.65;cursor:wait}.tl-login-msg{min-height:18px;margin-top:10px;font-size:12px;color:#667c87}.tl-login-msg[data-kind="error"]{color:#b42318}.tl-login-note{margin-top:13px;padding:9px 10px;border-radius:8px;background:#f1f7fa;color:#58717e;font-size:11px;line-height:1.45}
      #pcgdRoleBar{display:none;max-width:1180px;margin:12px auto 0;padding:0 18px}.tl-role-inner{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #cbdbe2;background:#fff;border-radius:11px;padding:10px 12px;box-shadow:0 3px 12px rgba(35,73,89,.07)}.tl-role-info strong{display:block;font-size:14px;color:#183f51}.tl-role-info span{display:block;margin-top:3px;font-size:11px;color:#667e89}.tl-role-user{display:flex;align-items:center;gap:9px}.tl-role-user div{text-align:right}.tl-role-user b{display:block;font-size:12px}.tl-role-user small{font-size:10px;color:#6a7f89}.tl-role-user button{height:33px;padding:0 10px}
      body[data-pcgd-level="ministry"] .import-panel,body[data-pcgd-level="ministry"] #selectedFilePanel,body[data-pcgd-level="ministry"] #directEntryPanel,body[data-pcgd-level="ministry"] #status,body[data-pcgd-level="ministry"] .scopebar,body[data-pcgd-level="ministry"] .main-menu,body[data-pcgd-level="ministry"] .tabpage,
      body[data-pcgd-level="province"] .import-panel,body[data-pcgd-level="province"] #selectedFilePanel,body[data-pcgd-level="province"] #directEntryPanel,body[data-pcgd-level="province"] #status,body[data-pcgd-level="province"] .scopebar,body[data-pcgd-level="province"] .main-menu,body[data-pcgd-level="province"] .tabpage{display:none!important}
      body[data-pcgd-level="ministry"] #nationalScopePanel .nat-head,body[data-pcgd-level="ministry"] #nationalScopePanel .nat-grid,body[data-pcgd-level="ministry"] #nationalScopePanel .nat-actions,body[data-pcgd-level="ministry"] #nationalScopePanel .nat-status,body[data-pcgd-level="ministry"] #nationalScopePanel .nat-config,body[data-pcgd-level="ministry"] #pcgdAuthBox,
      body[data-pcgd-level="province"] #nationalScopePanel .nat-head,body[data-pcgd-level="province"] #nationalScopePanel .nat-grid,body[data-pcgd-level="province"] #nationalScopePanel .nat-actions,body[data-pcgd-level="province"] #nationalScopePanel .nat-status,body[data-pcgd-level="province"] #nationalScopePanel .nat-config,body[data-pcgd-level="province"] #pcgdAuthBox{display:none!important}
      body[data-pcgd-level="ministry"] #nationalScopePanel,body[data-pcgd-level="province"] #nationalScopePanel{display:block!important;padding-top:12px}
      body[data-pcgd-level="ministry"] #nationalAggregatePanel,body[data-pcgd-level="province"] #nationalAggregatePanel{display:block!important}
      body[data-pcgd-level="ministry"] #gdmnAggregateOnlyPanel,body[data-pcgd-level="province"] #gdmnAggregateOnlyPanel{display:none!important}
      body[data-pcgd-level="commune"] #nationalScopePanel,body[data-pcgd-level="commune"] #nationalAggregatePanel,body[data-pcgd-level="commune"] #gdmnAggregateOnlyPanel{display:none!important}
      body:not([data-pcgd-level]) main,body:not([data-pcgd-level]) footer{visibility:hidden}
      @media(max-width:600px){.tl-login-card{border-radius:12px}.tl-login-head,.tl-login-body{padding-left:18px;padding-right:18px}.tl-role-inner{align-items:flex-start;flex-direction:column}.tl-role-user{width:100%;justify-content:space-between}.tl-role-user div{text-align:left}}
    `;document.head.appendChild(st);
  }

  function ensurePortal(){
    if($('pcgdLoginPortal'))return;
    const portal=document.createElement('section');portal.id='pcgdLoginPortal';portal.innerHTML=`
      <div class="tl-login-card" role="dialog" aria-modal="true" aria-labelledby="pcgdPortalTitle">
        <div class="tl-login-head"><h1 id="pcgdPortalTitle">Đăng nhập PCGD-XMC Smart</h1><p>Mỗi cấp quản lý có một giao diện riêng. Sau đăng nhập hệ thống chỉ mở đúng chức năng thuộc phạm vi được cấp.</p></div>
        <div class="tl-login-body">
          <div class="tl-field"><label for="pcgdPortalLevel">Cấp đăng nhập</label><select id="pcgdPortalLevel"><option value="ministry">Cấp Bộ</option><option value="province">Cấp tỉnh / thành phố</option><option value="commune">Cấp xã / phường / đặc khu</option></select></div>
          <div class="tl-field"><label for="pcgdPortalUser">Tên đăng nhập</label><input id="pcgdPortalUser" autocomplete="username" value="admin" placeholder="Tên đăng nhập"></div>
          <div class="tl-field"><label for="pcgdPortalPass">Mật khẩu</label><input id="pcgdPortalPass" type="password" autocomplete="current-password" placeholder="Nhập mật khẩu"></div>
          <button id="pcgdPortalLoginBtn" type="button">Đăng nhập</button>
          <div id="pcgdPortalMsg" class="tl-login-msg">Chọn đúng cấp đã được cấp quyền.</div>
          <div class="tl-login-note">Phân quyền: <strong>Cấp Bộ → cấp tài khoản tỉnh</strong> · <strong>Cấp tỉnh → cấp tài khoản xã</strong> · <strong>Cấp xã → chỉ thực hiện nghiệp vụ của xã</strong>.</div>
        </div>
      </div>`;
    document.body.appendChild(portal);

    const loginBtn=$('pcgdPortalLoginBtn');
    const doLogin=async()=>{
      const msg=$('pcgdPortalMsg'),selected=$('pcgdPortalLevel').value,username=clean($('pcgdPortalUser').value),password=$('pcgdPortalPass').value;
      if(!username||!password){msg.textContent='Vui lòng nhập tên đăng nhập và mật khẩu.';msg.dataset.kind='error';return}
      loginBtn.disabled=true;msg.textContent='Đang xác thực tài khoản…';msg.dataset.kind='';
      try{
        const u=await auth().login(username,password),actual=levelOf(u);
        if(actual!==selected){auth().logout();throw new Error(`Tài khoản này thuộc ${roleName(u)}, không phải ${AUTH_LEVELS[selected].label}.`)}
        msg.textContent='Đăng nhập thành công.';$('pcgdPortalPass').value='';
      }catch(e){msg.textContent=e?.message||'Không thể đăng nhập.';msg.dataset.kind='error'}finally{loginBtn.disabled=false}
    };
    loginBtn.addEventListener('click',doLogin);
    $('pcgdPortalPass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
  }

  function ensureRoleBar(){
    if($('pcgdRoleBar'))return;
    const bar=document.createElement('div');bar.id='pcgdRoleBar';
    const header=document.querySelector('.topbar');if(header)header.insertAdjacentElement('afterend',bar);else document.body.prepend(bar);
  }

  function lockAdminHierarchy(u,level){
    const role=$('pauRole'),province=$('pauProvince'),commune=$('pauCommune');if(!role)return;
    if(level==='ministry'){
      role.innerHTML='<option value="province_admin">Quản trị tỉnh</option>';
      if(province)province.disabled=false;if(commune){commune.value='';commune.disabled=true}
    }else if(level==='province'){
      role.innerHTML='<option value="commune_admin">Quản trị xã</option>';
      if(province){province.value=u.provinceKey||'';province.disabled=true}if(commune)commune.disabled=false;
    }
  }

  function render(){
    const a=auth();if(!a)return;
    const u=user(),portal=$('pcgdLoginPortal'),bar=$('pcgdRoleBar');
    if(!u){
      document.body.removeAttribute('data-pcgd-level');
      if(portal)portal.style.display='grid';if(bar)bar.style.display='none';
      return;
    }
    const level=levelOf(u);if(!level){a.logout();return}
    document.body.dataset.pcgdLevel=level;if(portal)portal.style.display='none';
    const meta=AUTH_LEVELS[level];
    if(bar){bar.style.display='block';bar.innerHTML=`<div class="tl-role-inner"><div class="tl-role-info"><strong>${esc(meta.title)}</strong><span>${esc(meta.desc)}</span></div><div class="tl-role-user"><div><b>${esc(u.displayName||u.username)}</b><small>${esc(meta.label)} · ${esc(u.username)}</small></div><button id="pcgdRoleLogout" class="secondary" type="button">Đăng xuất</button></div></div>`;$('pcgdRoleLogout').onclick=()=>a.logout()}
    setTimeout(()=>{lockAdminHierarchy(u,level);global.PCGDNational?.renderAggregate?.()},80);
  }

  function init(){
    ensureStyle();ensurePortal();ensureRoleBar();
    if(!auth()){setTimeout(init,80);return}
    global.addEventListener('pcgd-auth-changed',()=>setTimeout(render,0));
    const mo=new MutationObserver(()=>{const u=user();if(u){const level=levelOf(u);lockAdminHierarchy(u,level)}});mo.observe(document.body,{childList:true,subtree:true});
    render();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
