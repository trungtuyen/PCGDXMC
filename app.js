(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const fmt=n=>new Intl.NumberFormat('vi-VN').format(Number(n)||0);
  const pct=n=>`${(Number(n)||0).toFixed(2).replace('.',',')}%`;
  let selectedFiles=[],result=null,yearTouched=false;
  const file=$('excelFile'),analyze=$('analyzeBtn'),exportBtn=$('exportBtn'),status=$('status'),year=$('yearInput');

  year.addEventListener('input',()=>{yearTouched=true});
  file.addEventListener('change',()=>{
    selectedFiles=[...(file.files||[])];analyze.disabled=!selectedFiles.length;
    if(selectedFiles.length===1)setStatus(`Đã chọn: ${selectedFiles[0].name}. Nhấn “Phân tích và tạo biểu”.`,'info');
    else if(selectedFiles.length>1)setStatus(`Đã chọn ${selectedFiles.length} file điều tra. Phần mềm sẽ gộp dữ liệu toàn bộ file.`,'info');
    else setStatus('Chọn file điều tra Excel để bắt đầu.','info');
  });
  analyze.addEventListener('click',run);
  exportBtn.addEventListener('click',()=>{if(result)PCGDEngine.exportResult(result,selectedFiles.length===1?selectedFiles[0].name:'PCGDXMC_ToanXa')});
  $('searchInput').addEventListener('input',renderData);$('errorFilter').addEventListener('change',renderErrors);
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

  async function run(){
    if(!selectedFiles.length)return;analyze.disabled=true;exportBtn.disabled=true;setStatus('Đang đọc file điều tra, chuẩn hóa dữ liệu và sinh các chỉ tiêu PCGD–XMC…','info');
    try{
      const items=[];
      for(let i=0;i<selectedFiles.length;i++){
        const f=selectedFiles[i];setStatus(`Đang đọc ${i+1}/${selectedFiles.length}: ${f.name}…`,'info');
        const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellFormula:false,cellHTML:false,cellStyles:false,cellDates:false});items.push({wb,name:f.name});
      }
      result=PCGDEngine.analyzeWorkbooks(items,yearTouched?Number(year.value):0);year.value=result.year;$('yearLabel').textContent=`Năm ${result.year}`;
      renderAll();exportBtn.disabled=false;
      const types=[...new Set(result.sources.map(x=>x.type==='PHIEU_DIEU_TRA'?'Phiếu điều tra':'File tổng hợp'))].join(', ');
      setStatus(`Hoàn tất: ${fmt(result.summary.total)} đối tượng · ${fmt(result.summary.villages)} thôn/xóm · ${fmt(result.summary.issues)} vấn đề cần rà soát. Đã sẵn sàng xuất toàn bộ biểu Excel. Loại nguồn: ${types}.`,'success');
    }catch(e){console.error(e);setStatus(e?.message||'Không thể phân tích file.','error');}
    finally{analyze.disabled=!selectedFiles.length;}
  }

  function setStatus(text,type){status.textContent=text;status.className=`status ${type}`}
  function switchTab(id){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===id));document.querySelectorAll('.tabpage').forEach(x=>x.classList.toggle('active',x.id===id));}
  function renderAll(){renderKpis();renderAge();renderChecks();renderErrors();renderData();renderReports();$('errorCountPill').textContent=fmt(result.summary.issues)}
  function renderKpis(){const s=result.summary;const items=[['Nhân khẩu',fmt(s.total),`${fmt(s.files)} file · ${fmt(s.villages)} thôn/xóm`],['Hộ/phiếu',fmt(s.households),'Gộp theo thôn + số phiếu'],['15–18 tuổi',fmt(s.aged1518),`${fmt(s.tn1518)} đã TN THCS`],['Soát lỗi',fmt(s.issues),`${fmt(s.errorIssues)} lỗi · ${fmt(s.warningIssues)} cảnh báo`]];$('kpiGrid').innerHTML=items.map(x=>`<article class="kpi"><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong><small>${esc(x[2])}</small></article>`).join('');}
  function renderAge(){const bands=result.summary.ageBands,max=Math.max(1,...Object.values(bands));$('ageBars').classList.remove('empty');$('ageBars').innerHTML=Object.entries(bands).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(1,v/max*100)}%"></div></div><strong>${fmt(v)}</strong></div>`).join('')}
  function renderChecks(){const s=result.summary;const items=[['15–18 tuổi đã TN THCS',pct(s.rate1518),s.rate1518>=90?'ok':'warn'],['Tỷ lệ không gắn mù chữ 15–60',pct(s.notMcRate),s.notMcRate>=90?'ok':'warn'],['Đối tượng khuyết tật',fmt(s.disabilities),s.disabilities?'warn':'ok'],['Lỗi danh mục trường',fmt(s.schoolErrors),s.schoolErrors?'warn':'ok']];$('quickChecks').classList.remove('empty');$('quickChecks').innerHTML=items.map(i=>`<div class="check ${i[2]}"><span>${esc(i[0])}</span><strong>${esc(i[1])}</strong></div>`).join('');}
  function renderErrors(){if(!result)return;const f=$('errorFilter').value,arr=result.issues.filter(i=>f==='all'||i.severity===f).slice(0,1000);$('errorTable').innerHTML=arr.length?arr.map(i=>`<tr><td><span class="sev ${i.severity}">${i.severity==='error'?'Lỗi':'Cảnh báo'}</span></td><td>${esc(i.sourceName)}</td><td>${i.rowNumber}</td><td>${esc(i.name)}</td><td>${esc(i.village)}</td><td class="wrap">${esc(i.message)}</td><td class="wrap">${esc(i.suggestion)}</td></tr>`).join(''):'<tr><td colspan="7" class="muted">Không có vấn đề ở bộ lọc này.</td></tr>';}
  function renderData(){if(!result)return;const q=norm($('searchInput').value);let arr=result.records;if(q)arr=arr.filter(r=>norm([r.name,r.village,r.ticket,r.school,r.schoolName,r.sourceName].join(' ')).includes(q));arr=arr.slice(0,500);$('dataTable').innerHTML=arr.length?arr.map(r=>`<tr><td>${esc(r.sourceName)}</td><td>${r.rowNumber}</td><td>${esc(r.name)}</td><td>${r.birthYear||''}</td><td>${r.age===''?'':r.age}</td><td>${esc(r.village)}</td><td>${esc(r.bh)}</td><td>${esc(r.bg||r.bm)}</td><td>${esc(r.bn||'')}</td><td>${r.br?'<span class="sev warning">Có</span>':''}</td></tr>`).join(''):'<tr><td colspan="10" class="muted">Không có dòng phù hợp.</td></tr>';}
  function renderReports(){if(!result)return;const auto=['MN-1TE','MN-2','TH-1TE','TH-2','THCS-1TTN','THCS-2.1','THCS-2.2','CMC-1','CMC-2','CMC-3','CMC-4'];const manual=['MN-CSVC','MN-ĐN','TH-CSVC','TH-DN','THCS-CSVC','THCS-DN'];$('reportTable').innerHTML=[...auto.map(x=>`<tr><td><strong>${x}</strong></td><td><span class="sev">Tự động</span></td><td>Tính trực tiếp từ dữ liệu điều tra.</td></tr>`),...manual.map(x=>`<tr><td><strong>${x}</strong></td><td><span class="sev warning">Bổ sung</span></td><td>Đã tạo sheet Excel; cần nhà trường nhập CSVC/đội ngũ vì phiếu hộ dân không có dữ liệu này.</td></tr>`)].join('');$('sourceList').innerHTML=result.sources.map(x=>`<li><strong>${esc(x.name)}</strong>: ${fmt(x.rows)} đối tượng${x.fileYear?` · năm trong file ${x.fileYear}`:''}</li>`).join('');}
  function norm(v){return String(v||'').normalize('NFC').toLowerCase()}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]))}
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
