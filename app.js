(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0);
  const pct=n=>`${(Number(n)||0).toFixed(2).replace('.',',')}%`;
  const norm=v=>String(v||'').normalize('NFC').toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const displayVillage=v=>String(v||'').replace(/^Thôn\s+Bản\s+/i,'Bản ').trim();

  let selectedFiles=[],directEntries=[],result=null,yearTouched=false;
  const activeSheets={mn:'MN-1TE',th:'TH-1TE',thcs:'THCS-1TTN',xmc:'CMC-1'};
  const file=$('excelFile'),analyze=$('analyzeBtn'),exportBtn=$('exportBtn'),exportScopeBtn=$('exportScopeBtn'),status=$('status'),year=$('yearInput'),village=$('villageSelect');

  setupMultiFileUI();
  setupSurveyInputMenu();
  const badge=document.querySelector('.badge');if(badge)badge.textContent='Beta 0.8';
  const fileLabel=document.querySelector('label[for="excelFile"]');if(fileLabel)fileLabel.textContent='Chọn nhiều phiếu điều tra gốc (.xls/.xlsx)';

  year.addEventListener('input',()=>{yearTouched=true});
  file.addEventListener('change',()=>{addFiles([...(file.files||[])]);file.value='';});
  analyze.addEventListener('click',run);
  village.addEventListener('change',()=>{if(result)renderScope(true)});
  exportBtn.addEventListener('click',exportAllScope);
  exportScopeBtn.addEventListener('click',exportAllScope);
  $('searchInput').addEventListener('input',renderData);
  $('errorFilter').addEventListener('change',renderErrors);

  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{
    switchTab(btn.dataset.tab);
    if(result&&activeSheets[btn.dataset.tab])showReport(btn.dataset.tab,activeSheets[btn.dataset.tab]);
  }));
  document.querySelectorAll('[data-report-sheet]').forEach(btn=>btn.addEventListener('click',()=>{
    const group=btn.closest('[data-menu-group]')?.dataset.menuGroup;if(!group)return;
    btn.parentElement.querySelectorAll('[data-report-sheet]').forEach(x=>x.classList.toggle('active',x===btn));
    activeSheets[group]=btn.dataset.reportSheet;if(result)showReport(group,btn.dataset.reportSheet,btn.textContent.trim());
  }));
  document.querySelectorAll('[data-export-scope-group]').forEach(btn=>btn.addEventListener('click',()=>{
    if(!result)return;try{PCGDViewer.exportGroup(result,btn.dataset.exportScopeGroup,village.value,sourceBase());}catch(e){setStatus(e?.message||'Không thể xuất Excel.','error');}
  }));

  function hasInputs(){return selectedFiles.length>0||directEntries.length>0;}
  function updateAnalyzeState(){analyze.disabled=!hasInputs();}

  function setupMultiFileUI(){
    file.setAttribute('multiple','multiple');
    const panel=document.querySelector('.import-panel');if(!panel||$('selectedFilePanel'))return;
    const box=document.createElement('section');box.id='selectedFilePanel';box.className='panel';box.style.cssText='margin-top:10px;padding:14px 16px;display:none';
    box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px"><div><strong id="selectedFileCount">0 phiếu điều tra</strong><div style="font-size:12px;color:var(--muted);margin-top:3px">Có thể chọn nhiều file một lần hoặc bấm Chọn tệp nhiều lần để thêm tiếp.</div></div><button id="clearFilesBtn" class="secondary" type="button" style="height:34px">Xóa tất cả file</button></div><div id="selectedFileList" style="display:flex;gap:8px;flex-wrap:wrap"></div>`;
    panel.insertAdjacentElement('afterend',box);
    $('clearFilesBtn').addEventListener('click',()=>{selectedFiles=[];invalidateAfterSourceChange();renderFileQueue();updateAnalyzeState();setStatus('Đã xóa toàn bộ file điều tra.','info');});
  }

  function setupSurveyInputMenu(){
    const surveyTab=document.querySelector('.main-menu [data-tab="data"]');if(!surveyTab||$('surveyInputMenu'))return;
    const style=document.createElement('style');style.textContent=`
      #surveyInputMenu{position:fixed;z-index:1000;display:none;min-width:210px;background:#fff;border:1px solid #7697aa;box-shadow:0 4px 12px rgba(0,0,0,.22);padding:2px}
      #surveyInputMenu button{display:block;width:100%;border:0;background:#fff;text-align:left;padding:8px 10px;font-size:11px;color:#263e49;cursor:pointer}
      #surveyInputMenu button:hover{background:#dcecf5;color:#0d527d}
      #directEntryPanel{display:none;margin:4px 0;padding:0!important;border:1px solid #9eabb3!important;background:#fff!important}
      #directEntryPanel .de-head{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:linear-gradient(#d6e9ed,#bfdce2);border-bottom:1px solid #9db6be;font-weight:700;color:#27414c}
      #directEntryPanel .de-body{padding:8px}.de-grid{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:6px}.de-field{display:flex;flex-direction:column;gap:2px}.de-field label{font-size:10px;color:#465b66}.de-field input,.de-field select{height:25px;border:1px solid #a8b6bf;border-radius:0;padding:2px 5px;font-size:11px;background:#fff}.de-wide{grid-column:span 2}.de-actions{display:flex;gap:5px;justify-content:flex-end;margin-top:8px}.de-list{margin-top:8px;border:1px solid #aab6bd;max-height:250px;overflow:auto}.de-list table{font-size:10px}.de-list th,.de-list td{padding:4px 5px}.de-note{font-size:10px;color:#667d87;margin-top:6px}.de-remove{border:0;background:transparent;color:#b42318;cursor:pointer;font-weight:700}@media(max-width:900px){.de-grid{grid-template-columns:repeat(3,minmax(120px,1fr))}}@media(max-width:560px){.de-grid{grid-template-columns:1fr 1fr}.de-wide{grid-column:span 2}}`;
    document.head.appendChild(style);

    const menu=document.createElement('div');menu.id='surveyInputMenu';menu.innerHTML='<button type="button" data-survey-action="excel">📥 Nhập phiếu điều tra Excel</button><button type="button" data-survey-action="direct">✍ Nhập trực tiếp</button>';document.body.appendChild(menu);

    surveyTab.addEventListener('click',ev=>{ev.preventDefault();ev.stopImmediatePropagation();const r=surveyTab.getBoundingClientRect();menu.style.left=`${Math.max(2,r.left)}px`;menu.style.top=`${r.bottom+2}px`;menu.style.display=menu.style.display==='block'?'none':'block';},true);
    menu.querySelector('[data-survey-action="excel"]').addEventListener('click',()=>{menu.style.display='none';file.click();});
    menu.querySelector('[data-survey-action="direct"]').addEventListener('click',()=>{menu.style.display='none';showDirectEntryPanel();});
    document.addEventListener('click',ev=>{if(menu.style.display==='block'&&!menu.contains(ev.target)&&ev.target!==surveyTab)menu.style.display='none';});
    window.addEventListener('keydown',ev=>{if(ev.key==='Escape')menu.style.display='none';});
    createDirectEntryPanel();
  }

  function createDirectEntryPanel(){
    if($('directEntryPanel'))return;const anchor=$('selectedFilePanel')||document.querySelector('.import-panel');
    const box=document.createElement('section');box.id='directEntryPanel';box.className='panel';
    box.innerHTML=`<div class="de-head"><span>Phiếu điều tra · Nhập trực tiếp</span><button id="closeDirectEntry" class="secondary" type="button" style="height:24px;padding:0 8px">Đóng</button></div>
      <div class="de-body"><form id="directEntryForm"><div class="de-grid">
        <div class="de-field"><label>Thôn/xóm *</label><input name="village" required placeholder="Ví dụ: Bản Cháng"></div>
        <div class="de-field"><label>Số phiếu *</label><input name="ticket" required placeholder="C1-001"></div>
        <div class="de-field"><label>Họ và đệm *</label><input name="lastName" required></div>
        <div class="de-field"><label>Tên *</label><input name="firstName" required></div>
        <div class="de-field"><label>Giới tính</label><select name="sex"><option>Nam</option><option>Nữ</option></select></div>
        <div class="de-field"><label>Dân tộc</label><input name="ethnicity" value="Kinh"></div>
        <div class="de-field"><label>Ngày sinh</label><input name="day" type="number" min="1" max="31"></div>
        <div class="de-field"><label>Tháng sinh</label><input name="month" type="number" min="1" max="12"></div>
        <div class="de-field"><label>Năm sinh *</label><input name="birthYear" type="number" min="1900" max="2100" required></div>
        <div class="de-field de-wide"><label>Địa chỉ chi tiết</label><input name="address" placeholder="Ngoài tên thôn/xóm"></div>
        <div class="de-field"><label>Diện cư trú</label><select name="residence"><option>Thường trú</option><option>Tạm trú</option></select></div>
        <div class="de-field"><label>Tình trạng cư trú</label><select name="residenceStatus"><option value=""></option><option>Vắng</option><option>Lưu trú</option></select></div>
        <div class="de-field"><label>Khối đang học</label><input name="grade" placeholder="1, 6, 10..."></div>
        <div class="de-field"><label>Lớp học</label><input name="className" placeholder="6A1, 9A1*..."></div>
        <div class="de-field de-wide"><label>Tên trường</label><input name="schoolName"></div>
        <div class="de-field"><label>Mã trường</label><input name="schoolCode"></div>
        <div class="de-field"><label>Bậc tốt nghiệp</label><select name="graduated"><option value=""></option><option>MN</option><option>TH</option><option>THCS</option><option>THPT</option></select></div>
        <div class="de-field"><label>Năm tốt nghiệp</label><input name="graduationYear" placeholder="2025-2026"></div>
        <div class="de-field"><label>Học xong lớp</label><input name="completedClass" type="number" min="1" max="12"></div>
        <div class="de-field"><label>Năm học xong</label><input name="completedYear" placeholder="2025-2026"></div>
        <div class="de-field"><label>Bỏ học lớp</label><input name="droppedClass" type="number" min="1" max="12"></div>
        <div class="de-field"><label>Năm bỏ học</label><input name="droppedYear" placeholder="2025-2026"></div>
        <div class="de-field"><label>Đang học lớp XMC</label><input name="xmcCurrent" type="number" min="1" max="5"></div>
        <div class="de-field"><label>Hoàn thành lớp XMC</label><input name="xmcComplete" type="number" min="1" max="5"></div>
        <div class="de-field"><label>Tái mù chữ mức</label><select name="relapse"><option value=""></option><option value="1">1</option><option value="2">2</option></select></div>
        <div class="de-field"><label>Khuyết tật</label><select name="disability"><option value=""></option><option>Vận động</option><option>Nghe, nói</option><option>Nhìn</option><option>Trí tuệ</option><option>Thần kinh, tâm thần</option><option>Khác</option></select></div>
        <div class="de-field"><label>Có khả năng học tập</label><select name="canLearn"><option value=""></option><option value="X">Có</option></select></div>
        <div class="de-field"><label>Quan hệ chủ hộ</label><input name="relation"></div>
        <div class="de-field"><label>Điện thoại</label><input name="phone"></div>
        <div class="de-field de-wide"><label>Ghi chú</label><input name="note"></div>
      </div><div class="de-actions"><button type="reset" class="secondary">Làm mới form</button><button type="submit" class="primary">Thêm đối tượng</button></div></form>
      <div class="de-note">Dữ liệu nhập trực tiếp chỉ lưu trong phiên làm việc của trình duyệt; chưa gửi lên máy chủ.</div><div id="directEntryList" class="de-list"></div>
      <div class="de-actions"><button id="clearDirectEntries" class="secondary" type="button">Xóa dữ liệu nhập trực tiếp</button><button id="analyzeDirectEntries" class="primary" type="button">Phân tích dữ liệu đã nhập</button></div></div>`;
    anchor.insertAdjacentElement('afterend',box);
    $('closeDirectEntry').addEventListener('click',()=>box.style.display='none');
    $('directEntryForm').addEventListener('submit',ev=>{ev.preventDefault();addDirectEntry(new FormData(ev.currentTarget));});
    $('clearDirectEntries').addEventListener('click',()=>{directEntries=[];invalidateAfterSourceChange();renderDirectEntries();updateAnalyzeState();setStatus('Đã xóa dữ liệu nhập trực tiếp.','info');});
    $('analyzeDirectEntries').addEventListener('click',()=>{if(hasInputs())analyze.click();});renderDirectEntries();
  }

  function showDirectEntryPanel(){const box=$('directEntryPanel');if(!box)return;box.style.display='block';box.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>box.querySelector('[name="village"]')?.focus(),250);}

  function addDirectEntry(fd){
    const x=Object.fromEntries(fd.entries());if(!x.village.trim()||!x.ticket.trim()||!x.lastName.trim()||!x.firstName.trim()||!Number(x.birthYear)){setStatus('Nhập trực tiếp: cần có thôn/xóm, số phiếu, họ tên và năm sinh.','error');return;}
    directEntries.push(x);invalidateAfterSourceChange();renderDirectEntries();updateAnalyzeState();$('directEntryForm').reset();$('directEntryForm').elements.ethnicity.value='Kinh';$('directEntryForm').elements.residence.value='Thường trú';
    setStatus(`Đã thêm ${directEntries.length} đối tượng nhập trực tiếp. Có thể nhập tiếp hoặc bấm “Phân tích dữ liệu đã nhập”.`,'info');
  }

  function renderDirectEntries(){
    const box=$('directEntryList');if(!box)return;if(!directEntries.length){box.innerHTML='<div style="padding:8px;color:#7a8b93">Chưa có đối tượng nhập trực tiếp.</div>';return;}
    box.innerHTML=`<table><thead><tr><th>TT</th><th>Số phiếu</th><th>Họ tên</th><th>Năm sinh</th><th>Giới tính</th><th>Thôn/xóm</th><th>Khối</th><th>Trường</th><th></th></tr></thead><tbody>${directEntries.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.ticket)}</td><td>${esc(`${x.lastName} ${x.firstName}`)}</td><td>${esc(x.birthYear)}</td><td>${esc(x.sex)}</td><td>${esc(x.village)}</td><td>${esc(x.grade)}</td><td>${esc(x.schoolName)}</td><td><button class="de-remove" type="button" data-remove-direct="${i}">Xóa</button></td></tr>`).join('')}</tbody></table>`;
    box.querySelectorAll('[data-remove-direct]').forEach(b=>b.addEventListener('click',()=>{directEntries.splice(Number(b.dataset.removeDirect),1);invalidateAfterSourceChange();renderDirectEntries();updateAnalyzeState();}));
  }

  function makeDirectWorkbook(){
    const C=PCGDEngine.COL,rows=Array.from({length:4},()=>Array(51).fill(''));rows[1][0]=Number(year.value)||new Date().getFullYear();
    const disabilityCols={'Vận động':'AJ','Nghe, nói':'AK','Nhìn':'AL','Trí tuệ':'AM','Thần kinh, tâm thần':'AN','Khác':'AQ'};
    directEntries.forEach((x,i)=>{const r=Array(51).fill('');r[C.B]=i+1;r[C.C]=x.lastName;r[C.D]=x.firstName;r[C.E]=x.day;r[C.F]=x.month;r[C.G]=x.birthYear;r[C.H]=x.sex==='Nữ'?'X':'';r[C.I]=x.ethnicity||'Kinh';r[C.N]=`${x.village}${x.address?` - ${x.address}`:''}`;r[C.O]=x.ticket;r[C.P]=x.residence;r[C.Q]=x.residenceStatus;r[C.R]=x.grade;r[C.S]=x.className;r[C.U]=x.schoolName;r[C.V]=x.schoolCode;r[C.W]=x.graduated;r[C.Y]=x.graduationYear;r[C.AC]=x.completedClass;r[C.AD]=x.completedYear;r[C.AE]=x.droppedClass;r[C.AF]=x.droppedYear;r[C.AG]=x.xmcCurrent;r[C.AH]=x.xmcComplete;r[C.AI]=x.relapse;r[C.AS]=x.canLearn;r[C.AV]=x.relation;r[C.AX]=x.phone;r[C.AY]=x.note;const dc=disabilityCols[x.disability];if(dc&&C[dc]!==undefined)r[C[dc]]='X';rows.push(r);});
    const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,'MauNhapLieu');return wb;
  }

  function fileKey(f){return `${f.name}|${f.size}|${f.lastModified}`;}
  function addFiles(files){
    const valid=files.filter(f=>/\.(xls|xlsx|xlsm)$/i.test(f.name)),existing=new Set(selectedFiles.map(fileKey));let added=0,duplicate=0;
    valid.forEach(f=>{const k=fileKey(f);if(existing.has(k)){duplicate++;return;}existing.add(k);selectedFiles.push(f);added++;});if(added)invalidateAfterSourceChange();renderFileQueue();updateAnalyzeState();
    if(!hasInputs())setStatus('Chọn phiếu Excel hoặc nhập trực tiếp để bắt đầu.','info');else setStatus(`Đã chọn ${selectedFiles.length} phiếu Excel${directEntries.length?` · ${directEntries.length} đối tượng nhập trực tiếp`:''}${added?` · vừa thêm ${added}`:''}${duplicate?` · bỏ qua ${duplicate} file trùng`:''}.`, 'info');
  }

  function removeFile(index){const removed=selectedFiles.splice(index,1)[0];invalidateAfterSourceChange();renderFileQueue();updateAnalyzeState();setStatus(removed?`Đã bỏ “${removed.name}”. Còn ${selectedFiles.length} phiếu Excel.`:'Danh sách nguồn đã thay đổi.','info');}
  function renderFileQueue(){
    const box=$('selectedFilePanel'),list=$('selectedFileList'),count=$('selectedFileCount');if(!box||!list||!count)return;box.style.display=selectedFiles.length?'block':'none';count.textContent=`${selectedFiles.length} phiếu điều tra Excel đã chọn`;
    list.innerHTML=selectedFiles.map((f,i)=>`<div style="display:flex;align-items:center;gap:7px;background:#f5f9f8;border:1px solid var(--line);border-radius:999px;padding:6px 8px 6px 11px;font-size:12px"><span title="${esc(f.name)}">${esc(f.name)}</span><button type="button" data-remove-file="${i}" aria-label="Bỏ file" style="border:0;background:#e5ecea;border-radius:999px;width:23px;height:23px;cursor:pointer;font-weight:800">×</button></div>`).join('');list.querySelectorAll('[data-remove-file]').forEach(btn=>btn.addEventListener('click',()=>removeFile(Number(btn.dataset.removeFile))));
  }

  function invalidateAfterSourceChange(){
    if(!result)return;result=null;setExportState(false);village.disabled=true;village.innerHTML='<option value="__ALL__">Toàn xã</option>';$('scopeSummary').textContent='Nguồn dữ liệu đã thay đổi. Hãy phân tích lại để cập nhật báo cáo.';['mn','th','thcs','xmc'].forEach(g=>{const box=$(`preview-${g}`);if(box)box.innerHTML='<div class="blank">Nguồn dữ liệu đã thay đổi. Hãy phân tích lại.</div>';});
  }

  function sourceBase(){if(selectedFiles.length===1&&!directEntries.length)return selectedFiles[0].name;if(!selectedFiles.length&&directEntries.length)return'NhapTrucTiep';return'PCGDXMC_ToanXa';}
  function scopeLabel(){return village.value==='__ALL__'?'Toàn xã':displayVillage(village.value);}
  function current(){return result?PCGDViewer.scopeResult(result,village.value):null;}
  function setExportState(enabled){exportBtn.disabled=!enabled;exportScopeBtn.disabled=!enabled;document.querySelectorAll('[data-export-scope-group]').forEach(b=>b.disabled=!enabled);}

  async function run(){
    if(!hasInputs())return;analyze.disabled=true;setExportState(false);village.disabled=true;setStatus(`Đang phân tích ${selectedFiles.length} phiếu Excel${directEntries.length?` và ${directEntries.length} đối tượng nhập trực tiếp`:''}…`,'info');
    try{
      const items=[];
      for(let i=0;i<selectedFiles.length;i++){
        const f=selectedFiles[i];setStatus(`Đang đọc phiếu ${i+1}/${selectedFiles.length}: ${f.name}…`,'info');const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellFormula:false,cellHTML:false,cellStyles:false,cellDates:false});
        if(!wb.Sheets?.MauNhapLieu)throw new Error(`${f.name}: không có sheet “MauNhapLieu”. Hãy chọn đúng file điều tra gốc như mẫu Bản Cháng.xls.`);const check=XLSX.utils.sheet_to_json(wb.Sheets.MauNhapLieu,{header:1,defval:'',raw:false,range:'A1:AY6'}),row5=check?.[4]||[];if(![1,2,3,6,14].some(c=>String(row5[c]??'').trim()))throw new Error(`${f.name}: không thấy dữ liệu bắt đầu từ dòng 5 của MauNhapLieu.`);items.push({wb,name:f.name});
      }
      if(directEntries.length)items.push({wb:makeDirectWorkbook(),name:'NhapTrucTiep.xlsx'});
      result=PCGDEngine.analyzeWorkbooks(items,yearTouched?Number(year.value):0);year.value=result.year;$('yearLabel').textContent=`Năm ${result.year}`;populateVillages();setExportState(true);renderScope(false);
      setStatus(`Hoàn tất: ${fmt(result.summary.total)} đối tượng · ${fmt(result.summary.villages)} thôn/xóm · ${selectedFiles.length} phiếu Excel${directEntries.length?` + ${directEntries.length} đối tượng nhập trực tiếp`:''}.`, 'success');
    }catch(e){console.error(e);result=null;setStatus(e?.message||'Không thể phân tích dữ liệu.','error');}finally{updateAnalyzeState();village.disabled=!result;}
  }

  function populateVillages(){const counts=new Map();result.records.forEach(r=>counts.set(r.village,(counts.get(r.village)||0)+1));village.innerHTML='<option value="__ALL__">Toàn xã</option>'+result.summary.villageNames.map(v=>`<option value="${esc(v)}">${esc(displayVillage(v))} (${fmt(counts.get(v))} người)</option>`).join('');village.value='__ALL__';village.disabled=false;}
  function renderScope(refreshReport){const scoped=current(),s=scoped.summary,label=scopeLabel();$('scopeSummary').innerHTML=`<strong>${esc(label)}</strong> · ${fmt(s.total)} nhân khẩu · ${fmt(s.households)} hộ/phiếu · ${fmt(s.issues)} lỗi/cảnh báo`;$('overviewScope').textContent=label;$('errorScopeText').textContent=`Đang xem lỗi của ${label}.`;$('dataScopeText').textContent=`Đang xem dữ liệu của ${label}.`;document.querySelectorAll('[data-scope-pill]').forEach(x=>x.textContent=label);renderKpis(scoped);renderAge(scoped);renderChecks(scoped);renderErrors();renderData();$('errorCountPill').textContent=fmt(s.issues);if(refreshReport){const active=document.querySelector('.tab.active')?.dataset.tab;if(activeSheets[active])showReport(active,activeSheets[active]);}}
  function setStatus(text,type){status.textContent=text;status.className=`status ${type}`}
  function switchTab(id){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));document.querySelectorAll('.tabpage').forEach(x=>x.classList.toggle('active',x.id===id));}
  function renderKpis(scoped){const s=scoped.summary,items=[['Nhân khẩu',fmt(s.total),scopeLabel()],['Hộ/phiếu',fmt(s.households),'Theo phạm vi đang chọn'],['15–18 tuổi',fmt(s.aged1518),`${fmt(s.tn1518)} đã TN THCS`],['Soát lỗi',fmt(s.issues),`${fmt(s.errorIssues)} lỗi · ${fmt(s.warningIssues)} cảnh báo`]];$('kpiGrid').innerHTML=items.map(x=>`<article class="kpi"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></article>`).join('');}
  function renderAge(scoped){const bands=scoped.summary.ageBands,max=Math.max(1,...Object.values(bands));$('ageBars').classList.remove('empty');$('ageBars').innerHTML=Object.entries(bands).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(1,v/max*100)}%"></div></div><strong>${fmt(v)}</strong></div>`).join('')}
  function renderChecks(scoped){const s=scoped.summary,items=[['15–18 tuổi đã TN THCS',pct(s.rate1518),s.rate1518>=90?'ok':'warn'],['Tỷ lệ không gắn mù chữ 15–60',pct(s.notMcRate),s.notMcRate>=90?'ok':'warn'],['Đối tượng khuyết tật',fmt(s.disabilities),s.disabilities?'warn':'ok'],['Lỗi danh mục trường',fmt(s.schoolErrors),s.schoolErrors?'warn':'ok']];$('quickChecks').classList.remove('empty');$('quickChecks').innerHTML=items.map(i=>`<div class="check ${i[2]}"><span>${esc(i[0])}</span><strong>${esc(i[1])}</strong></div>`).join('');}
  function renderErrors(){if(!result)return;const scoped=current(),f=$('errorFilter').value,arr=scoped.issues.filter(i=>f==='all'||i.severity===f).slice(0,1000);$('errorTable').innerHTML=arr.length?arr.map(i=>`<tr><td><span class="sev ${i.severity}">${i.severity==='error'?'Lỗi':'Cảnh báo'}</span></td><td>${esc(i.sourceName)}</td><td>${i.rowNumber}</td><td>${esc(i.name)}</td><td>${esc(displayVillage(i.village))}</td><td class="wrap">${esc(i.message)}</td><td class="wrap">${esc(i.suggestion)}</td></tr>`).join(''):'<tr><td colspan="7" class="muted">Không có vấn đề trong phạm vi này.</td></tr>';}
  function renderData(){if(!result)return;const scoped=current(),q=norm($('searchInput').value);let arr=scoped.records;if(q)arr=arr.filter(r=>norm([r.name,r.ticket,r.school,r.schoolName,r.sourceName].join(' ')).includes(q));arr=arr.slice(0,500);$('dataTable').innerHTML=arr.length?arr.map(r=>`<tr><td>${esc(r.sourceName)}</td><td>${r.rowNumber}</td><td>${esc(r.name)}</td><td>${r.birthYear||''}</td><td>${r.age===''?'':r.age}</td><td>${esc(displayVillage(r.village))}</td><td>${esc(r.bh)}</td><td>${esc(r.bg||r.bm)}</td><td>${esc(r.bn||'')}</td><td>${r.br?'<span class="sev warning">Có</span>':''}</td></tr>`).join(''):'<tr><td colspan="10" class="muted">Không có dữ liệu phù hợp.</td></tr>';}
  function showReport(group,sheetName,title){const box=$(`preview-${group}`);if(!box)return;box.innerHTML='<div class="blank">Đang tạo biểu xem trước…</div>';try{const data=PCGDViewer.previewSheet(result,sheetName,village.value),rows=data.rows,titleEl=$(`title-${group}`);if(titleEl)titleEl.textContent=title||sheetName;if(!rows.length){box.innerHTML='<div class="blank">Không có dữ liệu cho biểu này trong phạm vi đang chọn.</div>';return;}box.innerHTML=tableHtml(rows);}catch(e){console.error(e);box.innerHTML=`<div class="blank">${esc(e?.message||'Không thể tạo biểu xem trước.')}</div>`;}}
  function tableHtml(rows){const width=Math.max(1,...rows.map(r=>r.length)),body=rows.map((r,ri)=>{const cells=Array.from({length:width},(_,ci)=>r[ci]??''),nonempty=cells.filter(x=>String(x).trim()).length;if(!nonempty)return `<tr class="spacer"><td colspan="${width}">&nbsp;</td></tr>`;if(ri===0)return `<tr>${cells.map((v,ci)=>ci===0?`<th colspan="${width}">${esc(v)}</th>`:'').join('')}</tr>`;const tag=ri<=3?'th':'td';return `<tr>${cells.map(v=>`<${tag}>${esc(v)}</${tag}>`).join('')}</tr>`;}).join('');return `<table><tbody>${body}</tbody></table>`;}
  function exportAllScope(){if(!result)return;try{PCGDViewer.exportAll(result,village.value,sourceBase());}catch(e){setStatus(e?.message||'Không thể xuất Excel.','error');}}

  updateAnalyzeState();
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();