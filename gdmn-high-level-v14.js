(function(global){
  'use strict';

  const SCOPE_KEY='pcgdxmc_management_scope';
  const HIGH_LEVELS=new Set(['province','national']);
  const GDMN_FORMS=[
    {code:'MN-01-TE',name:'Thống kê trẻ em mầm non theo độ tuổi',file:'3-6T_MN-01-TE.xlsx'},
    {code:'MN-01-TCĐK',name:'Thống kê tiêu chuẩn, điều kiện phổ cập GDMN theo từng xã',file:'3-6T-Ket qua dat chuan theo xa-MN-02.xlsx'},
    {code:'MN-01-GV',name:'Thống kê đội ngũ cán bộ quản lý, giáo viên, nhân viên',file:'3-6T-MN-01-GV.xlsx'},
    {code:'MN-01-CSVC',name:'Thống kê cơ sở vật chất, thiết bị dạy học lớp mẫu giáo',file:'3-6T-MN-01-CSVC.xlsx'},
    {code:'MN-01-TC',name:'Thống kê tình hình tài chính phổ cập GDMN',file:'10-2025-BC_Taichinh Pho cap.xlsx'},
    {code:'MN-05-KT',name:'Báo cáo thống kê đối tượng khuyết tật mầm non',file:'Khuyettat_Mamnon.xlsx'},
    {code:'MN-06-SỔ PC',name:'Sổ theo dõi phổ cập giáo dục mầm non',file:'So pho cap-PCGD_MN.xlsx'}
  ];

  const $=id=>document.getElementById(id);
  const scope=()=>{
    try{return {level:'commune',...JSON.parse(localStorage.getItem(SCOPE_KEY)||'{}')}}
    catch(_){return {level:'commune'}}
  };
  const isHighLevel=()=>HIGH_LEVELS.has(scope().level);

  function rememberAndSet(el,show){
    if(!el)return;
    if(el.dataset.gdmnOriginalDisplay===undefined)el.dataset.gdmnOriginalDisplay=el.style.display||'';
    el.style.display=show?el.dataset.gdmnOriginalDisplay:'none';
  }

  function activateSafeTab(){
    const active=document.querySelector('.main-menu .tab.active');
    if(active&&active.style.display!=='none')return;
    const target=document.querySelector('.main-menu [data-tab="mn"]')||document.querySelector('.main-menu [data-tab="overview"]');
    if(target){
      document.querySelectorAll('.main-menu .tab').forEach(x=>x.classList.toggle('active',x===target));
      document.querySelectorAll('.tabpage').forEach(x=>x.classList.toggle('active',x.id===target.dataset.tab));
    }
  }

  function ensureHighLevelFormPanel(){
    const workspace=document.querySelector('#mn .report-workspace');
    if(!workspace||$('gdmnHighLevelForms'))return;
    const panel=document.createElement('section');
    panel.id='gdmnHighLevelForms';
    panel.className='gdmn-high-forms';
    panel.innerHTML=`
      <div class="gdmn-high-note"><strong>Chế độ tổng hợp GDMN</strong><span>Cấp tỉnh/toàn quốc không nhập phiếu điều tra cá nhân. Hệ thống chỉ nhận số liệu tổng hợp từ cấp dưới theo 7 biểu GDMN.</span></div>
      <div class="gdmn-form-grid">${GDMN_FORMS.map((f,i)=>`<article class="gdmn-form-card"><span>${i+1}</span><div><strong>${f.code}</strong><p>${f.name}</p><small>${f.file}</small></div></article>`).join('')}</div>`;
    const submenu=workspace.querySelector('.report-submenu');
    if(submenu)submenu.insertAdjacentElement('beforebegin',panel);else workspace.appendChild(panel);
  }

  function ensureStyles(){
    if($('gdmnHighLevelStyle'))return;
    const st=document.createElement('style');st.id='gdmnHighLevelStyle';st.textContent=`
      .gdmn-high-forms{display:none;margin:10px 0}.gdmn-high-note{display:flex;gap:8px;align-items:flex-start;flex-direction:column;border:1px solid #b7d7c5;background:#eef9f2;color:#214d32;border-radius:8px;padding:10px 12px;font-size:12px}.gdmn-high-note span{color:#4d6757}.gdmn-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.gdmn-form-card{display:flex;gap:9px;align-items:flex-start;border:1px solid #d6e1e6;background:#fff;border-radius:8px;padding:9px}.gdmn-form-card>span{display:grid;place-items:center;min-width:25px;height:25px;border-radius:50%;background:#e4f0f6;color:#155b7f;font-weight:800;font-size:11px}.gdmn-form-card strong{font-size:11px;color:#174b65}.gdmn-form-card p{margin:2px 0;font-size:11px;color:#314b58}.gdmn-form-card small{font-size:9px;color:#7b8d96;word-break:break-word}.gdmn-level-banner{margin:8px 0 0;padding:8px 10px;border-radius:7px;background:#fff5dc;color:#7d5600;font-size:11px;font-weight:700}@media(max-width:700px){.gdmn-form-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(st);
  }

  function updateMnWorkspace(high,level){
    ensureHighLevelFormPanel();
    const panel=$('gdmnHighLevelForms');if(panel)panel.style.display=high?'block':'none';
    const workspace=document.querySelector('#mn .report-workspace');if(!workspace)return;
    const submenu=workspace.querySelector('.report-submenu');
    const meta=workspace.querySelector('.report-meta');
    const preview=workspace.querySelector('.report-preview');
    const exportBtn=workspace.querySelector('[data-export-scope-group="mn"]');
    rememberAndSet(submenu,!high);rememberAndSet(meta,!high);rememberAndSet(preview,!high);rememberAndSet(exportBtn,!high);
    const h2=workspace.querySelector('.report-head h2'),p=workspace.querySelector('.report-head p');
    if(h2){if(!h2.dataset.gdmnOriginalText)h2.dataset.gdmnOriginalText=h2.textContent||'';h2.textContent=high?`Tổng hợp phổ cập GDMN · ${level==='national'?'Toàn quốc':'Cấp tỉnh'}`:h2.dataset.gdmnOriginalText;}
    if(p){if(!p.dataset.gdmnOriginalText)p.dataset.gdmnOriginalText=p.textContent||'';p.textContent=high?'Chỉ tổng hợp 7 biểu GDMN từ cấp dưới; không sử dụng phiếu điều tra gốc tại cấp này.':p.dataset.gdmnOriginalText;}
  }

  function updateScopePanel(high,level){
    const p=document.querySelector('#nationalScopePanel .nat-title p');
    if(p){if(!p.dataset.gdmnOriginalText)p.dataset.gdmnOriginalText=p.textContent||'';p.textContent=high?'Chế độ quản lý tổng hợp: không tải, nhập hoặc chỉnh sửa dữ liệu điều tra cá nhân; chỉ tổng hợp biểu GDMN từ cấp dưới.':p.dataset.gdmnOriginalText;}
    let banner=$('gdmnLevelBanner');
    if(high&&!banner&&$('nationalScopePanel')){
      banner=document.createElement('div');banner.id='gdmnLevelBanner';banner.className='gdmn-level-banner';$('nationalScopePanel').appendChild(banner);
    }
    if(banner){banner.style.display=high?'block':'none';banner.textContent=level==='national'?'TOÀN QUỐC: chỉ tổng hợp biểu GDMN của 34 tỉnh/thành. Không có chức năng Phiếu điều tra.':'CẤP TỈNH: chỉ tổng hợp biểu GDMN của các xã/phường/đặc khu trực thuộc. Không có chức năng Phiếu điều tra.';}
  }

  function applyLevelMode(){
    const s=scope(),high=HIGH_LEVELS.has(s.level);
    document.body.dataset.managementLevel=s.level||'commune';

    const highHiddenSelectors=[
      '.import-panel','#selectedFilePanel','#directEntryPanel','#status','.scopebar','#surveyInputMenu',
      '.main-menu [data-tab="data"]','.main-menu [data-tab="errors"]','.main-menu [data-tab="th"]','.main-menu [data-tab="thcs"]','.main-menu [data-tab="xmc"]',
      '#data','#errors','#th','#thcs','#xmc'
    ];
    highHiddenSelectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>rememberAndSet(el,!high)));

    const surveyTab=document.querySelector('.main-menu [data-tab="data"]');
    if(surveyTab)surveyTab.setAttribute('aria-hidden',high?'true':'false');
    const file=$('excelFile'),analyze=$('analyzeBtn');
    if(file)file.disabled=high;
    if(analyze&&high)analyze.disabled=true;

    updateMnWorkspace(high,s.level);
    updateScopePanel(high,s.level);
    if(high)activateSafeTab();
  }

  function bindScopeEvents(){
    const level=$('managementLevel');
    if(level&&!level.dataset.gdmnBound){level.dataset.gdmnBound='1';level.addEventListener('change',()=>setTimeout(applyLevelMode,0));}
    const save=$('saveManagementScope');
    if(save&&!save.dataset.gdmnBound){save.dataset.gdmnBound='1';save.addEventListener('click',()=>setTimeout(applyLevelMode,0));}
  }

  function init(){
    ensureStyles();ensureHighLevelFormPanel();bindScopeEvents();applyLevelMode();
    const observer=new MutationObserver(()=>{bindScopeEvents();applyLevelMode();});
    observer.observe(document.body,{childList:true,subtree:true});
    global.addEventListener('storage',e=>{if(e.key===SCOPE_KEY)applyLevelMode()});
    global.PCGDGdmnHighLevel={GDMN_FORMS,applyLevelMode,isHighLevel};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
