(function(){
  'use strict';

  const CONFIG={
    mn:{
      label:'Mầm non',
      groups:[
        {head:'Biểu Mầm non',items:[
          ["[data-report-sheet='MN-1TE']",'MN-1TE · Thống kê trẻ em'],
          ["[data-report-sheet='MN-2']",'MN-2 · Tổng hợp phổ cập'],
          ["[data-report-sheet='MN-CSVC']",'MN-CSVC · Cơ sở vật chất'],
          ["[data-report-sheet='MN-ĐN']",'MN-ĐN · Đội ngũ']
        ]}
      ]
    },
    th:{
      label:'Tiểu học',
      groups:[
        {head:'Biểu Tiểu học',items:[
          ["[data-report-sheet='TH-1TE']",'TH-1TE · Thống kê trẻ em'],
          ["[data-report-sheet='TH-2']",'TH-2 · Tổng hợp phổ cập'],
          ["[data-report-sheet='TH-CSVC']",'TH-CSVC · Cơ sở vật chất'],
          ["[data-report-sheet='TH-DN']",'TH-ĐN · Đội ngũ']
        ]},
        {head:'Mẫu Excel gốc',items:[
          ["[data-excel-original='TH-XLS-GV']",'TH-01-GV · Đội ngũ giáo viên'],
          ["[data-excel-original='TH-XLS-CSVC']",'TH-01-CSVC · Cơ sở vật chất'],
          ["[data-excel-original='TH-XLS-HS-OUT']",'HS địa phương học ở ngoài'],
          ["[data-excel-original='TH-XLS-HS-IN']",'HS nơi khác đến học']
        ]}
      ]
    },
    thcs:{
      label:'THCS',
      groups:[
        {head:'Biểu THCS',items:[
          ["[data-report-sheet='THCS-1TTN']",'THCS-1TTN · Thanh thiếu niên'],
          ["[data-report-sheet='THCS-2.1']",'THCS-2.1 · Tổng hợp huy động'],
          ["[data-report-sheet='THCS-2.2']",'THCS-2.2 · Tổng hợp phổ cập'],
          ["[data-report-sheet='THCS-CSVC']",'THCS-CSVC · Cơ sở vật chất'],
          ["[data-report-sheet='THCS-DN']",'THCS-ĐN · Đội ngũ']
        ]}
      ]
    }
  };

  if(document.getElementById('eduMainDropdown'))return;

  const style=document.createElement('style');
  style.textContent=`
    #eduMainDropdown{position:fixed;z-index:2250;display:none;min-width:295px;max-width:min(390px,calc(100vw - 12px));max-height:min(70vh,560px);overflow:auto;background:#fff;border:1px solid #6f91a6;box-shadow:0 6px 18px rgba(0,0,0,.24);padding:3px;font-family:Arial,sans-serif}
    #eduMainDropdown .edu-dd-head{padding:6px 9px 4px;font-size:10px;font-weight:700;color:#667985;background:#edf3f6;border-bottom:1px solid #d3dde3;text-transform:uppercase}
    #eduMainDropdown button{display:block;width:100%;border:0;background:#fff;text-align:left;padding:8px 10px;font-size:11px;color:#253f4d;cursor:pointer;white-space:normal}
    #eduMainDropdown button:hover,#eduMainDropdown button:focus{background:#dcecf5;color:#0d527d;outline:none}
    #eduMainDropdown .edu-dd-sep{height:1px;background:#d7e0e5;margin:3px 0}
  `;
  document.head.appendChild(style);

  const dropdown=document.createElement('div');
  dropdown.id='eduMainDropdown';
  dropdown.setAttribute('role','menu');
  document.body.appendChild(dropdown);

  let currentTab=null,currentKey='';

  function sourceMenu(key){return document.querySelector(`[data-menu-group="${key}"]`);}
  function position(){
    if(!currentTab)return;
    const r=currentTab.getBoundingClientRect();
    const w=dropdown.offsetWidth||320;
    dropdown.style.left=`${Math.max(4,Math.min(r.left,window.innerWidth-w-6))}px`;
    dropdown.style.top=`${r.bottom+2}px`;
  }
  function close(){
    dropdown.style.display='none';
    if(currentTab)currentTab.setAttribute('aria-expanded','false');
    currentTab=null;currentKey='';
  }
  function activatePage(key,tab){
    document.querySelectorAll('.main-menu .tab').forEach(b=>b.classList.toggle('active',b===tab));
    document.querySelectorAll('.tabpage').forEach(p=>p.classList.toggle('active',p.id===key));
  }
  function renderDropdown(key,tab){
    const cfg=CONFIG[key];if(!cfg)return;
    dropdown.innerHTML=cfg.groups.map((g,gi)=>`${gi?'<div class="edu-dd-sep"></div>':''}<div class="edu-dd-head">${g.head}</div>${g.items.map(([selector,label])=>`<button type="button" data-edu-key="${key}" data-edu-target="${selector.replace(/"/g,'&quot;')}">${label}</button>`).join('')}`).join('');
    dropdown.querySelectorAll('[data-edu-target]').forEach(item=>item.addEventListener('click',()=>{
      const selector=item.dataset.eduTarget;
      const sm=sourceMenu(key);
      const target=sm?.querySelector(selector);
      close();
      activatePage(key,tab);
      if(target){
        target.click();
        document.getElementById(key)?.scrollIntoView({behavior:'smooth',block:'start'});
      }else{
        const box=document.getElementById(`preview-${key}`);
        if(box)box.innerHTML='<div class="blank">Chức năng này chưa sẵn sàng. Hãy tải lại trang bằng Ctrl + F5.</div>';
      }
    }));
  }
  function open(key,tab){
    if(currentTab&&currentTab!==tab)currentTab.setAttribute('aria-expanded','false');
    currentKey=key;currentTab=tab;
    renderDropdown(key,tab);
    dropdown.style.display='block';position();
    tab.setAttribute('aria-expanded','true');
  }
  function toggle(key,tab){
    if(dropdown.style.display==='block'&&currentTab===tab){close();return;}
    open(key,tab);
  }

  Object.entries(CONFIG).forEach(([key,cfg])=>{
    const tab=document.querySelector(`.main-menu [data-tab="${key}"]`),sm=sourceMenu(key);
    if(!tab||!sm)return;
    tab.textContent=`${cfg.label} ▾`;
    tab.setAttribute('aria-haspopup','menu');
    tab.setAttribute('aria-expanded','false');
    sm.style.display='none';
    tab.addEventListener('click',ev=>{
      ev.preventDefault();ev.stopImmediatePropagation();toggle(key,tab);
    },true);
  });

  document.addEventListener('click',ev=>{
    if(dropdown.style.display==='block'&&!dropdown.contains(ev.target)&&ev.target!==currentTab)close();
  });
  window.addEventListener('resize',()=>{if(dropdown.style.display==='block')position();});
  window.addEventListener('scroll',()=>{if(dropdown.style.display==='block')position();},{passive:true});
  window.addEventListener('keydown',ev=>{if(ev.key==='Escape')close();});
})();
