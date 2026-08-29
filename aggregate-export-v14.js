(function(global){
  'use strict';
  const EXCELJS_URL='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  let excelPromise=null;
  const fmt=n=>Number(n)||0;
  const pct=(a,b)=>b?Math.round(a/b*10000)/100:0;
  const safe=v=>String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_');
  function loadExcel(){if(global.ExcelJS)return Promise.resolve(global.ExcelJS);if(excelPromise)return excelPromise;excelPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=EXCELJS_URL;s.async=true;s.onload=()=>global.ExcelJS?resolve(global.ExcelJS):reject(new Error('Không tải được ExcelJS'));s.onerror=()=>reject(new Error('Không tải được thư viện Excel'));document.head.appendChild(s)});return excelPromise}
  function sum(items){const o={total:0,households:0,aged1518:0,tn1518:0,age1560:0,mc1560:0,issues:0,disabilities:0};for(const x of items){const m=x.metrics||x;for(const k of Object.keys(o))o[k]+=fmt(m[k])}return o}
  function provinceName(k){return global.PCGDNational?.PROVINCES?.find(x=>x.key===k)?.name||k||''}
  function rowsFor(data,scope){const rows=Array.isArray(data.rows)?data.rows:[];if(scope.level==='national'){const map=new Map();for(const r of rows){const a=map.get(r.provinceKey)||[];a.push(r);map.set(r.provinceKey,a)}return [...map.entries()].map(([k,a])=>({name:provinceName(k),communes:a.length,metrics:sum(a)})).sort((a,b)=>a.name.localeCompare(b.name,'vi'))}return rows.map(r=>({name:r.communeName||r.communeCode||'',communes:1,metrics:r.metrics||{}})).sort((a,b)=>a.name.localeCompare(b.name,'vi'))}
  function border(cell){const thin={style:'thin',color:{argb:'FF000000'}};cell.border={top:thin,left:thin,right:thin,bottom:thin}}
  async function exportAggregate(){
    const N=global.PCGDNational;if(!N)throw new Error('Module tổng hợp chưa sẵn sàng.');const scope=N.getScope(),data=await N.getAggregate(),rows=rowsFor(data,scope),m=data.metrics||sum(data.rows||[]),ExcelJS=await loadExcel();
    const wb=new ExcelJS.Workbook();wb.creator='PCGD-XMC Smart';wb.title='Tổng hợp PCGD-XMC';const ws=wb.addWorksheet('TongHop',{properties:{defaultRowHeight:18}});
    const title=scope.level==='national'?'BÁO CÁO TỔNG HỢP PCGD-XMC TOÀN QUỐC':scope.level==='province'?`BÁO CÁO TỔNG HỢP PCGD-XMC ${provinceName(scope.provinceKey).toUpperCase()}`:'BÁO CÁO TỔNG HỢP PCGD-XMC CẤP XÃ';
    ws.addRow([title]);ws.mergeCells('A1:J1');ws.getCell('A1').font={name:'Times New Roman',size:14,bold:true};ws.getCell('A1').alignment={horizontal:'center'};ws.getRow(1).height=28;
    ws.addRow([`Năm điều tra: ${Number(document.getElementById('yearInput')?.value)||new Date().getFullYear()}`]);ws.mergeCells('A2:J2');ws.getCell('A2').alignment={horizontal:'center'};ws.getCell('A2').font={name:'Times New Roman',size:11,italic:true};
    ws.addRow([]);ws.addRow(['Chỉ tiêu','Giá trị']);ws.addRow(['Tổng nhân khẩu',fmt(m.total)]);ws.addRow(['Tổng hộ/phiếu',fmt(m.households)]);ws.addRow(['15–18 tuổi',fmt(m.aged1518)]);ws.addRow(['15–18 đã TN THCS',fmt(m.tn1518)]);ws.addRow(['Tỷ lệ TN THCS (%)',pct(fmt(m.tn1518),fmt(m.aged1518))]);ws.addRow(['15–60 tuổi',fmt(m.age1560)]);ws.addRow(['Mù chữ 15–60',fmt(m.mc1560)]);ws.addRow(['Tỷ lệ không mù chữ (%)',100-pct(fmt(m.mc1560),fmt(m.age1560))]);ws.addRow(['Khuyết tật',fmt(m.disabilities)]);ws.addRow(['Lỗi/cảnh báo',fmt(m.issues)]);ws.addRow([]);
    const headerRow=ws.addRow(['TT','Đơn vị','Số xã','Nhân khẩu','Hộ/phiếu','15–18 tuổi','TN THCS','Tỷ lệ TN THCS %','15–60 tuổi','Mù chữ']);const headerNo=headerRow.number;
    rows.forEach((r,i)=>{const x=r.metrics||{};ws.addRow([i+1,r.name,r.communes||1,fmt(x.total),fmt(x.households),fmt(x.aged1518),fmt(x.tn1518),pct(fmt(x.tn1518),fmt(x.aged1518)),fmt(x.age1560),fmt(x.mc1560)])});
    ws.columns=[{width:6},{width:32},{width:10},{width:15},{width:14},{width:14},{width:14},{width:17},{width:14},{width:14}];
    ws.eachRow({includeEmpty:true},row=>row.eachCell({includeEmpty:true},cell=>{cell.font={...(cell.font||{}),name:'Times New Roman',size:11};cell.alignment={vertical:'middle',wrapText:true,horizontal:cell.col===2?'left':'center'}}));
    for(let r=4;r<=13;r++){border(ws.getCell(r,1));border(ws.getCell(r,2));ws.getCell(r,1).alignment={horizontal:'left'}}
    headerRow.eachCell(cell=>{border(cell);cell.font={name:'Times New Roman',size:10,bold:true};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}});headerRow.height=32;
    for(let r=headerNo+1;r<=ws.rowCount;r++)ws.getRow(r).eachCell({includeEmpty:true},border);
    ws.views=[{state:'frozen',ySplit:headerNo}];ws.autoFilter={from:{row:headerNo,column:1},to:{row:headerNo,column:10}};
    ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.4,bottom:.4,header:.15,footer:.2},printTitlesRow:`${headerNo}:${headerNo}`};ws.headerFooter.oddFooter='&LPCGD-XMC&CTrang &P/&N';ws.pageSetup.printArea=`A1:J${ws.rowCount}`;
    const buffer=await wb.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`PCGDXMC_${safe(scope.level)}_${safe(provinceName(scope.provinceKey))}_${new Date().getFullYear()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  function inject(){const panel=document.getElementById('nationalAggregatePanel');if(!panel){setTimeout(inject,120);return}if(document.getElementById('exportNationalExcelBtn'))return;const head=panel.querySelector('.nat-head');const b=document.createElement('button');b.id='exportNationalExcelBtn';b.className='secondary';b.type='button';b.textContent='Xuất Excel tổng hợp';b.onclick=async()=>{const old=b.textContent;b.disabled=true;b.textContent='Đang tạo Excel…';try{await exportAggregate()}catch(e){alert(e.message)}finally{b.disabled=false;b.textContent=old}};head?.appendChild(b)}
  global.PCGDAggregateExport={exportAggregate};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})(window);
