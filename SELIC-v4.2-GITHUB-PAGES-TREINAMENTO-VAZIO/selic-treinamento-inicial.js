/* SELIC v4.2 — treinamento: limpeza única das bases de processos deste navegador.
   IMPORTANTE: esta página estática NÃO oferece autenticação multiusuário segura nem dados compartilhados. */
(() => {
  'use strict';
  const marker = 'selic_treinamento_github_sem_processos_v1';
  try {
    if (localStorage.getItem(marker) === '1') return;
    const processKeys = [
      'divacp_processos_v17','divcon_processos_v2','dipreg_processos_v1',
      'cec_processos_v1','cpc_processos_v1',
      'dipreg_lab_processos_v1','cec_lab_processos_v1','cpc_lab_processos_v1',
      'divacp_agenda_v17','divcon_agenda_v1','dipreg_lab_agenda_v1',
      'cec_lab_agenda_v1','cpc_lab_agenda_v1',
      'divcon_imported_transfers_v2','dipreg_imported_transfers_v1',
      'cec_imported_transfers_v1','cpc_imported_transfers_v1','sead_process_transfers_v2'
    ];
    for (const k of processKeys) localStorage.setItem(k,'[]');
    localStorage.setItem('sead_shared_processes_v1','{}');
    // Evita reimportações históricas acidentais na mesma origem.
    for (const k of [
      'selic_divacp_planilhas_2025_2026_v1',
      'selic_divcon_importacao_historica_2024_2026_v1',
      'selic_importacao_cec_historica_v1',
      'selic_importacao_cpc_historica_v1',
      'selic_importacao_dipreg_planilhas_v1',
      'dipreg_lab_v11_imported_prototype',
      'cec_lab_v11_imported_prototype',
      'cpc_lab_v11_imported_prototype',
      'sead_divacp_recover_divcon_v2'
    ]) localStorage.setItem(k,'1');
    const adminKey = 'selic_access_admin_demo_v2';
    const admin = JSON.parse(localStorage.getItem(adminKey)||'null');
    if(admin && typeof admin==='object' && Array.isArray(admin.users)){
      admin.processes=[];
      localStorage.setItem(adminKey,JSON.stringify(admin));
    }
    localStorage.removeItem('selic_ultima_importacao_admin_v1');
    localStorage.setItem(marker,'1');
  }catch(e){console.error('Falha na preparação inicial do treinamento',e);}
})();
