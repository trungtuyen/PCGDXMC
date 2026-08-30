(function(global){
  'use strict';

  const STORE_PREFIX='pcgdxmc_th_manual_v20';
  const REPORTS={
    'TH-DN':{
      title:'TH-01-GV · Đội ngũ giáo viên',
      subtitle:'Nhập trực tiếp theo đúng các cột của Mẫu TH-01-GV. Mỗi trường trong xã/phường ghi một dòng.',
      fields:[
        ['school','Trường trong xã','text'],
        ['rank1','Hạng 1','number'],['rank2','Hạng 2','number'],['rank3','Hạng 3','number'],
        ['twoSessions','2 buổi/ngày','number'],
        ['principal','Hiệu trưởng','number'],['vicePrincipal','Phó Hiệu trưởng','number'],
        ['teacherTotal','GV tổng số','number'],['teacherPayroll','GV biên chế','number'],['teacherContract','GV hợp đồng','number'],
        ['teacherFemale','GV nữ','number'],['teacherMinority','GV dân tộc','number'],['teacherPerClass','Tỉ lệ GV/lớp','number'],
        ['eduPostgrad','Trên ĐH','number'],['eduUniversity','ĐH','number'],['eduCollege','CĐ','number'],['eduSecondaryPed','THSP','number'],
        ['trainingPrimary','Đào tạo Tiểu học','number'],['trainingMusic','Âm nhạc','number'],['trainingArt','Mỹ thuật','number'],
        ['trainingPE','Thể dục','number'],['trainingIT','Tin học','number'],['trainingLanguage','Ngoại ngữ','number'],['trainingOther','Khác','number'],
        ['standardGood','Chuẩn NN: Tốt','number'],['standardFair','Chuẩn NN: Khá','number'],
        ['standardPass','Chuẩn NN: Đạt','number'],['standardFail','Chuẩn NN: Chưa đạt','number'],
        ['teamLeader','Tổng phụ trách Đội','number'],['officeStaff','Nhân viên văn phòng','number'],
        ['libraryStaff','NV thư viện - TBDH','number']
      ]
    },
    'TH-CSVC':{
      title:'TH-01-CSVC · Cơ sở vật chất',
      subtitle:'Nhập trực tiếp theo đúng các cột của Mẫu TH-01-CSVC. Mỗi trường trong xã/phường ghi một dòng.',
      fields:[
        ['school','Trường','text'],['campuses','Số điểm trường','number'],['classes','Số lớp','number'],['combinedClasses','Lớp ghép','number'],
        ['roomPermanent','Phòng học kiên cố','number'],['roomSemi','Phòng học bán kiên cố','number'],
        ['roomTemp','Phòng học tạm','number'],['roomBorrowed','Phòng thuê/mượn','number'],['roomPerClass','Tỉ lệ phòng/lớp','number'],
        ['roomPrincipal','Phòng Hiệu trưởng - SL','number'],['roomVicePrincipal','Phòng PHT - SL','number'],
        ['roomOffice','Văn phòng - SL','number'],['roomHealth','Y tế - SL','number'],['roomTeam','TT hoạt động Đội - SL','number'],
        ['roomMeeting','Phòng họp - SL','number'],['roomMeetingArea','Phòng họp - DT','number'],
        ['libraryCount','Thư viện - SL','number'],['libraryArea','Thư viện - DT','number'],
        ['equipmentCount','Thiết bị - SL','number'],['equipmentArea','Thiết bị - DT','number'],
        ['toiletTeacherCount','VS giáo viên - SL','number'],['toiletTeacherArea','VS giáo viên - DT','number'],
        ['toiletStudentCount','VS học sinh - SL','number'],['toiletStudentArea','VS học sinh - DT','number'],
        ['playgroundCount','Sân chơi - SL','number'],['playgroundArea','Sân chơi - DT','number'],
        ['trainingGroundCount','Sân tập - SL','number'],['trainingGroundArea','Sân tập - DT','number']
      ]
    }
  };

  let currentReport='',saveTimer=null;

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function safePart(value){
    return String(value??'').trim().replace(/[^\p{L}\p{N}._-]+/gu,'_').slice(0,80)||'none';
  }
  function context(){
    const u=global.PCGDAuth?.user?.()||null;
    const year=document.getElementById('yearInput')?.value||new Date().getFullYear();
    const userPart=u?.username||u?.id||'local';
    const province=u?.provinceKey||'local';
    const commune=u?.communeCode||document.getElementById('communeCode')?.value||'local';
    return `${safePart(userPart)}:${safePart(province)}:${safePart(commune)}:${safePart(year)}`;
  }
  function key(report){return `${STORE_PREFIX}:${context()}:${report}`}
  function blankRow(report){
    const row={_id:(global.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`)};
    REPORTS[report].fields.forEach(([name])=>row[name]='');
    return row;
  }
  function load(report){
    try{
      const parsed=JSON.parse(localStorage.getItem(key(report))||'[]');
      return Array.isArray(parsed)&&parsed.length?parsed:[blankRow(report)];
    }catch(_){return [blankRow(report)]}
  }
  function save(report,rows){
    localStorage.setItem(key(report),JSON.stringify(rows));
    global.dispatchEvent(new CustomEvent('pcgd-th-manual-saved',{detail:{report,rows,context:context()}}));
  }
  function getRowsFromDom(){
    const table=document.querySelector('#thManualTable tbody');
    if(!table||!currentReport)return [];
    const rows=[];
    table.querySelectorAll('tr[data-row-id]').forEach(tr=>{
      const row={_id:tr.dataset.rowId};
      tr.querySelectorAll('[data-field]').forEach(input=>{
        const type=input.dataset.type;
        let value=input.value.trim();
        if(type==='number'&&value!==''){
          const n=Number(value.replace(',','.'));
          value=Number.isFinite(n)?n:'';
        }
        row[input.dataset.field]=value;
      });
      rows.push(row);
    });
    return rows.length?rows:[blankRow(currentReport)];
  }
  function scheduleSave(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      if(!currentReport)return;
      const rows=getRowsFromDom();
      save(currentReport,rows);
      showSaveState('Đã tự động lưu');
      renderTotals(rows);
    },350);
  }
  function showSaveState(text){
    const el=document.getElementById('thManualSaveState');
    if(el)el.textContent=text;
  }
  function totalsFor(report,rows){
    const totals={};
    REPORTS[report].fields.forEach(([name,,type])=>{
      if(type!=='number'||/Ratio|PerClass|teacherPerClass|roomPerClass/i.test(name))return;
      totals[name]=rows.reduce((sum,row)=>{
        const n=Number(row[name]);
        return sum+(Number.isFinite(n)?n:0);
      },0);
    });
    return totals;
  }
  function renderTotals(rows){
    const foot=document.querySelector('#thManualTable tfoot tr');
    if(!foot||!currentReport)return;
    const totals=totalsFor(currentReport,rows);
    const cells=['<th class="tm-sticky tm-tt">Cộng</th>'];
    REPORTS[currentReport].fields.forEach(([name,,type],index)=>{
      if(index===0){cells.push('<th>Toàn xã/phường</th>');return}
      const value=type==='number'&&Object.prototype.hasOwnProperty.call(totals,name)?totals[name]:'';
      cells.push(`<th>${escapeHtml(value)}</th>`);
    });
    cells.push('<th></th>');
    foot.innerHTML=cells.join('');
  }
  function rowHtml(report,row,index){
    const fields=REPORTS[report].fields.map(([name,label,type])=>{
      const val=row[name]??'';
      const attrs=type==='number'?`type="number" step="any" min="0" inputmode="decimal"`:`type="text"`;
      const placeholder=type==='text'?'Tên trường':'0';
      return `<td><input ${attrs} data-field="${name}" data-type="${type}" value="${escapeHtml(val)}" aria-label="${escapeHtml(label)}" placeholder="${placeholder}"></td>`;
    }).join('');
    return `<tr data-row-id="${escapeHtml(row._id||String(index))}"><td class="tm-sticky tm-tt">${index+1}</td>${fields}<td class="tm-actions-cell"><button type="button" class="tm-delete" title="Xóa dòng" aria-label="Xóa dòng ${index+1}">×</button></td></tr>`;
  }
  function render(report){
    const cfg=REPORTS[report],box=document.getElementById('preview-th'),title=document.getElementById('title-th');
    if(!cfg||!box)return;
    currentReport=report;
    if(title)title.textContent=cfg.title;
    const rows=load(report);
    const headers=cfg.fields.map(([,label])=>`<th title="${escapeHtml(label)}">${escapeHtml(label)}</th>`).join('');
    box.innerHTML=`<div class="th-manual">
      <div class="tm-head">
        <div><h4>${escapeHtml(cfg.title)}</h4><p>${escapeHtml(cfg.subtitle)}</p></div>
        <div class="tm-buttons"><button type="button" class="secondary" id="thManualAdd">+ Thêm trường</button><button type="button" class="primary" id="thManualSave">Lưu dữ liệu</button></div>
      </div>
      <div class="tm-note"><strong>Nhập trực tiếp:</strong> số liệu được lưu riêng theo tài khoản, xã/phường và năm điều tra trên thiết bị này. Có thể nhập bằng máy tính hoặc điện thoại.</div>
      <div class="tm-table-wrap"><table id="thManualTable"><thead><tr><th class="tm-sticky tm-tt">TT</th>${headers}<th>Thao tác</th></tr></thead><tbody>${rows.map((row,i)=>rowHtml(report,row,i)).join('')}</tbody><tfoot><tr></tr></tfoot></table></div>
      <div class="tm-foot"><span id="thManualSaveState">Dữ liệu đã tải</span><button type="button" class="tm-danger" id="thManualClear">Xóa toàn bộ biểu này</button></div>
    </div>`;
    bindTable();
    renderTotals(rows);
  }
  function reindex(){
    document.querySelectorAll('#thManualTable tbody tr').forEach((tr,i)=>{
      const cell=tr.querySelector('.tm-tt');if(cell)cell.textContent=String(i+1);
      const del=tr.querySelector('.tm-delete');if(del)del.setAttribute('aria-label',`Xóa dòng ${i+1}`);
    });
  }
  function bindTable(){
    const table=document.getElementById('thManualTable');if(!table)return;
    table.addEventListener('input',()=>{showSaveState('Đang lưu…');scheduleSave()});
    table.addEventListener('click',ev=>{
      const del=ev.target.closest('.tm-delete');if(!del)return;
      const tr=del.closest('tr');tr?.remove();
      const body=table.tBodies[0];
      if(body&&!body.rows.length)body.insertAdjacentHTML('beforeend',rowHtml(currentReport,blankRow(currentReport),0));
      reindex();scheduleSave();
    });
    document.getElementById('thManualAdd')?.addEventListener('click',()=>{
      const body=table.tBodies[0];
      body.insertAdjacentHTML('beforeend',rowHtml(currentReport,blankRow(currentReport),body.rows.length));
      reindex();
      body.lastElementChild?.querySelector('[data-field="school"]')?.focus();
      scheduleSave();
    });
    document.getElementById('thManualSave')?.addEventListener('click',()=>{
      const rows=getRowsFromDom();save(currentReport,rows);renderTotals(rows);showSaveState('Đã lưu dữ liệu');
    });
    document.getElementById('thManualClear')?.addEventListener('click',()=>{
      if(!global.confirm('Xóa toàn bộ dữ liệu đã nhập của biểu này cho năm hiện tại?'))return;
      localStorage.removeItem(key(currentReport));render(currentReport);showSaveState('Đã xóa dữ liệu');
    });
  }
  function injectStyle(){
    if(document.getElementById('thManualStyle'))return;
    const style=document.createElement('style');style.id='thManualStyle';style.textContent=`
      .th-manual{font-family:Arial,sans-serif;color:#243b47}.tm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px}
      .tm-head h4{margin:0 0 4px;font-size:15px}.tm-head p{margin:0;color:#607784;font-size:12px}.tm-buttons{display:flex;gap:7px;flex-wrap:wrap}
      .tm-note{background:#eef7fb;border:1px solid #c7dce7;border-radius:7px;padding:8px 10px;margin:8px 0;font-size:11px}
      .tm-table-wrap{overflow:auto;max-height:62vh;border:1px solid #cbd8df;border-radius:7px;background:#fff}#thManualTable{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%;font-size:11px}
      #thManualTable th,#thManualTable td{border-right:1px solid #d8e1e6;border-bottom:1px solid #d8e1e6;padding:3px;background:#fff;vertical-align:middle}
      #thManualTable thead th{position:sticky;top:0;z-index:4;background:#eaf2f6;min-width:88px;max-width:130px;white-space:normal}#thManualTable thead th:nth-child(2){min-width:210px}
      #thManualTable input{width:100%;min-width:76px;height:34px;border:1px solid #cbd7de;border-radius:4px;padding:4px 6px;font-size:12px;background:#fff}#thManualTable input[type=text]{min-width:205px}
      #thManualTable input:focus{outline:2px solid #9bcce8;border-color:#3488b7}#thManualTable tfoot th{position:sticky;bottom:0;background:#eaf5eb;font-weight:700;z-index:3}
      #thManualTable .tm-sticky{position:sticky;left:0;z-index:5;min-width:42px;background:#f3f6f8;text-align:center}#thManualTable thead .tm-sticky{z-index:7;background:#dfeaf0}#thManualTable tfoot .tm-sticky{z-index:6;background:#dceedd}
      .tm-actions-cell{min-width:50px;text-align:center}.tm-delete{border:0;background:#fff1f1;color:#b72c2c;border-radius:5px;width:30px;height:30px;font-size:20px;cursor:pointer}
      .tm-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;font-size:11px;color:#617782}.tm-danger{border:1px solid #d9a4a4;background:#fff5f5;color:#a12626;border-radius:6px;padding:7px 10px;cursor:pointer}
      @media(max-width:700px){.tm-head{display:block}.tm-buttons{margin-top:8px}.tm-buttons button{min-height:42px}.tm-table-wrap{max-height:68vh}#thManualTable input{height:40px;font-size:14px}.tm-note{font-size:12px}}
    `;document.head.appendChild(style);
  }
  function activateThPage(){
    const tab=document.querySelector('.main-menu [data-tab="th"]');
    document.querySelectorAll('.main-menu .tab').forEach(btn=>btn.classList.toggle('active',btn===tab));
    document.querySelectorAll('.tabpage').forEach(page=>page.classList.toggle('active',page.id==='th'));
  }
  function intercept(ev){
    const btn=ev.target.closest?.("[data-menu-group='th'] [data-report-sheet]");
    if(!btn)return;
    const report=btn.dataset.reportSheet;
    if(!REPORTS[report])return;
    ev.preventDefault();ev.stopImmediatePropagation();
    activateThPage();injectStyle();render(report);
    document.getElementById('th')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function refreshForContext(){if(currentReport&&REPORTS[currentReport])render(currentReport)}
  document.addEventListener('click',intercept,true);
  document.getElementById('yearInput')?.addEventListener('change',refreshForContext);
  global.addEventListener('pcgd-auth-changed',refreshForContext);
  global.PCGDTHManualInput={installed:true,reports:Object.keys(REPORTS),getData(report){return REPORTS[report]?load(report):[]},setData(report,rows){if(!REPORTS[report]||!Array.isArray(rows))return false;save(report,rows);if(currentReport===report)render(report);return true},contextKey:context,render};
})(window);
