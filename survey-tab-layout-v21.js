(function(){
  'use strict';

  function activateSurveyTab(){
    const tab=document.querySelector('.main-menu [data-tab="data"]');
    if(!tab)return;
    document.querySelectorAll('.main-menu .tab').forEach(btn=>btn.classList.toggle('active',btn===tab));
    document.querySelectorAll('.tabpage').forEach(page=>page.classList.toggle('active',page.id==='data'));
  }

  function moveSurveyWorkspace(){
    const page=document.getElementById('data');
    if(!page)return;
    const anchor=page.querySelector('.panel.compact');
    if(!anchor)return;
    const nodes=[
      document.querySelector('.import-panel'),
      document.getElementById('selectedFilePanel'),
      document.getElementById('directEntryPanel'),
      document.getElementById('status'),
      document.querySelector('.scopebar')
    ].filter(Boolean);
    nodes.forEach(node=>{
      if(node.parentElement!==page)page.insertBefore(node,anchor);
    });
  }

  function init(){
    moveSurveyWorkspace();
    const tab=document.querySelector('.main-menu [data-tab="data"]');
    if(tab){
      document.addEventListener('click',event=>{
        const target=event.target.closest?.('.main-menu [data-tab="data"]');
        if(!target)return;
        activateSurveyTab();
        moveSurveyWorkspace();
      },true);
    }
    window.addEventListener('resize',moveSurveyWorkspace,{passive:true});
    setTimeout(moveSurveyWorkspace,0);
    setTimeout(moveSurveyWorkspace,250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();

  window.PCGDSurveyLayout={activate:activateSurveyTab,refresh:moveSurveyWorkspace};
})();
