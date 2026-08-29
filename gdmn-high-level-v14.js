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
  const fmt=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

  function activateMnTab(){
    const target=document.querySelector('.main-menu [data-tab="mn"]');if(!target)return;
    document.querySelectorAll('.main-menu .tab').forEach(x=>x.classList.toggle('active',x===target));
    document.querySelectorAll('.tabpage').forEach(x=>x.classList.toggle('active',x.id==='mn'));
  }

  function ensureHighLevelFormPanel(){
    const workspace=document.querySelector('#mn .report-workspace');
    if(!workspace||$('gdmnHighLevelForms'))return;
    const panel=document.createElement('section');
    panel.id='gdmnHighLevelForms';panel.className='gdmn-high-forms';
    panel.innerHTML=`
      <div class="gdmn-high-note"><strong>Chế độ tổng hợp GDMN</strong><span>Cấp tỉnh/toàn quốc không nhập phiếu điều tra cá nhân. Hệ thống chỉ nhận số liệu tổng hợp từ cấp dưới theo 7 biểu GDMN.</span></div>
      <div class="gdmn-form-grid">${GDMN_FORMS.map((f,i)=>`<article class="gdmn-form-card"><span>${i+1}</span><div><strong>${f.code}</strong><p>${f.name}</p><small>${f.file}</small></div></article>`).join('')}</div>`;
    const submenu=workspace.querySelector('.report-submenu');
    if(submenu)submenu.insertAdjacentElement('beforebegin',panel);else workspace.appendChild(panel);
  }

  function ensureAggregatePanel(){
    if($('gdmnAggregateOnlyPanel'))return;
    const anchor=$('nationalScopePanel');if(!anchor)return;
    const panel=document.createElement('section');
    panel.id='gdmnAggregateOnlyPanel';panel.className='panel';panel.style.display='none';
    panel.innerHTML=`<div class="nat-head"><div class="nat-title"><h3 id="gdmnAggregateTitle">Tổng hợp GDMN</h3><p>Chỉ sử dụng gói tổng hợp từ cấp dưới; không tải dữ liệu điều tra cá nhân.</p></div></div><div id="gdmnAggregateKpis" class="nat-kpis"></div><div id="gdmnAggregateBody"><div class="nat-empty">Chưa có dữ liệu tổng hợp GDMN.</div></div><div id="gdmnAggregateMeta" class="nat-meta"></div>`;
    anchor.insertAdjacentElement('afterend',panel);
  }

  function ensureStyles(){
    if($('gdmnHighLevelStyle'))return;
    const st=document.createElement('style');st.id='gdmnHighLevelStyle';st.textContent=`
      .gdmn-high-forms{display:none;margin:10px 0}.gdmn-high-note{display:flex;gap:8px;align-items:flex-start;flex-direction:column;border:1px solid #b7d7c5;background:#eef9f2;color:#214d32;border-radius:8px;padding:10px 12px;font-size:12px}.gdmn-high-note span{color:#4d6757}.gdmn-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.gdmn-form-card{display:flex;gap:9px;align-items:flex-start;border:1px solid #d6e1e6;background:#fff;border-radius:8px;padding:9px}.gdmn-form-card>span{display:grid;place-items:center;min-width:25px;height:25px;border-radius:50%;background:#e4f0f6;color:#155b7f;font-weight:800;font-size:11px}.gdmn-form-card strong{font-size:11px;color:#174b65}.gdmn-form-card p{margin:2px 0;font-size:11px;color:#314b58}.gdmn-form-card small{font-size:9px;color:#7b8d96;word-break:break-word}.gdmn-level-banner{margin:8px 0 0;padding:8px 10px;border-radius:7px;background:#fff5dc;color:#7d5600;font-size:11px;font-weight:700}.gdmn-year-only{grid-template-columns:minmax(180px,260px)!important}.gdmn-year-only .field.small{max-width:260px}@media(max-width:700px){.gdmn-form-grid{grid-template-columns:1fr}}
    `;document.head.appendChild(st);
  }

  function updateMnWorkspace(high,level){
    ensureHighLevelFormPanel();
    const panel=$('gdmnHighLevelForms');if(panel)panel.style.display=high?'block':'none';
    const workspace=document.querySelector('#mn .report-workspace');if(!workspace)return;
    const submenu=workspace.querySelector('.report-submenu'),meta=workspace.querySelector('.report-meta'),preview=workspace.querySelector('.report-preview'),exportBtn=workspace.querySelector('[data-export-scope-group="mn"]');
    rememberAndSet(submenu,!high);rememberAndSet(meta,!high);rememberAndSet(preview,!high);rememberAndSet(exportBtn,!high);
    const h2=workspace.querySelector('.report-head h2'),p=workspace.querySelector('.report-head p');
    if(h2){if(!h2.dataset.gdmnOriginalText)h2.dataset.gdmnOriginalText=h2.textContent||'';const text=high?`Tổng hợp phổ cập GDMN · ${level==='national'?'Toàn quốc':'Cấp tỉnh'}`:h2.dataset.gdmnOriginalText;if(h2.textContent!==text)h2.textContent=text;}
    if(p){if(!p.dataset.gdmnOriginalText)p.dataset.gdmnOriginalText=p.textContent||'';const text=high?'Chỉ tổng hợp 7 biểu GDMN từ cấp dưới; không sử dụng phiếu điều tra gốc tại cấp này.':p.dataset.gdmnOriginalText;if(p.textContent!==text)p.textContent=text;}
  }

  function updateScopePanel(high,level){
    const p=document.querySelector('#nationalScopePanel .nat-title p');
    if(p){if(!p.dataset.gdmnOriginalText)p.dataset.gdmnOriginalText=p.textContent||'';const text=high?'Chế độ quản lý tổng hợp: không tải, nhập hoặc chỉnh sửa dữ liệu điều tra cá nhân; chỉ tổng hợp biểu GDMN từ cấp dưới.':p.dataset.gdmnOriginalText;if(p.textContent!==text)p.textContent=text;}
    let banner=$('gdmnLevelBanner');
    if(high&&!banner&&$('nationalScopePanel')){banner=document.createElement('div');banner.id='gdmnLevelBanner';banner.className='gdmn-level-banner';$('nationalScopePanel').appendChild(banner);}
    if(banner){banner.style.display=high?'block':'none';const text=level==='national'?'TOÀN QUỐC: chỉ tổng hợp biểu GDMN của 34 tỉnh/thành. Không có chức năng Phiếu điều tra.':'CẤP TỈNH: chỉ tổng hợp biểu GDMN của các xã/phường/đặc khu trực thuộc. Không có chức năng Phiếu điều tra.';if(banner.textContent!==text)banner.textContent=text;}
  }

  async function renderHighAggregate(){
    const s=scope(),panel=$('gdmnAggregateOnlyPanel');if(!panel)return;
    if(!HIGH_LEVELS.has(s.level)){panel.style.display='none';return;}
    panel.style.display='block';
    $('gdmnAggregateTitle').textContent=s.level==='national'?'Tổng hợp GDMN toàn quốc':'Tổng hợp GDMN cấp tỉnh';
    $('gdmnAggregateBody').innerHTML='<div class="nat-loading">Đang nạp gói tổng hợp GDMN…</div>';
    try{
      const data=await global.PCGDNational.getAggregate(),rows=Array.isArray(data.rows)?data.rows:[],m=data.metrics||{};
      const age05=Number(m.ageBands?.['0–5 tuổi'])||0;
      const provinces=new Set(rows.map(r=>r.provinceKey).filter(Boolean));
      $('gdmnAggregateKpis').innerHTML=[['Trẻ 0–5 tuổi',fmt(age05)],['Gói cấp xã',fmt(rows.length)],[s.level==='national'?'Tỉnh có dữ liệu':'Biểu GDMN',s.level==='national'?fmt(provinces.size):'7'],['Phạm vi biểu','7 biểu']].map(x=>`<div class="nat-kpi"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join('');
      let displayRows=[];
      if(s.level==='national'){
        const map=new Map();rows.forEach(r=>{const k=r.provinceKey||'unknown',v=map.get(k)||{name:r.provinceName||k,communes:0,age05:0};v.communes++;v.age05+=Number(r.metrics?.ageBands?.['0–5 tuổi'])||0;map.set(k,v)});displayRows=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'vi'));
      }else displayRows=rows.map(r=>({name:r.communeName||r.communeCode||'Chưa đặt tên',communes:1,age05:Number(r.metrics?.ageBands?.['0–5 tuổi'])||0})).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
      $('gdmnAggregateBody').innerHTML=displayRows.length?`<div class="nat-table-wrap"><table><thead><tr><th>Đơn vị</th><th>Số xã</th><th>Trẻ 0–5 tuổi</th></tr></thead><tbody>${displayRows.slice(0,300).map(r=>`<tr><td>${esc(r.name)}</td><td>${fmt(r.communes)}</td><td>${fmt(r.age05)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="nat-empty">Chưa có gói tổng hợp GDMN từ cấp dưới cho năm đang chọn.</div>';
      $('gdmnAggregateMeta').textContent=`Năm ${$('yearInput')?.value||''} · ${rows.length} gói cấp xã · danh mục 7 biểu GDMN`;
    }catch(e){$('gdmnAggregateBody').innerHTML=`<div class="nat-empty">${esc(e?.message||'Không thể nạp tổng hợp GDMN.')}</div>`;}
  }

  function applyLevelMode(){
    const s=scope(),high=HIGH_LEVELS.has(s.level);document.body.dataset.managementLevel=s.level||'commune';
    const highHiddenSelectors=[
      '.import-panel .field.grow','#analyzeBtn','#exportBtn','#selectedFilePanel','#directEntryPanel','#status','.scopebar','#surveyInputMenu','#nationalAggregatePanel',
      '.main-menu [data-tab="overview"]','.main-menu [data-tab="data"]','.main-menu [data-tab="errors"]','.main-menu [data-tab="th"]','.main-menu [data-tab="thcs"]','.main-menu [data-tab="xmc"]',
      '#overview','#data','#errors','#th','#thcs','#xmc'
    ];
    highHiddenSelectors.forEach(sel=>document.querySelectorAll(sel).forEach(el=>rememberAndSet(el,!high)));
    document.querySelector('.import-panel')?.classList.toggle('gdmn-year-only',high);
    const file=$('excelFile');if(file)file.disabled=high;
    updateMnWorkspace(high,s.level);updateScopePanel(high,s.level);
    if(high)activateMnTab();else global.PCGDNational?.renderAggregate?.();
    renderHighAggregate();
  }

  function bindScopeEvents(){
    const level=$('managementLevel');if(level&&!level.dataset.gdmnBound){level.dataset.gdmnBound='1';level.addEventListener('change',()=>setTimeout(applyLevelMode,0));}
    const save=$('saveManagementScope');if(save&&!save.dataset.gdmnBound){save.dataset.gdmnBound='1';save.addEventListener('click',()=>setTimeout(applyLevelMode,0));}
    const refresh=$('refreshAggregateBtn');if(refresh&&!refresh.dataset.gdmnBound){refresh.dataset.gdmnBound='1';refresh.addEventListener('click',()=>setTimeout(renderHighAggregate,50));}
    const year=$('yearInput');if(year&&!year.dataset.gdmnBound){year.dataset.gdmnBound='1';year.addEventListener('change',()=>setTimeout(renderHighAggregate,50));}
  }

  function init(){
    ensureStyles();ensureHighLevelFormPanel();ensureAggregatePanel();bindScopeEvents();applyLevelMode();
    setTimeout(()=>{ensureAggregatePanel();bindScopeEvents();applyLevelMode();},300);
    global.addEventListener('storage',e=>{if(e.key===SCOPE_KEY)applyLevelMode()});
    global.PCGDGdmnHighLevel={GDMN_FORMS,applyLevelMode,isHighLevel,renderHighAggregate};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
