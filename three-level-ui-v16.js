(function(){
  'use strict';
  const ui=document.createElement('script');
  ui.src='three-level-ui-v17.js?v=20260830-local-v20';
  ui.async=false;
  document.head.appendChild(ui);

  const local=document.createElement('script');
  local.src='local-mode-v18.js?v=20260830-local-v20';
  local.async=false;
  document.head.appendChild(local);

  const thManual=document.createElement('script');
  thManual.src='th-manual-input-v20.js?v=20260830-local-v20';
  thManual.async=false;
  document.head.appendChild(thManual);

  const surveyLayout=document.createElement('script');
  surveyLayout.src='survey-tab-layout-v21.js?v=20260830-survey-v21';
  surveyLayout.async=false;
  document.head.appendChild(surveyLayout);
})();
