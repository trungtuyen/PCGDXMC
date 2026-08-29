(function(global){
  'use strict';

  const COL={A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14,P:15,Q:16,R:17,S:18,T:19,U:20,V:21,W:22,X:23,Y:24,Z:25,AA:26,AB:27,AC:28,AD:29,AE:30,AF:31,AG:32,AH:33,AI:34,AJ:35,AK:36,AL:37,AM:38,AN:39,AO:40,AP:41,AQ:42,AR:43,AS:44,AT:45,AU:46,AV:47,AW:48,AX:49,AY:50,AZ:51,BA:52,BB:53,BC:54,BD:55,BE:56,BF:57,BG:58,BH:59,BI:60,BJ:61,BK:62,BL:63,BM:64,BN:65,BO:66,BP:67,BQ:68,BR:69,BS:70,BT:71,BU:72};
  const s=v=>(v===null||v===undefined?'':String(v).trim());
  const n=v=>{if(v===''||v===null||v===undefined)return 0;const x=Number(v);return Number.isFinite(x)?x:0};
  const norm=v=>s(v).normalize('NFC').toLowerCase();
  const nonblank=v=>s(v)!=='';
  const eq=(a,b)=>norm(a)===norm(b);
  const pct=(a,b)=>b?Math.round((a/b*100)*1000000)/1000000:0;
  const schoolYear=y=>`${y-1}-${y}`;
  const canonicalLevel=v=>{const t=norm(v);if(t==='mn')return'MN';if(t==='th')return'TH';if(t==='thcs')return'THCS';if(t==='thpt')return'THPT';return''};
  const isFemale=r=>eq(r.raw[COL.H],'X');
  const isMinority=r=>nonblank(r.raw[COL.I])&&!eq(r.raw[COL.I],'Kinh');
  const canLearn=r=>eq(r.raw[COL.AS],'X');
  const currentSchool=r=>nonblank(r.raw[COL.V])||nonblank(r.raw[COL.U]);
  const gradAtLeastTH=r=>['TH','THCS','THPT'].includes(canonicalLevel(r.raw[COL.W]));
  const gradAtLeastTHCS=r=>['THCS','THPT'].includes(canonicalLevel(r.raw[COL.W]));

  function rowsOf(ws,range){if(!ws)return[];return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,range});}
  function mapBy(rows,keyIndex,valueIndex){const m=new Map();rows.forEach(r=>{const k=norm(r[keyIndex]);if(k)m.set(k,s(r[valueIndex]));});return m;}
  function lookup(map,key){return map.get(norm(key))||''}

  function buildReferenceMaps(wb){
    const du=rowsOf(wb?.Sheets?.DuLieu),mt=rowsOf(wb?.Sheets?.MaTruong),tt=rowsOf(wb?.Sheets?.THONG_TIN);
    return {gradeLevel:mapBy(du.slice(1,40),COL.G,COL.I),ageLearning:mapBy(du.slice(1,24),COL.Z,COL.AA),birthYearGroup:mapBy(du.slice(41,65),COL.K,COL.L),schoolValid:mapBy(mt.slice(1,9000),COL.A,COL.B),schoolSystem:mapBy(mt.slice(2,9000),COL.A,COL.E),localSchool:mapBy(tt.slice(11,60),COL.G,COL.H)};
  }

  function fallbackLevel(rawGrade){
    const t=norm(rawGrade).replace(/[*!]/g,'').trim();
    if(!t)return'';
    if(/^(sv|thcn|tdn)/.test(t))return'SV';
    if(/tuổi|tháng|mn|mầm|mẫu|lá|chồi|mầm/.test(t))return'MN';
    const g=Number(t.replace(',','.'));
    if(Number.isFinite(g)){if(g>=1&&g<=5)return'TH';if(g>=6&&g<=9)return'THCS';if(g>=10&&g<=12)return'THPT';}
    return'';
  }
  function fallbackAgeLearning(age){if(age>=0&&age<=5)return'MN';if(age>=6&&age<=10)return'TH';if(age>=11&&age<=14)return'THCS';if(age>=15&&age<=18)return'THPT';return''}
  function fallbackAgeGroup(age){if(age>=6&&age<=10)return'6-10T';if(age>=11&&age<=14)return'11-14T';if(age>=15&&age<=18)return'15-18T';return''}

  function normalizeVillage(rawAddress,sourceName){
    let v=s(rawAddress).split(/\s[-–—]\s/)[0].trim();
    if(!v){v=s(sourceName).replace(/\.xls[xm]?$/i,'').replace(/^\s*\d+\s*[.\-_]?\s*/,'').trim();}
    v=v.replace(/^thôn\s+/i,'Thôn ').replace(/^xóm\s+/i,'Xóm ');
    if(/^bản\s+/i.test(v))v='Thôn '+v;
    return v||'Chưa xác định thôn/xóm';
  }

  function detectWorkbook(wb){if(wb?.Sheets?.MauNhapLieu)return'PHIEU_DIEU_TRA';if(wb?.Sheets?.DATA)return'FILE_TONG_HOP';return'KHONG_NHAN_DIEN';}

  function extractRowsFromSurvey(wb,sourceName,requestedYear){
    const rows=rowsOf(wb.Sheets.MauNhapLieu,'A1:AY30000'),fy=n(rows?.[1]?.[0]);
    const year=(requestedYear>=2000&&requestedYear<=2100)?requestedYear:((fy>=2000&&fy<=2100)?fy:0),out=[];
    for(let i=4;i<rows.length;i++){
      const src=rows[i]||[];if(![COL.B,COL.C,COL.D,COL.G,COL.O].some(c=>nonblank(src[c])))continue;
      const row=Array(73).fill('');row[COL.A]=normalizeVillage(src[COL.N],sourceName);for(let c=1;c<=COL.AY;c++)row[c]=src[c]??'';
      out.push({row,rowNumber:i+1,sourceName});
    }
    return{year,fileYear:fy,rows:out,type:'PHIEU_DIEU_TRA'};
  }

  function extractRowsFromMaster(wb,sourceName,requestedYear){
    const rows=rowsOf(wb.Sheets.DATA,'A1:BU30000'),fy=n(rows?.[1]?.[COL.A]);
    const year=(requestedYear>=2000&&requestedYear<=2100)?requestedYear:((fy>=2000&&fy<=2100)?fy:0),out=[];
    for(let i=4;i<rows.length;i++){const row=rows[i]||[];if([COL.A,COL.B,COL.C,COL.D,COL.G,COL.O].some(c=>nonblank(row[c])))out.push({row,rowNumber:i+1,sourceName});}
    return{year,fileYear:fy,rows:out,type:'FILE_TONG_HOP'};
  }

  function computeOne(row,rowNumber,year,refs,sourceName){
    const birthYear=n(row[COL.G]),age=birthYear>=1900?year-birthYear:'',prev=schoolYear(year),vSchool=s(row[COL.V]),rawGrade=row[COL.R];
    const bh=lookup(refs.gradeLevel,rawGrade)||fallbackLevel(rawGrade),bf=lookup(refs.ageLearning,age)||fallbackAgeLearning(Number(age)),bg=lookup(refs.birthYearGroup,birthYear)||fallbackAgeGroup(Number(age)),ba=lookup(refs.schoolSystem,vSchool);
    const bb=(refs.schoolValid.size&&['MN','TH','THCS','THPT'].includes(bh)&&vSchool&&!lookup(refs.schoolValid,vSchool))?'Lỗi':'';
    const bi=(bg==='15-18T'&&gradAtLeastTHCS({raw:row}))?'TNC2':'';
    const br=[COL.AJ,COL.AK,COL.AL,COL.AM,COL.AN,COL.AO,COL.AP,COL.AQ].some(i=>nonblank(row[i]))?1:0;
    let bs='';const w=canonicalLevel(row[COL.W]);if(s(row[COL.Y])===prev&&['MN','TH','THCS','THPT'].includes(w))bs=w;
    let bj='';if(bs==='THPT')bj=ba===''?'PT':eq(ba,'TX')?'TX':eq(ba,'NN')?'NN':'';else if(bg==='15-18T'&&bi==='TNC2'&&vSchool&&n(rawGrade)>9)bj=ba===''?'PT':eq(ba,'TX')?'TX':eq(ba,'NN')?'GDNN':'';
    if(!bj&&bg==='15-18T'&&bi==='TNC2'){if(bh==='THPT'||w==='THPT')bj='PT';else if(nonblank(row[COL.Z]))bj='GDNN';}
    const bk=lookup(refs.localSchool,vSchool),bl=((n(row[COL.AC])===9&&s(row[COL.AD])===prev)||(n(row[COL.AE])===9&&s(row[COL.AF])===prev))?'L9C':'';
    let bm='';if(age!==''&&age>=15){if(age<26)bm=25;else if(age<36)bm=35;else if(age<61)bm=60;}
    let bn='';if(n(row[COL.AI])>0&&br!==1)bn='MC';else if(br===1||bm==='')bn='';else if(['TH','THCS','THPT'].includes(w))bn='';else if(['thcn','cao đẳng','cao dang','đại học','dai hoc','thạc sĩ','thac si','tiến sĩ','tien si'].includes(norm(row[COL.Z])))bn='';else if(n(row[COL.AC])>=5||n(row[COL.AE])>=6||n(row[COL.AH])>=5)bn='';else bn='MC';
    let bp='';if(n(row[COL.AI])===2)bp='MC2';else if(bn==='MC'&&(n(row[COL.AC])>=3||n(row[COL.AG])>3||n(row[COL.AE])>3||n(row[COL.AH])>=3))bp='MC2';
    let bo='';if(bn==='MC'&&bp!=='MC2'&&(n(row[COL.AC])<=3||n(row[COL.AE])<=5||n(row[COL.AH])<5))bo='MC1';
    const bq=nonblank(row[COL.AE])?'BH':0,bt=s(row[COL.S]).endsWith('!')?'LB':'',bu=s(row[COL.S]).endsWith('*')?'2B':'';
    return{rowNumber,sourceName,name:[s(row[COL.C]),s(row[COL.D])].filter(Boolean).join(' ').replace(/\s+/g,' ').trim(),village:s(row[COL.A]),ticket:s(row[COL.O]),birthYear,age,female:s(row[COL.H]),ethnicity:s(row[COL.I]),rawGrade:s(rawGrade),className:s(row[COL.S]),school:vSchool,schoolName:s(row[COL.U]),graduated:s(row[COL.W]),graduationYear:s(row[COL.Y]),ba,bb,bc:age,bd:s(row[COL.A]),be:s(row[COL.O]),bf,bg,bh,bi,bj,bk,bl,bm,bn,bo,bp,bq,br,bs,bt,bu,raw:row};
  }

  function validate(records,year,sourceYears){
    const issues=[],seen=new Map(),add=(r,severity,message,suggestion)=>issues.push({severity,sourceName:r.sourceName||'',rowNumber:r.rowNumber,name:r.name||'(chưa có họ tên)',village:r.village||'',message,suggestion});
    records.forEach(r=>{
      if(!r.name)add(r,'error','Thiếu họ tên đối tượng.','Bổ sung họ đệm/tên.');if(!r.village)add(r,'warning','Thiếu thôn/xóm.','Kiểm tra cột địa chỉ hoặc tên file điều tra.');if(!r.birthYear||r.birthYear<1900||r.birthYear>year)add(r,'error','Năm sinh không hợp lệ hoặc bị thiếu.','Kiểm tra cột Năm sinh.');
      const day=n(r.raw[COL.E]),month=n(r.raw[COL.F]);if(day<1||day>31||month<1||month>12)add(r,'warning','Ngày/tháng sinh chưa hợp lệ.','Kiểm tra cột Ngày và Tháng.');
      if(r.bb==='Lỗi')add(r,'error','Mã trường không khớp danh mục trường.','Chuẩn hóa mã trường.');if(['MN','TH','THCS','THPT'].includes(r.bh)&&!currentSchool(r))add(r,'warning',`Đang được nhận diện học ${r.bh} nhưng thiếu trường/mã trường.`,'Bổ sung tên hoặc mã trường đang học.');
      if(nonblank(r.raw[COL.R])&&(nonblank(r.raw[COL.AC])||nonblank(r.raw[COL.AE])))add(r,'warning','Vừa có khối đang học vừa có học xong/bỏ học.','Đối chiếu lại tình trạng học tập.');
      const key=[norm(r.name),r.birthYear,n(r.raw[COL.E]),n(r.raw[COL.F]),norm(r.village)].join('|');if(r.name&&r.birthYear){if(seen.has(key))add(r,'warning',`Có khả năng trùng với ${seen.get(key)}.`,'Đối chiếu họ tên, ngày sinh và thôn/xóm.');else seen.set(key,`${r.sourceName} dòng ${r.rowNumber}`);}
    });
    if(sourceYears.size>1){const rr=records[0]||{sourceName:'',rowNumber:'',name:'',village:''};add(rr,'warning',`Các file có nhiều năm điều tra: ${[...sourceYears].sort().join(', ')}.`,'Chọn năm điều tra thống nhất trước khi xuất báo cáo.');}
    return issues;
  }

  function summarize(records,issues,year,files){
    const count=p=>records.filter(p).length,villages=[...new Set(records.map(r=>r.village).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')),households=new Set(records.map(r=>`${norm(r.village)}|${r.ticket}`).filter(x=>!x.endsWith('|'))).size;
    const ageBands={'0–5 tuổi':count(r=>r.age!==''&&r.age>=0&&r.age<=5),'6–10 tuổi':count(r=>r.age>=6&&r.age<=10),'11–14 tuổi':count(r=>r.age>=11&&r.age<=14),'15–18 tuổi':count(r=>r.age>=15&&r.age<=18),'19–35 tuổi':count(r=>r.age>=19&&r.age<=35),'36–60 tuổi':count(r=>r.age>=36&&r.age<=60),'Trên 60':count(r=>r.age>60)};
    const aged1518=records.filter(r=>r.age>=15&&r.age<=18&&r.br!==1),tn1518=aged1518.filter(r=>r.bi==='TNC2').length,age1560=records.filter(r=>r.age>=15&&r.age<=60&&r.br!==1),mc1560=age1560.filter(r=>r.bn==='MC').length;
    return{year,total:records.length,files:files.length,villages:villages.length,villageNames:villages,households,schoolErrors:count(r=>r.bb==='Lỗi'),disabilities:count(r=>r.br===1),issues:issues.length,errorIssues:issues.filter(i=>i.severity==='error').length,warningIssues:issues.filter(i=>i.severity==='warning').length,ageBands,aged1518:aged1518.length,tn1518,rate1518:pct(tn1518,aged1518.length),age1560:age1560.length,mc1560,notMcRate:pct(age1560.length-mc1560,age1560.length)};
  }

  function analyzeWorkbooks(items,requestedYear){
    if(!Array.isArray(items)||!items.length)throw new Error('Chưa có file để phân tích.');
    const extracted=[],sourceYears=new Set();let chosenYear=(requestedYear>=2000&&requestedYear<=2100)?Number(requestedYear):0,refWb=null;
    for(const item of items){const type=detectWorkbook(item.wb);if(type==='KHONG_NHAN_DIEN')throw new Error(`Không nhận diện được cấu trúc file “${item.name}”. Cần có sheet MauNhapLieu hoặc DATA.`);if(!refWb||item.wb.Sheets.MaTruong)refWb=item.wb;const e=type==='PHIEU_DIEU_TRA'?extractRowsFromSurvey(item.wb,item.name,chosenYear):extractRowsFromMaster(item.wb,item.name,chosenYear);if(e.fileYear>=2000&&e.fileYear<=2100)sourceYears.add(e.fileYear);if(!chosenYear&&e.year)chosenYear=e.year;extracted.push(e);}
    if(!chosenYear)chosenYear=new Date().getFullYear();const refs=buildReferenceMaps(refWb||items[0].wb),records=[];extracted.forEach(e=>e.rows.forEach(x=>records.push(computeOne(x.row,x.rowNumber,chosenYear,refs,x.sourceName))));
    const issues=validate(records,chosenYear,sourceYears),summary=summarize(records,issues,chosenYear,items);return{year:chosenYear,records,issues,summary,sourceYears:[...sourceYears],sources:items.map((x,i)=>({name:x.name,type:extracted[i].type,rows:extracted[i].rows.length,fileYear:extracted[i].fileYear}))};
  }
  function analyzeWorkbook(wb,requestedYear){return analyzeWorkbooks([{wb,name:'Excel PCGD'}],requestedYear)}
  function byVillage(records){const m=new Map();records.forEach(r=>{if(!m.has(r.village))m.set(r.village,[]);m.get(r.village).push(r)});return[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0],'vi'));}
  function count(rs,p){return rs.filter(p).length}
  function groupAge(rs,min,max){return rs.filter(r=>r.age>=min&&r.age<=max)}
  function ageMetrics(rs,age){const a=rs.filter(r=>r.age===age);return{total:a.length,female:count(a,isFemale),minority:count(a,isMinority),dis:count(a,r=>r.br===1),capable:count(a,r=>r.br===1&&canLearn(r)),access:count(a,r=>r.br===1&&canLearn(r)&&currentSchool(r))}}

  global.PCGDCore={COL,s,n,norm,nonblank,eq,pct,schoolYear,canonicalLevel,isFemale,isMinority,canLearn,currentSchool,gradAtLeastTH,gradAtLeastTHCS,byVillage,count,groupAge,ageMetrics};
  global.PCGDEngine={analyzeWorkbook,analyzeWorkbooks,COL,detectWorkbook};
})(window);
