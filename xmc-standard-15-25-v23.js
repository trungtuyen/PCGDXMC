(function(global){
  'use strict';

  const C=global.PCGDCore;
  if(!C)return;
  const {byVillage,pct}=C;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safe=v=>String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_').replace(/\.(xlsx?|xlsm)$/i,'');
  const round2=v=>global.PCGDNumberFormat?.round2?global.PCGDNumberFormat.round2(v):Math.round((Number(v)||0)*100)/100;
  const fmtRate=v=>{const n=round2(v);return Number.isInteger(n)?String(n):new Intl.NumberFormat('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);};

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

  function calc(rs,maxAge){
    const g=rs.filter(r=>r.age>=15&&r.age<=maxAge&&r.br!==1);
    const level1=g.filter(r=>r.bo!=='MC1');
    const level2=g.filter(r=>r.bo!=='MC1'&&r.bp!=='MC2');
    return {total:g.length,l1:level1.length,r1:pct(level1.length,g.length),l2:level2.length,r2:pct(level2.length,g.length)};
  }

  function standardLevel(rs){
    const a=calc(rs,25),b=calc(rs,35),c=calc(rs,60);
    if(a.r1>=90&&b.r2>=90&&c.r2>=90)return 2;
    if(a.r1>=90&&b.r1>=90&&c.r1>=90)return 1;
    return 0;
  }

  function reportData(result){
    if(!result)return {rows:[],total:{total:0,l1:0,r1:0,l2:0,r2:0},std1:0,std2:0};
    const rows=byVillage(result.records).map(([v,rs],i)=>{
      const a=calc(rs,25),level=standardLevel(rs);
      return {tt:i+1,village:v,...a,level};
    });
    const all=result.records.filter(r=>r.age>=15&&r.age<=25&&r.br!==1);
    const l1=all.filter(r=>r.bo!=='MC1').length;
    const l2=all.filter(r=>r.bo!=='MC1'&&r.bp!=='MC2').length;
    return {
      rows,
      total:{total:all.length,l1,r1:pct(l1,all.length),l2,r2:pct(l2,all.length)},
      std1:rows.filter(r=>r.level>=1).length,
      std2:rows.filter(r=>r.level>=2).length
    };
  }

  function year(){return Number(document.getElementById('yearInput')?.value)||global.PCGDLastResult?.year||new Date().getFullYear();}

  function render(){
    const section=document.getElementById('xmc');
    const box=document.getElementById('preview-xmc');
    if(!section||!box||section.dataset.xmc1525Active!=='1')return;
    const data=reportData(currentResult()),y=year();
    const title=document.getElementById('title-xmc');if(title)title.textContent='Thống kê đạt chuẩn XMC (15–25)';
    const body=data.rows.length?data.rows.map(r=>`<tr><td>${r.tt}</td><td class="left">${esc(r.village)}</td><td>${r.total}</td><td>${r.l1}</td><td>${fmtRate(r.r1)}</td><td>${r.l2}</td><td>${fmtRate(r.r2)}</td></tr>`).join(''):`<tr><td colspan="7" class="empty">Chưa có dữ liệu phân tích.</td></tr>`;
    box.innerHTML=`<style>
      .xmc1525-wrap{background:#fff;padding:16px 18px;min-width:780px;font-family:'Times New Roman',serif;color:#000}
      .xmc1525-unit{font-weight:700;font-size:15px;margin-bottom:4px}.xmc1525-title{text-align:center;font-weight:700;font-size:17px;margin:4px 0}.xmc1525-time{text-align:center;font-size:14px;margin:0 0 12px}
      .xmc1525-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px}.xmc1525-table th,.xmc1525-table td{border:1px solid #000;padding:6px 5px;text-align:center;vertical-align:middle}.xmc1525-table th{font-weight:700}.xmc1525-table .left{text-align:left}.xmc1525-table .codes td{padding:3px 5px}.xmc1525-table .total td{font-weight:700}.xmc1525-table .empty{height:42px;color:#666;font-style:italic}
      .xmc1525-footer{display:flex;justify-content:space-between;gap:18px;margin-top:3px;align-items:flex-start}.xmc1525-standards{border-collapse:collapse;min-width:470px;font-size:14px}.xmc1525-standards td{border:1px solid #000;padding:4px 7px}.xmc1525-standards td:last-child{width:90px;text-align:center;font-weight:700}.xmc1525-note{border-collapse:collapse;font-size:14px}.xmc1525-note td{background:#fff400;padding:4px 12px;border:0}.xmc1525-note td:last-child{min-width:42px;text-align:right}
      .xmc1525-date{text-align:right;margin-top:12px;padding-right:8%;font-size:14px}.xmc1525-sign{display:grid;grid-template-columns:1fr 2fr;gap:28px;text-align:center;font-weight:700;font-size:14px;line-height:1.35;margin-top:6px}.xmc1525-sign .chief{font-size:13px}.xmc1525-export{margin:0 0 10px;display:flex;justify-content:flex-end}.xmc1525-export button{font:600 12px Arial,sans-serif;border:1px solid #6f91a6;background:#eef6f9;padding:7px 12px;cursor:pointer}
      @media(max-width:850px){.xmc1525-wrap{min-width:760px}.xmc1525-footer{flex-direction:column}.xmc1525-sign{grid-template-columns:1fr 1.6fr}}
      @media print{.xmc1525-export{display:none}.xmc1525-wrap{padding:0;min-width:0}.xmc1525-table th,.xmc1525-table td{padding:4px 3px}}
    </style><div class="xmc1525-wrap">
      <div class="xmc1525-export"><button type="button" id="xmc1525ExportBtn">Xuất Excel biểu này</button></div>
      <div class="xmc1525-unit">XÃ/PHƯỜNG: ${esc(unitName())}</div>
      <div class="xmc1525-title">THỐNG KÊ ĐẠT CHUẨN XÓA MÙ CHỮ</div>
      <div class="xmc1525-time">Thời điểm: tháng&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; năm ${y}</div>
      <table class="xmc1525-table"><colgroup><col style="width:6%"><col style="width:22%"><col style="width:10%"><col style="width:22%"><col style="width:10%"><col style="width:20%"><col style="width:10%"></colgroup><thead>
        <tr><th rowspan="2">TT</th><th rowspan="2">Đơn vị điều tra</th><th colspan="5">Độ tuổi 15-25</th></tr>
        <tr><th>Tổng số</th><th>Số người biết chữ mức độ 1</th><th>Tỉ lệ</th><th>Số người biết chữ mức độ 2</th><th>Tỉ lệ</th></tr>
        <tr class="codes"><td>1</td><td>2</td><td>13</td><td>14</td><td>15</td><td>16</td><td>17</td></tr>
      </thead><tbody>${body}<tr class="total"><td>@</td><td>Cộng</td><td>${data.total.total}</td><td>${data.total.l1}</td><td>${fmtRate(data.total.r1)}</td><td>${data.total.l2}</td><td>${fmtRate(data.total.r2)}</td></tr></tbody></table>
      <div class="xmc1525-footer"><table class="xmc1525-standards"><tr><td>Số xã, phường đạt chuẩn XMC mức độ 1:</td><td>${data.std1}</td></tr><tr><td>Số xã, phường đạt chuẩn XMC mức độ 2:</td><td>${data.std2}</td></tr></table><table class="xmc1525-note"><tr><td>MĐ 1</td><td>2</td></tr><tr><td>MĐ 2</td><td>3</td></tr></table></div>
      <div class="xmc1525-date">Ngày&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; tháng&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; năm ${y}</div>
      <div class="xmc1525-sign"><div>NGƯỜI LẬP BIỂU</div><div><div class="chief">TM. BAN CHỈ ĐẠO PHỔ CẬP GIÁO DỤC, XÓA MÙ CHỮ</div><div>TRƯỞNG BAN</div></div></div>
    </div>`;
    document.getElementById('xmc1525ExportBtn')?.addEventListener('click',exportExcel);
  }

  function exportExcel(){
    const X=global.XLSX,result=currentResult();
    if(!X){alert('Bộ xử lý Excel chưa sẵn sàng.');return;}
    const data=reportData(result),y=year(),rows=[];
    rows.push([`XÃ/PHƯỜNG: ${unitName()}`,'','','','','','']);
    rows.push(['','THỐNG KÊ ĐẠT CHUẨN XÓA MÙ CHỮ','','','','','']);
    rows.push(['',`Thời điểm: tháng        năm ${y}`,'','','','','']);
    rows.push([]);
    rows.push(['TT','Đơn vị điều tra','Độ tuổi 15-25','','','','']);
    rows.push(['','','Tổng số','Số người biết chữ mức độ 1','Tỉ lệ','Số người biết chữ mức độ 2','Tỉ lệ']);
    rows.push(['1','2','13','14','15','16','17']);
    data.rows.forEach(r=>rows.push([r.tt,r.village,r.total,r.l1,round2(r.r1),r.l2,round2(r.r2)]));
    rows.push(['@','Cộng',data.total.total,data.total.l1,round2(data.total.r1),data.total.l2,round2(data.total.r2)]);
    rows.push(['Số xã, phường đạt chuẩn XMC mức độ 1:','','',data.std1,'','','','MĐ 1',2]);
    rows.push(['Số xã, phường đạt chuẩn XMC mức độ 2:','','',data.std2,'','','','MĐ 2',3]);
    rows.push(['','','','','',`Ngày     tháng     năm ${y}`]);
    rows.push(['NGƯỜI LẬP BIỂU','','','TM. BAN CHỈ ĐẠO PHỔ CẬP GIÁO DỤC, XÓA MÙ CHỮ']);
    rows.push(['','','','TRƯỞNG BAN']);
    const ws=X.utils.aoa_to_sheet(rows);
    ws['!merges']=[
      X.utils.decode_range('B2:G2'),X.utils.decode_range('B3:G3'),X.utils.decode_range('A5:A6'),X.utils.decode_range('B5:B6'),X.utils.decode_range('C5:G5'),
      X.utils.decode_range(`A${data.rows.length+9}:C${data.rows.length+9}`),X.utils.decode_range(`A${data.rows.length+10}:C${data.rows.length+10}`),
      X.utils.decode_range(`F${data.rows.length+11}:G${data.rows.length+11}`),X.utils.decode_range(`A${data.rows.length+12}:C${data.rows.length+12}`),X.utils.decode_range(`D${data.rows.length+12}:G${data.rows.length+12}`),X.utils.decode_range(`D${data.rows.length+13}:G${data.rows.length+13}`)
    ];
    ws['!cols']=[{wch:5},{wch:24},{wch:10},{wch:28},{wch:10},{wch:25},{wch:10},{wch:8},{wch:6}];
    ws['!rows']=[{hpt:20},{hpt:24},{hpt:20},{hpt:8},{hpt:24},{hpt:38},{hpt:18}];
    ws['!pageSetup']={paperSize:9,orientation:'landscape',fitToWidth:1,fitToHeight:0};
    const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'XMC-15-25-DatChuan');
    X.writeFile(wb,`${safe(unitName())}_ThongKe_DatChuan_XMC_15-25_${y}.xlsx`,{compression:true});
  }

  function activate(){
    const tab=document.querySelector('.main-menu [data-tab="xmc"]');
    document.querySelectorAll('.main-menu .tab').forEach(b=>b.classList.toggle('active',b===tab));
    document.querySelectorAll('.tabpage').forEach(p=>p.classList.toggle('active',p.id==='xmc'));
    const section=document.getElementById('xmc');if(section)section.dataset.xmc1525Active='1';
    const dd=document.getElementById('xmcMainDropdown');if(dd)dd.style.display='none';
    if(tab)tab.setAttribute('aria-expanded','false');
    render();document.getElementById('xmc')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function install(){
    const dd=document.getElementById('xmcMainDropdown');if(!dd||dd.querySelector('[data-xmc-standard-1525]'))return;
    const firstSep=dd.querySelector('.xmc-dd-sep');
    const btn=document.createElement('button');btn.type='button';btn.dataset.xmcStandard1525='1';btn.textContent='Thống kê đạt chuẩn XMC (15–25)';
    btn.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();activate();});
    if(firstSep)dd.insertBefore(btn,firstSep);else dd.appendChild(btn);
    dd.addEventListener('click',ev=>{if(ev.target.closest('button')!==btn){const section=document.getElementById('xmc');if(section)section.dataset.xmc1525Active='0';}},true);
    document.getElementById('villageSelect')?.addEventListener('change',()=>setTimeout(render,0));
    document.getElementById('yearInput')?.addEventListener('change',()=>setTimeout(render,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  global.PCGDXMCStandard1525={render,reportData,exportExcel};
})(window);
