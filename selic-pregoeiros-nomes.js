/* Identificação única dos pregoeiros; jose.castro é o login (não ALBERTO). */
(()=>{'use strict';
const aliases={"ALINESOUTO":"aline.souto","BRUNAAALMEIDA":"brunaa.almeida","CAROLYNERENATA":"carolyne.renata","FRANCISCOSOUZANETO":"franciscosouza.neto","FRANCISCOINACIO":"francisco.inacio","GARDENIOMARTINS":"gardenio.martins","GREICESILVA":"greice.silva","JANAINACUNHA":"janaina.cunha","JANDAARAUJO":"janda.araujo","JOELSONAMORIM":"joelson.amorim","JOSECASTRO":"jose.castro","SANDRABARBOSA":"sandra.barbosa","VALDEMIRALMEIDA":"valdemir.almeida","WILTONSILVA":"wilton.silva","LAURAMONTEIRO":"laura.monteiro","JUANEZBARROSO":"juanez.barroso","ALINE":"aline.souto","BRUNA":"brunaa.almeida","CAROLYNE":"carolyne.renata","NETO":"franciscosouza.neto","INACIO":"francisco.inacio","GARDENIO":"gardenio.martins","GREICE":"greice.silva","QUELE":"greice.silva","JANAINA":"janaina.cunha","JANDA":"janda.araujo","JOELSON":"joelson.amorim","ALBERTO":"jose.castro","SANDRA":"sandra.barbosa","VALDEMIR":"valdemir.almeida","WILTON":"wilton.silva","LAURA":"laura.monteiro","JUANEZ":"juanez.barroso","INACIOFRANCISCO":"francisco.inacio"};
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const canon=x=>{const val=String(x||'').trim();return aliases[norm(val)]||val;};
window.SELIC_CANONICAL_PREGOEIRO=canon;
const uniquePeople=a=>{const seen=new Set();return a.map(canon).filter(s=>{const id=norm(s);if(!id||seen.has(id))return false;seen.add(id);return true;});};
for(const storage of ['dipreg_processos_v1','divcon_processos_v1','cec_processos_v1','cpc_processos_v1']){
  try{const a=JSON.parse(localStorage.getItem(storage)||'null');if(!Array.isArray(a))continue;let edited=false;
  for(const p of a){const fields=['pregoeiroDipreg','pregoeiroDivcon','pregoeiroCec','pregoeiroCpc'];if(storage==='dipreg_processos_v1')fields.push('responsavel');
    for(const field of fields)if(p[field]){const t=canon(p[field]);if(t!==p[field]){p[field]=t;edited=true;}}}
  if(edited)localStorage.setItem(storage,JSON.stringify(a));
  }catch(e){console.warn('Falha de normalização de responsáveis',storage,e);}
}
for(const storage of ['dipreg_lab_profile_settings_v1','divcon_profile_settings_v1','cec_lab_profile_settings_v1','cpc_lab_profile_settings_v1']){
  try{const s=JSON.parse(localStorage.getItem(storage)||'null');if(!s||typeof s!=='object')continue;let edited=false;
    for(const k of Object.keys(s))if(/pregoeiros/i.test(k)&&Array.isArray(s[k])){const v=uniquePeople(s[k]);if(JSON.stringify(s[k])!==JSON.stringify(v)){s[k]=v;edited=true;}}
    if(edited)localStorage.setItem(storage,JSON.stringify(s));
  }catch(e){console.warn('Falha de normalização da lista de pregoeiros',storage,e);}
}
})();
