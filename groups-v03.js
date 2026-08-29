(function(global){
  'use strict';
  if(!global.PCGDEngine||!global.XLSX) throw new Error('PCGD Engine hoặc SheetJS chưa sẵn sàng.');
  const originalExport=global.PCGDEngine.exportResult;
  if(typeof originalExport!=='function') throw new Error('Chưa có bộ xuất biểu PCGD-XMC.');

  const GROUPS={
    tonghop:{label:'TongHopCapXa',sheets:['TongQuan','SoatLoi','DATA']},
    mn:{label:'MamNon',sheets:['TongQuan','MN-1TE','MN-2','MN-CSVC','MN-ĐN']},
    th:{label:'TieuHoc',sheets:['TongQuan','TH-1TE','TH-2','TH-CSVC','TH-DN']},
    thcs:{label:'THCS',sheets:['TongQuan','THCS-1TTN','THCS-2.1','THCS-2.2','THCS-CSVC','THCS-DN']},
    xmc:{label:'XoaMuChu',sheets:['TongQuan','CMC-1','CMC-2','CMC-3','CMC-4']}
  };

  function safeName(v){return String(v||'PCGDXMC').replace(/[\\/:*?"<>|]/g,'_').replace(/\.(xlsx?|xlsm)$/i,'');}

  function captureFullWorkbook(result,sourceName){
    let captured=null;
    const writeFile=global.XLSX.writeFile;
    global.XLSX.writeFile=function(wb){captured=wb;};
    try{originalExport(result,sourceName);}finally{global.XLSX.writeFile=writeFile;}
    if(!captured) throw new Error('Không tạo được workbook tổng hợp.');
    return captured;
  }

  function exportGroup(result,groupKey,sourceName){
    const cfg=GROUPS[groupKey];
    if(!cfg) throw new Error('Nhóm biểu không hợp lệ.');
    const full=captureFullWorkbook(result,sourceName);
    const out=global.XLSX.utils.book_new();
    cfg.sheets.forEach(name=>{
      const ws=full.Sheets[name];
      if(ws) global.XLSX.utils.book_append_sheet(out,ws,name);
    });
    if(!out.SheetNames.length) throw new Error('Không có biểu để xuất cho nhóm này.');
    global.XLSX.writeFile(out,`${safeName(sourceName)}_${cfg.label}_${result.year}.xlsx`,{compression:true});
  }

  global.PCGDEngine.exportGroup=exportGroup;
  global.PCGDEngine.reportGroups=GROUPS;
})(window);
