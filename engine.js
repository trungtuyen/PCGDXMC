(function(global){
  'use strict';
  const COL={A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14,P:15,Q:16,R:17,S:18,T:19,U:20,V:21,W:22,X:23,Y:24,Z:25,AA:26,AB:27,AC:28,AD:29,AE:30,AF:31,AG:32,AH:33,AI:34,AJ:35,AK:36,AL:37,AM:38,AN:39,AO:40,AP:41,AQ:42,AR:43,AS:44,AT:45,AU:46,AV:47,AW:48,AX:49,AY:50,AZ:51,BA:52,BB:53,BC:54,BD:55,BE:56,BF:57,BG:58,BH:59,BI:60,BJ:61,BK:62,BL:63,BM:64,BN:65,BO:66,BP:67,BQ:68,BR:69,BS:70,BT:71,BU:72};
  const s=v=>(v===null||v===undefined?'':String(v).trim());
  const n=v=>{if(v===''||v===null||v===undefined)return 0;const x=Number(v);return Number.isFinite(x)?x:0};
  const nonblank=v=>s(v)!=='';
  const norm=v=>s(v).normalize('NFC').toLowerCase();
  const inSet=(v,arr)=>arr.some(x=>norm(v)===norm(x));
  const eq=(a,b)=>norm(a)===norm(b);
  const canonLevel=v=>{const t=norm(v);return t==='mn'?'MN':t==='th'?'TH':t==='thcs'?'THCS':t==='thpt'?'THPT':'';};
  const schoolYear=y=>`${y-1}-${y}`;
  const fullname=row=>[s(row[COL.C]),s(row[COL.D])].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();

  function rowsOf(ws,range){
    if(!ws) return [];
    return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,range});
  }
  function exactMap(rows,keyIndex,valueIndex){
    const m=new Map();
    rows.forEach(r=>{const k=s(r[keyIndex]); if(k!=='')m.set(norm(k),s(r[valueIndex]));});
    return m;
  }
  function lookup(map,key){return map.get(norm(key))||''}

  function buildReferenceMaps(wb){
    const du=rowsOf(wb.Sheets.DuLieu);
    const mt=rowsOf(wb.Sheets.MaTruong);
    const tt=rowsOf(wb.Sheets.THONG_TIN);
    return {
      gradeLevel: exactMap(du.slice(1,36),COL.G,COL.I),
      ageLearning: exactMap(du.slice(1,20),COL.Z,COL.AA),
      birthYearGroup: exactMap(du.slice(41,60),COL.K,COL.L),
      schoolValid: exactMap(mt.slice(1,9000),COL.A,COL.B),
      schoolSystem: exactMap(mt.slice(2,9000),COL.A,COL.E),
      localSchool: exactMap(tt.slice(11,36),COL.G,COL.H)
    };
  }

  function fallbackLevel(rawGrade){
    const t=s(rawGrade).toUpperCase();
    if(!t)return '';
    if(/^SV/.test(t))return 'SV';
    if(/^MN|^MG|^NT/.test(t))return 'MN';
    const g=n(rawGrade);
    if(g>=1&&g<=5)return 'TH';
    if(g>=6&&g<=9)return 'THCS';
    if(g>=10&&g<=12)return 'THPT';
    return '';
  }
  function fallbackAgeLearning(age){
    if(age>=0&&age<=5)return 'MN';
    if(age>=6&&age<=10)return 'TH';
    if(age>=11&&age<=14)return 'THCS';
    if(age>=15&&age<=18)return 'THPT';
    return '';
  }
  function fallbackAgeGroup(age){
    if(age>=6&&age<=10)return '6-10T';
    if(age>=11&&age<=14)return '11-14T';
    if(age>=15&&age<=18)return '15-18T';
    return '';
  }

  function computeOne(row,rowNumber,year,refs){
    const birthYear=n(row[COL.G]);
    const age=birthYear>=1900?year-birthYear:'';
    const prev=schoolYear(year);
    const vSchool=s(row[COL.V]);
    const rawGrade=row[COL.R];
    const bh=refs.gradeLevel.size?lookup(refs.gradeLevel,rawGrade):fallbackLevel(rawGrade);
    const bf=refs.ageLearning.size?lookup(refs.ageLearning,age):fallbackAgeLearning(Number(age));
    const bg=refs.birthYearGroup.size?lookup(refs.birthYearGroup,birthYear):fallbackAgeGroup(Number(age));
    const ba=lookup(refs.schoolSystem,vSchool);
    const bb=(['MN','TH','THCS','THPT'].includes(bh) && !lookup(refs.schoolValid,vSchool))?'Lỗi':'';
    const bi=(bg==='15-18T' && ['THCS','THPT'].includes(canonLevel(row[COL.W])))?'TNC2':'';
    const br=[COL.AJ,COL.AK,COL.AL,COL.AM,COL.AN,COL.AO,COL.AP,COL.AQ].some(i=>nonblank(row[i]))?1:0;
    let bs='';
    const wLevel=canonLevel(row[COL.W]);
    if(s(row[COL.Y])===prev && ['MN','TH','THCS','THPT'].includes(wLevel))bs=wLevel;
    let bj='';
    if(bs==='THPT') bj=ba===''?'PT':eq(ba,'TX')?'TX':eq(ba,'NN')?'NN':'';
    else if(bg==='15-18T'&&bi==='TNC2'&&vSchool&&n(rawGrade)>9) bj=ba===''?'PT':eq(ba,'TX')?'TX':eq(ba,'NN')?'GDNN':'';
    const bk=lookup(refs.localSchool,vSchool);
    const bl=((n(row[COL.AC])===9&&s(row[COL.AD])===prev)||(n(row[COL.AE])===9&&s(row[COL.AF])===prev))?'L9C':'';
    let bm='';
    if(age!==''&&Number(age)>=15){if(age<26)bm=25;else if(age<36)bm=35;else if(age<61)bm=60;}
    let bn='';
    if(n(row[COL.AI])>0&&br!==1)bn='MC';
    else if(br===1||bm==='')bn='';
    else if(inSet(row[COL.W],['TH','THCS','THPT']))bn='';
    else if(['thcn','cao đẳng','đại học','thạc sĩ','tiến sĩ'].includes(norm(row[COL.Z])))bn='';
    else if(n(row[COL.AC])>=5||n(row[COL.AE])>=6||n(row[COL.AH])>=5)bn='';
    else bn='MC';
    let bp='';
    if(n(row[COL.AI])===1)bp='';
    else if(n(row[COL.AI])===2)bp='MC2';
    else if(bn==='MC'&&(n(row[COL.AC])>=3||n(row[COL.AG])>3||n(row[COL.AE])>3||n(row[COL.AH])>=3))bp='MC2';
    let bo='';
    if(bn==='MC'&&bp!=='MC2'&&(n(row[COL.AC])<=3||n(row[COL.AE])<=5||n(row[COL.AH])<5))bo='MC1';
    const bq=nonblank(row[COL.AE])?'BH':0;
    const bt=s(row[COL.S]).endsWith('!')?'LB':'';
    const bu=s(row[COL.S]).endsWith('*')?'2B':'';
    return {
      rowNumber,name:fullname(row),village:s(row[COL.A]),ticket:s(row[COL.O]),birthYear,age,
      female:s(row[COL.H]),rawGrade:s(rawGrade),className:s(row[COL.S]),school:vSchool,graduated:s(row[COL.W]),graduationYear:s(row[COL.Y]),
      ba,bb,bc:age,bd:s(row[COL.A]),be:s(row[COL.O]),bf,bg,bh,bi,bj,bk,bl,bm,bn,bo,bp,bq,br,bs,bt,bu,
      raw:row
    };
  }

  function validate(records,year){
    const issues=[]; const seen=new Map();
    const add=(r,severity,message,suggestion)=>issues.push({severity,rowNumber:r.rowNumber,name:r.name||'(chưa có họ tên)',village:r.village||'',message,suggestion});
    records.forEach(r=>{
      if(!r.name)add(r,'error','Thiếu họ tên đối tượng.','Bổ sung họ đệm/tên ở cột C–D.');
      if(!r.village)add(r,'warning','Thiếu tên thôn/xóm.','Bổ sung cột A để biểu theo địa bàn không bị thiếu.');
      if(!r.birthYear||r.birthYear<1900||r.birthYear>year)add(r,'error','Năm sinh không hợp lệ hoặc bị thiếu.','Kiểm tra cột G (Năm sinh).');
      if(r.bb==='Lỗi')add(r,'error','Mã/tên trường không khớp danh mục MaTruong.','Chuẩn hóa cột V theo danh mục trường của file.');
      if(['TH','THCS','THPT'].includes(r.bh)&&!r.school)add(r,'warning',`Đang được nhận diện học ${r.bh} nhưng thiếu trường đang học.`,'Bổ sung cột V nếu đối tượng thực tế đang đi học.');
      if(r.age!==''&&((r.bh==='TH'&&(r.age<5||r.age>15))||(r.bh==='THCS'&&(r.age<9||r.age>19))||(r.bh==='THPT'&&(r.age<12||r.age>23))))add(r,'warning',`Tuổi ${r.age} chưa điển hình so với khối ${r.bh}.`,'Kiểm tra năm sinh và khối/lớp; giữ nguyên nếu là trường hợp đặc thù.');
      const key=[norm(r.name),r.birthYear,s(r.raw[COL.E]),s(r.raw[COL.F]),norm(r.village)].join('|');
      if(r.name&&r.birthYear){if(seen.has(key))add(r,'warning',`Có khả năng trùng đối tượng với dòng ${seen.get(key)}.`,'Đối chiếu họ tên, ngày sinh và thôn/xóm.');else seen.set(key,r.rowNumber);}
    });
    return issues;
  }

  function summarize(records,issues,year){
    const count=p=>records.filter(p).length;
    const households=new Set(records.map(r=>r.ticket).filter(Boolean)).size;
    const ageBands={
      '0–5 tuổi':count(r=>r.age!==''&&r.age>=0&&r.age<=5),
      '6–10 tuổi':count(r=>r.age>=6&&r.age<=10),
      '11–14 tuổi':count(r=>r.age>=11&&r.age<=14),
      '15–18 tuổi':count(r=>r.age>=15&&r.age<=18),
      '19–35 tuổi':count(r=>r.age>=19&&r.age<=35),
      '36–60 tuổi':count(r=>r.age>=36&&r.age<=60),
      'Trên 60':count(r=>r.age>60)
    };
    const aged1518=records.filter(r=>r.bg==='15-18T');
    const tn1518=aged1518.filter(r=>r.bi==='TNC2').length;
    const rate1518=aged1518.length?tn1518/aged1518.length*100:0;
    const age1560=records.filter(r=>r.age>=15&&r.age<=60&&r.br!==1);
    const mc1560=age1560.filter(r=>r.bn==='MC').length;
    const notMcRate=age1560.length?(age1560.length-mc1560)/age1560.length*100:0;
    return {year,total:records.length,households,schoolErrors:count(r=>r.bb==='Lỗi'),disabilities:count(r=>r.br===1),issues:issues.length,errorIssues:issues.filter(i=>i.severity==='error').length,warningIssues:issues.filter(i=>i.severity==='warning').length,ageBands,aged1518:aged1518.length,tn1518,rate1518,age1560:age1560.length,mc1560,notMcRate};
  }

  function analyzeWorkbook(wb,requestedYear){
    if(!wb.Sheets.DATA)throw new Error('Không tìm thấy sheet DATA. Hãy chọn đúng file PCGD cấp xã.');
    const rows=rowsOf(wb.Sheets.DATA,'A1:BU20050');
    const fileYear=n(rows?.[1]?.[COL.A]);
    const year=(fileYear>=2000&&fileYear<=2100)?fileYear:Number(requestedYear);
    if(!year)throw new Error('Không xác định được năm điều tra.');
    const refs=buildReferenceMaps(wb);
    const records=[];
    for(let i=4;i<rows.length;i++){
      const row=rows[i]||[];
      const hasData=[COL.A,COL.B,COL.C,COL.D,COL.G,COL.O].some(c=>nonblank(row[c]));
      if(!hasData)continue;
      records.push(computeOne(row,i+1,year,refs));
    }
    const issues=validate(records,year);
    const summary=summarize(records,issues,year);
    return {year,records,issues,summary};
  }

  function exportResult(result,sourceName){
    const wb=XLSX.utils.book_new();
    const s=result.summary;
    const summaryRows=[['PCGD–XMC Smart','Kết quả đối chiếu Beta'],['Nguồn',sourceName||''],['Năm điều tra',result.year],[],['Chỉ số','Giá trị'],['Nhân khẩu',s.total],['Hộ/phiếu',s.households],['15–18 tuổi',s.aged1518],['15–18 tuổi đã TN THCS (theo logic Excel)',s.tn1518],['Tỷ lệ 15–18 đã TN THCS',s.rate1518/100],['15–60 tuổi trong mẫu XMC',s.age1560],['Đối tượng gắn MC',s.mc1560],['Tỷ lệ không gắn MC trong mẫu',s.notMcRate/100],['Khuyết tật',s.disabilities],['Lỗi mã trường',s.schoolErrors],['Tổng vấn đề soát lỗi',s.issues]];
    const ws1=XLSX.utils.aoa_to_sheet(summaryRows); ws1['!cols']=[{wch:44},{wch:22}]; if(ws1.FMT){}; XLSX.utils.book_append_sheet(wb,ws1,'TongHop');
    const issueRows=[['Mức độ','Dòng Excel','Họ tên','Thôn/xóm','Nội dung','Gợi ý'],...result.issues.map(i=>[i.severity,i.rowNumber,i.name,i.village,i.message,i.suggestion])];
    const ws2=XLSX.utils.aoa_to_sheet(issueRows); ws2['!cols']=[{wch:10},{wch:12},{wch:30},{wch:24},{wch:55},{wch:55}]; XLSX.utils.book_append_sheet(wb,ws2,'SoatLoi');
    const dataRows=[['Dòng','Họ tên','Thôn/xóm','Số phiếu','Năm sinh','Tuổi','Khối hiện tại','Lứa tuổi học','Nhóm tuổi','TNC2','Hệ THPT','Tại chỗ','L9C','Nhóm XMC','Mù chữ','MC1','MC2','Bỏ học','Khuyết tật','TN năm trước','Lưu ban','2 buổi','Lỗi mã trường'],...result.records.map(r=>[r.rowNumber,r.name,r.village,r.ticket,r.birthYear,r.age,r.bh,r.bf,r.bg,r.bi,r.bj,r.bk,r.bl,r.bm,r.bn,r.bo,r.bp,r.bq,r.br,r.bs,r.bt,r.bu,r.bb])];
    const ws3=XLSX.utils.aoa_to_sheet(dataRows); ws3['!cols']=dataRows[0].map((_,i)=>({wch:i===1?30:i===2?24:14})); XLSX.utils.book_append_sheet(wb,ws3,'DuLieuTinh');
    XLSX.writeFile(wb,`PCGDXMC_KetQua_${result.year}.xlsx`);
  }

  global.PCGDEngine={analyzeWorkbook,exportResult,COL};
})(window);
