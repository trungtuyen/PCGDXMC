(function(global){
  'use strict';
  const E=global.PCGDEngine;
  const X=global.XLSX;
  if(!E||!X) throw new Error('PCGD Engine hoặc SheetJS chưa sẵn sàng.');

  const norm=v=>String(v??'').replace(/\s+/g,' ').trim().normalize('NFC').toLowerCase();
  const pct=(a,b)=>b?Math.round((a/b*100)*100)/100:0;
  const isAll=v=>!v||v==='__ALL__';
  const safe=v=>String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_').replace(/\.(xlsx?|xlsm)$/i,'');

  function scopeResult(result,village){
    if(!result||isAll(village)) return result;
    const records=result.records.filter(r=>norm(r.village)===norm(village));
    const issues=result.issues.filter(i=>norm(i.village)===norm(village));
    const households=new Set(records.map(r=>`${norm(r.village)}|${String(r.ticket||'').trim()}`).filter(x=>!x.endsWith('|'))).size;
    const count=p=>records.filter(p).length;
    const ageBands={
      '0–5 tuổi':count(r=>r.age!==''&&r.age>=0&&r.age<=5),
      '6–10 tuổi':count(r=>r.age>=6&&r.age<=10),
      '11–14 tuổi':count(r=>r.age>=11&&r.age<=14),
      '15–18 tuổi':count(r=>r.age>=15&&r.age<=18),
      '19–35 tuổi':count(r=>r.age>=19&&r.age<=35),
      '36–60 tuổi':count(r=>r.age>=36&&r.age<=60),
      'Trên 60':count(r=>r.age>60)
    };
    const aged1518=records.filter(r=>r.age>=15&&r.age<=18&&r.br!==1);
    const tn1518=aged1518.filter(r=>r.bi==='TNC2').length;
    const age1560=records.filter(r=>r.age>=15&&r.age<=60&&r.br!==1);
    const mc1560=age1560.filter(r=>r.bn==='MC').length;
    const srcMap=new Map();
    records.forEach(r=>srcMap.set(r.sourceName,(srcMap.get(r.sourceName)||0)+1));
    const sources=(result.sources||[]).filter(s=>srcMap.has(s.name)).map(s=>({...s,rows:srcMap.get(s.name)}));
    return {
      ...result,
      records,
      issues,
      sources,
      scopeVillage:village,
      summary:{
        ...result.summary,
        total:records.length,
        files:sources.length,
        villages:records.length?1:0,
        villageNames:records.length?[village]:[],
        households,
        schoolErrors:count(r=>r.bb==='Lỗi'),
        disabilities:count(r=>r.br===1),
        issues:issues.length,
        errorIssues:issues.filter(i=>i.severity==='error').length,
        warningIssues:issues.filter(i=>i.severity==='warning').length,
        ageBands,
        aged1518:aged1518.length,
        tn1518,
        rate1518:pct(tn1518,aged1518.length),
        age1560:age1560.length,
        mc1560,
        notMcRate:pct(age1560.length-mc1560,age1560.length)
      }
    };
  }

  function captureWorkbook(result,sourceName){
    let wb=null;
    const real=X.writeFile;
    X.writeFile=function(book){wb=book;};
    try{E.exportResult(result,sourceName);}finally{X.writeFile=real;}
    if(!wb) throw new Error('Không tạo được workbook báo cáo.');
    return wb;
  }

  function previewSheet(result,sheetName,village){
    const scoped=scopeResult(result,village);
    if(!scoped.records.length) return {rows:[],scope:scoped};
    const wb=captureWorkbook(scoped,'XemTruoc');
    const ws=wb.Sheets[sheetName];
    if(!ws) throw new Error(`Không tìm thấy biểu ${sheetName}.`);
    const rows=X.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
    return {rows,scope:scoped};
  }

  function exportGroup(result,groupKey,village,sourceName){
    const scoped=scopeResult(result,village);
    if(!scoped.records.length) throw new Error('Phạm vi đang chọn không có dữ liệu.');
    const suffix=isAll(village)?'ToanXa':safe(village);
    E.exportGroup(scoped,groupKey,`${safe(sourceName)}_${suffix}`);
  }

  function exportAll(result,village,sourceName){
    const scoped=scopeResult(result,village);
    if(!scoped.records.length) throw new Error('Phạm vi đang chọn không có dữ liệu.');
    const suffix=isAll(village)?'ToanXa':safe(village);
    E.exportResult(scoped,`${safe(sourceName)}_${suffix}`);
  }

  global.PCGDViewer={scopeResult,previewSheet,exportGroup,exportAll,isAll};
})(window);
