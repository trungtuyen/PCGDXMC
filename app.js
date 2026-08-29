(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0);
  const pct=n=>`${(Number(n)||0).toFixed(2).replace('.',',')}%`;
  let selectedFile=null,result=null;
  const file=$('excelFile'),analyze=$('analyzeBtn'),exportBtn=$('exportBtn'),status=$('status'),year=$('yearInput');
  file.addEventListener('change',()=>{selectedFile=file.files?.[0]||null;analyze.disabled=!selectedFile;setStatus(selectedFile?`Đã chọn: ${selectedFile.name}. Nhấn “Phân tích dữ liệu”.`:'Chọn file Excel để bắt đầu.','info')});
  analyze.addEventListener('click',run);
  exportBtn.addEventListener('click',()=>{if(result)PCGDEngine.exportResult(result,selectedFile?.name)});
  $('searchInput').addEventListener('input',renderData);
  $('errorFilter').addEventListener('change',renderErrors);
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

  async function run(){
    if(!selectedFile)return;
    analyze.disabled=true;exportBtn.disabled=true;setStatus('Đang đọc workbook và tính lại dữ liệu…','info');
    try{
      const buf=await selectedFile.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array',cellFormula:false,cellHTML:false,cellStyles:false,sheets:['DATA','DuLieu','MaTruong','THONG_TIN']});
      result=PCGDEngine.analyzeWorkbook(wb,Number(year.value));
      year.value=result.year;$('yearLabel').textContent=`Năm ${result.year}`;
      renderAll();exportBtn.disabled=false;setStatus(`Hoàn tất: ${fmt(result.summary.total)} đối tượng, ${fmt(result.summary.issues)} vấn đề cần rà soát. Dữ liệu chỉ được xử lý trong trình duyệt này.`,'success');
    }catch(e){console.error(e);setStatus(e?.message||'Không thể phân tích file.','error');}
    finally{analyze.disabled=!selectedFile;}
  }
  function setStatus(text,type){status.textContent=text;status.className=`status ${type}`}
  function switchTab(id){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));document.querySelectorAll('.tabpage').forEach(x=>x.classList.toggle('active',x.id===id));}
  function renderAll(){renderKpis();renderAge();renderChecks();renderErrors();renderData();$('errorCountPill').textContent=fmt(result.summary.issues)}
  function renderKpis(){const s=result.summary;const items=[['Nhân khẩu',fmt(s.total),'Dòng dữ liệu hợp lệ trong DATA'],['Hộ/phiếu',fmt(s.households),'Số phiếu/hộ duy nhất'],['15–18 tuổi',fmt(s.aged1518),`${fmt(s.tn1518)} đối tượng gắn TNC2`],['Lỗi mã trường',fmt(s.schoolErrors),`${fmt(s.errorIssues)} lỗi · ${fmt(s.warningIssues)} cảnh báo`]];$('kpiGrid').innerHTML=items.map(x=>`<article class="kpi"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></article>`).join('');}
  function renderAge(){const bands=result.summary.ageBands,max=Math.max(1,...Object.values(bands));$('ageBars').classList.remove('empty');$('ageBars').innerHTML=Object.entries(bands).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(1,v/max*100)}%"></div></div><strong>${fmt(v)}</strong></div>`).join('')}
  function renderChecks(){const s=result.summary;const items=[['15–18 tuổi đã TN THCS (logic Excel)',pct(s.rate1518),s.rate1518>=90?'ok':'warn'],['Tỷ lệ không gắn MC trong mẫu 15–60',pct(s.notMcRate),s.notMcRate>=90?'ok':'warn'],['Đối tượng khuyết tật',fmt(s.disabilities),s.disabilities?'warn':'ok'],['Lỗi danh mục trường',fmt(s.schoolErrors),s.schoolErrors?'warn':'ok']];$('quickChecks').classList.remove('empty');$('quickChecks').innerHTML=items.map(i=>`<div class="check ${i[2]}"><span>${esc(i[0])}</span><strong>${esc(i[1])}</strong></div>`).join('');}
  function renderErrors(){if(!result)return;const f=$('errorFilter').value,arr=result.issues.filter(i=>f==='all'||i.severity===f).slice(0,1000);$('errorTable').innerHTML=arr.length?arr.map(i=>`<tr><td><span class="sev ${i.severity}">${i.severity==='error'?'Lỗi':'Cảnh báo'}</span></td><td>${i.rowNumber}</td><td>${esc(i.name)}</td><td>${esc(i.village)}</td><td class="wrap">${esc(i.message)}</td><td class="wrap">${esc(i.suggestion)}</td></tr>`).join(''):'<tr><td colspan="6" class="muted">Không có vấn đề ở bộ lọc này.</td></tr>';}
  function renderData(){if(!result)return;const q=norm($('searchInput').value);let arr=result.records;if(q)arr=arr.filter(r=>norm([r.name,r.village,r.ticket,r.school].join(' ')).includes(q));arr=arr.slice(0,500);$('dataTable').innerHTML=arr.length?arr.map(r=>`<tr><td>${r.rowNumber}</td><td>${esc(r.name)}</td><td>${r.birthYear||''}</td><td>${r.age===''?'':r.age}</td><td>${esc(r.village)}</td><td>${esc(r.bh)}</td><td>${esc(r.bg||r.bm)}</td><td>${esc(r.bn||'')}</td><td>${r.br?'<span class="sev warning">Có</span>':''}</td><td>${r.bb?'<span class="sev error">Lỗi</span>':'OK'}</td></tr>`).join(''):'<tr><td colspan="10" class="muted">Không có dòng phù hợp.</td></tr>';}
  function norm(v){return String(v||'').normalize('NFC').toLowerCase()}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
