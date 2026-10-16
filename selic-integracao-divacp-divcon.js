/* Integração de dados entre DIVACP e DIVCON: identifica pelo número SEI, preserva campos preenchidos. */
(function () {
  "use strict";
  const AC='divacp_processos_v17', DC='divcon_processos_v2';
  const shared=['dataEntradaSelic','orgao','objeto','modalidade','numeroLicitacao','fonte','valorEstimado','anoLicitacao','linkProcesso','dataInicial','dataFinal','hora','responsavel','itensLote'];
  const specific=['dataEntradaDivcon','situacaoMinutEdital','dataEnvioJuridico','orgaoDivcon','aberturaPregao','responsavelPublicacao','pregoeiroDivcon','responsavelMinuta','statusDivcon'];
  function norm(v){return String(v||'').normalize('NFKC').replace(/\s+/g,'').toUpperCase();}
  function empty(v){return v===null||v===undefined||String(v).trim()==='';}
  function read(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch(e){console.warn('SELIC integração: falha ao ler dados',key,e);return [];}}
  function save(key,items){localStorage.setItem(key,JSON.stringify(items));}
  function update(){
    const a=read(AC),d=read(DC), byNumber=new Map();
    for(const p of d){if(p&&p.numero&&!byNumber.has(norm(p.numero)))byNumber.set(norm(p.numero),p);}
    let changedA=false,changedD=false,matches=0;
    for(const ap of a){
      if(!ap||!ap.numero)continue;
      const dp=byNumber.get(norm(ap.numero));if(!dp)continue;
      matches++;
      // Campos comuns: preencher lacunas apenas, sem substituir ajustes manuais.
      for(const f of shared){
        if(empty(ap[f])&&!empty(dp[f])){ap[f]=dp[f];changedA=true;}
        if(empty(dp[f])&&!empty(ap[f])){dp[f]=ap[f];changedD=true;}
      }
      // Dados exclusivos do setor DIVCON passam a ser consultáveis também na DIVACP.
      for(const f of specific){
        if(empty(ap[f])&&!empty(dp[f])){ap[f]=dp[f];changedA=true;}
        if(empty(dp[f])&&!empty(ap[f])){dp[f]=ap[f];changedD=true;}
      }
      // Cópia de referência da DIVACP em uso no fluxo de setores.
      const acCopy=dp.copiaDivacp&&typeof dp.copiaDivacp==='object'?dp.copiaDivacp:{};
      for(const f of ['numero','dataEntradaSelic','orgao','objeto','modalidade','numeroLicitacao','fonte','valorEstimado','anoLicitacao','linkProcesso']){
        if(empty(acCopy[f])&&!empty(ap[f])){acCopy[f]=ap[f];changedD=true;}
      }
      if(changedD)dp.copiaDivacp=acCopy;
      // Respeitar movimentações posteriores para CPC, CEC ou DIPREG.
      if(!ap.setorAtual||norm(ap.setorAtual)==='DIVACP'){
        if(ap.setorAtual!=='DIVCON'){ap.setorAtual='DIVCON';ap.setorResponsavel='DIVCON';changedA=true;}
      }
    }
    if(changedA)save(AC,a);
    if(changedD)save(DC,d);
    return {matches,changedA,changedD};
  }
  try{update();}catch(e){console.error('SELIC: integração DIVACP-DIVCON',e);}
  // Atualiza dados salvos por outras abas sem alterar processos em andamento nesta aba.
  window.addEventListener('storage',e=>{if(e.key===AC||e.key===DC){try{update();}catch(err){console.error(err);}}});
})();
