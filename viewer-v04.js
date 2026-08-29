(function(global){
  'use strict';
  const E=global.PCGDEngine;
  const X=global.XLSX;
  if(!E||!X) throw new Error('PCGD Engine hoặc SheetJS chưa sẵn sàng.');

  const norm=v=>String(v??'').replace(/\s+/g,' ').trim().normalize('NFC').toLowerCase();
  const pct=(a,b)=>b?Math.round((a/b*100)*100)/100:0;
  const isAll=v=>!v||v==='__ALL__';
  const safe=v=>String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_').replace(/\.(xlsx?|xlsm)$/i,'');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const originalAnalyze=E.analyzeWorkbooks;
  if(typeof originalAnalyze==='function'){
    E.analyzeWorkbooks=function(){
      const r=originalAnalyze.apply(this,arguments);
      global.PCGDLastResult=r;
      return r;
    };
  }

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
      ...result,records,issues,sources,scopeVillage:village,
      summary:{...result.summary,total:records.length,files:sources.length,villages:records.length?1:0,villageNames:records.length?[village]:[],households,
        schoolErrors:count(r=>r.bb==='Lỗi'),disabilities:count(r=>r.br===1),issues:issues.length,errorIssues:issues.filter(i=>i.severity==='error').length,
        warningIssues:issues.filter(i=>i.severity==='warning').length,ageBands,aged1518:aged1518.length,tn1518,rate1518:pct(tn1518,aged1518.length),
        age1560:age1560.length,mc1560,notMcRate:pct(age1560.length-mc1560,age1560.length)}
    };
  }

  function captureWorkbook(result,sourceName){
    let wb=null; const real=X.writeFile; X.writeFile=function(book){wb=book;};
    try{E.exportResult(result,sourceName);}finally{X.writeFile=real;}
    if(!wb) throw new Error('Không tạo được workbook báo cáo.');
    return wb;
  }

  function previewSheet(result,sheetName,village){
    const scoped=scopeResult(result,village);
    if(!scoped.records.length) return {rows:[],scope:scoped};
    const wb=captureWorkbook(scoped,'XemTruoc'),ws=wb.Sheets[sheetName];
    if(!ws) throw new Error(`Không tìm thấy biểu ${sheetName}.`);
    return {rows:X.utils.sheet_to_json(ws,{header:1,defval:'',raw:false}),scope:scoped};
  }

  function exportGroup(result,groupKey,village,sourceName){
    const scoped=scopeResult(result,village); if(!scoped.records.length) throw new Error('Phạm vi đang chọn không có dữ liệu.');
    E.exportGroup(scoped,groupKey,`${safe(sourceName)}_${isAll(village)?'ToanXa':safe(village)}`);
  }
  function exportAll(result,village,sourceName){
    const scoped=scopeResult(result,village); if(!scoped.records.length) throw new Error('Phạm vi đang chọn không có dữ liệu.');
    E.exportResult(scoped,`${safe(sourceName)}_${isAll(village)?'ToanXa':safe(village)}`);
  }

  function c2n(col){let n=0;for(const ch of col)n=n*26+ch.charCodeAt(0)-64;return n;}
  function refParts(ref){const m=String(ref).match(/^([A-Z]+)(\d+)$/);return m?{c:c2n(m[1]),r:Number(m[2])}:null;}
  function mergeParts(ref){const [a,b]=String(ref).split(':').map(refParts);return a&&b?{r:a.r,c:a.c,rs:b.r-a.r+1,cs:b.c-a.c+1}:null;}
  const nums=(row,count,start=1)=>Object.fromEntries(Array.from({length:count},(_,i)=>[`${colName(i+1)}${row}`,String(start+i)]));
  function colName(n){let s='';while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}

  const gvCells={
    A1:'Xã (Phường):',J2:'THỐNG KÊ ĐỘI NGŨ GIÁO VIÊN PHỔ CẬP GIÁO DỤC TIỂU HỌC',AB2:'Mẫu: TH-01-GV',A3:'Thời điểm:',
    A4:'TT',B4:'Đơn vị',G4:'CBQL',I4:'Giáo viên',AE4:'Nhân viên',B5:'Đơn vị',C5:'Hạng trường',F5:'2 buổi/ngày',G5:'Hiệu trưởng',H5:'P.Hiệu trưởng',
    I5:'Tổng số',J5:'Biên chế',K5:'Hợp đồng',L5:'Nữ',M5:'Dân tộc',N5:'Tỉ lệ GV/Lớp',O5:'Trình độ đào tạo',S5:'Loại hình đào tạo',Z5:'Chuẩn nghề nghiệp',
    AD5:'TPT.Đội',AE5:'Văn phòng',AF5:'T.Viện-TBDH',C6:'Hạng 1',D6:'Hạng 2',E6:'Hạng 3',O6:'Trên ĐH',P6:'ĐH',Q6:'CĐ',R6:'THSP',S6:'Tiểu học',T6:'AN',
    U6:'MT',V6:'TD',W6:'Tin học',X6:'NN',Y6:'Khác',Z6:'Tốt',AA6:'Khá',AB6:'Đạt',AC6:'Chưa đạt',A8:'1',B8:'Trường………..',A9:'@',B9:'Cộng',
    A11:'Tiêu chí',I11:'SL',J11:'Tỷ lệ',A12:'GV đạt trình độ đào tạo đại học',A13:'GV đạt trình độ đào tạo từ thạc sĩ trở lên',A14:'GV đạt yêu cầu chuẩn nghề nghiệp mức đạt trở lên',
    Q15:' , ngày   tháng   năm ',A16:'NGƯỜI LẬP BIỂU',Q16:'HIỆU TRƯỞNG',Q17:'KT. TRƯỞNG BAN',Q18:'PHÓ TRƯỞNG BAN',A20:'       Vũ Văn Tiến'};
  Object.assign(gvCells,nums(7,32)); gvCells.G7='8';gvCells.H7='9';gvCells.I7='10';gvCells.J7='11';gvCells.K7='12';gvCells.L7='13';gvCells.M7='14';gvCells.N7='15';gvCells.O7='16';gvCells.P7='17';gvCells.Q7='18';gvCells.R7='19';gvCells.S7='21';gvCells.T7='22';gvCells.U7='23';gvCells.V7='24';gvCells.W7='25';gvCells.X7='26';gvCells.Y7='27';gvCells.Z7='28';gvCells.AA7='29';gvCells.AB7='30';gvCells.AC7='31';gvCells.AD7='32';gvCells.AE7='33';gvCells.AF7='34';

  const csvcCells={A1:'Xã (Phường):',I1:'THỐNG KÊ CƠ SỞ VẬT CHẤT PHỔ CẬP GIÁO DỤC TIỂU HỌC',Z1:'Mẫu: TH-01-CSVC',C2:'Thời điểm: ngày  tháng   năm',
    A4:'TT',B4:'Đơn vị',C4:'Số Đ.Tr',D4:'Số lớp',F4:'Số phòng học',K4:'Số phòng chức năng',V4:'Công trình VS',Z4:'Sân chơi',AB4:'Sân tập',D5:'Tổng số',E5:'Lớp ghép',F5:'Kiên cố',
    G5:'Bán kiên cố',H5:'Tạm',I5:'Thuê/mượn',J5:'Tỉ lệ Ph/Lớp',K5:'HTr',L5:'PHT',M5:'VP',N5:'Y tế',O5:'TT HĐ  Đội',P5:'P.họp',R5:'T.Viện',T5:'Thiết bị',V5:'GV',X5:'HS',
    Z5:'SL',AA5:'DT',AB5:'SL',AC5:'DT',K6:'SL',L6:'SL',M6:'SL',N6:'SL',O6:'SL',P6:'SL',Q6:'DT',R6:'SL',S6:'DT',T6:'SL',U6:'DT',V6:'SL',W6:'DT',X6:'SL',Y6:'DT',
    A8:'1',B8:'Trường………..',O9:' , ngày    tháng   năm ',P10:'HIỆU TRƯỞNG ',Q11:'KT. TRƯỞNG BAN',B12:'NGƯỜI LẬP BIỂU',Q12:'PHÓ TRƯỞNG BAN',B17:'       Vũ Văn Tiến',Q17:'PHÓ GIÁM ĐỐC SỞ GDĐT',Q18:'Nguyễn Văn Hưng'};
  Object.assign(csvcCells,nums(7,29));

  function hsHeader(cells){
    Object.assign(cells,{A5:'TT',B5:'Đơn vị',C5:'6 Tuổi',F5:'7 Tuổi',J5:'8 Tuổi',O5:'9 Tuổi',U5:'10 Tuổi',AB5:'11 Tuổi',AF5:'12 Tuổi',AJ5:'13 Tuổi',AN5:'14 Tuổi',AR5:'Tổng',
      C6:'CRL',D6:'L1',E6:'L2',F6:'CRL',G6:'L1',H6:'L2',I6:'L3',J6:'CRL',K6:'L1',L6:'L2',M6:'L3',N6:'L4',O6:'CRL',P6:'L1',Q6:'L2',R6:'L3',S6:'L4',T6:'L5',
      U6:'CRL',V6:'L1',W6:'L2',X6:'L3',Y6:'L4',Z6:'L5',AA6:'L6',AB6:'L2',AC6:'L3',AD6:'L4',AE6:'L5',AF6:'L2',AG6:'L3',AH6:'L4',AI6:'L5',AJ6:'L2',AK6:'L3',AL6:'L4',AM6:'L5',AN6:'L2',AO6:'L3',AP6:'L4',AQ6:'L5'});
    return cells;
  }
  const hsOut=hsHeader({A1:'Xã (Phường):',A2:'Số liệu học sinh của xã, phường đang học tại xã/phường ngoài (trong tỉnh) và tỉnh/thành phố ngoài',A3:'Thống kê ngày       tháng       năm 2025',
    A7:'I',B7:'HỌC SINH CỦA XÃ ĐANG HỌC TẠI XÃ/PHƯỜNG NGOÀI (TRONG TỈNH)',A8:'1',B8:'Trường …',A9:'...',A10:'@',B10:'Cộng',A11:'II',B11:'HỌC SINH CỦA XÃ ĐANG HỌC TẠI TỈNH/THÀNH PHỐ NGOÀI',A12:'@',B12:'Số lượng',A13:'Cộng (I + II)',AH15:'…., ngày       tháng      năm 2025',AH16:'HIỆU TRƯỞNG ',B17:'NGƯỜI LẬP BIỂU',B21:'CRL là chưa ra lớp'});
  const hsIn=hsHeader({A1:'Xã (Phường):',A2:'Tỉnh Thái Nguyên',C2:'Số liệu học sinh xã/phường ngoài (trong tỉnh) và tỉnh/thành phố ngoài đang học tại xã',B3:'Thống kê ngày       tháng      năm 2025',
    A7:'I',B7:'HỌC SINH XÃ/PHƯỜNG NGOÀI (TRONG TỈNH) ĐANG HỌC TẠI XÃ',A8:'1',B8:'Trường  …',A9:'…',B9:'…',A10:'@',B10:'Cộng I',A11:'II',B11:'HỌC SINH TỈNH/THÀNH PHỐ NGOÀI ĐANG HỌC TẠI XÃ',A12:'1',B12:'Trường  …',A13:'…',B13:'..',A14:'@',B14:'Cộng II',A15:'Cộng (I + II)',AE17:'…., ngày       tháng  năm 2025',AE18:'HIỆU TRƯỞNG ',A19:'NGƯỜI LẬP BIỂU'});

  const TEMPLATES={
    'TH-XLS-GV':{title:'Mẫu TH-01-GV · Đội ngũ giáo viên',rows:20,cols:32,widths:[4.375,19.75,6.25,6.25,6.25,9.25,9.75,11.375,6.75,7.375,8.25,3.25,6.75,10.75,7.625,4.875,5.25,5.5,7.25,3.625,7.25,3.375,6.375,3.625,4.875,5,5,3.75,5.375,3.75,3.75,3.75],heights:[27,19.5,18.75,28.5,33.75,60,12.75,25.5,15,7.5,15,15,15,15,19.5,19.5,19.5,19.5,26.25,19.5],border:[[4,9],[11,14]],bold:[2,4,5,6,7,9,11,16,17,18],cells:gvCells,merges:['Q16:AF16','Q17:AF17','Q18:AF18','A13:H13','U13:X13','Y13:AF13','A14:H14','AA14:AF14','Q15:AF15','A11:H11','A12:H12','Y12:AF12','L5:L6','M5:M6','N5:N6','O5:R5','S5:Y5','Z5:AC5','F5:F6','G5:G6','H5:H6','I5:I6','J5:J6','K5:K6','J2:AA2','AB2:AF2','A3:AF3','A4:A6','B4:F4','G4:H4','I4:AD4','AE4:AF4','B5:B6','C5:E5','AD5:AD6','AE5:AE6','AF5:AF6']},
    'TH-XLS-CSVC':{title:'Mẫu TH-01-CSVC · Cơ sở vật chất',rows:19,cols:29,widths:[3.625,20.25,5.5,5.75,6.625,5.375,7.875,3.375,7.75,7.875,3,3.25,2.625,3.375,7.375,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5,2.5],heights:[30.75,27.75,19.5,24,39.75,21.75,23.25,23.25,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,15],border:[[4,8]],bold:[1,4,5,6,7,10,11,12,17,18],cells:csvcCells,merges:['F10:I10','P10:Y10','Q11:X11','Q12:X12','Q17:X17','X5:Y5','Z5:Z6','AA5:AA6','AB5:AB6','Q18:X18','O9:Z9','AC5:AC6','V4:Y4','Z4:AA4','AB4:AC4','D5:D6','E5:E6','F5:F6','G5:G6','H5:H6','I5:I6','J5:J6','K4:U4','P5:Q5','R5:S5','T5:U5','V5:W5','A4:A6','B4:B6','C4:C6','D4:E4','F4:J4','I1:Y1','Z1:AC1','A2:B2','C2:Y2','A3:B3','C3:F3']},
    'TH-XLS-HS-OUT':{title:'HS của địa phương học ở ngoài',rows:21,cols:44,widths:[3.75,18.75,4.75,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,3.75,3.75,3.75,3.75,3.75,4,4,4,4,8.125],heights:Array(21).fill(15.75),border:[[5,13]],bold:[2,5,6,7,10,11,13,16,17],cells:hsOut,merges:['B17:F17','AH17:AR17','AH18:AR18','A20:D20','B11:AR11','A13:B13','A15:D15','O15:AA15','AH15:AR15','O16:AA16','AH16:AR16','B7:AR7','A2:AR2','A3:AR3','A4:AR4','A5:A6','B5:B6','C5:D5','F5:I5','J5:N5','O5:T5','U5:AA5','AB5:AE5','AF5:AI5','AJ5:AM5','AN5:AQ5','AR5:AR6']},
    'TH-XLS-HS-IN':{title:'HS địa phương ngoài đến học',rows:19,cols:44,widths:[3.75,22.25,...Array(41).fill(3.625),5],heights:[12.75,25.5,15.75,15.75,...Array(11).fill(25.5),13.5,15.75,15.75,15.75],border:[[5,15]],bold:[2,5,6,7,10,11,14,15,18,19],cells:hsIn,merges:['A19:F19','AH19:AR19','AH20:AR20','A23:F23','A15:B15','O17:AA17','AE17:AR17','A18:F18','O18:AA18','AE18:AR18','B11:AR11','B3:AR3','B4:AR4','A5:A6','B5:B6','C5:E5','F5:I5','J5:N5','O5:T5','U5:AA5','AB5:AE5','AF5:AI5','AJ5:AM5','AN5:AQ5','AR5:AR6','B7:AR7']}
  };

  function scopeText(){
    const sel=document.getElementById('villageSelect');
    if(!sel||sel.value==='__ALL__')return 'Toàn xã';
    return (sel.options[sel.selectedIndex]?.text||sel.value).replace(/\s*\([^)]*người\)\s*$/i,'').trim();
  }
  function yearText(){return Number(document.getElementById('yearInput')?.value)||new Date().getFullYear();}
  function bordered(def,row){return (def.border||[]).some(([a,b])=>row>=a&&row<=b);}
  function renderTemplate(name){
    const def=TEMPLATES[name]; if(!def)return '<div class="blank">Không tìm thấy mẫu biểu.</div>';
    const mergeTop=new Map(),covered=new Set();
    (def.merges||[]).forEach(m=>{const p=mergeParts(m);if(!p||p.r>def.rows||p.c>def.cols)return;mergeTop.set(`${p.r}:${p.c}`,p);for(let r=p.r;r<p.r+p.rs;r++)for(let c=p.c;c<p.c+p.cs;c++)if(r!==p.r||c!==p.c)covered.add(`${r}:${c}`);});
    const year=yearText(),scope=scopeText();
    const colgroup='<colgroup>'+def.widths.slice(0,def.cols).map(w=>`<col style="width:${Math.max(24,Math.round(w*7+5))}px">`).join('')+'</colgroup>';
    let body='';
    for(let r=1;r<=def.rows;r++){
      const h=def.heights[r-1]||15.75; body+=`<tr style="height:${Math.round(h*96/72)}px">`;
      for(let c=1;c<=def.cols;c++){
        const key=`${r}:${c}`;if(covered.has(key))continue;
        const ref=`${colName(c)}${r}`,mp=mergeTop.get(key);let v=def.cells[ref]||'';
        if(ref==='A1'&&/^Xã \(Phường\):/.test(v))v=`Xã (Phường): ${scope}`;
        v=String(v).replace(/2025|202\.\.\./g,String(year));
        const attrs=mp?` rowspan="${mp.rs}" colspan="${mp.cs}"`:'';
        const isTitle=(r<=3)&&((mp&&mp.cs>4)||c===1); const isBold=(def.bold||[]).includes(r);
        let css=`font-family:'Times New Roman',serif;font-size:${isTitle?14:12}px;vertical-align:middle;text-align:center;padding:3px 4px;white-space:normal;line-height:1.08;`;
        if(bordered(def,r))css+='border:1px solid #000;';else css+='border:0;';
        if(isBold||isTitle)css+='font-weight:700;';
        if(c===2&&r>=8)css+='text-align:left;';
        if(c===1&&r===1)css+='text-align:left;';
        body+=`<td${attrs} style="${css}">${esc(v)}</td>`;
      }
      body+='</tr>';
    }
    return `<div style="min-width:max-content;background:white;padding:12px"><div style="font-size:12px;color:#55736d;margin:0 0 8px 2px">Hiển thị theo cấu trúc gốc từ <strong>Bieu TIEU HOC.xlsx</strong> · Phạm vi: <strong>${esc(scope)}</strong></div><table style="border-collapse:collapse;table-layout:fixed;background:#fff">${colgroup}<tbody>${body}</tbody></table></div>`;
  }

  function installOriginalTHMenus(){
    const menu=document.querySelector('[data-menu-group="th"]'); if(!menu||menu.dataset.excelOriginalInstalled)return;
    menu.dataset.excelOriginalInstalled='1';
    const sep=document.createElement('span');sep.textContent='Mẫu Excel gốc:';sep.style.cssText='align-self:center;font-size:11px;font-weight:800;color:#6a817c;margin-left:6px';menu.appendChild(sep);
    const items=[['TH-XLS-GV','TH-01-GV'],['TH-XLS-CSVC','TH-01-CSVC'],['TH-XLS-HS-OUT','HS ĐP học ở ngoài'],['TH-XLS-HS-IN','HS ngoài đến học']];
    items.forEach(([id,label])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.excelOriginal=id;
      b.addEventListener('click',ev=>{
        ev.preventDefault();ev.stopImmediatePropagation();menu.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));
        const section=document.getElementById('th');section.dataset.excelOriginalActive=id;
        const title=document.getElementById('title-th');if(title)title.textContent=TEMPLATES[id].title;
        const box=document.getElementById('preview-th');if(box)box.innerHTML=renderTemplate(id);
      },true);
      menu.appendChild(b);
    });
    const sel=document.getElementById('villageSelect');
    if(sel)sel.addEventListener('change',()=>setTimeout(()=>rerenderOriginal(),0),true);
    document.querySelectorAll('[data-tab="th"]').forEach(t=>t.addEventListener('click',()=>setTimeout(()=>rerenderOriginal(),0),true));
  }
  function rerenderOriginal(){
    const section=document.getElementById('th');const id=section?.dataset.excelOriginalActive;if(!id||!TEMPLATES[id])return;
    const box=document.getElementById('preview-th');if(box)box.innerHTML=renderTemplate(id);
    const title=document.getElementById('title-th');if(title)title.textContent=TEMPLATES[id].title;
    const menu=document.querySelector('[data-menu-group="th"]');if(menu)menu.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.excelOriginal===id));
  }

  installOriginalTHMenus();
  global.PCGDViewer={scopeResult,previewSheet,exportGroup,exportAll,isAll,renderOriginalTH:renderTemplate,originalTHTemplates:TEMPLATES};
})(window);
