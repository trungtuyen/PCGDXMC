(function(global){
  'use strict';

  const C=global.PCGDCore;
  if(!C)return;
  const {byVillage,pct}=C;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=v=>String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_').replace(/\.(xlsx?|xlsm)$/i,'');
  const round2=v=>global.PCGDNumberFormat?.round2?global.PCGDNumberFormat.round2(v):Math.round((Number(v)||0)*100)/100;
  const fmtRate=v=>{const n=round2(v);return Number.isInteger(n)?String(n):new Intl.NumberFormat('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);};

  const RANGES={
    '15-35':{label:'15–35',min:15,max:35,file:'15-35',note:'#ff1f12'},
    '35-60':{label:'35–60',min:35,max:60,file:'35-60',note:'#19a8dc'}
  };
  let activeKey='';

  function currentResult(){
    const result=global.PCGDLastResult;
    if(!result)return null;
    const village=document.getElementById('villageSelect')?.value||'__ALL__';
    return global.PCGDViewer?.scopeResult?global.PCGDViewer.scopeResult(result,village):result;
  }

  function unitName(){
    const user=global.PCGDAuth?.user?.()||{};
    const raw=user.unitName||user.communeName||user.scopeName||'';
    if(raw)return String(raw).replace(/^xã\s+|^phường\s+/i,'').trim().toUpperCase();
    const banner=document.querySelector('[data-pcgd-unit-name],#pcgdUnitName');
    if(banner?.textContent?.trim())return banner.textContent.trim().toUpperCase();
    return '................................';
  }

  function calc(rs,min,max){
    const g=(rs||[]).filter(r=>r.age>=min&&r.age<=max&&r.br!==1);
    const l1=g.filter(r=>r.bo!=='MC1');
    const l2=g.filter(r=>r.bo!=='MC1'&&r.bp!=='MC2');
    return {
      total:g.length,
      l1:l1.length,
      r1:pct(l1.length,g.length),
      l2:l2.length,
      r2:pct(l2.length,g.length),
      mc1:g.length-l1.length,
      mc2:g.length-l2.length
    };
  }

  function standardLevel(rs){
    const a=calc(rs,15,25),b=calc(rs,15,35),c=calc(rs,15,60);
    if(a.r1>=90&&b.r2>=90&&c.r2>=90)return 2;
    if(a.r1>=90&&b.r1>=90&&c.r1>=90)return 1;
    return 0;
  }

  function reportData(result,def){
    if(!result||!def)return {rows:[],total:calc([],def?.min||15,def?.max||35),std1:0,std2:0};
    const rows=byVillage(result.records).map(([v,rs],i)=>({tt:i+1,village:v,...calc(rs,def.min,def.max)}));
    const total=calc(result.records,def.min,def.max);
    const level=total.total?standardLevel(result.records):0;
    return {rows,total,std1:level===1?1:0,std2:level===2?1:0};
  }

  function render(key){
    const def=RANGES[key],section=document.getElementById('xmc'),box=document.getElementById('preview-xmc');
    if(!def||!section||!box||activeKey!==key)return;
    const data=reportData(currentResult(),def);
    const title=document.getElementById('title-xmc');if(title)title.textContent=`Thống kê đạt chuẩn XMC (${def.label})`;
    const body=data.rows.length?data.rows.map(r=>`<tr><td>${r.tt}</td><td class="left">${esc(r.village)}</td><td>${r.total}</td><td>${r.l1}</td><td>${fmtRate(r.r1)}</td><td>${r.l2}</td><td>${fmtRate(r.r2)}</td></tr>`).join(''):`<tr><td colspan="7" class="empty">Chưa có dữ liệu phân tích.</td></tr>`;
    box.innerHTML=`<style>
      .xmc-range-wrap{background:#fff;padding:16px 18px;min-width:780px;font-family:'Times New Roman',serif;color:#000}
      .xmc-range-toolbar{margin:0 0 10px;display:flex;justify-content:flex-end}.xmc-range-toolbar button{font:600 12px Arial,sans-serif;border:1px solid #6f91a6;background:#eef6f9;padding:7px 12px;cursor:pointer}
      .xmc-range-unit{font-weight:700;font-size:15px;margin-bottom:4px}.xmc-range-title{text-align:center;font-weight:700;font-size:17px;margin:4px 0 12px}
      .xmc-range-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px}.xmc-range-table th,.xmc-range-table td{border:1px solid #000;padding:6px 5px;text-align:center;vertical-align:middle}.xmc-range-table th{font-weight:700}.xmc-range-table .left{text-align:left}.xmc-range-table .codes td{padding:3px 5px}.xmc-range-table .total td{font-weight:700}.xmc-range-table .empty{height:42px;color:#666;font-style:italic}
      .xmc-range-footer{display:flex;justify-content:space-between;gap:18px;margin-top:3px;align-items:flex-start}.xmc-range-standards{border-collapse:collapse;min-width:470px;font-size:14px}.xmc-range-standards td{border:1px solid #000;padding:4px 7px}.xmc-range-standards td:last-child{width:90px;text-align:center;font-weight:700}.xmc-range-note{border-collapse:collapse;font-size:14px}.xmc-range-note td{background:${def.note};padding:4px 12px;border:0;color:#000}.xmc-range-note td:last-child{min-width:42px;text-align:right}
      .xmc-range-sign{display:grid;grid-template-columns:1fr 2fr;gap:28px;text-align:center;font-weight:700;font-size:14px;line-height:1.35;margin-top:26px}.xmc-range-sign .chief{font-size:13px}
      @media(max-width:850px){.xmc-range-wrap{min-width:760px}.xmc-range-footer{flex-direction:column}.xmc-range-sign{grid-template-columns:1fr 1.6fr}}
      @media print{.xmc-range-toolbar{display:none}.xmc-range-wrap{padding:0;min-width:0}.xmc-range-table th,.xmc-range-table td{padding:4px 3px}}
    </style><div class="xmc-range-wrap">
      <div class="xmc-range-toolbar"><button type="button" id="xmcRangeExportBtn">Xuất Excel biểu này</button></div>
      <div class="xmc-range-unit">XÃ/PHƯỜNG: ${esc(unitName())}</div>
      <div class="xmc-range-title">THỐNG KÊ ĐẠT CHUẨN XÓA MÙ CHỮ</div>
      <table class="xmc-range-table"><colgroup><col style="width:6%"><col style="width:22%"><col style="width:10%"><col style="width:22%"><col style="width:10%"><col style="width:20%"><col style="width:10%"></colgroup><thead>
        <tr><th rowspan="2">TT</th><th rowspan="2">Đơn vị điều tra</th><th colspan="5">Độ tuổi ${esc(def.file)}</th></tr>
        <tr><th>Tổng số</th><th>Số người biết chữ mức độ 1</th><th>Tỉ lệ</th><th>Số người biết chữ mức độ 2</th><th>Tỉ lệ</th></tr>
        <tr class="codes"><td>1</td><td>2</td><td>13</td><td>14</td><td>15</td><td>16</td><td>17</td></tr>
      </thead><tbody>${body}<tr class="total"><td>@</td><td>Cộng</td><td>${data.total.total}</td><td>${data.total.l1}</td><td>${fmtRate(data.total.r1)}</td><td>${data.total.l2}</td><td>${fmtRate(data.total.r2)}</td></tr></tbody></table>
      <div class="xmc-range-footer"><table class="xmc-range-standards"><tr><td>Số xã, phường đạt chuẩn XMC mức độ 1:</td><td>${data.std1||''}</td></tr><tr><td>Số xã, phường đạt chuẩn XMC mức độ 2:</td><td>${data.std2||''}</td></tr></table><table class="xmc-range-note"><tr><td>MĐ 1</td><td>${data.total.mc1}</td></tr><tr><td>MĐ 2</td><td>${data.total.mc2}</td></tr></table></div>
      <div class="xmc-range-sign"><div>NGƯỜI LẬP BIỂU</div><div><div class="chief">TM. BAN CHỈ ĐẠO PHỔ CẬP GIÁO DỤC, XÓA MÙ CHỮ</div><div>TRƯỞNG BAN</div></div></div>
    </div>`;
    document.getElementById('xmcRangeExportBtn')?.addEventListener('click',()=>exportExcel(key));
  }

  function exportExcel(key){
    const X=global.XLSX,def=RANGES[key],result=currentResult();
    if(!X){alert('Bộ xử lý Excel chưa sẵn sàng.');return;}
    if(!def)return;
    const data=reportData(result,def),rows=[];
    rows.push([`XÃ/PHƯỜNG: ${unitName()}`,'','','','','','','','']);
    rows.push(['','THỐNG KÊ ĐẠT CHUẨN XÓA MÙ CHỮ','','','','','','','']);
    rows.push([]);
    rows.push(['TT','Đơn vị điều tra',`Độ tuổi ${def.file}`,'','','','','','']);
    rows.push(['','','Tổng số','Số người biết chữ mức độ 1','Tỉ lệ','Số người biết chữ mức độ 2','Tỉ lệ','','']);
    rows.push(['1','2','13','14','15','16','17','','']);
    data.rows.forEach(r=>rows.push([r.tt,r.village,r.total,r.l1,round2(r.r1),r.l2,round2(r.r2),'','']));
    rows.push(['@','Cộng',data.total.total,data.total.l1,round2(data.total.r1),data.total.l2,round2(data.total.r2),'','']);
    rows.push(['Số xã, phường đạt chuẩn XMC mức độ 1:','','',data.std1||'','','','','MĐ 1',data.total.mc1]);
    rows.push(['Số xã, phường đạt chuẩn XMC mức độ 2:','','',data.std2||'','','','','MĐ 2',data.total.mc2]);
    rows.push([]);
    rows.push(['NGƯỜI LẬP BIỂU','','','TM. BAN CHỈ ĐẠO PHỔ CẬP GIÁO DỤC, XÓA MÙ CHỮ','','','','','']);
    rows.push(['','','','TRƯỞNG BAN','','','','','']);
    const ws=X.utils.aoa_to_sheet(rows);
    const totalRow=data.rows.length+7;
    const std1Row=totalRow+1,std2Row=totalRow+2,signRow=totalRow+4,chiefRow=totalRow+5;
    ws['!merges']=[
      X.utils.decode_range('A1:B1'),X.utils.decode_range('B2:G2'),X.utils.decode_range('A4:A5'),X.utils.decode_range('B4:B5'),X.utils.decode_range('C4:G4'),
      X.utils.decode_range(`A${std1Row}:C${std1Row}`),X.utils.decode_range(`A${std2Row}:C${std2Row}`),
      X.utils.decode_range(`A${signRow}:C${signRow}`),X.utils.decode_range(`D${signRow}:G${signRow}`),X.utils.decode_range(`D${chiefRow}:G${chiefRow}`)
    ];
    ws['!cols']=[{wch:5},{wch:24},{wch:10},{wch:28},{wch:10},{wch:25},{wch:10},{wch:8},{wch:8}];
    ws['!rows']=[{hpt:20},{hpt:24},{hpt:8},{hpt:24},{hpt:38},{hpt:18}];
    ws['!pageSetup']={paperSize:9,orientation:'landscape',fitToWidth:1,fitToHeight:0};
    const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,`XMC-${def.file}-DatChuan`);
    X.writeFile(wb,`${safe(unitName())}_ThongKe_DatChuan_XMC_${def.file}.xlsx`,{compression:true});
  }

  function activate(key){
    if(!RANGES[key])return;
    activeKey=key;
    const tab=document.querySelector('.main-menu [data-tab="xmc"]');
    document.querySelectorAll('.main-menu .tab').forEach(b=>b.classList.toggle('active',b===tab));
    document.querySelectorAll('.tabpage').forEach(p=>p.classList.toggle('active',p.id==='xmc'));
    const section=document.getElementById('xmc');if(section)section.dataset.xmcStandardRange=key;
    const dd=document.getElementById('xmcMainDropdown');if(dd)dd.style.display='none';
    if(tab)tab.setAttribute('aria-expanded','false');
    render(key);document.getElementById('xmc')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function clearIfOtherAction(ev){
    const btn=ev.target?.closest?.('button');
    if(!btn)return;
    if(btn.dataset.xmcStandardRange)return;
    if(btn.closest('#xmcMainDropdown')||btn.closest('[data-menu-group="xmc"]')){
      activeKey='';
      const section=document.getElementById('xmc');if(section)delete section.dataset.xmcStandardRange;
    }
  }

  function reorder(dd){
    const sep=dd.querySelector('.xmc-dd-sep');if(!sep)return;
    const old=dd.querySelector('[data-xmc-standard-1525]');
    const a=dd.querySelector('[data-xmc-standard-range="15-35"]');
    const b=dd.querySelector('[data-xmc-standard-range="35-60"]');
    if(old)dd.insertBefore(old,sep);
    if(a)dd.insertBefore(a,sep);
    if(b)dd.insertBefore(b,sep);
  }

  function install(){
    const dd=document.getElementById('xmcMainDropdown');
    if(!dd){setTimeout(install,60);return;}
    if(dd.dataset.standardRangesInstalled==='1')return;
    dd.dataset.standardRangesInstalled='1';
    ['15-35','35-60'].forEach(key=>{
      const def=RANGES[key],btn=document.createElement('button');
      btn.type='button';btn.dataset.xmcStandardRange=key;btn.textContent=`Thống kê đạt chuẩn XMC (${def.label})`;
      btn.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();activate(key);});
      const sep=dd.querySelector('.xmc-dd-sep');if(sep)dd.insertBefore(btn,sep);else dd.appendChild(btn);
    });
    setTimeout(()=>reorder(dd),250);
    dd.addEventListener('click',clearIfOtherAction,true);
    document.querySelector('[data-menu-group="xmc"]')?.addEventListener('click',clearIfOtherAction,true);
    document.getElementById('villageSelect')?.addEventListener('change',()=>{if(activeKey)setTimeout(()=>render(activeKey),1);},true);
    document.querySelectorAll('[data-tab="xmc"]').forEach(t=>t.addEventListener('click',()=>{if(activeKey)setTimeout(()=>render(activeKey),1);},true));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  global.PCGDXMCStandardRanges={render,reportData,exportExcel,RANGES,activate};
})(window);
