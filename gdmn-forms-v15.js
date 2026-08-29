(function(global){
  'use strict';

  const VERSION='1.5.0';
  const SCOPE_KEY='pcgdxmc_management_scope';
  const API_KEY='pcgdxmc_api_base';
  const TOKEN_KEY='pcgdxmc_api_token';
  const STATE_PREFIX='pcgdxmc_gdmn_state_v15';
  const PENDING_PREFIX='pcgdxmc_gdmn_pending_v15';
  const HIGH_LEVELS=new Set(['province','national']);
  const FORM_CODES=['MN-01-TE','MN-01-TCDK','MN-01-GV','MN-01-CSVC','MN-01-TC','MN-05-KT','MN-06-SO-PC'];
  const FORMS=[
    {code:'MN-01-TE',label:'MN-01-TE',name:'Thống kê trẻ em mầm non theo độ tuổi',template:'templates/gdmn/MN-01-TE.xlsx'},
    {code:'MN-01-TCDK',label:'MN-01-TC, ĐK',name:'Tiêu chuẩn, điều kiện phổ cập GDMN theo từng xã',template:'templates/gdmn/MN-01-TCDK.xlsx'},
    {code:'MN-01-GV',label:'MN-01-GV',name:'Đội ngũ cán bộ quản lý, giáo viên, nhân viên',template:'templates/gdmn/MN-01-GV.xlsx'},
    {code:'MN-01-CSVC',label:'MN-01-CSVC',name:'Cơ sở vật chất, thiết bị dạy học lớp mẫu giáo',template:'templates/gdmn/MN-01-CSVC.xlsx'},
    {code:'MN-01-TC',label:'MN-01-T. chính',name:'Tình hình tài chính phổ cập GDMN',template:'templates/gdmn/MN-01-TC.xlsx'},
    {code:'MN-05-KT',label:'MN-05-KT',name:'Thống kê đối tượng khuyết tật mầm non',template:'templates/gdmn/MN-05-KT.xlsx'},
    {code:'MN-06-SO-PC',label:'MN-06-Sổ PC',name:'Sổ theo dõi phổ cập giáo dục mầm non',template:'templates/gdmn/MN-06-SO-PC.xlsx',localDetail:true}
  ];
  const FINANCE_ROWS={
    8:'Tổng chi cho Giáo dục mầm non',9:'Trong đó: Ngân sách thường xuyên',10:'Ngân sách đầu tư',11:'Ngân sách từ nguồn Chương trình mục tiêu, dự án',12:'Từ nguồn xã hội hóa',
    13:'Tỷ lệ chi hoạt động chuyên môn GDMN trong NSTX',14:'Định mức chi thường xuyên cho trẻ em từ 3 đến 5 tuổi (B. quân)',15:'Chi đầu tư xây dựng phòng học, phòng chức năng',16:'Chi mua sắm thiết bị dạy học và thiết bị nội thất dùng chung',
    17:'Trong đó',18:'Mua sắm thiết bị dạy học, đồ dùng, thiết bị nội thất dùng chung',19:'Hỗ trợ đồ dùng, học liệu cho trẻ 3–5 tuổi bán trú',20:'Hỗ trợ tiền điện, nước trẻ 3–5 tuổi bán trú',21:'Hỗ trợ kinh phí trông trưa trẻ 3–5 tuổi',22:'Hỗ trợ nhân viên nấu ăn theo NĐ 277/2025',23:'Hỗ trợ nhân viên nấu ăn theo NĐ 105/2020',24:'Thiết bị, đồ dùng cho cơ sở GDMN độc lập vùng ĐBKK/BQP',25:'Hỗ trợ theo chính sách khác',
    26:'Chi thực hiện chính sách cho trẻ em',27:'Hỗ trợ chi phí học tập',28:'Miễn học phí',29:'Hỗ trợ ăn trưa',30:'Hỗ trợ ăn trưa NĐ 105/2020',31:'Hỗ trợ ăn trưa NĐ 277/2025',32:'Hỗ trợ theo chính sách khác',
    33:'Chi thực hiện chính sách cho giáo viên mầm non',34:'Tuyển dụng giáo viên mầm non',35:'Đối tượng thực hiện phổ cập',36:'Giáo viên dạy lớp ghép và TCTV',37:'Giáo viên dạy con công nhân',38:'Hỗ trợ đội ngũ theo chính sách khác'
  };

  const $=id=>document.getElementById(id);
  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const norm=v=>clean(v).normalize('NFC').toLowerCase();
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const fmt=n=>new Intl.NumberFormat('vi-VN').format(num(n));
  const pct=(a,b)=>num(b)>0?num(a)/num(b)*100:0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now=()=>new Date().toISOString();
  const year=()=>Number($('yearInput')?.value)||new Date().getFullYear();
  const schoolYear=y=>`${y-1}-${y}`;
  const scope=()=>{try{return {level:'commune',provinceKey:'thai-nguyen',communeCode:'',communeName:'',...JSON.parse(localStorage.getItem(SCOPE_KEY)||'{}')}}catch(_){return {level:'commune',provinceKey:'thai-nguyen',communeCode:'',communeName:''}}};
  const provinceName=key=>global.PCGDNational?.PROVINCES?.find?.(x=>x.key===key)?.name||key||'';
  const apiBase=()=>clean(localStorage.getItem(API_KEY)||'').replace(/\/$/,'');
  const apiToken=()=>clean(localStorage.getItem(TOKEN_KEY)||'');
  const deepClone=x=>JSON.parse(JSON.stringify(x??{}));

  function deepSum(a,b){
    const out=deepClone(a||{});
    Object.entries(b||{}).forEach(([k,v])=>{
      if(typeof v==='number'&&Number.isFinite(v))out[k]=num(out[k])+v;
      else if(v&&typeof v==='object'&&!Array.isArray(v))out[k]=deepSum(out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k])?out[k]:{},v);
    });
    return out;
  }
  function emptyState(){
    const manual={};for(let a=0;a<=6;a++)manual[a]={preparedVietnamese:0,deaths:0,movedOut:0,movedIn:0,outsideCompleted:0};
    return {
      teManual:manual,
      tcdk:{specialArea:false,standardResult:'',schools:0,independent:0,sites:0,age34:{classesSingle:0,classesCombined:0},age5:{classesSingle:0,classesCombined:0}},
      gv:{institutions:[]},csvc:{institutions:[]},finance:{baseYear:year(),values:{}},updatedAt:''
    };
  }
  function stateKey(s=scope(),y=year()){return `${STATE_PREFIX}|${y}|${s.provinceKey||''}|${clean(s.communeCode)||clean(s.communeName).toLocaleLowerCase('vi')}`;}
  function pendingKey(s=scope(),y=year()){return `${PENDING_PREFIX}|${y}|${s.provinceKey||''}|${clean(s.communeCode)||clean(s.communeName).toLocaleLowerCase('vi')}`;}
  function loadState(){
    const d=emptyState();try{const x=JSON.parse(localStorage.getItem(stateKey())||'{}');return {...d,...x,teManual:{...d.teManual,...(x.teManual||{})},tcdk:{...d.tcdk,...(x.tcdk||{}),age34:{...d.tcdk.age34,...(x.tcdk?.age34||{})},age5:{...d.tcdk.age5,...(x.tcdk?.age5||{})}},gv:{institutions:Array.isArray(x.gv?.institutions)?x.gv.institutions:[]},csvc:{institutions:Array.isArray(x.csvc?.institutions)?x.csvc.institutions:[]},finance:{...d.finance,...(x.finance||{}),values:x.finance?.values||{}}};}catch(_){return d}
  }
  function saveState(st){st.updatedAt=now();localStorage.setItem(stateKey(),JSON.stringify(st));return st;}

  function isFemale(r){const v=norm(r.female||r.raw?.[7]);return v==='x'||v==='1'||v.includes('nữ')||v.includes('nu');}
  function ethnicity(r){return clean(r.raw?.[8]);}
  function isMinority(r){const e=norm(ethnicity(r));return !!e&&e!=='kinh';}
  function canLearn(r){const v=norm(r.raw?.[44]);return r.br===1&&(v==='x'||v==='1'||v.includes('có')||v.includes('co'));}
  function enrolledMN(r){return r.bh==='MN';}
  function localEnrolled(r){return enrolledMN(r)&&!!clean(r.bk);}
  function tempResident(r){const v=norm(r.raw?.[15]);return v.includes('tạm')||v.includes('tam');}
  function completedMN(r,y){const lv=norm(r.graduated||r.raw?.[22]);const gy=clean(r.graduationYear||r.raw?.[24]);return (lv==='mn'||lv.includes('mầm non')||lv.includes('mam non'))&&(!gy||gy===schoolYear(y)||gy===String(y));}
  function disabilityTypeCounts(rs){
    const map={movement:0,hearing:0,vision:0,neuro:0,intellectual:0,autism:0,learning:0,other:0};
    const cols=[['movement',35],['hearing',36],['vision',37],['neuro',38],['intellectual',39],['learning',40],['autism',41],['other',42]];
    rs.forEach(r=>cols.forEach(([k,c])=>{if(clean(r.raw?.[c]))map[k]++}));return map;
  }

  function buildTE(result,st){
    const y=Number(result?.year)||year(),records=Array.isArray(result?.records)?result.records:[],ages={};
    for(let a=0;a<=6;a++){
      const rs=records.filter(r=>num(r.age)===a),disabled=rs.filter(r=>r.br===1),cap=disabled.filter(canLearn),enrolled=rs.filter(enrolledMN),must=rs.filter(r=>!(r.br===1&&!canLearn(r))),manual=st.teManual?.[a]||{};
      const completed=rs.filter(r=>a>=3&&a<=5&&completedMN(r,y));
      ages[a]={
        total:rs.length,female:rs.filter(isFemale).length,minority:rs.filter(isMinority).length,disabled:disabled.length,disabledCapable:cap.length,disabledAccess:cap.filter(enrolledMN).length,
        mustMobilize:must.length,enrolled:enrolled.length,localEnrolled:enrolled.filter(localEnrolled).length,outsideEnrolled:enrolled.filter(r=>!localEnrolled(r)).length,
        enrolledFemale:enrolled.filter(isFemale).length,enrolledMinority:enrolled.filter(isMinority).length,preparedVietnamese:num(manual.preparedVietnamese),fromElsewhere:enrolled.filter(tempResident).length,
        twoSessions:enrolled.filter(r=>r.bu==='2B').length,deaths:num(manual.deaths),movedOut:num(manual.movedOut),movedIn:num(manual.movedIn),completed:completed.length,outsideCompleted:num(manual.outsideCompleted)
      };
    }
    const sum=(list,key)=>list.reduce((t,a)=>t+num(ages[a]?.[key]),0),rate=(n,d)=>d?pct(n,d):0;
    const a5=ages[5],a6=ages[6],a34=[3,4];
    const criteria={fiveEnrolled:a5.enrolled,fiveEnrolledRate:rate(a5.enrolled,a5.mustMobilize),sixCompleted:a6.completed,sixCompletedRate:rate(a6.completed,a6.mustMobilize),fiveDisabledAccess:a5.disabledAccess,fiveDisabledAccessRate:rate(a5.disabledAccess,a5.disabledCapable),fiveTwoSessions:a5.twoSessions,fiveTwoSessionsRate:rate(a5.twoSessions,a5.enrolled),age34Enrolled:sum(a34,'enrolled'),age34EnrolledRate:rate(sum(a34,'enrolled'),sum(a34,'mustMobilize')),age34Completed:sum(a34,'completed'),age34CompletedRate:rate(sum(a34,'completed'),sum(a34,'enrolled')),age34TwoSessions:sum(a34,'twoSessions'),age34TwoSessionsRate:rate(sum(a34,'twoSessions'),sum(a34,'enrolled'))};
    return {version:1,aggregate:{ages,criteria},details:{autoGenerated:true,sourceRecords:records.length}};
  }
  function buildKT(result){
    const records=Array.isArray(result?.records)?result.records:[],ages={};
    for(let a=0;a<=5;a++){
      const rs=records.filter(r=>num(r.age)===a&&r.br===1),types=disabilityTypeCounts(rs),access=rs.filter(r=>canLearn(r)&&enrolledMN(r)).length;
      ages[a]={total:rs.length,...types,access,accessRate:pct(access,rs.length)};
    }
    return {version:1,aggregate:{ages},details:{autoGenerated:true}};
  }
  function buildSoPC(result){
    const records=(Array.isArray(result?.records)?result.records:[]).filter(r=>num(r.age)>=0&&num(r.age)<=5);
    const villages=new Set(records.map(r=>clean(r.village)).filter(Boolean));
    return {version:1,aggregate:{children:records.length,girls:records.filter(isFemale).length,minority:records.filter(isMinority).length,disabled:records.filter(r=>r.br===1).length,villages:villages.size},details:{localDetailOnly:true,privacy:'person-level rows stay at commune'}};
  }
  function normAgeGroup(x){return {classes:num(x?.classes),teachers:num(x?.teachers),teacherContract:num(x?.teacherContract),policy:num(x?.policy),standard:num(x?.standard),above:num(x?.above),professional:num(x?.professional)};}
  function buildGV(st){
    const institutions=(st.gv?.institutions||[]).map(x=>({type:x.type==='independent'?'independent':'school',name:clean(x.name),staffTotal:num(x.staffTotal),staffContract:num(x.staffContract),managers:num(x.managers),teachersTotal:num(x.teachersTotal),staffOther:num(x.staffOther),age34:normAgeGroup(x.age34),age5:normAgeGroup(x.age5)})).filter(x=>x.name||x.staffTotal||x.teachersTotal||x.age34.classes||x.age5.classes);
    let aggregate={institutions:institutions.length,schools:0,independent:0,staffTotal:0,staffContract:0,managers:0,teachersTotal:0,staffOther:0,age34:{classes:0,teachers:0,teacherContract:0,policy:0,standard:0,above:0,professional:0},age5:{classes:0,teachers:0,teacherContract:0,policy:0,standard:0,above:0,professional:0}};
    institutions.forEach(x=>{aggregate[x.type==='independent'?'independent':'schools']++;['staffTotal','staffContract','managers','teachersTotal','staffOther'].forEach(k=>aggregate[k]+=num(x[k]));aggregate.age34=deepSum(aggregate.age34,x.age34);aggregate.age5=deepSum(aggregate.age5,x.age5)});
    return {version:1,aggregate,details:{institutions}};
  }
  function buildCSVC(st){
    const fields=['sites','branchSites','classesTotal','nurseryClasses','roomsTotal','nurseryRooms','permanent','semi','temporary','equipped','toilets','toiletsStd','water','waterStd','kitchen','kitchenStd','playground','playgroundToys'];
    const institutions=(st.csvc?.institutions||[]).map(x=>{const o={type:x.type==='independent'?'independent':'school',name:clean(x.name),age34Classes:num(x.age34Classes),age5Classes:num(x.age5Classes),age34Rooms:num(x.age34Rooms),age5Rooms:num(x.age5Rooms)};fields.forEach(k=>o[k]=num(x[k]));return o}).filter(x=>x.name||x.sites||x.classesTotal||x.roomsTotal||x.age34Classes||x.age5Classes);
    let aggregate={institutions:institutions.length,schools:0,independent:0,age34Classes:0,age5Classes:0,age34Rooms:0,age5Rooms:0};fields.forEach(k=>aggregate[k]=0);
    institutions.forEach(x=>{aggregate[x.type==='independent'?'independent':'schools']++;['age34Classes','age5Classes','age34Rooms','age5Rooms',...fields].forEach(k=>aggregate[k]+=num(x[k]))});
    return {version:1,aggregate,details:{institutions}};
  }
  function buildFinance(st){
    const y0=Number(st.finance?.baseYear)||year(),years=[y0,y0+1,y0+2,y0+3,y0+4],lines={};
    Object.keys(FINANCE_ROWS).forEach(r=>{const vals=years.map(y=>num(st.finance?.values?.[r]?.[y]));lines[r]={};const averaged=r==='13'||r==='14';years.forEach((y,i)=>lines[r][y]=averaged?{sum:vals[i],count:vals[i]!==0?1:0}:vals[i]);lines[r].total=averaged?{sum:vals.reduce((a,b)=>a+b,0),count:vals.filter(v=>v!==0).length}:vals.reduce((a,b)=>a+b,0)});
    return {version:1,aggregate:{lines},details:{years}};
  }
  function buildTCDK(result,st,te,gv,csvc,kt){
    const sumAge=(ages,keys)=>{const out={};keys.forEach(k=>out[k]=ages.reduce((t,a)=>t+num(te.aggregate.ages?.[a]?.[k]),0));return out};
    const age34=deepSum(sumAge([3,4],['mustMobilize','enrolled','completed','disabled','disabledCapable','disabledAccess']),{classesSingle:num(st.tcdk?.age34?.classesSingle),classesCombined:num(st.tcdk?.age34?.classesCombined)});
    const age5=deepSum(sumAge([5],['mustMobilize','enrolled','completed','disabled','disabledCapable','disabledAccess']),{classesSingle:num(st.tcdk?.age5?.classesSingle),classesCombined:num(st.tcdk?.age5?.classesCombined)});
    const gva=gv.aggregate,ca=csvc.aggregate;
    age34.classesTotal=age34.classesSingle+age34.classesCombined||num(gva.age34?.classes);age5.classesTotal=age5.classesSingle+age5.classesCombined||num(gva.age5?.classes);
    age34.teacherRate=age34.classesTotal?num(gva.age34?.teachers)/age34.classesTotal:0;age5.teacherRate=age5.classesTotal?num(gva.age5?.teachers)/age5.classesTotal:0;
    age34.roomRate=age34.classesTotal?num(ca.age34Rooms)/age34.classesTotal:0;age5.roomRate=age5.classesTotal?num(ca.age5Rooms)/age5.classesTotal:0;
    age34.equipped=num(ca.equipped);age5.equipped=num(ca.equipped);
    return {version:1,aggregate:{specialArea:st.tcdk?.specialArea?1:0,schools:num(st.tcdk?.schools)||num(gva.schools)||num(ca.schools),independent:num(st.tcdk?.independent)||num(gva.independent)||num(ca.independent),sites:num(st.tcdk?.sites)||num(ca.sites),age34,age5},details:{standardResult:clean(st.tcdk?.standardResult)}};
  }
  function buildAllForms(result=global.PCGDLastResult,st=loadState()){
    if(!result?.summary||!Array.isArray(result.records))throw new Error('Cấp xã cần phân tích phiếu điều tra trước khi tạo biểu GDMN.');
    const te=buildTE(result,st),kt=buildKT(result),gv=buildGV(st),csvc=buildCSVC(st),finance=buildFinance(st),sopc=buildSoPC(result),tcdk=buildTCDK(result,st,te,gv,csvc,kt);
    return {'MN-01-TE':te,'MN-01-TCDK':tcdk,'MN-01-GV':gv,'MN-01-CSVC':csvc,'MN-01-TC':finance,'MN-05-KT':kt,'MN-06-SO-PC':sopc};
  }

  async function request(path,opts={}){
    const base=apiBase();if(!base)throw new Error('Chưa cấu hình máy chủ API trong mục Phạm vi quản lý.');
    const headers={'Accept':'application/json',...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})};const t=apiToken();if(t)headers.Authorization=`Bearer ${t}`;
    const c=new AbortController(),tm=setTimeout(()=>c.abort(),opts.timeout||15000);
    try{const r=await fetch(`${base}${path}`,{...opts,headers,signal:c.signal});if(!r.ok)throw new Error(`API ${r.status}: ${(await r.text()).slice(0,160)}`);return r.status===204?null:r.json()}finally{clearTimeout(tm)}
  }
  async function syncForms(){
    const s=scope();if(s.level!=='commune')throw new Error('Chỉ cấp xã/phường/đặc khu được đồng bộ dữ liệu nguồn GDMN.');
    if(!clean(s.communeName))throw new Error('Hãy nhập tên xã/phường/đặc khu trong Phạm vi quản lý.');
    const forms=buildAllForms(),body={schemaVersion:1,appVersion:VERSION,year:year(),provinceKey:s.provinceKey,provinceName:provinceName(s.provinceKey),communeCode:clean(s.communeCode),communeName:clean(s.communeName),generatedAt:now(),forms};
    localStorage.setItem(pendingKey(),JSON.stringify(body));
    if(!navigator.onLine||!apiBase()){setGdmnStatus('Đã lưu 7 biểu GDMN trên thiết bị; khi có mạng hãy bấm Đồng bộ lại.','warn');return {queued:true,forms}}
    const res=await request('/v1/gdmn/forms/upsert',{method:'POST',body:JSON.stringify(body),timeout:20000});localStorage.removeItem(pendingKey());setGdmnStatus('Đã đồng bộ 7 biểu GDMN cấp xã lên máy chủ.','ok');return res;
  }
  async function flushPending(){
    if(!navigator.onLine||!apiBase())return;const raw=localStorage.getItem(pendingKey());if(!raw)return;
    try{await request('/v1/gdmn/forms/upsert',{method:'POST',body:raw,timeout:20000});localStorage.removeItem(pendingKey());setGdmnStatus('Đã tự đồng bộ gói GDMN đang chờ.','ok')}catch(_){/* giữ hàng đợi */}
  }
  async function getRemoteForm(code){
    const s=scope(),q=new URLSearchParams({level:s.level,year:String(year()),form:code});if(s.level!=='national'&&s.provinceKey)q.set('province',s.provinceKey);if(s.level==='commune'&&s.communeCode)q.set('commune',s.communeCode);
    return request(`/v1/gdmn/forms?${q}`,{method:'GET',timeout:20000});
  }

  function financeValue(v){return v&&typeof v==='object'&&!Array.isArray(v)?(num(v.count)?num(v.sum)/num(v.count):0):num(v);}
  function formAggregateFromRows(data){let out={};(data?.rows||[]).forEach(r=>{const a=r.aggregate||r.payload?.aggregate||{};out=deepSum(out,a)});return out;}
  function selectedCode(){return $('gdmnFormSelect')?.value||FORM_CODES[0];}
  function formMeta(code){return FORMS.find(f=>f.code===code)||FORMS[0];}
  function setGdmnStatus(text,kind='info'){const el=$('gdmnStatus');if(!el)return;el.textContent=text;el.dataset.kind=kind;}

  function ensureStyles(){if($('gdmnV15Styles'))return;const st=document.createElement('style');st.id='gdmnV15Styles';st.textContent=`
    .g15{margin:10px 0}.g15-head{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap}.g15-actions{display:flex;gap:6px;flex-wrap:wrap}.g15-actions button,.g15-actions select{min-height:34px}.g15-status{margin-top:8px;padding:8px 10px;border-radius:7px;background:#eef5f8;color:#31515e;font-size:11px}.g15-status[data-kind="ok"]{background:#e9f7ef;color:#176c3a}.g15-status[data-kind="warn"]{background:#fff4e5;color:#8b5300}.g15-status[data-kind="error"]{background:#fdecec;color:#9d1c1c}.g15-preview{margin-top:10px}.g15-preview table{width:100%;border-collapse:collapse;font-size:11px}.g15-preview th,.g15-preview td{border:1px solid #d7e0e5;padding:6px;text-align:right}.g15-preview th:first-child,.g15-preview td:first-child{text-align:left}.g15-preview th{background:#edf4f7;position:sticky;top:0}.g15-scroll{overflow:auto;max-height:520px;border:1px solid #d7e0e5;border-radius:7px}.g15-editor{margin-top:10px;border-top:1px dashed #ccd8de;padding-top:10px}.g15-grid{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr));gap:7px}.g15-field{display:flex;flex-direction:column;gap:3px}.g15-field label{font-size:10px;color:#607784;font-weight:700}.g15-field input,.g15-field select{height:31px;border:1px solid #b8c7cf;border-radius:5px;padding:0 6px}.g15-card{border:1px solid #d4e0e6;border-radius:8px;padding:9px;margin-top:8px;background:#fff}.g15-card-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.g15-card h4{margin:0;font-size:12px}.g15-age-title{font-size:10px;font-weight:800;color:#315b70;margin:8px 0 4px}.g15-finance input{width:92px;height:28px;border:1px solid #b8c7cf;padding:2px 4px}.g15-note{font-size:11px;color:#5d727d;background:#f5f8fa;padding:9px;border-radius:7px}.g15-form-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.g15-form-tabs button{border:1px solid #b8cbd5;background:#fff;border-radius:6px;padding:6px 8px;font-size:10px;cursor:pointer}.g15-form-tabs button.active{background:#ddecf4;color:#0d527d;font-weight:800}.g15-kpis{display:grid;grid-template-columns:repeat(4,minmax(100px,1fr));gap:7px;margin:8px 0}.g15-kpi{border:1px solid #d7e2e7;border-radius:7px;padding:8px}.g15-kpi span{font-size:9px;color:#657985;display:block}.g15-kpi strong{font-size:17px;display:block;margin-top:2px}@media(max-width:900px){.g15-grid{grid-template-columns:repeat(2,minmax(120px,1fr))}.g15-kpis{grid-template-columns:1fr 1fr}}@media(max-width:560px){.g15-grid{grid-template-columns:1fr}.g15-actions>*{flex:1 1 45%}}
  `;document.head.appendChild(st)}

  function ensurePanel(){
    const ws=document.querySelector('#mn .report-workspace');if(!ws||$('gdmnV15Panel'))return;
    const p=document.createElement('section');p.id='gdmnV15Panel';p.className='g15';
    p.innerHTML=`<div class="g15-head"><div><h3 style="margin:0">Bộ 7 biểu GDMN</h3><p style="margin:3px 0 0;font-size:11px;color:#667d87">Tự động lấy chỉ tiêu trẻ em/khuyết tật từ phiếu xã; đội ngũ, CSVC, tài chính nhập bổ sung theo mẫu.</p></div><div class="g15-actions"><select id="gdmnFormSelect">${FORMS.map(f=>`<option value="${f.code}">${f.label}</option>`).join('')}</select><button id="gdmnRefresh" class="secondary" type="button">Làm mới</button><button id="gdmnEdit" class="secondary" type="button">Nhập bổ sung</button><button id="gdmnSave" class="secondary" type="button" style="display:none">Lưu số liệu</button><button id="gdmnSync" class="primary" type="button">Đồng bộ 7 biểu</button><button id="gdmnExport" class="secondary" type="button">Xuất Excel biểu này</button></div></div><div id="gdmnStatus" class="g15-status" data-kind="info">Chọn biểu để xem. Ở cấp tỉnh/toàn quốc hệ thống chỉ đọc tổng hợp, không có phiếu điều tra.</div><div id="gdmnFormTabs" class="g15-form-tabs"></div><div id="gdmnPreview" class="g15-preview"></div><div id="gdmnEditor" class="g15-editor" style="display:none"></div>`;
    const old=ws.querySelector('.report-submenu');if(old)old.insertAdjacentElement('beforebegin',p);else ws.appendChild(p);
    $('gdmnFormTabs').innerHTML=FORMS.map(f=>`<button type="button" data-code="${f.code}">${f.label}</button>`).join('');
    $('gdmnFormTabs').addEventListener('click',e=>{const b=e.target.closest('[data-code]');if(!b)return;$('gdmnFormSelect').value=b.dataset.code;closeEditor();renderCurrent()});
    $('gdmnFormSelect').addEventListener('change',()=>{closeEditor();renderCurrent()});
    $('gdmnRefresh').addEventListener('click',renderCurrent);
    $('gdmnEdit').addEventListener('click',openEditor);
    $('gdmnSave').addEventListener('click',saveEditor);
    $('gdmnSync').addEventListener('click',()=>syncForms().then(renderCurrent).catch(e=>setGdmnStatus(e.message,'error')));
    $('gdmnExport').addEventListener('click',()=>exportSelected().catch(e=>setGdmnStatus(e.message,'error')));
  }

  function applyLevelUi(){
    const s=scope(),high=HIGH_LEVELS.has(s.level),p=$('gdmnV15Panel');if(!p)return;
    const edit=$('gdmnEdit'),sync=$('gdmnSync');if(edit)edit.style.display=high?'none':'';if(sync)sync.style.display=high?'none':'';
    const oldPanel=$('gdmnHighLevelForms');if(oldPanel)oldPanel.style.display='none';const oldAgg=$('gdmnAggregateOnlyPanel');if(oldAgg)oldAgg.style.display='none';
    const hide=[ '.import-panel .field.grow','#analyzeBtn','#exportBtn','#selectedFilePanel','#directEntryPanel','#status','.scopebar','#surveyInputMenu','#nationalAggregatePanel','.main-menu [data-tab="overview"]','.main-menu [data-tab="data"]','.main-menu [data-tab="errors"]','.main-menu [data-tab="th"]','.main-menu [data-tab="thcs"]','.main-menu [data-tab="xmc"]','#overview','#data','#errors','#th','#thcs','#xmc'];
    hide.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{if(el.dataset.g15Display===undefined)el.dataset.g15Display=el.style.display||'';el.style.display=high?'none':el.dataset.g15Display}));
    document.querySelector('.import-panel')?.classList.toggle('gdmn-year-only',high);
    if(high){const tab=document.querySelector('.main-menu [data-tab="mn"]');if(tab){document.querySelectorAll('.main-menu .tab').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('.tabpage').forEach(x=>x.classList.toggle('active',x.id==='mn'))}}
    const ws=document.querySelector('#mn .report-workspace');if(ws){const oldSub=ws.querySelector(':scope > .report-submenu'),oldMeta=ws.querySelector(':scope > .report-meta'),oldPrev=ws.querySelector(':scope > .report-preview'),oldExp=ws.querySelector('.report-head [data-export-scope-group="mn"]');[oldSub,oldMeta,oldPrev,oldExp].forEach(el=>{if(!el)return;if(el.dataset.g15Display===undefined)el.dataset.g15Display=el.style.display||'';el.style.display=high?'none':el.dataset.g15Display})}
    renderCurrent();
  }

  function closeEditor(){const e=$('gdmnEditor');if(e)e.style.display='none';if($('gdmnSave'))$('gdmnSave').style.display='none';if($('gdmnEdit'))$('gdmnEdit').textContent='Nhập bổ sung';}
  function openEditor(){if(scope().level!=='commune')return;const e=$('gdmnEditor');if(!e)return;e.style.display='block';$('gdmnSave').style.display='';$('gdmnEdit').textContent='Đang nhập';renderEditor(selectedCode());e.scrollIntoView({behavior:'smooth',block:'nearest'});}
  function inputField(label,path,value,type='number',extra=''){return `<div class="g15-field"><label>${esc(label)}</label><input data-path="${esc(path)}" type="${type}" value="${esc(value??'')}" ${extra}></div>`;}
  function ageGroupFields(prefix,x){return `<div class="g15-grid">${inputField('Số lớp',`${prefix}.classes`,x?.classes)}${inputField('Giáo viên',`${prefix}.teachers`,x?.teachers)}${inputField('GV hợp đồng',`${prefix}.teacherContract`,x?.teacherContract)}${inputField('GV hưởng CĐ/CS',`${prefix}.policy`,x?.policy)}${inputField('GV đạt chuẩn',`${prefix}.standard`,x?.standard)}${inputField('GV trên chuẩn',`${prefix}.above`,x?.above)}${inputField('GV đạt chuẩn nghề nghiệp',`${prefix}.professional`,x?.professional)}</div>`;}

  function renderEditor(code){
    const st=loadState(),e=$('gdmnEditor');if(!e)return;
    if(code==='MN-01-TE'){
      e.innerHTML=`<div class="g15-note">Các chỉ tiêu nhân khẩu, huy động, nữ, dân tộc, khuyết tật, học 2 buổi/ngày được tự động tính từ phiếu điều tra. Chỉ nhập các chỉ tiêu chưa có trong phiếu nguồn.</div><div class="g15-scroll"><table><thead><tr><th>Tuổi</th><th>DTTS chuẩn bị TV</th><th>Chết</th><th>Chuyển đi</th><th>Chuyển đến</th><th>Nơi khác HT CTGDMN</th></tr></thead><tbody>${[0,1,2,3,4,5,6].map(a=>{const x=st.teManual?.[a]||{};return `<tr><td>${a}</td><td><input data-path="teManual.${a}.preparedVietnamese" type="number" min="0" value="${num(x.preparedVietnamese)}"></td><td><input data-path="teManual.${a}.deaths" type="number" min="0" value="${num(x.deaths)}"></td><td><input data-path="teManual.${a}.movedOut" type="number" min="0" value="${num(x.movedOut)}"></td><td><input data-path="teManual.${a}.movedIn" type="number" min="0" value="${num(x.movedIn)}"></td><td><input data-path="teManual.${a}.outsideCompleted" type="number" min="0" value="${num(x.outsideCompleted)}"></td></tr>`}).join('')}</tbody></table></div>`;
    }else if(code==='MN-01-TCDK'){
      e.innerHTML=`<div class="g15-grid"><div class="g15-field"><label>Vùng KTXH ĐBKK</label><select data-path="tcdk.specialArea"><option value="0" ${!st.tcdk.specialArea?'selected':''}>Không</option><option value="1" ${st.tcdk.specialArea?'selected':''}>Có</option></select></div><div class="g15-field"><label>Kết quả đạt chuẩn</label><select data-path="tcdk.standardResult"><option value="" ${!st.tcdk.standardResult?'selected':''}>Chưa xác nhận</option><option ${st.tcdk.standardResult==='Đạt'?'selected':''}>Đạt</option><option ${st.tcdk.standardResult==='Không đạt'?'selected':''}>Không đạt</option></select></div>${inputField('Số trường','tcdk.schools',st.tcdk.schools)}${inputField('Số cơ sở GDMN độc lập','tcdk.independent',st.tcdk.independent)}${inputField('Số điểm trường','tcdk.sites',st.tcdk.sites)}</div><div class="g15-age-title">Độ tuổi 3, 4 tuổi</div><div class="g15-grid">${inputField('Lớp đơn','tcdk.age34.classesSingle',st.tcdk.age34.classesSingle)}${inputField('Lớp ghép','tcdk.age34.classesCombined',st.tcdk.age34.classesCombined)}</div><div class="g15-age-title">Độ tuổi 5 tuổi</div><div class="g15-grid">${inputField('Lớp đơn','tcdk.age5.classesSingle',st.tcdk.age5.classesSingle)}${inputField('Lớp ghép','tcdk.age5.classesCombined',st.tcdk.age5.classesCombined)}</div><div class="g15-note" style="margin-top:8px">Tỷ lệ huy động, hoàn thành CTGDMN, trẻ khuyết tật được lấy tự động từ MN-01-TE/MN-05-KT; tỷ lệ GV/lớp và phòng/lớp lấy từ MN-01-GV/MN-01-CSVC.</div>`;
    }else if(code==='MN-01-GV'){
      e.innerHTML=`<div class="g15-note">Mỗi cơ sở nhập một lần; số liệu 3–4 tuổi và 5 tuổi được tách riêng đúng cấu trúc mẫu MN-01-GV.</div><div id="g15GvCards">${(st.gv.institutions||[]).map((x,i)=>gvCard(x,i)).join('')}</div><button id="g15AddGv" type="button" class="secondary" style="margin-top:8px">+ Thêm trường/cơ sở</button>`;$('g15AddGv').onclick=()=>{st.gv.institutions.push({type:'school',name:'',age34:{},age5:{}});saveState(st);renderEditor(code)};bindCardDeletes('gv');
    }else if(code==='MN-01-CSVC'){
      e.innerHTML=`<div class="g15-note">Nhập theo từng trường/cơ sở. Các cột khớp với mẫu MN-01-CSVC.</div><div id="g15CsvcCards">${(st.csvc.institutions||[]).map((x,i)=>csvcCard(x,i)).join('')}</div><button id="g15AddCsvc" type="button" class="secondary" style="margin-top:8px">+ Thêm trường/cơ sở</button>`;$('g15AddCsvc').onclick=()=>{st.csvc.institutions.push({type:'school',name:''});saveState(st);renderEditor(code)};bindCardDeletes('csvc');
    }else if(code==='MN-01-TC'){
      const y0=Number(st.finance.baseYear)||year(),ys=[y0,y0+1,y0+2,y0+3,y0+4];
      e.innerHTML=`<div class="g15-grid">${inputField('Năm bắt đầu','finance.baseYear',y0,'number','min="2000" max="2100"')}</div><div class="g15-scroll g15-finance" style="margin-top:8px"><table><thead><tr><th>Nội dung</th>${ys.map(y=>`<th>${y}</th>`).join('')}</tr></thead><tbody>${Object.entries(FINANCE_ROWS).map(([r,label])=>`<tr><td>${esc(label)}</td>${ys.map(y=>`<td><input data-path="finance.values.${r}.${y}" type="number" step="0.01" value="${num(st.finance.values?.[r]?.[y])}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }else if(code==='MN-05-KT')e.innerHTML='<div class="g15-note">MN-05-KT được tự động tính từ các cột dạng khuyết tật trong phiếu điều tra. Không cần nhập lại tại đây.</div>';
    else e.innerHTML='<div class="g15-note"><strong>Bảo vệ dữ liệu cá nhân:</strong> Sổ MN-06 được tạo trực tiếp từ phiếu điều tra trên thiết bị cấp xã. Khi đồng bộ lên tỉnh/toàn quốc chỉ gửi tổng số đối tượng, nữ, DTTS, khuyết tật và số thôn; không gửi họ tên, ngày sinh, số phiếu hoặc tên cha/mẹ.</div>';
  }
  function gvCard(x,i){return `<div class="g15-card"><div class="g15-card-head"><h4>Cơ sở ${i+1}</h4><button type="button" class="secondary" data-del="gv:${i}">Xóa</button></div><div class="g15-grid" style="margin-top:7px"><div class="g15-field"><label>Loại</label><select data-path="gv.institutions.${i}.type"><option value="school" ${x.type!=='independent'?'selected':''}>Trường mầm non</option><option value="independent" ${x.type==='independent'?'selected':''}>Cơ sở GDMN độc lập</option></select></div>${inputField('Tên trường/cơ sở',`gv.institutions.${i}.name`,x.name,'text')}${inputField('CBQL, GV, NV tổng số',`gv.institutions.${i}.staffTotal`,x.staffTotal)}${inputField('Hợp đồng làm việc',`gv.institutions.${i}.staffContract`,x.staffContract)}${inputField('CBQL',`gv.institutions.${i}.managers`,x.managers)}${inputField('Giáo viên toàn trường',`gv.institutions.${i}.teachersTotal`,x.teachersTotal)}${inputField('Nhân viên',`gv.institutions.${i}.staffOther`,x.staffOther)}</div><div class="g15-age-title">Mẫu giáo 3, 4 tuổi</div>${ageGroupFields(`gv.institutions.${i}.age34`,x.age34)}<div class="g15-age-title">Mẫu giáo 5 tuổi</div>${ageGroupFields(`gv.institutions.${i}.age5`,x.age5)}</div>`;}
  function csvcCard(x,i){const f=(label,k)=>inputField(label,`csvc.institutions.${i}.${k}`,x[k]);return `<div class="g15-card"><div class="g15-card-head"><h4>Cơ sở ${i+1}</h4><button type="button" class="secondary" data-del="csvc:${i}">Xóa</button></div><div class="g15-grid" style="margin-top:7px"><div class="g15-field"><label>Loại</label><select data-path="csvc.institutions.${i}.type"><option value="school" ${x.type!=='independent'?'selected':''}>Trường mầm non</option><option value="independent" ${x.type==='independent'?'selected':''}>Cơ sở GDMN độc lập</option></select></div>${inputField('Tên trường/cơ sở',`csvc.institutions.${i}.name`,x.name,'text')}${f('Số điểm/cơ sở','sites')}${f('Điểm trường lẻ','branchSites')}${f('Tổng nhóm/lớp','classesTotal')}${f('Nhóm nhà trẻ','nurseryClasses')}${f('Lớp MG 3,4 tuổi','age34Classes')}${f('Lớp MG 5 tuổi','age5Classes')}${f('Tổng phòng toàn trường','roomsTotal')}${f('Phòng nhà trẻ','nurseryRooms')}${f('Phòng MG 3,4 tuổi','age34Rooms')}${f('Phòng MG 5 tuổi','age5Rooms')}${f('Phòng kiên cố','permanent')}${f('Bán kiên cố','semi')}${f('Tạm/nhờ','temporary')}${f('Lớp đủ TBDH, ĐD, ĐC','equipped')}${f('Phòng/khu vệ sinh','toilets')}${f('Vệ sinh đạt chuẩn','toiletsStd')}${f('Công trình nước sạch','water')}${f('Nước sạch đạt chuẩn','waterStd')}${f('Bếp ăn','kitchen')}${f('Bếp ăn đạt chuẩn','kitchenStd')}${f('Sân chơi','playground')}${f('Sân có đồ chơi','playgroundToys')}</div></div>`;}
  function bindCardDeletes(kind){document.querySelectorAll(`[data-del^="${kind}:"]`).forEach(b=>b.onclick=()=>{const st=loadState(),i=Number(b.dataset.del.split(':')[1]);st[kind].institutions.splice(i,1);saveState(st);renderEditor(selectedCode())})}
  function setPath(obj,path,value){const ps=path.split('.');let cur=obj;for(let i=0;i<ps.length-1;i++){const k=ps[i];if(cur[k]===undefined)cur[k]=/^\d+$/.test(ps[i+1])?[]:{};cur=cur[k]}cur[ps.at(-1)]=value;}
  function saveEditor(){const st=loadState(),e=$('gdmnEditor');if(!e)return;e.querySelectorAll('[data-path]').forEach(inp=>{let v=inp.value;if(inp.type==='number')v=num(v);if(inp.tagName==='SELECT'&&inp.dataset.path==='tcdk.specialArea')v=v==='1';setPath(st,inp.dataset.path,v)});saveState(st);setGdmnStatus('Đã lưu số liệu bổ sung GDMN trên thiết bị.','ok');closeEditor();renderCurrent();}

  function kpiHtml(items){return `<div class="g15-kpis">${items.map(([a,b])=>`<div class="g15-kpi"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`).join('')}</div>`;}
  function unitName(r){return r.communeName||r.provinceName||r.label||r.communeCode||r.provinceKey||'Đơn vị';}
  function highRows(data){return Array.isArray(data?.rows)?data.rows:[];}
  function renderTable(headers,rows){return `<div class="g15-scroll"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((v,i)=>`<td${i===0?' style="text-align:left"':''}>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
  async function renderCurrent(){
    ensurePanel();const code=selectedCode(),s=scope();$('gdmnFormTabs')?.querySelectorAll('[data-code]').forEach(b=>b.classList.toggle('active',b.dataset.code===code));
    const p=$('gdmnPreview');if(!p)return;p.innerHTML='<div class="g15-note">Đang nạp biểu…</div>';
    try{
      if(s.level==='commune'){
        const forms=buildAllForms(),payload=forms[code];p.innerHTML=renderPayload(code,payload,[{communeName:s.communeName,provinceName:provinceName(s.provinceKey),payload,aggregate:payload.aggregate}],false);setGdmnStatus(`${formMeta(code).label} · cấp xã · dữ liệu chi tiết xử lý tại trình duyệt.`,'info');
      }else{
        const data=await getRemoteForm(code);p.innerHTML=renderPayload(code,null,highRows(data),s.level==='national');setGdmnStatus(`${formMeta(code).label} · ${s.level==='national'?'toàn quốc':'cấp tỉnh'} · ${highRows(data).length} đơn vị nguồn.`,'info');
      }
    }catch(e){p.innerHTML=`<div class="g15-note">${esc(e.message)}</div>`;setGdmnStatus(e.message,'warn')}
  }
  function renderPayload(code,payload,rows,isNational){
    const ag=payload?.aggregate||formAggregateFromRows({rows}),label=isNational?'Tỉnh/thành':'Đơn vị';
    if(code==='MN-01-TE'){
      const a5=ag.ages?.[5]||{},a34=deepSum(ag.ages?.[3]||{},ag.ages?.[4]||{});const rr=rows.map(r=>{const a=r.aggregate||r.payload?.aggregate||{},x5=a.ages?.[5]||{},x34=deepSum(a.ages?.[3]||{},a.ages?.[4]||{});return [unitName(r),fmt(x34.mustMobilize),fmt(x34.enrolled),`${pct(x34.enrolled,x34.mustMobilize).toFixed(2)}%`,fmt(x5.mustMobilize),fmt(x5.enrolled),`${pct(x5.enrolled,x5.mustMobilize).toFixed(2)}%`]});
      return kpiHtml([['Trẻ 3–4 tuổi phải huy động',fmt(a34.mustMobilize)],['3–4 tuổi đến lớp',fmt(a34.enrolled)],['Trẻ 5 tuổi phải huy động',fmt(a5.mustMobilize)],['5 tuổi đến lớp',fmt(a5.enrolled)]])+renderTable([label,'3–4 phải HĐ','3–4 đến lớp','Tỷ lệ','5 tuổi phải HĐ','5 tuổi đến lớp','Tỷ lệ'],rr);
    }
    if(code==='MN-01-TCDK'){
      const rr=rows.map(r=>{const a=r.aggregate||r.payload?.aggregate||{},x=a.age34||{},y=a.age5||{};return [unitName(r),fmt(a.schools),fmt(a.independent),fmt(a.sites),`${pct(x.enrolled,x.mustMobilize).toFixed(2)}%`,`${pct(y.enrolled,y.mustMobilize).toFixed(2)}%`,num(x.teacherRate).toFixed(2),num(y.teacherRate).toFixed(2)]});return kpiHtml([['Số trường',fmt(ag.schools)],['Cơ sở độc lập',fmt(ag.independent)],['Điểm trường',fmt(ag.sites)],['Xã ĐBKK',fmt(ag.specialArea)]])+renderTable([label,'Trường','CS độc lập','Điểm trường','HĐ 3–4','HĐ 5 tuổi','GV/lớp 3–4','GV/lớp 5'],rr);
    }
    if(code==='MN-01-GV'){
      const rr=rows.map(r=>{const a=r.aggregate||r.payload?.aggregate||{};const cls=num(a.age34?.classes)+num(a.age5?.classes),t=num(a.age34?.teachers)+num(a.age5?.teachers);return [unitName(r),fmt(a.staffTotal),fmt(a.managers),fmt(a.teachersTotal),fmt(cls),fmt(t),cls?(t/cls).toFixed(2):'0.00']});return kpiHtml([['CBQL, GV, NV',fmt(ag.staffTotal)],['CBQL',fmt(ag.managers)],['Giáo viên',fmt(ag.teachersTotal)],['Cơ sở',fmt(ag.institutions)]])+renderTable([label,'CBQL+GV+NV','CBQL','GV toàn trường','Lớp MG','GV dạy MG','GV/lớp'],rr);
    }
    if(code==='MN-01-CSVC'){
      const rr=rows.map(r=>{const a=r.aggregate||r.payload?.aggregate||{},cls=num(a.age34Classes)+num(a.age5Classes),rooms=num(a.age34Rooms)+num(a.age5Rooms);return [unitName(r),fmt(a.sites),fmt(cls),fmt(rooms),cls?(rooms/cls).toFixed(2):'0.00',fmt(a.equipped),fmt(a.toiletsStd),fmt(a.waterStd),fmt(a.kitchenStd)]});return kpiHtml([['Điểm/cơ sở',fmt(ag.sites)],['Lớp MG',fmt(num(ag.age34Classes)+num(ag.age5Classes))],['Phòng MG',fmt(num(ag.age34Rooms)+num(ag.age5Rooms))],['Lớp đủ TBDH',fmt(ag.equipped)]])+renderTable([label,'Điểm','Lớp MG','Phòng MG','Phòng/lớp','Đủ TBDH','VS đạt','Nước đạt','Bếp đạt'],rr);
    }
    if(code==='MN-01-TC'){
      const line=ag.lines?.[8]||{};const years=Object.keys(line).filter(k=>k!=='total').sort();const rr=rows.map(r=>{const a=r.aggregate||r.payload?.aggregate||{},l=a.lines?.[8]||{};return [unitName(r),fmt(financeValue(l.total)),...years.map(y=>fmt(financeValue(l[y])))]});return kpiHtml([['Tổng chi GDMN',fmt(financeValue(line.total))],['Số năm',String(years.length)],['Đơn vị nguồn',fmt(rows.length)],['Biểu','MN-01-T. chính']])+renderTable([label,'Tổng',...years],rr);
    }
    if(code==='MN-05-KT'){
      let total=0,access=0;Object.values(ag.ages||{}).forEach(x=>{total+=num(x.total);access+=num(x.access)});const rr=rows.map(r=>{const a=r.aggregate||r.payload?.aggregate||{};let t=0,ac=0;Object.values(a.ages||{}).forEach(x=>{t+=num(x.total);ac+=num(x.access)});return [unitName(r),fmt(t),fmt(ac),`${pct(ac,t).toFixed(2)}%`]});return kpiHtml([['Trẻ khuyết tật 0–5',fmt(total)],['Tiếp cận GD',fmt(access)],['Tỷ lệ',`${pct(access,total).toFixed(2)}%`],['Đơn vị',fmt(rows.length)]])+renderTable([label,'Tổng KT','Tiếp cận GD','Tỷ lệ'],rr);
    }
    const rr=rows.map(r=>{const a=r.aggregate||r.payload?.aggregate||{};return [unitName(r),fmt(a.children),fmt(a.girls),fmt(a.minority),fmt(a.disabled),fmt(a.villages)]});return `<div class="g15-note"><strong>MN-06 được bảo vệ theo nguyên tắc tối thiểu hóa dữ liệu:</strong> tỉnh/toàn quốc không nhận danh sách họ tên. Chỉ tổng hợp số lượng.</div>`+kpiHtml([['Đối tượng 0–5',fmt(ag.children)],['Nữ',fmt(ag.girls)],['DTTS',fmt(ag.minority)],['Khuyết tật',fmt(ag.disabled)]])+renderTable([label,'Đối tượng','Nữ','DTTS','Khuyết tật','Thôn'],rr);
  }

  function cell(ws,addr,v){if(!ws[addr])ws[addr]={t:typeof v==='number'?'n':'s',v:v};else{ws[addr].v=v;ws[addr].t=typeof v==='number'?'n':'s';delete ws[addr].f}}
  function percentCell(ws,addr,v){cell(ws,addr,num(v)/100);ws[addr].z='0.00%';}
  function copyRowStyle(ws,src,dst,maxCol){for(let c=0;c<maxCol;c++){const s=XLSX.utils.encode_cell({r:src-1,c}),d=XLSX.utils.encode_cell({r:dst-1,c});if(ws[s]){const old=ws[d]||{};ws[d]={...old,s:ws[s].s,z:ws[s].z};}}}
  function clearRows(ws,start,end,maxCol){for(let r=start;r<=end;r++)for(let c=0;c<maxCol;c++)delete ws[XLSX.utils.encode_cell({r:r-1,c})];}
  function ensureRef(ws,row,col){const range=XLSX.utils.decode_range(ws['!ref']||'A1:A1');range.e.r=Math.max(range.e.r,row-1);range.e.c=Math.max(range.e.c,col-1);ws['!ref']=XLSX.utils.encode_range(range);}
  async function loadTemplate(meta){const r=await fetch(meta.template,{cache:'no-store'});if(!r.ok)throw new Error(`Không tải được mẫu ${meta.label}.`);return XLSX.read(await r.arrayBuffer(),{type:'array',cellStyles:true,cellDates:true});}
  function scopeAggregateFromRemote(data){return formAggregateFromRows(data)}

  async function exportSelected(){
    const code=selectedCode(),meta=formMeta(code),s=scope();let payload=null,data=null;
    if(s.level==='commune'){const forms=buildAllForms();payload=forms[code];data={rows:[{communeName:s.communeName,provinceName:provinceName(s.provinceKey),payload,aggregate:payload.aggregate}]};}
    else data=await getRemoteForm(code);
    const wb=await loadTemplate(meta),ws=wb.Sheets[wb.SheetNames[0]],ag=payload?.aggregate||scopeAggregateFromRemote(data),rows=data?.rows||[];
    if(code==='MN-01-TE')fillTE(ws,ag,s);else if(code==='MN-01-TCDK')fillTCDK(ws,ag,rows,s);else if(code==='MN-01-GV')fillGV(ws,ag,rows,s);else if(code==='MN-01-CSVC')fillCSVC(ws,ag,rows,s);else if(code==='MN-01-TC')fillFinance(ws,ag,s);else if(code==='MN-05-KT')fillKT(ws,ag,s);else fillSoPC(wb,ws,ag,s);
    const safe=(s.level==='national'?'Toan_quoc':s.level==='province'?String(provinceName(s.provinceKey)).replace(/\s+/g,'_'):clean(s.communeName).replace(/\s+/g,'_'))||'PCGDMN';XLSX.writeFile(wb,`${meta.label.replace(/[^A-Za-z0-9-]/g,'_')}_${safe}_${year()}.xlsx`,{compression:true});setGdmnStatus(`Đã tạo Excel ${meta.label} theo mẫu gốc.`,'ok');
  }
  function scopeText(s){return s.level==='national'?'TOÀN QUỐC':s.level==='province'?provinceName(s.provinceKey):clean(s.communeName);}
  function fillTE(ws,ag,s){cell(ws,'B1',s.level==='commune'?`Xã: ${clean(s.communeName)}`:`Phạm vi: ${scopeText(s)}`);cell(ws,'B2',s.level==='commune'?`Tỉnh: ${provinceName(s.provinceKey)}`:'');cell(ws,'D2',`Thời điểm: năm ${year()}`);for(let a=0;a<=6;a++)cell(ws,XLSX.utils.encode_cell({r:4,c:5+a}),year()-a);const rowKeys={7:'total',8:'female',9:'minority',10:'disabled',11:'disabledCapable',12:'disabledAccess',13:'mustMobilize',14:'enrolled',15:'localEnrolled',16:'outsideEnrolled',17:'rateEnrolled',18:'enrolledFemale',19:'enrolledMinority',20:'preparedVietnamese',21:'fromElsewhere',22:'twoSessions',23:'rateTwo',24:'deaths',25:'movedOut',26:'movedIn',27:'completed',28:'rateCompleted',29:'outsideCompleted'};
    Object.entries(rowKeys).forEach(([r,k])=>{let total=0;for(let a=0;a<=6;a++){const x=ag.ages?.[a]||{};let v=k==='rateEnrolled'?pct(x.enrolled,x.mustMobilize):k==='rateTwo'?pct(x.twoSessions,x.enrolled):k==='rateCompleted'?pct(x.completed,x.enrolled):num(x[k]);const addr=XLSX.utils.encode_cell({r:Number(r)-1,c:5+a});if(k.startsWith('rate'))percentCell(ws,addr,v);else cell(ws,addr,v);if(a<=5&&!k.startsWith('rate'))total+=num(v)}const m=`M${r}`;if(k==='rateEnrolled')percentCell(ws,m,pct([0,1,2,3,4,5].reduce((t,a)=>t+num(ag.ages?.[a]?.enrolled),0),[0,1,2,3,4,5].reduce((t,a)=>t+num(ag.ages?.[a]?.mustMobilize),0)));else if(k==='rateTwo')percentCell(ws,m,pct([0,1,2,3,4,5].reduce((t,a)=>t+num(ag.ages?.[a]?.twoSessions),0),[0,1,2,3,4,5].reduce((t,a)=>t+num(ag.ages?.[a]?.enrolled),0)));else if(k==='rateCompleted')percentCell(ws,m,pct([3,4,5].reduce((t,a)=>t+num(ag.ages?.[a]?.completed),0),[3,4,5].reduce((t,a)=>t+num(ag.ages?.[a]?.enrolled),0)));else cell(ws,m,total)});
    const c=ag.criteria||{};[[33,'fiveEnrolled','fiveEnrolledRate'],[34,'sixCompleted','sixCompletedRate'],[35,'fiveDisabledAccess','fiveDisabledAccessRate'],[36,'fiveTwoSessions','fiveTwoSessionsRate'],[38,'age34Enrolled','age34EnrolledRate'],[39,'age34Completed','age34CompletedRate'],[40,'age34TwoSessions','age34TwoSessionsRate']].forEach(([r,k,p])=>{cell(ws,`E${r}`,num(c[k]));percentCell(ws,`F${r}`,num(c[p]))});}
  function agTcdkRow(a){return [num(a.classesTotal),num(a.classesSingle),num(a.classesCombined),num(a.mustMobilize),num(a.enrolled),pct(a.enrolled,a.mustMobilize),num(a.completed),pct(a.completed,a.enrolled),num(a.disabled),num(a.disabledCapable),num(a.disabledAccess),pct(a.disabledAccess,a.disabledCapable),num(a.teacherRate),num(a.roomRate),num(a.equipped)];}
  function fillTCDK(ws,ag,rows,s){cell(ws,'A1',s.level==='commune'?`Xã: ${clean(s.communeName)}`:`Phạm vi: ${scopeText(s)}`);cell(ws,'A2',`Năm ${year()}`);clearRows(ws,8,1200,22);let r=8;const put=(tt,name,a34,a5,meta={})=>{copyRowStyle(ws,8,r,22);cell(ws,`A${r}`,tt||'');cell(ws,`B${r}`,name);if(meta.specialArea)cell(ws,`C${r}`,'x');cell(ws,`D${r}`,num(meta.schools));cell(ws,`E${r}`,num(meta.independent));cell(ws,`F${r}`,num(meta.sites));r++;for(const [lbl,a] of [[' - Độ tuổi 3, 4 tuổi',a34||{}],[' - Độ tuổi 5 tuổi',a5||{}]]){copyRowStyle(ws,lbl.includes('3, 4')?9:10,r,22);cell(ws,`B${r}`,lbl);const vals=agTcdkRow(a);for(let i=0;i<vals.length;i++){const col=6+i,addr=XLSX.utils.encode_cell({r:r-1,c:col});if([5,7,11].includes(i))percentCell(ws,addr,num(vals[i]));else cell(ws,addr,vals[i])}r++}};put('',s.level==='national'?'TOÀN QUỐC':s.level==='province'?'TOÀN TỈNH':clean(s.communeName),ag.age34,ag.age5,ag);if(s.level!=='commune')rows.forEach((x,i)=>{const a=x.aggregate||x.payload?.aggregate||{};put(i+1,unitName(x),a.age34,a.age5,a)});ensureRef(ws,r+4,22);cell(ws,`Q${r+2}`,'Ngày.... tháng.... năm....');cell(ws,`B${r+3}`,'NGƯỜI LẬP BIỂU');cell(ws,`Q${r+3}`,'TM. BAN CHỈ ĐẠO PCGD-XMC');}
  function gvAgeArray(a){return [num(a.classes),num(a.teachers),num(a.teacherContract),num(a.policy),num(a.classes)?num(a.teachers)/num(a.classes):0,num(a.standard),num(a.above),num(a.teachers)?(num(a.standard)+num(a.above))/num(a.teachers):0,num(a.professional),num(a.teachers)?num(a.professional)/num(a.teachers):0];}
  function fillGV(ws,ag,rows,s){cell(ws,'A1',s.level==='commune'?`Xã: ${clean(s.communeName)}`:`Phạm vi: ${scopeText(s)}`);cell(ws,'A2',`Tỉnh/Năm: ${s.level==='national'?'Toàn quốc':provinceName(s.provinceKey)} · ${year()}`);clearRows(ws,8,1500,19);let r=8;const put=(tt,name,a,details)=>{copyRowStyle(ws,8,r,19);cell(ws,`A${r}`,tt||'');cell(ws,`B${r}`,name);['staffTotal','staffContract','managers','teachersTotal'].forEach((k,j)=>cell(ws,XLSX.utils.encode_cell({r:r-1,c:2+j}),num(a[k])));const cls=num(a.age34?.classes)+num(a.age5?.classes);percentCell(ws,`G${r}`,cls?pct(a.teachersTotal,cls):0);cell(ws,`H${r}`,num(a.staffOther));r++;for(const [lbl,g] of [['3, 4 tuổi',a.age34||{}],['5 tuổi',a.age5||{}]]){copyRowStyle(ws,lbl==='3, 4 tuổi'?9:10,r,19);cell(ws,`I${r}`,lbl);const vals=gvAgeArray(g);cell(ws,`J${r}`,vals[0]);cell(ws,`K${r}`,vals[1]);cell(ws,`L${r}`,vals[2]);cell(ws,`M${r}`,vals[3]);percentCell(ws,`N${r}`,vals[4]*100);cell(ws,`O${r}`,vals[5]);cell(ws,`P${r}`,vals[6]);percentCell(ws,`Q${r}`,vals[7]*100);cell(ws,`R${r}`,vals[8]);percentCell(ws,`S${r}`,vals[9]*100);r++}};put('',s.level==='national'?'TOÀN QUỐC':s.level==='province'?'TOÀN TỈNH':clean(s.communeName),ag);if(s.level==='commune'){const p=buildGV(loadState());p.details.institutions.forEach((x,i)=>put(i+1,x.name,x))}else if(s.level==='province'){rows.forEach(x=>(x.payload?.details?.institutions||[]).forEach((d,i)=>put('',`${d.name} · ${x.communeName||''}`,d)))}else rows.forEach((x,i)=>put(i+1,unitName(x),x.aggregate||{}));ensureRef(ws,r+4,19);cell(ws,`N${r+2}`,'Ngày.... tháng.... năm....');cell(ws,`B${r+3}`,'Người lập biểu');cell(ws,`N${r+3}`,'TM. BAN CHỈ ĐẠO PCGD-XMC');}
  function fillCSVC(ws,ag,rows,s){cell(ws,'A1',s.level==='commune'?`Xã: ${clean(s.communeName)}`:`Phạm vi: ${scopeText(s)}`);cell(ws,'A2',`Năm: ${year()}`);clearRows(ws,9,1500,24);let r=9;const put=(tt,name,a)=>{copyRowStyle(ws,9,r,24);cell(ws,`A${r}`,tt||'');cell(ws,`B${r}`,name);cell(ws,`C${r}`,num(a.institutions||1));cell(ws,`D${r}`,num(a.branchSites));cell(ws,`E${r}`,num(a.classesTotal||num(a.nurseryClasses)+num(a.age34Classes)+num(a.age5Classes)));cell(ws,`F${r}`,num(a.nurseryClasses));r++;for(const [lbl,cls,rooms] of [['3, 4 tuổi',num(a.age34Classes),num(a.age34Rooms)],['5 tuổi',num(a.age5Classes),num(a.age5Rooms)]]){copyRowStyle(ws,lbl==='3, 4 tuổi'?9:10,r,24);cell(ws,`G${r}`,lbl);cell(ws,`H${r}`,cls);cell(ws,`I${r}`,num(a.roomsTotal));cell(ws,`J${r}`,num(a.nurseryRooms));cell(ws,`K${r}`,rooms);percentCell(ws,`L${r}`,cls?pct(rooms,cls):0);cell(ws,`M${r}`,num(a.permanent));cell(ws,`N${r}`,num(a.semi));cell(ws,`O${r}`,num(a.temporary));cell(ws,`P${r}`,num(a.equipped));cell(ws,`Q${r}`,num(a.toilets));cell(ws,`R${r}`,num(a.toiletsStd));cell(ws,`S${r}`,num(a.water));cell(ws,`T${r}`,num(a.waterStd));cell(ws,`U${r}`,num(a.kitchen));cell(ws,`V${r}`,num(a.kitchenStd));cell(ws,`W${r}`,num(a.playground));cell(ws,`X${r}`,num(a.playgroundToys));r++}};put('',s.level==='national'?'TOÀN QUỐC':s.level==='province'?'TOÀN TỈNH':clean(s.communeName),ag);if(s.level==='commune'){buildCSVC(loadState()).details.institutions.forEach((x,i)=>put(i+1,x.name,x))}else if(s.level==='province'){rows.forEach(x=>(x.payload?.details?.institutions||[]).forEach(d=>put('',`${d.name} · ${x.communeName||''}`,d)))}else rows.forEach((x,i)=>put(i+1,unitName(x),x.aggregate||{}));ensureRef(ws,r+4,24);cell(ws,`R${r+2}`,'Ngày.... tháng.... năm....');cell(ws,`B${r+3}`,'Người lập biểu');cell(ws,`R${r+3}`,'TM. BAN CHỈ ĐẠO PCGD-XMC');}
  function fillFinance(ws,ag,s){cell(ws,'A3',`Tên đơn vị: ${scopeText(s)}`);cell(ws,'D2',`Năm: ${year()}`);const first=ag.lines?.[8]||{},ys=Object.keys(first).filter(k=>k!=='total').sort((a,b)=>Number(a)-Number(b));ys.slice(0,5).forEach((y,i)=>cell(ws,XLSX.utils.encode_cell({r:5,c:4+i}),Number(y)));Object.keys(FINANCE_ROWS).forEach(r=>{const l=ag.lines?.[r]||{};cell(ws,`D${r}`,financeValue(l.total));ys.slice(0,5).forEach((y,i)=>cell(ws,XLSX.utils.encode_cell({r:Number(r)-1,c:4+i}),financeValue(l[y])))});}
  function fillKT(ws,ag,s){cell(ws,'A1',s.level==='commune'?`UBND XÃ: ${clean(s.communeName)}`:`PHẠM VI: ${scopeText(s)}`);cell(ws,'G3',`Năm: ${year()}`);let total={total:0,movement:0,hearing:0,vision:0,neuro:0,intellectual:0,autism:0,learning:0,other:0,access:0};for(let a=0;a<=5;a++){const x=ag.ages?.[a]||{};cell(ws,`A${7+a}`,year()-a);cell(ws,`B${7+a}`,a);const vals=[x.total,x.movement,x.hearing,x.vision,x.neuro,x.intellectual,x.autism,x.learning,x.other,x.access];for(let i=0;i<vals.length;i++)cell(ws,XLSX.utils.encode_cell({r:6+a,c:2+i}),num(vals[i]));percentCell(ws,`M${7+a}`,pct(x.access,x.total));Object.keys(total).forEach(k=>total[k]+=num(x[k]))}const vals=[total.total,total.movement,total.hearing,total.vision,total.neuro,total.intellectual,total.autism,total.learning,total.other,total.access];for(let i=0;i<vals.length;i++)cell(ws,XLSX.utils.encode_cell({r:12,c:2+i}),vals[i]);percentCell(ws,'M13',pct(total.access,total.total));}
  function fillSoPC(wb,ws,ag,s){cell(ws,'A1',`Tỉnh/TP: ${s.level==='national'?'Toàn quốc':provinceName(s.provinceKey)}`);cell(ws,'A2',s.level==='commune'?`Xã/phường: ${clean(s.communeName)}`:`Phạm vi: ${scopeText(s)}`);cell(ws,'A3',`Năm học: ${schoolYear(year()+1)}`);if(s.level==='commune'){const rs=(global.PCGDLastResult?.records||[]).filter(r=>num(r.age)>=0&&num(r.age)<=5);clearRows(ws,11,1000,16);let row=11;rs.forEach((r,i)=>{copyRowStyle(ws,11,row,16);cell(ws,`A${row}`,i+1);cell(ws,`B${row}`,clean(r.ticket));cell(ws,`C${row}`,clean(r.name));const d=[clean(r.raw?.[4]),clean(r.raw?.[5]),clean(r.birthYear)].filter(Boolean).join('/');cell(ws,`D${row}`,d);cell(ws,`E${row}`,isFemale(r)?'x':'');cell(ws,`F${row}`,clean(r.village));cell(ws,`G${row}`,ethnicity(r));cell(ws,`H${row}`,clean(r.raw?.[48]));const age=num(r.age),col=Math.min(13,8+Math.max(0,Math.min(5,age)));cell(ws,XLSX.utils.encode_cell({r:row-1,c:col}),enrolledMN(r)?clean(r.className||r.raw?.[18]||'X'):'');cell(ws,`O${row}`,clean(r.school||r.raw?.[20]));cell(ws,`P${row}`,r.br===1?'Khuyết tật':'' );row++});cell(ws,`B${row+1}`,`Tổng số đối tượng: ${rs.length}`);cell(ws,`K${row+1}`,'Ngày....tháng....năm....');cell(ws,`K${row+2}`,'TM. BAN CHỈ ĐẠO PCGD-XMC');cell(ws,`C${row+3}`,'NGƯỜI LẬP BIỂU');ensureRef(ws,row+4,16);}else{clearRows(ws,11,16,16);cell(ws,'B11',`Cấp ${s.level==='national'?'toàn quốc':'tỉnh'} không nhận danh sách cá nhân.`);cell(ws,'B12',`Tổng số đối tượng 0–5 tuổi: ${fmt(ag.children)}`);cell(ws,'B13',`Nữ: ${fmt(ag.girls)} · DTTS: ${fmt(ag.minority)} · Khuyết tật: ${fmt(ag.disabled)}`);const sh=XLSX.utils.aoa_to_sheet([['Đơn vị','Số đối tượng','Nữ','DTTS','Khuyết tật','Số thôn'],[scopeText(s),num(ag.children),num(ag.girls),num(ag.minority),num(ag.disabled),num(ag.villages)]]);XLSX.utils.book_append_sheet(wb,sh,'TongHopDonVi');}}

  function bindGlobal(){
    const lvl=$('managementLevel');if(lvl&&!lvl.dataset.g15Bound){lvl.dataset.g15Bound='1';lvl.addEventListener('change',()=>setTimeout(applyLevelUi,0))}
    const save=$('saveManagementScope');if(save&&!save.dataset.g15Bound){save.dataset.g15Bound='1';save.addEventListener('click',()=>setTimeout(applyLevelUi,0))}
    const yr=$('yearInput');if(yr&&!yr.dataset.g15Bound){yr.dataset.g15Bound='1';yr.addEventListener('change',()=>{closeEditor();renderCurrent()})}
    const analyze=$('analyzeBtn');if(analyze&&!analyze.dataset.g15Bound){analyze.dataset.g15Bound='1';analyze.addEventListener('click',()=>setTimeout(renderCurrent,1200))}
  }
  function init(){ensureStyles();ensurePanel();bindGlobal();applyLevelUi();flushPending();global.addEventListener('online',flushPending);setTimeout(()=>{ensurePanel();bindGlobal();applyLevelUi()},350);global.PCGDGdmnForms={VERSION,FORMS,buildAllForms,buildTE,buildKT,buildGV,buildCSVC,buildFinance,syncForms,getRemoteForm,renderCurrent,exportSelected,deepSum};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
