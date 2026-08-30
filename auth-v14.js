(function(){
  'use strict';
  if(window.PCGDAuth)return;
  const script=document.createElement('script');
  script.src='auth-v15.js?v=20260830-mobile';
  script.async=false;
  document.head.appendChild(script);
})();
