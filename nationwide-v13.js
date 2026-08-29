(function(global){
  'use strict';

  const VERSION='1.3.0';
  const DB_NAME='pcgdxmc-national-v1';
  const DB_VERSION=1;
  const STORE_SUMMARIES='summaries';
  const STORE_QUEUE='queue';
  const API_KEY='pcgdxmc_api_base';
  const TOKEN_KEY='pcgdxmc_api_token';
  const SCOPE_KEY='pcgdxmc_management_scope';

  // Danh mục 34 tỉnh/thành sau sắp xếp 2025. key là mã nội bộ ổn định của ứng dụng, không phải mã hành chính quốc gia.
  const PROVINCES=[
    ['ha-noi','Thành phố Hà Nội'],['tuyen-quang','Tỉnh Tuyên Quang'],['lao-cai','Tỉnh Lào Cai'],['thai-nguyen','Tỉnh Thái Nguyên'],
    ['phu-tho','Tỉnh Phú Thọ'],['bac-ninh','Tỉnh Bắc Ninh'],['hung-yen','Tỉnh Hưng Yên'],['hai-phong','Thành phố Hải Phòng'],
    ['ninh-binh','Tỉnh Ninh Bình'],['cao-bang','Tỉnh Cao Bằng'],['dien-bien','Tỉnh Điện Biên'],['lai-chau','Tỉnh Lai Châu'],
    ['son-la','Tỉnh Sơn La'],['lang-son','Tỉnh Lạng Sơn'],['quang-ninh','Tỉnh Quảng Ninh'],['thanh-hoa','Tỉnh Thanh Hóa'],
    ['nghe-an','Tỉnh Nghệ An'],['ha-tinh','Tỉnh Hà Tĩnh'],['quang-tri','Tỉnh Quảng Trị'],['hue','Thành phố Huế'],
    ['da-nang','Thành phố Đà Nẵng'],['quang-ngai','Tỉnh Quảng Ngãi'],['gia-lai','Tỉnh Gia Lai'],['dak-lak','Tỉnh Đắk Lắk'],
    ['khanh-hoa','Tỉnh Khánh Hòa'],['lam-dong','Tỉnh Lâm Đồng'],['ho-chi-minh','Thành phố Hồ Chí Minh'],['dong-nai','Tỉnh Đồng Nai'],
    ['tay-ninh','Tỉnh Tây Ninh'],['can-tho','Thành phố Cần Thơ'],['vinh-long','Tỉnh Vĩnh Long'],['dong-thap','Tỉnh Đồng Tháp'],
    ['an-giang','Tỉnh An Giang'],['ca-mau','Tỉnh Cà Mau']
  ].map(([key,name])=>({key,name}));

  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0);
  const pct=n=>`${(Number(n)||0).toFixed(2).replace('.',',')}%`;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const nowIso=()=>new Date().toISOString();
  const clean=v=>String(v||'').replace(/\s+/g,' ').trim();

  function getScope(){
    try{return {...{level:'commune',provinceKey:'thai-nguyen',communeCode:'',communeName:''},...JSON.parse(localStorage.getItem(SCOPE_KEY)||'{}')}}
    catch(_){return {level:'commune',provinceKey:'thai-nguyen',communeCode:'',communeName:''}}
  }
  function saveScope(s){localStorage.setItem(SCOPE_KEY,JSON.stringify(s));}
  function apiBase(){return clean(localStorage.getItem(API_KEY)||'').replace(/\/$/,'');}
  function apiToken(){return clean(localStorage.getItem(TOKEN_KEY)||'');}
  function year(){return Number($('yearInput')?.value)||new Date().getFullYear();}
  function provinceName(key){return PROVINCES.find(p=>p.key===key)?.name||key||'';}

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE_SUMMARIES))db.createObjectStore(STORE_SUMMARIES,{keyPath:'scopeKey'});
        if(!db.objectStoreNames.contains(STORE_QUEUE))db.createObjectStore(STORE_QUEUE,{keyPath:'id',autoIncrement:true});
      };
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  async function dbPut(store,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>{db.close();resolve(value)};tx.onerror=()=>{db.close();reject(tx.error)}})}
  async function dbAdd(store,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).add(value);tx.oncomplete=()=>{db.close();resolve(value)};tx.onerror=()=>{db.close();reject(tx.error)}})}
  async function dbAll(store){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).getAll();req.onsuccess=()=>{db.close();resolve(req.result||[])};req.onerror=()=>{db.close();reject(req.error)}})}
  async function dbDelete(store,key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}

  async function digestText(text){
    if(!global.crypto?.subtle)return '';
    const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  function compactMetrics(summary){
    const s=summary||{};
    return {
      total:Number(s.total)||0,households:Number(s.households)||0,villages:Number(s.villages)||0,
      aged1518:Number(s.aged1518)||0,tn1518:Number(s.tn1518)||0,age1560:Number(s.age1560)||0,mc1560:Number(s.mc1560)||0,
      disabilities:Number(s.disabilities)||0,issues:Number(s.issues)||0,errorIssues:Number(s.errorIssues)||0,warningIssues:Number(s.warningIssues)||0,
      schoolErrors:Number(s.schoolErrors)||0,
      ageBands:{...(s.ageBands||{})}
    };
  }

  async function currentCommuneSummary(){
    const result=global.PCGDLastResult;
    if(!result?.summary)throw new Error('Hãy phân tích dữ liệu cấp xã trước khi đồng bộ.');
    const scope=getScope();
    if(!scope.provinceKey)throw new Error('Chưa chọn tỉnh/thành.');
    if(!clean(scope.communeName))throw new Error('Chưa nhập tên xã/phường/đặc khu.');
    const metrics=compactMetrics(result.summary);
    const payload={
      schemaVersion:1,appVersion:VERSION,year:year(),provinceKey:scope.provinceKey,provinceName:provinceName(scope.provinceKey),
      communeCode:clean(scope.communeCode),communeName:clean(scope.communeName),scopeLevel:'commune',metrics,
      generatedAt:nowIso(),sourceCount:Number(result.summary.files)||0
    };
    payload.scopeKey=`${payload.year}|${payload.provinceKey}|${payload.communeCode||payload.communeName.toLocaleLowerCase('vi')}`;
    payload.checksum=await digestText(JSON.stringify(payload));
    return payload;
  }

  async function saveSummaryLocal(summary){await dbPut(STORE_SUMMARIES,summary);return summary;}
  async function queueSummary(summary,reason){await dbAdd(STORE_QUEUE,{kind:'summary-upsert',summary,reason:clean(reason),createdAt:nowIso()});updateNetworkBadge();}

  async function request(path,opts={}){
    const base=apiBase();if(!base)throw new Error('Chưa cấu hình máy chủ API.');
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),opts.timeout||12000);
    const headers={'Accept':'application/json',...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})};
    const token=apiToken();if(token)headers.Authorization=`Bearer ${token}`;
    try{
      const res=await fetch(`${base}${path}`,{...opts,headers,signal:controller.signal});
      if(!res.ok)throw new Error(`API ${res.status}: ${(await res.text()).slice(0,180)}`);
      if(res.status===204)return null;return await res.json();
    }finally{clearTimeout(timeout)}
  }

  async function postSummary(summary){return request('/v1/summaries/upsert',{method:'POST',body:JSON.stringify(summary),timeout:15000});}

  async function syncCurrent(){
    setSyncStatus('Đang chuẩn bị gói tổng hợp…','info');
    const summary=await currentCommuneSummary();await saveSummaryLocal(summary);
    if(!navigator.onLine||!apiBase()){
      await queueSummary(summary,!navigator.onLine?'offline':'api-not-configured');
      setSyncStatus('Đã lưu gói tổng hợp trên máy; sẽ đồng bộ khi có mạng/máy chủ.','warn');
      await renderAggregate();return;
    }
    try{await postSummary(summary);setSyncStatus('Đồng bộ số liệu xã thành công.','ok')}
    catch(e){await queueSummary(summary,e.message);setSyncStatus('Mạng/máy chủ chưa sẵn sàng; gói đã xếp hàng an toàn.','warn')}
    await renderAggregate();
  }

  async function flushQueue(){
    if(!navigator.onLine||!apiBase())return;
    const items=await dbAll(STORE_QUEUE);if(!items.length){updateNetworkBadge();return;}
    for(const item of items){
      if(item.kind!=='summary-upsert')continue;
      try{await postSummary(item.summary);await dbDelete(STORE_QUEUE,item.id)}catch(_){break}
    }
    updateNetworkBadge();
  }

  function sumMetrics(items){
    const out={total:0,households:0,villages:0,aged1518:0,tn1518:0,age1560:0,mc1560:0,disabilities:0,issues:0,errorIssues:0,warningIssues:0,schoolErrors:0,ageBands:{}};
    items.forEach(x=>{
      const m=x.metrics||x;
      ['total','households','villages','aged1518','tn1518','age1560','mc1560','disabilities','issues','errorIssues','warningIssues','schoolErrors'].forEach(k=>out[k]+=Number(m[k])||0);
      Object.entries(m.ageBands||{}).forEach(([k,v])=>out.ageBands[k]=(out.ageBands[k]||0)+(Number(v)||0));
    });
    out.rate1518=out.aged1518?Math.round(out.tn1518/out.aged1518*10000)/100:0;
    out.notMcRate=out.age1560?Math.round((out.age1560-out.mc1560)/out.age1560*10000)/100:0;
    return out;
  }

  async function localAggregate(scope){
    const all=(await dbAll(STORE_SUMMARIES)).filter(x=>Number(x.year)===year());
    let rows=all;
    if(scope.level==='province')rows=rows.filter(x=>x.provinceKey===scope.provinceKey);
    if(scope.level==='commune')rows=rows.filter(x=>x.provinceKey===scope.provinceKey&&(scope.communeCode?x.communeCode===scope.communeCode:x.communeName===scope.communeName));
    return {source:'local',year:year(),level:scope.level,rows,metrics:sumMetrics(rows)};
  }

  async function serverAggregate(scope){
    const q=new URLSearchParams({level:scope.level,year:String(year())});
    if(scope.level!=='national'&&scope.provinceKey)q.set('province',scope.provinceKey);
    if(scope.level==='commune'&&scope.communeCode)q.set('commune',scope.communeCode);
    return request(`/v1/aggregates?${q.toString()}`,{method:'GET',timeout:12000});
  }

  async function getAggregate(){
    const scope=getScope();
    if(navigator.onLine&&apiBase()){
      try{return await serverAggregate(scope)}catch(e){setSyncStatus(`Không lấy được tổng hợp máy chủ; dùng bộ nhớ cục bộ. ${e.message}`,'warn')}
    }
    return localAggregate(scope);
  }

  function aggregateRows(data,scope){
    const rows=Array.isArray(data.rows)?data.rows:[];
    if(scope.level==='national'){
      const map=new Map();rows.forEach(r=>{const k=r.provinceKey||'unknown';const list=map.get(k)||[];list.push(r);map.set(k,list)});
      return [...map.entries()].map(([key,list])=>({label:provinceName(key),provinceKey:key,communes:list.length,metrics:sumMetrics(list)})).sort((a,b)=>a.label.localeCompare(b.label,'vi'));
    }
    if(scope.level==='province')return rows.map(r=>({label:r.communeName||r.communeCode||'Chưa đặt tên',communes:1,metrics:r.metrics||{}})).sort((a,b)=>a.label.localeCompare(b.label,'vi'));
    return rows.map(r=>({label:r.communeName||'Xã/phường',communes:1,metrics:r.metrics||{}}));
  }

  async function renderAggregate(){
    const panel=$('nationalAggregatePanel');if(!panel)return;
    const scope=getScope();panel.style.display='block';
    $('nationalAggregateTitle').textContent=scope.level==='national'?'Tổng hợp toàn quốc':scope.level==='province'?`Tổng hợp ${provinceName(scope.provinceKey)}`:`Tổng hợp ${scope.communeName||'cấp xã'}`;
    $('nationalAggregateBody').innerHTML='<div class="nat-loading">Đang nạp số liệu tổng hợp nhẹ…</div>';
    try{
      const data=await getAggregate(),m=data.metrics||sumMetrics(data.rows||[]),rows=aggregateRows(data,scope);
      $('nationalAggregateKpis').innerHTML=[
        ['Nhân khẩu',fmt(m.total)],['Hộ/phiếu',fmt(m.households)],['15–18 TN THCS',`${fmt(m.tn1518)} / ${fmt(m.aged1518)}`],['Tỷ lệ TN THCS',pct(m.rate1518)],['15–60 không gắn MC',pct(m.notMcRate)],['Lỗi/cảnh báo',fmt(m.issues)]
      ].map(x=>`<div class="nat-kpi"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join('');
      const shown=rows.slice(0,200);
      $('nationalAggregateBody').innerHTML=shown.length?`<div class="nat-table-wrap"><table><thead><tr><th>Đơn vị</th><th>Số xã</th><th>Nhân khẩu</th><th>Hộ</th><th>15–18</th><th>TN THCS</th><th>Tỷ lệ</th><th>15–60</th><th>Mù chữ</th><th>Cảnh báo</th></tr></thead><tbody>${shown.map(r=>{const x=r.metrics||{};const rate=(Number(x.aged1518)||0)?Number(x.tn1518||0)/Number(x.aged1518)*100:0;return `<tr><td>${esc(r.label)}</td><td>${fmt(r.communes)}</td><td>${fmt(x.total)}</td><td>${fmt(x.households)}</td><td>${fmt(x.aged1518)}</td><td>${fmt(x.tn1518)}</td><td>${pct(rate)}</td><td>${fmt(x.age1560)}</td><td>${fmt(x.mc1560)}</td><td>${fmt(x.issues)}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="nat-empty">Chưa có gói tổng hợp cho phạm vi này. Ở cấp xã, hãy phân tích dữ liệu rồi bấm “Đồng bộ số liệu xã”.</div>';
      $('nationalAggregateMeta').textContent=`Nguồn: ${data.source==='local'?'bộ nhớ thiết bị':'máy chủ'} · Năm ${year()} · ${rows.length} đơn vị hiển thị`;
    }catch(e){$('nationalAggregateBody').innerHTML=`<div class="nat-empty">${esc(e.message)}</div>`}
  }

  async function exportBundle(){
    const scope=getScope(),data=await localAggregate(scope),bundle={schema:'pcgdxmc-summary-bundle',version:1,exportedAt:nowIso(),scope,year:year(),summaries:data.rows};
    const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`PCGDXMC_${scope.level}_${year()}_tonghop.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  }

  async function importBundle(file){
    const text=await file.text(),bundle=JSON.parse(text);if(bundle.schema!=='pcgdxmc-summary-bundle'||!Array.isArray(bundle.summaries))throw new Error('Không đúng gói tổng hợp PCGD-XMC.');
    for(const s of bundle.summaries){if(s?.scopeKey&&s?.metrics)await saveSummaryLocal(s)}
    setSyncStatus(`Đã nhập ${bundle.summaries.length} gói tổng hợp.`, 'ok');await renderAggregate();
  }

  function setSyncStatus(text,kind='info'){const el=$('nationalSyncStatus');if(!el)return;el.textContent=text;el.dataset.kind=kind;}

  async function updateNetworkBadge(){
    const el=$('nationalNetwork');if(!el)return;
    let queued=0;try{queued=(await dbAll(STORE_QUEUE)).length}catch(_){}
    const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const net=navigator.onLine?(c?.effectiveType?String(c.effectiveType).toUpperCase():'ONLINE'):'OFFLINE';
    el.textContent=`${navigator.onLine?'●':'○'} ${net}${queued?` · ${queued} chờ đồng bộ`:''}`;el.dataset.online=navigator.onLine?'1':'0';
  }

  function applyScopeFromUi(){
    const s={level:$('managementLevel').value,provinceKey:$('provinceSelect').value,communeCode:clean($('communeCode').value),communeName:clean($('communeName').value)};saveScope(s);updateScopeUi();setSyncStatus('Đã lưu phạm vi quản lý trên thiết bị.','ok');renderAggregate();
  }

  function updateScopeUi(){
    const s=getScope(),isNat=s.level==='national',isProvince=s.level==='province';
    $('managementLevel').value=s.level;$('provinceSelect').value=s.provinceKey||PROVINCES[0].key;$('communeCode').value=s.communeCode||'';$('communeName').value=s.communeName||'';
    $('provinceSelect').disabled=isNat;$('communeCode').disabled=isNat||isProvince;$('communeName').disabled=isNat||isProvince;
    $('syncCommuneBtn').disabled=s.level!=='commune';
  }

  function saveApiConfig(){localStorage.setItem(API_KEY,clean($('apiBaseInput').value));localStorage.setItem(TOKEN_KEY,clean($('apiTokenInput').value));setSyncStatus(apiBase()?'Đã lưu cấu hình API. Có thể kiểm tra kết nối.':'Đã chuyển sang chế độ cục bộ/offline.','ok');flushQueue();renderAggregate();}
  async function testApi(){
    if(!apiBase()){setSyncStatus('Chưa nhập URL API.','warn');return}
    setSyncStatus('Đang kiểm tra API…','info');try{const r=await request('/v1/health',{method:'GET',timeout:8000});setSyncStatus(`API sẵn sàng${r?.version?` · ${r.version}`:''}.`,'ok');flushQueue()}catch(e){setSyncStatus(`Chưa kết nối được API: ${e.message}`,'warn')}
  }

  function injectStyles(){
    const st=document.createElement('style');st.textContent=`
      #nationalScopePanel{margin-bottom:12px}.nat-head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}.nat-title h3{margin:0 0 3px;font-size:16px}.nat-title p{margin:0;color:var(--muted);font-size:12px}.nat-grid{display:grid;grid-template-columns:1.1fr 1.5fr 1fr 1.6fr auto;gap:8px;align-items:end;margin-top:12px}.nat-field{display:flex;flex-direction:column;gap:4px}.nat-field label{font-size:11px;color:var(--muted);font-weight:700}.nat-field input,.nat-field select{height:36px;border:1px solid var(--border,#ccd6dc);border-radius:7px;padding:0 9px;background:#fff}.nat-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.nat-actions button{min-height:34px}.nat-network{font-size:11px;font-weight:800;padding:5px 8px;border-radius:999px;background:#e8f6ee;color:#1b6b3b}.nat-network[data-online="0"]{background:#fff2df;color:#9a5b00}.nat-status{font-size:11px;margin-top:8px;padding:7px 9px;border-radius:6px;background:#eef5f8;color:#31515e}.nat-status[data-kind="ok"]{background:#e9f7ef;color:#176c3a}.nat-status[data-kind="warn"]{background:#fff4e5;color:#8b5300}.nat-config{margin-top:9px;border-top:1px dashed #cfd9de;padding-top:7px}.nat-config summary{cursor:pointer;font-size:11px;font-weight:700;color:#4c6875}.nat-config-grid{display:grid;grid-template-columns:2fr 1.5fr auto auto;gap:7px;align-items:end;margin-top:8px}.nat-kpis{display:grid;grid-template-columns:repeat(6,minmax(110px,1fr));gap:8px;margin:10px 0}.nat-kpi{border:1px solid #d5e0e5;border-radius:8px;padding:9px;background:#fff}.nat-kpi span{display:block;font-size:10px;color:#647985}.nat-kpi strong{display:block;font-size:18px;margin-top:3px}.nat-table-wrap{overflow:auto;max-height:480px;border:1px solid #d7e0e5;border-radius:7px}.nat-table-wrap table{width:100%;border-collapse:collapse;font-size:11px}.nat-table-wrap th{position:sticky;top:0;background:#edf4f7;z-index:1}.nat-table-wrap th,.nat-table-wrap td{padding:7px;border-bottom:1px solid #e1e8eb;text-align:right;white-space:nowrap}.nat-table-wrap th:first-child,.nat-table-wrap td:first-child{text-align:left}.nat-meta{font-size:11px;color:#687e89}.nat-empty,.nat-loading{padding:16px;color:#6d8089;text-align:center}
      @media(max-width:900px){.nat-grid{grid-template-columns:1fr 1fr}.nat-grid .nat-save{grid-column:span 2}.nat-kpis{grid-template-columns:repeat(3,1fr)}.nat-config-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.nat-grid,.nat-config-grid{grid-template-columns:1fr}.nat-grid .nat-save{grid-column:auto}.nat-kpis{grid-template-columns:1fr 1fr}.nat-actions button{flex:1 1 45%}.nat-network{font-size:10px}}
    `;document.head.appendChild(st);
  }

  function injectUi(){
    const main=document.querySelector('main.shell'),anchor=document.querySelector('.import-panel');if(!main||!anchor||$('nationalScopePanel'))return;
    const panel=document.createElement('section');panel.id='nationalScopePanel';panel.className='panel';panel.innerHTML=`
      <div class="nat-head"><div class="nat-title"><h3>Phạm vi quản lý PCGD-XMC</h3><p>Giữ dữ liệu chi tiết ở cấp được phân quyền; tỉnh/toàn quốc chỉ tải số liệu tổng hợp nhẹ.</p></div><span id="nationalNetwork" class="nat-network">● ONLINE</span></div>
      <div class="nat-grid">
        <div class="nat-field"><label>Cấp quản lý</label><select id="managementLevel"><option value="commune">Xã / phường / đặc khu</option><option value="province">Tỉnh / thành phố</option><option value="national">Toàn quốc</option></select></div>
        <div class="nat-field"><label>Tỉnh / thành phố</label><select id="provinceSelect">${PROVINCES.map(p=>`<option value="${p.key}">${esc(p.name)}</option>`).join('')}</select></div>
        <div class="nat-field"><label>Mã xã (nếu có)</label><input id="communeCode" autocomplete="off" placeholder="Ví dụ: 00123"></div>
        <div class="nat-field"><label>Tên xã / phường / đặc khu</label><input id="communeName" autocomplete="off" placeholder="Ví dụ: Xã Na Rì"></div>
        <button id="saveManagementScope" class="secondary nat-save" type="button">Lưu phạm vi</button>
      </div>
      <div class="nat-actions"><button id="syncCommuneBtn" class="primary" type="button">Đồng bộ số liệu xã</button><button id="refreshAggregateBtn" class="secondary" type="button">Làm mới tổng hợp</button><button id="exportSummaryBundleBtn" class="secondary" type="button">Xuất gói tổng hợp</button><button id="importSummaryBundleBtn" class="secondary" type="button">Nhập gói tổng hợp</button><input id="importSummaryBundleFile" type="file" accept=".json" hidden></div>
      <div id="nationalSyncStatus" class="nat-status" data-kind="info">Chế độ an toàn 4G: chỉ đồng bộ gói tổng hợp nhỏ; dữ liệu đang nhập vẫn được xử lý cục bộ.</div>
      <details class="nat-config"><summary>Cấu hình máy chủ API (dành cho triển khai nhiều tỉnh)</summary><div class="nat-config-grid"><div class="nat-field"><label>API URL</label><input id="apiBaseInput" placeholder="https://api.pcgdxmc.vn"></div><div class="nat-field"><label>Access token phiên đăng nhập</label><input id="apiTokenInput" type="password" autocomplete="off" placeholder="Không lưu mật khẩu quản trị"></div><button id="saveApiBtn" class="secondary" type="button">Lưu API</button><button id="testApiBtn" class="secondary" type="button">Kiểm tra</button></div></details>`;
    anchor.parentNode.insertBefore(panel,anchor);

    const agg=document.createElement('section');agg.id='nationalAggregatePanel';agg.className='panel';agg.style.display='none';agg.innerHTML=`<div class="nat-head"><div class="nat-title"><h3 id="nationalAggregateTitle">Tổng hợp</h3><p id="nationalAggregateMeta" class="nat-meta">Năm ${year()}</p></div></div><div id="nationalAggregateKpis" class="nat-kpis"></div><div id="nationalAggregateBody"><div class="nat-empty">Chưa có dữ liệu tổng hợp.</div></div>`;
    const scopebar=document.querySelector('.scopebar');if(scopebar)scopebar.insertAdjacentElement('afterend',agg);else anchor.insertAdjacentElement('afterend',agg);

    $('apiBaseInput').value=apiBase();$('apiTokenInput').value=apiToken();updateScopeUi();updateNetworkBadge();
    $('managementLevel').addEventListener('change',()=>{const s=getScope();s.level=$('managementLevel').value;saveScope(s);updateScopeUi();renderAggregate()});
    $('provinceSelect').addEventListener('change',()=>{const s=getScope();s.provinceKey=$('provinceSelect').value;saveScope(s);renderAggregate()});
    $('saveManagementScope').addEventListener('click',applyScopeFromUi);
    $('syncCommuneBtn').addEventListener('click',()=>syncCurrent().catch(e=>setSyncStatus(e.message,'warn')));
    $('refreshAggregateBtn').addEventListener('click',renderAggregate);
    $('exportSummaryBundleBtn').addEventListener('click',()=>exportBundle().catch(e=>setSyncStatus(e.message,'warn')));
    $('importSummaryBundleBtn').addEventListener('click',()=>$('importSummaryBundleFile').click());
    $('importSummaryBundleFile').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{await importBundle(f)}catch(err){setSyncStatus(err.message,'warn')}finally{e.target.value=''}});
    $('saveApiBtn').addEventListener('click',saveApiConfig);$('testApiBtn').addEventListener('click',testApi);
  }

  function monitorAnalyze(){
    const btn=$('analyzeBtn');if(!btn)return;
    btn.addEventListener('click',async()=>{
      for(let i=0;i<20;i++){await sleep(350);if(global.PCGDLastResult?.summary){setSyncStatus('Đã phân tích xong. Có thể đồng bộ gói tổng hợp xã khi cần.','ok');await renderAggregate();break}}
    });
  }

  async function init(){
    injectStyles();injectUi();monitorAnalyze();
    global.addEventListener('online',()=>{updateNetworkBadge();flushQueue();renderAggregate()});
    global.addEventListener('offline',updateNetworkBadge);
    navigator.connection?.addEventListener?.('change',updateNetworkBadge);
    $('yearInput')?.addEventListener('change',renderAggregate);
    await flushQueue();await renderAggregate();
  }

  global.PCGDNational={VERSION,PROVINCES,getScope,saveScope,currentCommuneSummary,saveSummaryLocal,localAggregate,getAggregate,syncCurrent,flushQueue,renderAggregate};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error));else init().catch(console.error);
})(window);
