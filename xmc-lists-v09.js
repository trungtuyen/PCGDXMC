(function(global){
  'use strict';
  const X=global.XLSX;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').replace(/\s+/g,' ').trim().normalize('NFC').toLowerCase();
  const safe=v=>String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_');
  const C={A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14,P:15,Q:16,R:17,S:18,T:19,U:20,V:21,W:22,X:23,Y:24,Z:25,AA:26,AB:27,AC:28,AD:29,AE:30,AF:31,AG:32,AH:33,AI:34,AJ:35,AK:36,AL:37,AM:38,AN:39,AO:40,AP:41,AQ:42,AR:43,AS:44,AT:45,AU:46,AV:47,AW:48,AX:49,AY:50};

  const FIELDS=[
    ['Thôn/xóm',C.A],['TT',C.B],['Họ đệm',C.C],['Tên',C.D],['Ngày sinh',C.E],['Tháng sinh',C.F],['Năm sinh',C.G],['Nữ',C.H],['Dân tộc',C.I],['Tôn giáo',C.J],['Diện ưu tiên',C.K],
    ['Chủ hộ - họ đệm',C.L],['Chủ hộ - tên',C.M],['Địa chỉ',C.N],['Số phiếu',C.O],['Diện cư trú',C.P],['Tình trạng cư trú',C.Q],['Khối học',C.R],['Lớp học',C.S],['Quận/huyện đang học',C.T],['Tên trường',C.U],['Mã trường',C.V],
    ['Bậc tốt nghiệp',C.W],['Bổ túc',C.X],['Năm tốt nghiệp',C.Y],['Bậc TN nghề',C.Z],['Số bằng tốt nghiệp',C.AA],['Năm TN nghề',C.AB],['Học xong lớp',C.AC],['Năm học xong',C.AD],['Bỏ học lớp',C.AE],['Năm bỏ học',C.AF],
    ['Đang học lớp XMC',C.AG],['Hoàn thành lớp XMC',C.AH],['Tái mù chữ mức',C.AI],['KT vận động',C.AJ],['KT nghe/nói',C.AK],['KT nhìn',C.AL],['KT trí tuệ',C.AM],['KT thần kinh/tâm thần',C.AN],['KT khác 1',C.AO],['KT khác 2',C.AP],['KT khác 3',C.AQ],
    ['Có chứng nhận khuyết tật',C.AR],['Khả năng học tập',C.AS],['Hoàn cảnh đặc biệt',C.AT],['Chi tiết hoàn cảnh',C.AU],['Quan hệ với chủ hộ',C.AV],['Họ tên cha/mẹ',C.AW],['Điện thoại',C.AX],['Ghi chú',C.AY]
  ];

  let activeLevel='';
  function result(){return global.PCGDLastResult||null;}
  function villageValue(){return document.getElementById('villageSelect')?.value||'__ALL__';}
  function scopeLabel(){const s=document.getElementById('villageSelect');return !s||s.value==='__ALL__'?'Toàn xã':(s.options[s.selectedIndex]?.text||s.value).replace(/\s*\([^)]*người\)\s*$/i,'').trim();}
  function scopedRecords(){const r=result();if(!r)return[];const v=villageValue();return v==='__ALL__'?r.records:r.records.filter(x=>norm(x.village)===norm(v));}
  function list(level){return scopedRecords().filter(r=>level==='MC1'?r.bo==='MC1':r.bp==='MC2');}
  function fullName(r){return [r.raw?.[C.C],r.raw?.[C.D]].filter(Boolean).join(' ').replace(/\s+/g,' ').trim()||r.name||'';}
  function rowData(r,level){return [level,r.sourceName||'',r.rowNumber||'',...FIELDS.map(([,i])=>r.raw?.[i]??'')];}
  const HEADERS=['Phân loại','File nguồn','Dòng Excel',...FIELDS.map(x=>x[0])];

  function install(){
    const menu=document.querySelector('[data-menu-group="xmc"]');if(!menu||menu.dataset.mcListsInstalled)return;
    menu.dataset.mcListsInstalled='1';
    const sep=document.createElement('span');sep.textContent='Danh sách đối tượng:';sep.style.cssText='align-self:center;font-size:10px;font-weight:700;color:#526670;margin-left:5px';menu.appendChild(sep);
    [['MC1','Người mù chữ MĐ1'],['MC2','Người mù chữ MĐ2']].forEach(([level,label])=>{
      const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.mcLevel=level;
      b.addEventListener('click',ev=>{ev.preventDefault();ev.stopImmediatePropagation();activeLevel=level;menu.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));render(level);},true);
      menu.appendChild(b);
    });
    const sel=document.getElementById('villageSelect');if(sel)sel.addEventListener('change',()=>{if(activeLevel)setTimeout(()=>render(activeLevel),0);},true);
    document.querySelectorAll('[data-tab="xmc"]').forEach(t=>t.addEventListener('click',()=>{if(activeLevel)setTimeout(()=>render(activeLevel),0);},true));
  }

  function render(level){
    const box=document.getElementById('preview-xmc'),title=document.getElementById('title-xmc');if(!box)return;
    const arr=list(level),label=level==='MC1'?'Người mù chữ mức độ 1':'Người mù chữ mức độ 2';
    if(title)title.textContent=`${label} · ${scopeLabel()} · ${arr.length} người`;
    if(!result()){box.innerHTML='<div class="blank">Hãy nhập/phân tích dữ liệu trước khi lọc danh sách mù chữ.</div>';return;}
    const toolbar=`<div style="display:flex;gap:6px;align-items:center;justify-content:space-between;padding:6px;background:#eef3f5;border-bottom:1px solid #aebcc6;position:sticky;left:0;z-index:3"><div><strong>${esc(label)}</strong> · <span>${esc(scopeLabel())}</span> · <strong>${arr.length}</strong> người</div><div style="display:flex;gap:5px"><input id="mcSearch" type="search" placeholder="Tìm họ tên, số phiếu, địa chỉ…" style="width:260px;height:26px;border:1px solid #9facb4;padding:2px 6px"><button id="mcExport" type="button" class="primary" style="height:26px">Xuất Excel danh sách</button></div></div>`;
    box.innerHTML=toolbar+table(arr,level,'');
    const q=document.getElementById('mcSearch');q?.addEventListener('input',()=>{const term=norm(q.value);const filtered=!term?arr:arr.filter(r=>norm([fullName(r),r.village,r.ticket,r.raw?.[C.N],r.raw?.[C.AX],r.sourceName].join(' ')).includes(term));const old=box.querySelector('.mc-table-wrap');if(old)old.outerHTML=table(filtered,level,term);});
    document.getElementById('mcExport')?.addEventListener('click',()=>exportList(level));
  }

  function table(arr,level,term){
    if(!arr.length)return `<div class="mc-table-wrap"><div style="padding:18px;text-align:center;color:#6f8088">${term?'Không có đối tượng phù hợp tìm kiếm.':'Không có người thuộc '+esc(level==='MC1'?'mù chữ mức độ 1':'mù chữ mức độ 2')+' trong phạm vi này.'}</div></div>`;
    const head=HEADERS.map(h=>`<th>${esc(h)}</th>`).join('');
    const rows=arr.map(r=>`<tr>${rowData(r,level).map((v,i)=>`<td${i===3?' style="font-weight:700"':''}>${esc(v)}</td>`).join('')}</tr>`).join('');
    return `<div class="mc-table-wrap" style="overflow:auto;max-height:560px"><table style="min-width:max-content"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function exportList(level){
    if(!X){alert('Chưa tải thư viện Excel.');return;}const arr=list(level);if(!arr.length){alert('Không có dữ liệu để xuất.');return;}
    const data=[HEADERS,...arr.map(r=>rowData(r,level))];const ws=X.utils.aoa_to_sheet(data);ws['!freeze']={xSplit:0,ySplit:1};ws['!cols']=HEADERS.map((h,i)=>({wch:i===3?18:Math.min(28,Math.max(9,h.length+2))}));
    const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,level==='MC1'?'MuChu_MucDo1':'MuChu_MucDo2');
    const year=Number(document.getElementById('yearInput')?.value)||new Date().getFullYear();X.writeFile(wb,`${level==='MC1'?'Danh_sach_mu_chu_MD1':'Danh_sach_mu_chu_MD2'}_${safe(scopeLabel())}_${year}.xlsx`,{compression:true});
  }

  install();
  global.PCGDXMCLists={render,exportList,list};
})(window);
