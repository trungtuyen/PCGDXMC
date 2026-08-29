(function(global){
  'use strict';
  const E=global.PCGDEngine;
  const V=global.PCGDViewer;
  const X=global.XLSX;
  if(!E||!V||!X) return;
  if(global.PCGDExcelExport?.installed) return;

  const EXCELJS_URL='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
  let excelJsPromise=null;

  const safe=v=>String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_').replace(/\.(xlsx?|xlsm)$/i,'');
  const nonEmpty=row=>(row||[]).filter(v=>String(v??'').trim()!=='').length;
  const isPercentHeader=v=>/t[ỷỉ] lệ|%/i.test(String(v||''));
  const isReportSheet=name=>!/^(TongQuan|SoatLoi|DATA)$/i.test(name);
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

  function toast(message,type='info'){
    let el=document.getElementById('pcgdExcelToast');
    if(!el){
      el=document.createElement('div');el.id='pcgdExcelToast';
      el.style.cssText='position:fixed;right:14px;bottom:14px;z-index:5000;max-width:min(420px,calc(100vw - 28px));padding:10px 13px;border-radius:8px;font:600 12px/1.35 Arial,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.22);display:none';
      document.body.appendChild(el);
    }
    el.textContent=message;
    el.style.background=type==='error'?'#fee4e2':type==='warn'?'#fff4cc':'#e8f5ee';
    el.style.color=type==='error'?'#b42318':type==='warn'?'#7a4b00':'#176b43';
    el.style.display='block';clearTimeout(el._t);el._t=setTimeout(()=>el.style.display='none',4500);
  }

  function setBusy(busy,label){
    const buttons=[...document.querySelectorAll('#exportBtn,#exportScopeBtn,[data-export-scope-group]')];
    buttons.forEach(btn=>{
      if(busy){if(!btn.dataset.excelText)btn.dataset.excelText=btn.textContent;btn.disabled=true;btn.textContent=label||'Đang tạo Excel…';}
      else{btn.disabled=false;if(btn.dataset.excelText){btn.textContent=btn.dataset.excelText;delete btn.dataset.excelText;}}
    });
  }

  function loadExcelJS(){
    if(global.ExcelJS) return Promise.resolve(global.ExcelJS);
    if(excelJsPromise) return excelJsPromise;
    excelJsPromise=new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src.includes('exceljs'));
      if(existing){existing.addEventListener('load',()=>resolve(global.ExcelJS),{once:true});existing.addEventListener('error',()=>reject(new Error('Không tải được thư viện ExcelJS.')),{once:true});return;}
      const s=document.createElement('script');s.src=EXCELJS_URL;s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>global.ExcelJS?resolve(global.ExcelJS):reject(new Error('ExcelJS không khởi tạo được.'));
      s.onerror=()=>reject(new Error('Không tải được thư viện định dạng Excel.'));
      document.head.appendChild(s);
    });
    return excelJsPromise;
  }

  function captureFullWorkbook(result,sourceName){
    let captured=null;const real=X.writeFile;
    X.writeFile=function(wb){captured=wb;};
    try{E.exportResult(result,sourceName);}finally{X.writeFile=real;}
    if(!captured) throw new Error('Không tạo được dữ liệu báo cáo.');
    return captured;
  }

  function getSheetNames(full,groupKey){
    if(!groupKey) return full.SheetNames.slice();
    const cfg=E.reportGroups?.[groupKey];
    if(!cfg) throw new Error('Nhóm biểu báo cáo không hợp lệ.');
    return cfg.sheets.filter(n=>full.Sheets[n]);
  }

  function headerInfo(rows,name){
    if(name==='DATA'||name==='SoatLoi') return {start:1,end:1};
    if(name==='TongQuan') return {start:1,end:1};
    let start=1;
    for(let i=0;i<Math.min(rows.length,8);i++){
      if(nonEmpty(rows[i])>=2){start=i+1;break;}
    }
    let end=start;
    const next=rows[start];
    if(next&&/năm sinh/i.test(String(next[0]||''))&&nonEmpty(next)>=2) end=start+1;
    return {start,end};
  }

  function inferWidths(rows,sourceWs,maxCols){
    const sourceCols=sourceWs?.['!cols'];
    if(sourceCols?.length){
      return Array.from({length:maxCols},(_,i)=>clamp(Number(sourceCols[i]?.wch)||12,5,38));
    }
    return Array.from({length:maxCols},(_,ci)=>{
      let len=0;
      for(let r=0;r<Math.min(rows.length,150);r++)len=Math.max(len,String(rows[r]?.[ci]??'').length);
      return clamp(len+2,7,32);
    });
  }

  function applyCellBorder(cell){
    const thin={style:'thin',color:{argb:'FF000000'}};
    cell.border={top:thin,left:thin,bottom:thin,right:thin};
  }

  function styleAdministrativeSheet(ws,rows,name,sourceWs,year){
    const maxCols=Math.max(1,...rows.map(r=>r.length));
    const {start:headerStart,end:headerEnd}=headerInfo(rows,name);
    const report=isReportSheet(name);
    const landscape=maxCols>10;

    ws.properties.defaultRowHeight=18;
    ws.pageSetup={
      paperSize:9,orientation:landscape?'landscape':'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,
      horizontalCentered:true,verticalCentered:false,
      margins:{left:.25,right:.25,top:.4,bottom:.4,header:.15,footer:.2},
      printTitlesRow:`${headerStart}:${headerEnd}`
    };
    ws.headerFooter.oddFooter=`&LPCGD-XMC&CTrang &P/&N&R${year}`;
    ws.views=[{state:'frozen',ySplit:headerEnd,activeCell:`A${headerEnd+1}`}];

    const widths=inferWidths(rows,sourceWs,maxCols);
    widths.forEach((w,i)=>ws.getColumn(i+1).width=w);

    ws.eachRow({includeEmpty:true},(row,rowNo)=>{
      row.alignment={vertical:'middle'};
      row.eachCell({includeEmpty:true},(cell,colNo)=>{
        cell.font={name:'Times New Roman',size:name==='DATA'?10:11,color:{argb:'FF000000'}};
        cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};
        if(rowNo>=headerStart){
          applyCellBorder(cell);
          if(colNo<=2&&rowNo>headerEnd&&typeof cell.value==='string')cell.alignment={vertical:'middle',horizontal:'left',wrapText:true};
        }
      });
    });

    if(report){
      if(maxCols>1){
        ws.mergeCells(1,1,1,maxCols);
        ws.mergeCells(2,1,2,maxCols);
        if(rows[2]&&nonEmpty(rows[2])===1)ws.mergeCells(3,1,3,maxCols);
      }
      const title=ws.getCell(1,1);title.font={name:'Times New Roman',size:14,bold:true};title.alignment={horizontal:'center',vertical:'middle',wrapText:true};ws.getRow(1).height=30;
      const yearCell=ws.getCell(2,1);yearCell.font={name:'Times New Roman',size:11,italic:true};yearCell.alignment={horizontal:'center',vertical:'middle'};
      if(rows[2]&&nonEmpty(rows[2])===0)ws.getRow(3).height=7;
    }

    for(let r=headerStart;r<=headerEnd;r++){
      const row=ws.getRow(r);row.height=Math.max(row.height||18,30);
      row.eachCell({includeEmpty:true},cell=>{
        cell.font={name:'Times New Roman',size:10,bold:true};
        cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
        applyCellBorder(cell);
      });
    }

    const headerValues=rows[headerEnd-1]||[];
    headerValues.forEach((v,ci)=>{
      if(!isPercentHeader(v))return;
      for(let r=headerEnd+1;r<=ws.rowCount;r++){
        const cell=ws.getCell(r,ci+1);
        if(typeof cell.value==='number')cell.numFmt='0.00"%"';
      }
    });

    if(name==='TongQuan'){
      ws.views=[];ws.pageSetup.orientation='portrait';
      ws.getColumn(1).width=42;ws.getColumn(2).width=26;
      ws.getRow(1).height=28;
      ws.getRow(1).eachCell(cell=>{cell.font={name:'Times New Roman',size:13,bold:true};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};applyCellBorder(cell);});
      for(let r=2;r<=ws.rowCount;r++){
        ws.getCell(r,1).alignment={horizontal:'left',vertical:'middle',wrapText:true};
        ws.getCell(r,2).alignment={horizontal:'left',vertical:'middle',wrapText:true};
      }
    }

    if(name==='SoatLoi'||name==='DATA'){
      ws.autoFilter={from:{row:1,column:1},to:{row:1,column:maxCols}};
      ws.pageSetup.orientation='landscape';
    }

    ws.pageSetup.printArea=`A1:${columnName(maxCols)}${Math.max(1,ws.rowCount)}`;
  }

  function columnName(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}

  async function buildStyledWorkbook(full,sheetNames,year){
    const ExcelJS=await loadExcelJS();
    const out=new ExcelJS.Workbook();
    out.creator='PCGD-XMC Smart';out.lastModifiedBy='PCGD-XMC Smart';out.created=new Date();out.modified=new Date();
    out.company='PCGD-XMC';out.subject='Biểu báo cáo phổ cập giáo dục - xóa mù chữ';out.title=`PCGD-XMC ${year}`;

    sheetNames.forEach(name=>{
      const sourceWs=full.Sheets[name];if(!sourceWs)return;
      const rows=X.utils.sheet_to_json(sourceWs,{header:1,defval:'',raw:true});
      const ws=out.addWorksheet(name,{properties:{defaultRowHeight:18}});
      rows.forEach(row=>ws.addRow(row));
      styleAdministrativeSheet(ws,rows,name,sourceWs,year);
    });
    return out;
  }

  async function downloadWorkbook(workbook,fileName){
    const buffer=await workbook.xlsx.writeBuffer();
    const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }

  async function styledExport(result,village,sourceName,groupKey){
    const scoped=V.scopeResult(result,village);
    if(!scoped?.records?.length) throw new Error('Phạm vi đang chọn không có dữ liệu.');
    const scopeSuffix=V.isAll(village)?'ToanXa':safe(village);
    const base=`${safe(sourceName)}_${scopeSuffix}`;
    const full=captureFullWorkbook(scoped,base);
    const sheetNames=getSheetNames(full,groupKey);
    if(!sheetNames.length)throw new Error('Không có biểu để xuất.');
    const workbook=await buildStyledWorkbook(full,sheetNames,scoped.year);
    const groupLabel=groupKey?(E.reportGroups?.[groupKey]?.label||safe(groupKey)):'TongHop_PCGDXMC';
    await downloadWorkbook(workbook,`${base}_${groupLabel}_${scoped.year}.xlsx`);
  }

  function fallback(original,args,error){
    console.warn('Xuất Excel định dạng chuẩn thất bại, dùng bộ xuất dự phòng.',error);
    toast('Không tải được bộ định dạng nâng cao; hệ thống đang xuất Excel cơ bản để không gián đoạn công việc.','warn');
    try{original.apply(V,args);}catch(e){toast(e?.message||'Không thể xuất Excel.','error');}
  }

  const originalAll=V.exportAll;
  const originalGroup=V.exportGroup;
  V.exportAll=function(result,village,sourceName){
    setBusy(true,'Đang tạo Excel chuẩn…');
    styledExport(result,village,sourceName,null)
      .then(()=>toast('Đã tạo file Excel có định dạng in A4, tiêu đề và đường viền chuẩn.'))
      .catch(err=>fallback(originalAll,[result,village,sourceName],err))
      .finally(()=>setBusy(false));
  };
  V.exportGroup=function(result,groupKey,village,sourceName){
    setBusy(true,'Đang tạo Excel chuẩn…');
    styledExport(result,village,sourceName,groupKey)
      .then(()=>toast('Đã tạo nhóm biểu Excel có định dạng in và trình bày hành chính.'))
      .catch(err=>fallback(originalGroup,[result,groupKey,village,sourceName],err))
      .finally(()=>setBusy(false));
  };

  global.PCGDExcelExport={installed:true,version:'1.2.0',styledExport};
})(window);
