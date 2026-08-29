(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0);
  const pct=n=>`${(Number(n)||0).toFixed(2).replace('.',',')}%`;
  const norm=v=>String(v||'').normalize('NFC').toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const displayVillage=v=>String(v||'').replace(/^Thôn\s+Bản\s+/i,'Bản ').trim();

  let selectedFiles=[],result=null,yearTouched=false;
  const activeSheets={mn:'MN-1TE',th:'TH-1TE',thcs:'THCS-1TTN',xmc:'CMC-1'};
  const file=$('excelFile'),analyze=$('analyzeBtn'),exportBtn=$('exportBtn'),exportScopeBtn=$('exportScopeBtn'),status=$('status'),year=$('yearInput'),village=$('villageSelect');

  setupMultiFileUI();
  const badge=document.querySelector('.badge');if(badge)badge.textContent='Beta 0.5';
  const fileLabel=document.querySelector('label[for="excelFile"]');if(fileLabel)fileLabel.textContent='Chọn nhiều phiếu điều tra gốc (.xls/.xlsx)';

  year.addEventListener('input',()=>{yearTouched=true});
  file.addEventListener('change',()=>{
    addFiles([...(file.files||[])]);
    file.value='';
  });
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
    const group=btn.closest('[data-menu-group]')?.dataset.menuGroup;
    if(!group)return;
    btn.parentElement.querySelectorAll('[data-report-sheet]').forEach(x=>x.classList.toggle('active',x===btn));
    activeSheets[group]=btn.dataset.reportSheet;
    if(result)showReport(group,btn.dataset.reportSheet,btn.textContent.trim());
  }));
  document.querySelectorAll('[data-export-scope-group]').forEach(btn=>btn.addEventListener('click',()=>{
    if(!result)return;
    try{PCGDViewer.exportGroup(result,btn.dataset.exportScopeGroup,village.value,sourceBase());}
    catch(e){setStatus(e?.message||'Không thể xuất Excel.','error');}
  }));

  function setupMultiFileUI(){
    file.setAttribute('multiple','multiple');
    const panel=document.querySelector('.import-panel');
    if(!panel||$('selectedFilePanel'))return;
    const box=document.createElement('section');
    box.id='selectedFilePanel';box.className='panel';
    box.style.cssText='margin-top:10px;padding:14px 16px;display:none';
    box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px"><div><strong id="selectedFileCount">0 phiếu điều tra</strong><div style="font-size:12px;color:var(--muted);margin-top:3px">Có thể chọn nhiều file một lần hoặc bấm Chọn tệp nhiều lần để thêm tiếp.</div></div><button id="clearFilesBtn" class="secondary" type="button" style="height:34px">Xóa tất cả</button></div><div id="selectedFileList" style="display:flex;gap:8px;flex-wrap:wrap"></div>`;
    panel.insertAdjacentElement('afterend',box);
    $('clearFilesBtn').addEventListener('click',()=>{selectedFiles=[];invalidateAfterFileChange();renderFileQueue();setStatus('Đã xóa toàn bộ phiếu điều tra.','info');});
  }

  function fileKey(f){return `${f.name}|${f.size}|${f.lastModified}`;}
  function addFiles(files){
    const valid=files.filter(f=>/\.(xls|xlsx|xlsm)$/i.test(f.name));
    const existing=new Set(selectedFiles.map(fileKey));let added=0,duplicate=0;
    valid.forEach(f=>{const k=fileKey(f);if(existing.has(k)){duplicate++;return;}existing.add(k);selectedFiles.push(f);added++;});
    if(added)invalidateAfterFileChange();
    renderFileQueue();
    analyze.disabled=!selectedFiles.length;
    if(!selectedFiles.length)setStatus('Chọn một hoặc nhiều phiếu điều tra gốc để bắt đầu.','info');
    else setStatus(`Đã chọn ${selectedFiles.length} phiếu điều tra${added?` · vừa thêm ${added}`:''}${duplicate?` · bỏ qua ${duplicate} file trùng`:''}. Nhấn “Phân tích dữ liệu” khi đã chọn đủ.`, 'info');
  }

  function removeFile(index){
    const removed=selectedFiles.splice(index,1)[0];invalidateAfterFileChange();renderFileQueue();analyze.disabled=!selectedFiles.length;
    setStatus(removed?`Đã bỏ “${removed.name}”. Còn ${selectedFiles.length} phiếu điều tra.`:'Danh sách file đã thay đổi.','info');
  }

  function renderFileQueue(){
    const box=$('selectedFilePanel'),list=$('selectedFileList'),count=$('selectedFileCount');if(!box||!list||!count)return;
    box.style.display=selectedFiles.length?'block':'none';count.textContent=`${selectedFiles.length} phiếu điều tra đã chọn`;
    list.innerHTML=selectedFiles.map((f,i)=>`<div style="display:flex;align-items:center;gap:7px;background:#f5f9f8;border:1px solid var(--line);border-radius:999px;padding:6px 8px 6px 11px;font-size:12px"><span title="${esc(f.name)}">${esc(f.name)}</span><button type="button" data-remove-file="${i}" aria-label="Bỏ file" style="border:0;background:#e5ecea;border-radius:999px;width:23px;height:23px;cursor:pointer;font-weight:800">×</button></div>`).join('');
    list.querySelectorAll('[data-remove-file]').forEach(btn=>btn.addEventListener('click',()=>removeFile(Number(btn.dataset.removeFile))));
  }

  function invalidateAfterFileChange(){
    if(!result)return;
    result=null;setExportState(false);village.disabled=true;village.innerHTML='<option value="__ALL__">Toàn xã</option>';
    $('scopeSummary').textContent='Danh sách phiếu đã thay đổi. Hãy phân tích lại để cập nhật báo cáo.';
    ['mn','th','thcs','xmc'].forEach(g=>{const box=$(`preview-${g}`);if(box)box.innerHTML='<div class="blank">Danh sách phiếu đã thay đổi. Hãy phân tích lại dữ liệu.</div>';});
  }

  function sourceBase(){return selectedFiles.length===1?selectedFiles[0].name:'PCGDXMC_ToanXa';}
  function scopeLabel(){return village.value==='__ALL__'?'Toàn xã':displayVillage(village.value);}
  function current(){return result?PCGDViewer.scopeResult(result,village.value):null;}
  function setExportState(enabled){exportBtn.disabled=!enabled;exportScopeBtn.disabled=!enabled;document.querySelectorAll('[data-export-scope-group]').forEach(b=>b.disabled=!enabled);}

  async function run(){
    if(!selectedFiles.length)return;
    analyze.disabled=true;setExportState(false);village.disabled=true;setStatus(`Đang đọc ${selectedFiles.length} phiếu điều tra gốc…`,'info');
    try{
      const items=[];
      for(let i=0;i<selectedFiles.length;i++){
        const f=selectedFiles[i];setStatus(`Đang đọc phiếu ${i+1}/${selectedFiles.length}: ${f.name}…`,'info');
        const buf=await f.arrayBuffer();
        const wb=XLSX.read(buf,{type:'array',cellFormula:false,cellHTML:false,cellStyles:false,cellDates:false});
        if(!wb.Sheets?.MauNhapLieu)throw new Error(`${f.name}: không có sheet “MauNhapLieu”. Hãy chọn đúng file điều tra gốc như mẫu Bản Cháng.xls.`);
        const check=XLSX.utils.sheet_to_json(wb.Sheets.MauNhapLieu,{header:1,defval:'',raw:false,range:'A1:AY6'});
        const row5=check?.[4]||[];
        if(![1,2,3,6,14].some(c=>String(row5[c]??'').trim()))throw new Error(`${f.name}: không thấy dữ liệu bắt đầu từ dòng 5 của MauNhapLieu.`);
        items.push({wb,name:f.name});
      }
      result=PCGDEngine.analyzeWorkbooks(items,yearTouched?Number(year.value):0);
      year.value=result.year;$('yearLabel').textContent=`Năm ${result.year}`;
      populateVillages();setExportState(true);renderScope(false);
      setStatus(`Hoàn tất ${selectedFiles.length} phiếu: ${fmt(result.summary.total)} đối tượng · ${fmt(result.summary.villages)} thôn/xóm. Có thể chọn thôn và xem/xuất từng bộ biểu.`, 'success');
    }catch(e){console.error(e);result=null;setStatus(e?.message||'Không thể phân tích file.','error');}
    finally{analyze.disabled=!selectedFiles.length;village.disabled=!result;}
  }

  function populateVillages(){
    const counts=new Map();result.records.forEach(r=>counts.set(r.village,(counts.get(r.village)||0)+1));
    village.innerHTML='<option value="__ALL__">Toàn xã</option>'+result.summary.villageNames.map(v=>`<option value="${esc(v)}">${esc(displayVillage(v))} (${fmt(counts.get(v))} người)</option>`).join('');
    village.value='__ALL__';village.disabled=false;
  }

  function renderScope(refreshReport){
    const scoped=current(),s=scoped.summary,label=scopeLabel();
    $('scopeSummary').innerHTML=`<strong>${esc(label)}</strong> · ${fmt(s.total)} nhân khẩu · ${fmt(s.households)} hộ/phiếu · ${fmt(s.issues)} lỗi/cảnh báo`;
    $('overviewScope').textContent=label;$('errorScopeText').textContent=`Đang xem lỗi của ${label}.`;$('dataScopeText').textContent=`Đang xem dữ liệu của ${label}.`;
    document.querySelectorAll('[data-scope-pill]').forEach(x=>x.textContent=label);
    renderKpis(scoped);renderAge(scoped);renderChecks(scoped);renderErrors();renderData();$('errorCountPill').textContent=fmt(s.issues);
    if(refreshReport){const active=document.querySelector('.tab.active')?.dataset.tab;if(activeSheets[active])showReport(active,activeSheets[active]);}
  }

  function setStatus(text,type){status.textContent=text;status.className=`status ${type}`}
  function switchTab(id){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));document.querySelectorAll('.tabpage').forEach(x=>x.classList.toggle('active',x.id===id));}
  function renderKpis(scoped){const s=scoped.summary;const items=[['Nhân khẩu',fmt(s.total),scopeLabel()],['Hộ/phiếu',fmt(s.households),'Theo phạm vi đang chọn'],['15–18 tuổi',fmt(s.aged1518),`${fmt(s.tn1518)} đã TN THCS`],['Soát lỗi',fmt(s.issues),`${fmt(s.errorIssues)} lỗi · ${fmt(s.warningIssues)} cảnh báo`]];$('kpiGrid').innerHTML=items.map(x=>`<article class="kpi"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></article>`).join('');}
  function renderAge(scoped){const bands=scoped.summary.ageBands,max=Math.max(1,...Object.values(bands));$('ageBars').classList.remove('empty');$('ageBars').innerHTML=Object.entries(bands).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(1,v/max*100)}%"></div></div><strong>${fmt(v)}</strong></div>`).join('')}
  function renderChecks(scoped){const s=scoped.summary;const items=[['15–18 tuổi đã TN THCS',pct(s.rate1518),s.rate1518>=90?'ok':'warn'],['Tỷ lệ không gắn mù chữ 15–60',pct(s.notMcRate),s.notMcRate>=90?'ok':'warn'],['Đối tượng khuyết tật',fmt(s.disabilities),s.disabilities?'warn':'ok'],['Lỗi danh mục trường',fmt(s.schoolErrors),s.schoolErrors?'warn':'ok']];$('quickChecks').classList.remove('empty');$('quickChecks').innerHTML=items.map(i=>`<div class="check ${i[2]}"><span>${esc(i[0])}</span><strong>${esc(i[1])}</strong></div>`).join('');}
  function renderErrors(){if(!result)return;const scoped=current(),f=$('errorFilter').value,arr=scoped.issues.filter(i=>f==='all'||i.severity===f).slice(0,1000);$('errorTable').innerHTML=arr.length?arr.map(i=>`<tr><td><span class="sev ${i.severity}">${i.severity==='error'?'Lỗi':'Cảnh báo'}</span></td><td>${esc(i.sourceName)}</td><td>${i.rowNumber}</td><td>${esc(i.name)}</td><td>${esc(displayVillage(i.village))}</td><td class="wrap">${esc(i.message)}</td><td class="wrap">${esc(i.suggestion)}</td></tr>`).join(''):'<tr><td colspan="7" class="muted">Không có vấn đề trong phạm vi này.</td></tr>';}
  function renderData(){if(!result)return;const scoped=current(),q=norm($('searchInput').value);let arr=scoped.records;if(q)arr=arr.filter(r=>norm([r.name,r.ticket,r.school,r.schoolName,r.sourceName].join(' ')).includes(q));arr=arr.slice(0,500);$('dataTable').innerHTML=arr.length?arr.map(r=>`<tr><td>${esc(r.sourceName)}</td><td>${r.rowNumber}</td><td>${esc(r.name)}</td><td>${r.birthYear||''}</td><td>${r.age===''?'':r.age}</td><td>${esc(displayVillage(r.village))}</td><td>${esc(r.bh)}</td><td>${esc(r.bg||r.bm)}</td><td>${esc(r.bn||'')}</td><td>${r.br?'<span class="sev warning">Có</span>':''}</td></tr>`).join(''):'<tr><td colspan="10" class="muted">Không có dữ liệu phù hợp.</td></tr>';}

  function showReport(group,sheetName,title){
    const box=$(`preview-${group}`);if(!box)return;
    box.innerHTML='<div class="blank">Đang tạo biểu xem trước…</div>';
    try{
      const data=PCGDViewer.previewSheet(result,sheetName,village.value),rows=data.rows;
      const titleEl=$(`title-${group}`);if(titleEl)titleEl.textContent=title||sheetName;
      if(!rows.length){box.innerHTML='<div class="blank">Không có dữ liệu cho biểu này trong phạm vi đang chọn.</div>';return;}
      box.innerHTML=tableHtml(rows);
    }catch(e){console.error(e);box.innerHTML=`<div class="blank">${esc(e?.message||'Không thể tạo biểu xem trước.')}</div>`;}
  }

  function tableHtml(rows){
    const width=Math.max(1,...rows.map(r=>r.length));
    const body=rows.map((r,ri)=>{
      const cells=Array.from({length:width},(_,ci)=>r[ci]??''),nonempty=cells.filter(x=>String(x).trim()).length;
      if(!nonempty)return `<tr class="spacer"><td colspan="${width}">&nbsp;</td></tr>`;
      if(ri===0)return `<tr>${cells.map((v,ci)=>ci===0?`<th colspan="${width}">${esc(v)}</th>`:'').join('')}</tr>`;
      const tag=ri<=3?'th':'td';return `<tr>${cells.map(v=>`<${tag}>${esc(v)}</${tag}>`).join('')}</tr>`;
    }).join('');
    return `<table><tbody>${body}</tbody></table>`;
  }

  function exportAllScope(){if(!result)return;try{PCGDViewer.exportAll(result,village.value,sourceBase());}catch(e){setStatus(e?.message||'Không thể xuất Excel.','error');}}

  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
