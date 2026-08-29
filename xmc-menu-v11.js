(function(){
  'use strict';
  const tab=document.querySelector('.main-menu [data-tab="xmc"]');
  const sourceMenu=document.querySelector('[data-menu-group="xmc"]');
  if(!tab||!sourceMenu||document.getElementById('xmcMainDropdown'))return;

  tab.textContent='Xóa mù chữ ▾';
  tab.setAttribute('aria-haspopup','menu');
  tab.setAttribute('aria-expanded','false');
  sourceMenu.style.display='none';

  const style=document.createElement('style');
  style.textContent=`
    #xmcMainDropdown{position:fixed;z-index:2200;display:none;min-width:300px;max-width:min(380px,calc(100vw - 12px));background:#fff;border:1px solid #6f91a6;box-shadow:0 6px 18px rgba(0,0,0,.24);padding:3px;font-family:Arial,sans-serif}
    #xmcMainDropdown .xmc-dd-head{padding:6px 9px 4px;font-size:10px;font-weight:700;color:#667985;background:#edf3f6;border-bottom:1px solid #d3dde3;text-transform:uppercase}
    #xmcMainDropdown button{display:block;width:100%;border:0;background:#fff;text-align:left;padding:8px 10px;font-size:11px;color:#253f4d;cursor:pointer;white-space:normal}
    #xmcMainDropdown button:hover,#xmcMainDropdown button:focus{background:#dcecf5;color:#0d527d;outline:none}
    #xmcMainDropdown .xmc-dd-sep{height:1px;background:#d7e0e5;margin:3px 0}
  `;
  document.head.appendChild(style);

  const dropdown=document.createElement('div');dropdown.id='xmcMainDropdown';dropdown.setAttribute('role','menu');dropdown.innerHTML=`
    <div class="xmc-dd-head">Biểu tổng hợp XMC</div>
    <button type="button" data-xmc-target="[data-report-sheet='CMC-1']">CMC-1 · Tổng hợp tình hình công tác XMC</button>
    <button type="button" data-xmc-target="[data-report-sheet='CMC-2']">CMC-2 · Thống kê số người mù chữ các độ tuổi</button>
    <button type="button" data-xmc-target="[data-report-sheet='CMC-3']">CMC-3 · Tổng hợp kết quả xóa mù chữ</button>
    <button type="button" data-xmc-target="[data-report-sheet='CMC-4']">CMC-4 · Thống kê đạt chuẩn xóa mù chữ</button>
    <div class="xmc-dd-sep"></div><div class="xmc-dd-head">Biểu tổng hợp theo nhóm tuổi</div>
    <button type="button" data-xmc-target="[data-xmc-age-range='15-25']">XMC 15–25 tuổi</button>
    <button type="button" data-xmc-target="[data-xmc-age-range='26-35']">XMC 26–35 tuổi</button>
    <button type="button" data-xmc-target="[data-xmc-age-range='36-60']">XMC 36–60 tuổi</button>
    <div class="xmc-dd-sep"></div><div class="xmc-dd-head">Danh sách đối tượng</div>
    <button type="button" data-xmc-target="[data-mc-level='MC1']">Người mù chữ mức độ 1</button>
    <button type="button" data-xmc-target="[data-mc-level='MC2']">Người mù chữ mức độ 2</button>`;document.body.appendChild(dropdown);
  function position(){const r=tab.getBoundingClientRect();dropdown.style.left=`${Math.max(4,Math.min(r.left,window.innerWidth-dropdown.offsetWidth-6))}px`;dropdown.style.top=`${r.bottom+2}px`}
  function open(){dropdown.style.display='block';position();tab.setAttribute('aria-expanded','true')}
  function close(){dropdown.style.display='none';tab.setAttribute('aria-expanded','false')}
  function toggle(){dropdown.style.display==='block'?close():open()}
  function activateXmcPage(){document.querySelectorAll('.main-menu .tab').forEach(b=>b.classList.toggle('active',b===tab));document.querySelectorAll('.tabpage').forEach(p=>p.classList.toggle('active',p.id==='xmc'))}
  tab.addEventListener('click',ev=>{ev.preventDefault();ev.stopImmediatePropagation();toggle()},true);
  dropdown.querySelectorAll('[data-xmc-target]').forEach(item=>item.addEventListener('click',()=>{const target=sourceMenu.querySelector(item.dataset.xmcTarget);close();activateXmcPage();if(target){target.click();document.getElementById('xmc')?.scrollIntoView({behavior:'smooth',block:'start'})}}));
  document.addEventListener('click',ev=>{if(dropdown.style.display==='block'&&!dropdown.contains(ev.target)&&ev.target!==tab)close()});window.addEventListener('resize',()=>{if(dropdown.style.display==='block')position()});window.addEventListener('scroll',()=>{if(dropdown.style.display==='block')position()},{passive:true});window.addEventListener('keydown',ev=>{if(ev.key==='Escape')close()});
})();

function loadPcgdxmcModule(src,dataKey){
  if(document.querySelector(`script[${dataKey}]`))return;const s=document.createElement('script');s.src=src;s.setAttribute(dataKey,'1');document.head.appendChild(s);
}
(function(){if(!window.PCGDExcelExport?.installed)loadPcgdxmcModule('./excel-export-v12.js','data-pcgd-excel-export')})();
(function(){loadPcgdxmcModule('./education-menus-v13.js','data-pcgd-education-menus')})();
(function(){loadPcgdxmcModule('./auth-v14.js','data-pcgd-auth')})();
(function(){loadPcgdxmcModule('./aggregate-export-v14.js','data-pcgd-aggregate-export')})();
