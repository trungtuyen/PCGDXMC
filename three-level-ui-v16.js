(function(){
  'use strict';
  const ui=document.createElement('script');
  ui.src='three-level-ui-v17.js?v=20260830-local-v19';
  ui.async=false;
  document.head.appendChild(ui);

  const local=document.createElement('script');
  local.src='local-mode-v18.js?v=20260830-local-v19';
  local.async=false;
  document.head.appendChild(local);
})();
