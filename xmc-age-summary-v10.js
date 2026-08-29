(function(global){
  'use strict';
  const X=global.XLSX;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').replace(/\s+/g,' ').trim().normalize('NFC').toLowerCase();
  const safe=v=>String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_');
  const C={H:7,I:8};
  let activeRange='';

  const RANGES={
    '15-25':{label:'15–25 tuổi',min:15,max:25,file:'15_25'},
    '26-35':{label:'26–35 tuổi',min:26,max:35,file:'26_35'},
    '36-60':{label:'36–60 tuổi',min:36,max:60,file:'36_60'}
  };

  const result=()=>global.PCGDLastResult||null;
  const isFemale=r=>String(r.raw?.[C.H]??'').trim().toUpperCase()==='X';
  const isMinority=r=>{const v=String(r.raw?.[C.I]??'').trim();return !!v&&norm(v)!=='kinh';};
  const isFemaleMinority=r=>isFemale(r)&&isMinority(r);
  const pct=(a,b)=>b?Math.round(a/b*1000000)/10000:0;
  const fmt=v=>Number(v||0).toLocaleString('vi-VN',{maximumFractionDigits:4});

  function selectedVillage(){return document.getElementById('villageSelect')?.value||'__ALL__';}
  function scopeLabel(){const s=document.getElementById('villageSelect');return !s||s.value==='__ALL__'?'Toàn xã':(s.options[s.selectedIndex]?.text||s.value).replace(/\s*\([^)]*người\)\s*$/i,'').trim();}
  function year(){return Number(document.getElementById('yearInput')?.value)||new Date().getFullYear();}
  function scopeRecords(){const r=result();if(!r)return[];const v=selectedVillage();return v==='__ALL__'?r.records:r.records.filter(x=>norm(x.village)===norm(v));}
  function eligible(rs,min,max){return rs.filter(r=>r.age>=min&&r.age<=max&&r.br!==1);}

  function metrics(rs,def){
    const all60=eligible(rs,15,60),g=eligible(rs,def.min,def.max),m1=g.filter(r=>r.bo==='MC1'),m2=g.filter(r=>r.bp==='MC2');
    const basic=a=>[a.length,a.filter(isFemale).length,a.filter(isMinority).length,a.filter(isFemaleMinority).length];
    const den=basic(g),v60=basic(all60),b1=basic(m1),b2=basic(m2);
    const mcBlock=(b)=>[b[0],pct(b[0],den[0]),b[1],pct(b[1],den[1]),b[2],pct(b[2],den[2]),b[3],pct(b[3],den[3])];
    return [...v60,...den,...mcBlock(b1),...mcBlock(b2)];
  }

  function grouped(def){
    const map=new Map();scopeRecords().forEach(r=>{const k=r.village||'Chưa xác định';if(!map.has(k))map.set(k,[]);map.get(k).push(r);});
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],'vi')).map(([v,rs],i)=>({stt:i+1,v,vals:metrics(rs,def)}));
  }

  function totals(rows){
    if(!rows.length)return Array(24).fill(0);
    const t=Array(24).fill(0);
    // population columns
    [0,1,2,3,4,5,6,7].forEach(i=>t[i]=rows.reduce((s,r)=>s+Number(r.vals[i]||0),0));
    // MC1 + MC2 count columns, then recompute rates from population denominators
    const countIdx=[8,10,12,14,16,18,20,22];countIdx.forEach(i=>t[i]=rows.reduce((s,r)=>s+Number(r.vals[i]||0),0));
    const denom=[4,5,6,7];
    [[8,9,0],[10,11,1],[12,13,2],[14,15,3],[16,17,0],[18,19,1],[20,21,2],[22,23,3]].forEach(([ci,pi,di])=>t[pi]=pct(t[ci],t[denom[di]]));
    return t;
  }

  function install(){
    const menu=document.querySelector('[data-menu-group="xmc"]');if(!menu||menu.dataset.ageSummaryInstalled)return;
    menu.dataset.ageSummaryInstalled='1';
    const sep=document.createElement('span');sep.textContent='Biểu tổng hợp nhóm tuổi:';sep.style.cssText='align-self:center;font-size:10px;font-weight:700;color:#526670;margin-left:5px';menu.appendChild(sep);
    Object.entries(RANGES).forEach(([key,def])=>{
      const b=document.createElement('button');b.type='button';b.textContent=`XMC ${def.label}`;b.dataset.xmcAgeRange=key;
      b.addEventListener('click',ev=>{ev.preventDefault();ev.stopImmediatePropagation();activeRange=key;menu.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));render(key);},true);
      menu.appendChild(b);
    });
    // Nếu người dùng chuyển sang CMC hoặc danh sách MĐ1/MĐ2 thì ngừng tự làm mới biểu nhóm tuổi.
    menu.querySelectorAll('button:not([data-xmc-age-range])').forEach(b=>b.addEventListener('click',()=>{activeRange='';},true));
    const sel=document.getElementById('villageSelect');if(sel)sel.addEventListener('change',()=>{if(activeRange)setTimeout(()=>render(activeRange),1);},true);
    document.querySelectorAll('[data-tab="xmc"]').forEach(t=>t.addEventListener('click',()=>{if(activeRange)setTimeout(()=>render(activeRange),1);},true));
  }

  function headerHtml(def){return `<thead>
    <tr class="xmc-title"><th colspan="26">TỔNG HỢP TÌNH HÌNH SỐ LIỆU CÔNG TÁC CHỐNG MÙ CHỮ</th></tr>
    <tr class="xmc-subtitle"><th colspan="26">${esc(scopeLabel().toUpperCase())} · NĂM ${year()}</th></tr>
    <tr><th rowspan="3">TT</th><th rowspan="3">Thôn, xóm, tổ dân phố</th><th colspan="4" rowspan="2">Tổng dân số<br>(15–60)</th><th colspan="4" rowspan="2">Chia ra: dân số từ<br>${esc(def.label)}</th><th colspan="16">Dân số từ ${esc(def.label)} mù chữ</th></tr>
    <tr><th colspan="8">Mức độ 1<br><small>(Chưa hoàn thành lớp 3)</small></th><th colspan="8">Mức độ 2<br><small>(Chưa hoàn thành lớp 5)</small></th></tr>
    <tr><th>TSố</th><th>Nữ</th><th>Dân tộc</th><th>Nữ dân tộc</th><th>TSố</th><th>Nữ</th><th>Dân tộc</th><th>Nữ dân tộc</th><th>TSố</th><th>Tỷ lệ %</th><th>Nữ</th><th>Tỷ lệ %</th><th>Dân tộc</th><th>Tỷ lệ %</th><th>Nữ dân tộc</th><th>Tỷ lệ %</th><th>TSố</th><th>Tỷ lệ %</th><th>Nữ</th><th>Tỷ lệ %</th><th>Dân tộc</th><th>Tỷ lệ %</th><th>Nữ dân tộc</th><th>Tỷ lệ %</th></tr>
  </thead>`;}

  function cells(vals){return vals.map((v,i)=>`<td${[9,11,13,15,17,19,21,23].includes(i)?' class="rate"':''}>${[9,11,13,15,17,19,21,23].includes(i)?fmt(v):Number(v||0).toLocaleString('vi-VN')}</td>`).join('');}

  function render(key){
    const def=RANGES[key],box=document.getElementById('preview-xmc'),title=document.getElementById('title-xmc');if(!def||!box)return;
    if(title)title.textContent=`Biểu tổng hợp XMC ${def.label} · ${scopeLabel()}`;
    if(!result()){box.innerHTML='<div class="blank">Hãy nhập và phân tích dữ liệu trước khi xem biểu tổng hợp XMC.</div>';return;}
    const rows=grouped(def),sum=totals(rows);
    const toolbar=`<div class="xmc-age-toolbar"><div><strong>Biểu tổng hợp XMC ${esc(def.label)}</strong> · ${esc(scopeLabel())} · ${rows.length} thôn/xóm</div><button id="xmcAgeExport" type="button" class="primary">Xuất Excel biểu này</button></div>`;
    const body=rows.map(r=>`<tr><td>${r.stt}</td><td class="village">${esc(r.v)}</td>${cells(r.vals)}</tr>`).join('');
    const empty=rows.length?'':`<tr><td colspan="26" style="padding:18px;text-align:center;color:#6f8088">Không có dữ liệu trong phạm vi này.</td></tr>`;
    box.innerHTML=`<style>
      .xmc-age-toolbar{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px;background:#eef3f5;border-bottom:1px solid #aebcc6;position:sticky;left:0;z-index:4}.xmc-age-toolbar button{height:26px!important}
      .xmc-age-wrap{overflow:auto;max-height:620px;background:#fff}.xmc-age-table{border-collapse:collapse;min-width:1850px;width:max-content;font-family:'Times New Roman',serif;font-size:11px}.xmc-age-table th,.xmc-age-table td{border:1px solid #000!important;padding:4px 5px!important;text-align:center!important;vertical-align:middle;white-space:normal!important}.xmc-age-table thead th{position:static!important;background:#fff!important;color:#000!important;font-weight:700}.xmc-age-table .xmc-title th{font-size:15px;padding:8px!important}.xmc-age-table .xmc-subtitle th{font-size:12px;padding:6px!important}.xmc-age-table td.village{text-align:left!important;min-width:170px}.xmc-age-table td.rate{min-width:66px}.xmc-age-table tr.total td{font-weight:700;background:#f5f5f5!important}
    </style>${toolbar}<div class="xmc-age-wrap"><table class="xmc-age-table">${headerHtml(def)}<tbody>${body}${empty}${rows.length?`<tr class="total"><td></td><td>Cộng</td>${cells(sum)}</tr>`:''}</tbody></table></div>`;
    document.getElementById('xmcAgeExport')?.addEventListener('click',()=>exportAge(key));
  }

  function exportRows(def){
    const rows=grouped(def),sum=totals(rows);
    const aoa=[
      ['TỔNG HỢP TÌNH HÌNH SỐ LIỆU CÔNG TÁC CHỐNG MÙ CHỮ'],
      [`${scopeLabel().toUpperCase()} · NĂM ${year()}`],[],
      ['TT','Thôn, xóm, tổ dân phố','Tổng DS 15-60','','','','Dân số '+def.label,'','','','Mù chữ mức độ 1','','','','','','','','Mù chữ mức độ 2','','','','','','',''],
      ['','','TSố','Nữ','Dân tộc','Nữ dân tộc','TSố','Nữ','Dân tộc','Nữ dân tộc','TSố','Tỷ lệ %','Nữ','Tỷ lệ %','Dân tộc','Tỷ lệ %','Nữ dân tộc','Tỷ lệ %','TSố','Tỷ lệ %','Nữ','Tỷ lệ %','Dân tộc','Tỷ lệ %','Nữ dân tộc','Tỷ lệ %'],
      ...rows.map(r=>[r.stt,r.v,...r.vals]),
      ...(rows.length?[[null,'Cộng',...sum]]:[])
    ];
    return aoa;
  }

  function exportAge(key){
    if(!X){alert('Chưa tải thư viện Excel.');return;}const def=RANGES[key];if(!def)return;
    const aoa=exportRows(def);const ws=X.utils.aoa_to_sheet(aoa);
    ws['!merges']=[X.utils.decode_range('A1:Z1'),X.utils.decode_range('A2:Z2'),X.utils.decode_range('C4:F4'),X.utils.decode_range('G4:J4'),X.utils.decode_range('K4:R4'),X.utils.decode_range('S4:Z4')];
    ws['!cols']=[{wch:5},{wch:25},...Array(24).fill({wch:10})];
    const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,`XMC_${def.file}`);
    X.writeFile(wb,`Tong_hop_XMC_${def.file}_${safe(scopeLabel())}_${year()}.xlsx`,{compression:true});
  }

  install();
  global.PCGDXMCAgeSummary={render,exportAge,RANGES};
})(window);
