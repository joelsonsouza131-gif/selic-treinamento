/* Integração não destrutiva por número de processo: DIVACP, DIVCON, CEC, CPC. */
(function(){'use strict';
const KEYS={DIVACP:'divacp_processos_v17',DIVCON:'divcon_processos_v2',CEC:'cec_processos_v1',CPC:'cpc_processos_v1'};
const COMMON=['dataEntradaSelic','orgao','objeto','modalidade','numeroLicitacao','fonte','valorEstimado','anoLicitacao','linkProcesso','dataInicial','dataFinal','dataAbertura','hora','responsavel','itensLote'];
const FIELDS={DIVCON:['dataEntradaDivcon','situacaoMinutEdital','dataEnvioJuridico','orgaoDivcon','aberturaPregao','responsavelPublicacao','pregoeiroDivcon','responsavelMinuta','statusDivcon'],CEC:['dataEntradaCec','dataSaidaCec','situacaoMinutEditalCec','pregoeiroCec','statusCec','dataInicialCec','dataFinalCec','dataAberturaCec','horaCec','valorDesertoFracassado','valorEstimadoAtualizado','andamentoCec','seiPlanilhaComparativaCec','valorAdjudicadoCec'],CPC:['dataEntradaCpc','dataSaidaCpc','situacaoMinutEditalCpc','pregoeiroCpc','statusCpc','dataInicialCpc','dataFinalCpc','dataAberturaCpc','horaCpc','valorDesertoFracassado','valorEstimadoAtualizado','andamentoCpc','seiPlanilhaComparativaCpc','valorAdjudicadoCpc']};
const ALL=[...new Set([...COMMON,...Object.values(FIELDS).flat(),'andamento','seiPlanilhaComparativa','valorAdjudicado','status'])];
const normal=v=>String(v||'').normalize('NFKC').replace(/\s+/g,'').toUpperCase();
const empty=v=>v===null||v===undefined||String(v).trim()==='';
const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[];}catch{return [];}};
function reconcile(){
 const lists=Object.fromEntries(Object.entries(KEYS).map(([s,k])=>[s,read(k)]));
 const indexes=Object.fromEntries(Object.entries(lists).map(([s,arr])=>[s,new Map(arr.filter(p=>p?.numero).map(p=>[normal(p.numero),p]))]));
 const changed=new Set();
 for(const sector of ['CEC','CPC'])for(const item of lists[sector]){
  if(!item?.numero)continue;
  const n=normal(item.numero); const peers=Object.entries(indexes).filter(([other,m])=>other!==sector&&m.has(n)).map(([other,m])=>[other,m.get(n)]);
  for(const [other,p] of peers){
   for(const f of ALL){
    if(empty(p[f])&&!empty(item[f])){p[f]=item[f];changed.add(other);}
    if(empty(item[f])&&!empty(p[f])){item[f]=p[f];changed.add(sector);}
   }
   if(other==='DIVACP'&&(!p.setorAtual||normal(p.setorAtual)==='DIVACP'||normal(p.setorAtual)==='DIVCON')){
    // A classificação do registro importado indica a comissão, sem alterar os outros processos.
    if(p.setorAtual!==sector){p.setorAtual=sector;p.setorResponsavel=sector;changed.add(other);}
   }
   if(other==='DIVCON'){
    const cp=item.copiaDivacp&&typeof item.copiaDivacp==='object'?item.copiaDivacp:{};
    for(const f of COMMON)if(empty(cp[f])&&!empty(p[f])){cp[f]=p[f];changed.add(sector);}
    if(changed.has(sector))item.copiaDivacp=cp;
   }
  }
 }
 for(const sector of changed){try{localStorage.setItem(KEYS[sector],JSON.stringify(lists[sector]));}catch(e){console.warn('Integração SELIC: armazenamento cheio ou indisponível',sector,e);}}
}
try{reconcile();}catch(e){console.error('Integração SELIC',e);}
})();
