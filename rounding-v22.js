(function(global){
  'use strict';

  const round2=value=>{
    const n=Number(value);
    if(!Number.isFinite(n))return 0;
    return Math.round((n+Number.EPSILON)*100)/100;
  };
  const format2=value=>new Intl.NumberFormat('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(round2(value));

  if(global.PCGDCore){
    global.PCGDCore.round2=round2;
    global.PCGDCore.pct=(a,b)=>{
      const denominator=Number(b),numerator=Number(a);
      if(!Number.isFinite(denominator)||denominator===0||!Number.isFinite(numerator))return 0;
      return round2(numerator/denominator*100);
    };
  }

  function decimalValue(text){
    const raw=String(text??'').trim();
    if(!/^-?\d+[.,]\d+$/.test(raw))return null;
    const n=Number(raw.replace(',','.'));
    return Number.isFinite(n)?n:null;
  }

  function formatReportNumbers(root=document){
    root.querySelectorAll('.report-preview td,.report-preview th').forEach(cell=>{
      if(cell.children.length)return;
      const n=decimalValue(cell.textContent);
      if(n===null)return;
      cell.textContent=format2(n);
    });
  }

  let scheduled=false;
  function scheduleFormat(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;formatReportNumbers();});
  }

  function install(){
    formatReportNumbers();
    const observer=new MutationObserver(scheduleFormat);
    observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('change',event=>{
      const input=event.target;
      if(!(input instanceof HTMLInputElement)||input.type!=='number'||input.value==='')return;
      if(!['teacherPerClass','roomPerClass'].includes(input.dataset.field||''))return;
      input.value=round2(input.value).toFixed(2);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  global.PCGDNumberFormat={round2,format2,formatReportNumbers};
})(window);
