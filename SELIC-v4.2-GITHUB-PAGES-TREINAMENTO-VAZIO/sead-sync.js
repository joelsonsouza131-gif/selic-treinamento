/*
 * SEAD — sincronização setorial v2.1
 * Armazenamento compartilhado da mesma origem (http://localhost:8765).
 * Um processo é identificado pelo ID estável da origem, nunca pelo número editável.
 * Cada setor publica apenas campos de sua competência. Histórico e tramitação são cumulativos.
 */
(() => {
  'use strict';
  const KEY = 'sead_shared_processes_v1';
  const BUS_KEY = 'sead_process_transfers_v2';
  const OWN_DIVACP = [
    'numero','dataEntradaSelic','orgao','objeto','modalidade','numeroLicitacao',
    'fonte','valorEstimado','anoLicitacao','linkProcesso','itensLote','responsavel',
    'dataInicial','dataFinal','dataAbertura','hora','valorDesertoFracassado',
    'valorEstimadoAtualizado','andamento','seiPlanilhaComparativa',
    'valorAdjudicado','status','setorResponsavel'
  ];
  const OWN_DIVCON = [
    'dataEntradaDivcon','situacaoMinutEdital','dataEnvioJuridico','orgaoDivcon',
    'aberturaPregao','responsavelPublicacao','pregoeiroDivcon','statusDivcon',
    'responsavelMinuta','recebidoDivcon','dataRecebimentoDivcon',
    'origemRecebimento','transferenciaRecebimentoId'
  ];
  const OWN_CEC = [
    'dataEntradaCec','dataSaidaCec','statusCec','pregoeiroCec',
    'dataInicialCec','dataFinalCec','dataAberturaCec','horaCec',
    'itensLoteCec','valorAdjudicadoCec',
    'seiPlanilhaComparativaCec','fimRecursosCec','fimContrarrazoesCec','fimDecisaoCec','andamentoCec',
    'recebidoCec','dataRecebimentoCec','origemRecebimentoCec','transferenciaRecebimentoCecId'
  ];
  const OWN_CPC = [
    'dataEntradaCpc','dataSaidaCpc','statusCpc','pregoeiroCpc',
    'dataInicialCpc','dataFinalCpc','dataAberturaCpc','horaCpc',
    'itensLoteCpc','valorAdjudicadoCpc',
    'seiPlanilhaComparativaCpc','fimRecursosCpc','fimContrarrazoesCpc','fimDecisaoCpc','andamentoCpc',
    'recebidoCpc','dataRecebimentoCpc','origemRecebimentoCpc','transferenciaRecebimentoCpcId'
  ];
  const OWN_DIPREG = [
    'dataEntradaDipreg','dataSaidaDipreg','statusDipreg','pregoeiroDipreg',
    'dataInicialDipreg','dataFinalDipreg','dataAberturaDipreg','horaDipreg',
    'itensLoteDipreg','valorAdjudicadoDipreg','seiPlanilhaComparativaDipreg',
    'fimRecursosDipreg','fimContrarrazoesDipreg','fimDecisaoDipreg','andamentoDipreg',
    'recebidoDipreg','dataRecebimentoDipreg','origemRecebimentoDipreg','transferenciaRecebimentoDipregId'
  ];
  const FUTURE_SHARED = [
    'dataEntradaCpc','dataSaidaCpc','statusCpc','pregoeiroCpc','dataInicialCpc','dataFinalCpc','dataAberturaCpc','horaCpc','itensLoteCpc','valorEstimadoCpc','valorAdjudicadoCpc','seiPlanilhaComparativaCpc','fimRecursosCpc','fimContrarrazoesCpc','fimDecisaoCpc','andamentoCpc',
    'dataEntradaDipreg','dataSaidaDipreg','statusDipreg','pregoeiroDipreg','dataInicialDipreg','dataFinalDipreg','dataAberturaDipreg','horaDipreg','itensLoteDipreg','valorEstimadoDipreg','valorAdjudicadoDipreg','seiPlanilhaComparativaDipreg','fimRecursosDipreg','fimContrarrazoesDipreg','fimDecisaoDipreg','andamentoDipreg'
  ];
  const ALL = [...new Set([...OWN_DIVACP, ...OWN_DIVCON, ...OWN_CEC, ...OWN_CPC, ...OWN_DIPREG, ...FUTURE_SHARED])];
  const compare = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const copy = value => JSON.parse(JSON.stringify(value));
  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      return data && !Array.isArray(data) && typeof data === 'object' ? data : {};
    } catch (e) {
      console.warn('Sincronização: registro compartilhado ilegível', e);
      return null;  // não sobrescrever acidentalmente dados compartilhados corrompidos
    }
  };
  const transferBus = () => {
    try {
      const data = JSON.parse(localStorage.getItem(BUS_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  };
  const mergeList = (...lists) => {
    const seen = new Set();
    const result = [];
    lists.forEach(list => (Array.isArray(list) ? list : []).forEach(item => {
      if (!item || typeof item !== 'object') return;
      const id = item.id || item.refId || JSON.stringify(item);
      if (seen.has(id)) return;
      seen.add(id);
      result.push(item);
    }));
    return result;
  };
  const ownedBy = sector => {
    if (sector === 'DIVACP') return OWN_DIVACP;
    if (sector === 'DIVCON') return OWN_DIVCON;
    if (sector === 'CEC') return OWN_CEC;
    if (sector === 'CPC') return OWN_CPC;
    if (sector === 'DIPREG') return OWN_DIPREG;
    return [];
  };
  const others = sector => ALL.filter(field => !ownedBy(sector).includes(field));
  let context = null;
  let snapshots = new Map();
  let lastSeen = '';
  let inSync = false;

  function assignId(sector, process, bus) {
    if (process.syncId) return process.syncId;
    let transfer;
    if (sector === 'DIVACP') {
      transfer = bus.find(x => x.origem === 'DIVACP' && x.processId === process.id);
      if (transfer) process.syncId = 'DIVACP:' + process.id;
    } else {
      const transferId = sector === 'CEC'
        ? process.transferenciaRecebimentoCecId
        : sector === 'CPC' ? process.transferenciaRecebimentoCpcId
        : sector === 'DIPREG' ? process.transferenciaRecebimentoDipregId
        : process.transferenciaRecebimentoId;
      transfer = bus.find(x => x.id === transferId);
      if (transfer && transfer.processId) {
        const origem = String(transfer.origem || 'DIVACP').toUpperCase();
        // Se o processo nasceu na DIVACP, preservar o ID global da origem mesmo após
        // passar por outros setores. Caso contrário, manter a origem real.
        process.syncId = process.syncId || (origem + ':' + transfer.processId);
      }
    }
    return process.syncId || '';
  }

  function newRecord(process) {
    const fields = {};
    ALL.forEach(field => {
      if (process[field] !== undefined) fields[field] = copy(process[field]);
    });
    return {
      fields,
      setorAtual: process.setorAtual || '',
      historicoEnvios: copy(process.historicoEnvios || []),
      historicoAcoes: copy(process.historicoAcoes || []),
      seeded: { DIVACP: false, DIVCON: false, CEC: false, CPC: false, DIPREG: false },
      updatedAt: new Date().toISOString()
    };
  }

  function applyRecord(process, record, opts = {}) {
    if (!record || !record.fields) return false;
    let changed = false;
    const skipFields = new Set(opts.skipFields || []);
    ALL.forEach(field => {
      if (skipFields.has(field) || !Object.prototype.hasOwnProperty.call(record.fields, field)) return;
      if (!compare(process[field], record.fields[field])) {
        process[field] = copy(record.fields[field]);
        changed = true;
      }
    });
    if (!opts.skipRoute && record.setorAtual && process.setorAtual !== record.setorAtual) {
      process.setorAtual = record.setorAtual;
      changed = true;
    }
    for (const field of ['historicoEnvios','historicoAcoes']) {
      const merged = mergeList(process[field], record[field]);
      if (!compare(merged, process[field])) {
        process[field] = merged;
        changed = true;
      }
    }
    // Campos auxiliares usados pelas tabelas e pelo formulário em cada setor.
    if (changed) {
      process.assunto = process.objeto || '';
      process.prazo = process.dataFinal || '';
      process.observacoes = process.andamento || '';
      process.copiaDivacp = {
        numero: process.numero || '', dataEntradaSelic: process.dataEntradaSelic || '',
        orgao: process.orgao || '', objeto: process.objeto || '',
        modalidade: process.modalidade || '', numeroLicitacao: process.numeroLicitacao || '',
        fonte: process.fonte || '', valorEstimado: process.valorEstimado ?? '',
        anoLicitacao: process.anoLicitacao || '', linkProcesso: process.linkProcesso || ''
      };
    }
    return changed;
  }

  function snapshot(process) {
    const fields = {};
    ALL.forEach(field => fields[field] = copy(process[field] ?? ''));
    fields.setorAtual = process.setorAtual || '';
    return fields;
  }

  function writeRegistry(records) {
    const raw = JSON.stringify(records);
    if (raw === localStorage.getItem(KEY)) return;
    localStorage.setItem(KEY, raw);
    lastSeen = raw;
  }

  // Primeiro acesso de uma nova versão: vincula cópias por ID da transferência
  // e recupera os dados já existentes sem apagar informações da DIVCON.
  function init(sector, api) {
    context = { sector, ...api };
    const records = load();
    if (!records) return;
    let modifiedRegistry = false;
    let modifiedLocal = false;
    const bus = transferBus();
    for (const process of context.getProcesses()) {
      const oldId = process.syncId;
      const id = assignId(sector, process, bus);
      if (!id) continue;
      if (!oldId) modifiedLocal = true;
      let record = records[id];
      if (!record) {
        record = newRecord(process);
        records[id] = record;
        modifiedRegistry = true;
      }
      if (!record.seeded) record.seeded = { DIVACP: false, DIVCON: false, CEC: false, CPC: false, DIPREG: false };
      if (!record.seeded[sector]) {
        ownedBy(sector).forEach(field => {
          if (process[field] !== undefined) record.fields[field] = copy(process[field]);
        });
        // Setor da tramitação que existe antes de instalar a sincronização.
        if (sector === 'DIVACP' && process.setorAtual) record.setorAtual = process.setorAtual;
        record.historicoEnvios = mergeList(record.historicoEnvios, process.historicoEnvios);
        record.historicoAcoes = mergeList(record.historicoAcoes, process.historicoAcoes);
        record.seeded[sector] = true;
        record.updatedAt = new Date().toISOString();
        modifiedRegistry = true;
      }
      if (applyRecord(process, record)) modifiedLocal = true;
      snapshots.set(id, snapshot(process));
    }
    try {
      if (modifiedRegistry) writeRegistry(records);
      if (modifiedLocal) context.saveLocal();
    } catch (e) { console.error('Sincronização inicial indisponível:', e); }
    lastSeen = localStorage.getItem(KEY) || '';
    window.addEventListener('storage', event => {
      if (event.key === KEY) pull();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pull();
    });
    window.addEventListener('focus', pull);
    window.setInterval(pull, 1700);
  }

  function save() {
    if (!context || inSync) return;
    const records = load();
    if (!records) return;
    const bus = transferBus();
    let changedRegistry = false;
    for (const process of context.getProcesses()) {
      const id = assignId(context.sector, process, bus);
      if (!id) continue;
      let record = records[id];
      if (!record) {
        record = newRecord(process);
        records[id] = record;
        changedRegistry = true;
      }
      const baseline = snapshots.get(id);
      if (!record.seeded) record.seeded = { DIVACP: false, DIVCON: false, CEC: false, CPC: false, DIPREG: false };
      const createdForSector = !record.seeded[context.sector];
      const localChanges = new Set();
      const myFields = ownedBy(context.sector);
      myFields.forEach(field => {
        const wasEdited = baseline && !compare(process[field], baseline[field]);
        if (wasEdited || createdForSector) {
          const value = process[field] ?? '';
          if (!compare(record.fields[field], value)) {
            record.fields[field] = copy(value);
            changedRegistry = true;
          }
          localChanges.add(field);
        }
      });
      const routeChanged = baseline && !compare(process.setorAtual, baseline.setorAtual);
      if (routeChanged || !record.setorAtual) {
        if (record.setorAtual !== process.setorAtual) {
          record.setorAtual = process.setorAtual;
          changedRegistry = true;
        }
      }
      if (createdForSector) {
        record.seeded[context.sector] = true;
        changedRegistry = true;
      }
      for (const field of ['historicoEnvios','historicoAcoes']) {
        const merged = mergeList(record[field], process[field]);
        if (!compare(merged, record[field])) {
          record[field] = merged;
          changedRegistry = true;
        }
      }
      // Campos de outro setor vêm sempre do registro compartilhado;
      // campos próprios só são atualizados remotamente se não foram editados.
      applyRecord(process, record, {
        skipFields: [...localChanges],
        skipRoute: Boolean(routeChanged)
      });
      snapshots.set(id, snapshot(process));
      if (changedRegistry) record.updatedAt = new Date().toISOString();
    }
    if (changedRegistry) writeRegistry(records);
  }

  function refreshVisibleDetails() {
    const form = document.querySelector('#editProcessForm');
    const activeId = form?.elements?.id?.value;
    if (!activeId || !context) return;
    const process = context.getProcesses().find(p => p.id === activeId);
    if (!process) return;
    const detailSection = document.querySelector('#section-processo-detalhe');
    if (detailSection && (detailSection.hidden || detailSection.classList.contains('hidden'))) return;
    ALL.forEach(field => {
      const input = form.elements[field];
      if (input && (input.disabled || input.readOnly)) input.value = process[field] ?? '';
    });
    const title = document.querySelector('#detailProcessTitle');
    if (title) title.textContent = process.numero || 'Informações do processo';
    const link = document.querySelector('#editLinkProcesso');
    if (link && (link.disabled || link.readOnly)) link.value = process.linkProcesso || '';
    const editLinkButton = document.querySelector('[data-link-input="editLinkProcesso"]');
    if (editLinkButton && typeof updateLinkButton === 'function') updateLinkButton(editLinkButton);
    // A atualização do texto também atualiza o link somente para leitura.
  }

  function pull() {
    if (!context || inSync) return;
    const raw = localStorage.getItem(KEY) || '';
    if (!raw || raw === lastSeen) return;
    const records = load();
    if (!records) return;
    inSync = true;
    let modifiedLocal = false;
    try {
      const bus = transferBus();
      for (const process of context.getProcesses()) {
        const id = assignId(context.sector, process, bus);
        if (!id || !records[id]) continue;
        if (applyRecord(process, records[id])) modifiedLocal = true;
        snapshots.set(id, snapshot(process));
      }
      if (modifiedLocal) {
        context.saveLocal();
        context.refresh();
        refreshVisibleDetails();
      }
      lastSeen = raw;
    } finally {
      inSync = false;
    }
  }

  window.SEADSync = { init, save, pull, sharedKey: KEY };
})();
