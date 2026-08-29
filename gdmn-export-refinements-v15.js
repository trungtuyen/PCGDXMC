(function(global){
  'use strict';
  function applyNumberFormat(ws,col,start=1,end=2000){for(let r=start;r<=end;r++){const c=ws[`${col}${r}`];if(c&&c.t==='n')c.z='0.00';}}
  function applyExportFixes(wb,name){
    const ws=wb?.Sheets?.[wb.SheetNames?.[0]];if(!ws)return;
    if(/^MN-01-GV/i.test(name)){applyNumberFormat(ws,'G');applyNumberFormat(ws,'N');}
    if(/^MN-01-CSVC/i.test(name))applyNumberFormat(ws,'L');
  }
  function bind(){
    if(!global.XLSX?.writeFile||global.XLSX.writeFile.__gdmnFixed)return;
    const original=global.XLSX.writeFile.bind(global.XLSX);
    const wrapped=function(wb,name,opts){applyExportFixes(wb,String(name||''));return original(wb,name,opts)};
    wrapped.__gdmnFixed=true;global.XLSX.writeFile=wrapped;
  }
  bind();
  global.PCGDGdmnExportRefinements={version:'1.5.1',applyExportFixes};
})(window);
