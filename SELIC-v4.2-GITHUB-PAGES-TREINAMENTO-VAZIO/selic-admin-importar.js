/* SELIC — importação administrativa de planilhas por setor e por pregoeiro.
   Execução local no navegador: para sincronização entre máquinas é necessário backend. */
(() => {
  'use strict';
  const keys={DIVACP:'divacp_processos_v17',DIVCON:'divcon_processos_v2',DIPREG:'dipreg_processos_v1',CEC:'cec_processos_v1',CPC:'cpc_processos_v1'};
  const pregoeiros=[
    'aline.souto','brunaa.almeida','carolyne.renata','franciscosouza.neto','francisco.inacio',
    'gardenio.martins','greice.silva','janaina.cunha','janda.araujo','joelson.amorim',
    'jose.castro','sandra.barbosa','valdemir.almeida','wilton.silva','laura.monteiro','juanez.barroso'
  ];
  const $=id=>document.getElementById(id);
  const escape=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const normalized=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const normalizeHeader=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  const normalizeNumber=s=>String(s??'').replace(/\s+/g,'').toUpperCase();
  const status=(text,type='')=>{const el=$('selicImportStatus');el.className='selic-import-status '+type;el.textContent=text;};
  const getCurrentUser=()=>{
    try {
      const session=JSON.parse(localStorage.getItem('selic_session_v1')||'null');
      const access=JSON.parse(localStorage.getItem('selic_access_admin_demo_v2')||'null');
      const user=access?.users?.find(u=>u.id===session?.userId);
      if(session?.isAdmin&&user?.active&&(user.profiles||[]).includes('ADMINISTRADOR') &&
        !user.forcePasswordChange && (user.passwordVersion||0)===(session.passwordVersion||0)) return user;
    } catch(_) {}
    return null;
  };
  let preview=null;
  function clearPreview(){preview=null;$('selicImportPreview').hidden=true;$('selicImportSummary').textContent='';}
  function valueAsText(v){return String(v??'').trim();}
  function excelDate(value){
    if(value===undefined||value===null||value==='')return '';
    const text=valueAsText(value);
    if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(text)){const [d,m,y]=text.split('/');return `${y}-${m}-${d}`;}
    const num=Number(text);
    if(Number.isFinite(num)&&num>20000&&num<100000){
      const d=new Date(Date.UTC(1899,11,30)+Math.floor(num)*86400000);
      return d.toISOString().slice(0,10);
    }
    return '';
  }
  function excelTime(value){
    const text=valueAsText(value);
    if(/^\d{1,2}:\d{2}/.test(text))return text.slice(0,5);
    const n=Number(text);
    if(Number.isFinite(n)&&n>0&&n<1){const mins=Math.round(n*24*60)%(24*60);return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');}
    return text;
  }
  function getXml(xml){
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw Error('O Excel possui conteúdo XML inválido.');
    return doc;
  }
  function elements(el,name){return Array.from(el.getElementsByTagNameNS('*',name));}
  function first(el,name){return elements(el,name)[0]||null;}
  function textOf(el){return el?.textContent||'';}
  function columnNumber(cell){const letters=(cell.getAttribute('r')||'').match(/^[A-Z]+/i)?.[0]||'';
    let c=0;for(const letter of letters.toUpperCase())c=c*26+letter.charCodeAt(0)-64;return c-1;}
  async function readExcel(file){
    if(typeof JSZip!=='function')throw Error('Não foi possível carregar o leitor Excel local. Verifique o arquivo jszip.min.js.');
    const zip=await JSZip.loadAsync(await file.arrayBuffer());
    const shared=[];
    if(zip.file('xl/sharedStrings.xml')){
      const doc=getXml(await zip.file('xl/sharedStrings.xml').async('string'));
      for(const si of elements(doc,'si'))shared.push(elements(si,'t').map(textOf).join(''));
    }
    let sheets=[];
    const workbook=zip.file('xl/workbook.xml');
    const rels=zip.file('xl/_rels/workbook.xml.rels');
    if(workbook&&rels){
      const wb=getXml(await workbook.async('string'));
      const rel=getXml(await rels.async('string'));
      const map=new Map(elements(rel,'Relationship').map(x=>[x.getAttribute('Id'),x.getAttribute('Target')]));
      for(const sheet of elements(wb,'sheet')){
        const id=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
        let dest=map.get(id)||'';
        if(dest.startsWith('/'))dest=dest.replace(/^\//,'');
        else if(!dest.startsWith('xl/'))dest='xl/'+dest.replace(/^\.\//,'');
        if(zip.file(dest))sheets.push({name:sheet.getAttribute('name')||dest,path:dest});
      }
    }
    if(!sheets.length){sheets=Object.keys(zip.files).filter(p=>/^xl\/worksheets\/sheet\d+\.xml$/i.test(p)).sort().map(p=>({name:p,path:p}));}
    if(!sheets.length)throw Error('Não encontrei uma aba de dados neste Excel.');
    const output=[];
    for(const sheet of sheets){
      const doc=getXml(await zip.file(sheet.path).async('string'));
      const rows=[];
      for(const row of elements(first(doc,'sheetData')||doc,'row')){
        const cells=[];
        for(const c of elements(row,'c')){
          const n=columnNumber(c);if(n<0||n>120)continue;
          const kind=c.getAttribute('t');
          let val=textOf(first(c,'v'));
          if(kind==='s')val=shared[Number(val)]??'';
          else if(kind==='inlineStr')val=elements(c,'t').map(textOf).join('');
          cells[n]=val;
        }
        rows.push(cells);
      }
      if(rows.length)output.push({name:sheet.name,rows});
    }
    if(!output.length)throw Error('O arquivo Excel não contém linhas de dados.');
    return output;
  }
  function parseCsv(source){
    const text=source.replace(/^\uFEFF/,'');
    const firstLine=text.split(/\r?\n/,1)[0]||'';
    const delims=[';',',','\t'];
    const delimiter=delims.sort((a,b)=>firstLine.split(b).length-firstLine.split(a).length)[0];
    let rows=[],line=[],word='',inside=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(ch==='"'){
        if(inside&&text[i+1]==='"'){word+='"';i++;}else inside=!inside;
      }else if(ch===delimiter&&!inside){line.push(word);word='';}
      else if((ch==='\n'||ch==='\r')&&!inside){if(ch==='\r'&&text[i+1]==='\n')i++;line.push(word);if(line.some(x=>x.trim()))rows.push(line);line=[];word='';}
      else word+=ch;
    }
    line.push(word);if(line.some(x=>x.trim()))rows.push(line);
    return [{name:'CSV',rows}];
  }
  function findHeader(rows){
    for(let i=0;i<Math.min(rows.length,18);i++){
      const h=(rows[i]||[]).map(normalizeHeader);
      const hasProcess=h.some(x=>/PROCESSO|N\s*PROCESS/.test(x));
      const hasOther=h.some(x=>/MODALIDADE|OBJETO|LICITACAO|ORGAO|RESPONSAVEL/.test(x));
      if(hasProcess&&hasOther)return i;
    }
    throw Error('Cabeçalho não identificado: a planilha precisa ter uma coluna Número do Processo e outras colunas de identificação.');
  }
  function readRecords(sheets,sector,pregoeiro,fileName){
    const result=[];let rejected=0;
    for(const sheet of sheets){
      let start;
      try{start=findHeader(sheet.rows);}catch(_){continue;}
      const headers=sheet.rows[start].map(normalizeHeader);
      const sub=(sheet.rows[start+1]||[]).map(normalizeHeader);
      const find=(patterns)=>headers.findIndex(h=>patterns.some(p=>p.test(h)));
      const at=(row,ix)=>ix>=0?valueAsText(row[ix]):'';
      const pick=(row,patterns)=>at(row,find(patterns));
      const dipregLayout=sector==='DIPREG'&&/PROCESSO/.test(headers[0]||'')&&/MODALIDADE/.test(headers[1]||'')&&/LICITACAO/.test(headers[2]||'')&&/OBJETO/.test(headers[4]||'');
      const secondIsSub= sub.some(x=>/DATA ENTRADA|DATA SAIDA|DATA INICIAL|DATA FINAL|HORA/.test(x));
      const offset=start+1+(secondIsSub?1:0);
      for(let i=offset;i<sheet.rows.length;i++){
        const row=sheet.rows[i];
        let numero=pick(row,[/PROCESSO/,/^N PROCESS/]);
        if(dipregLayout)numero=at(row,0);
        numero=normalizeNumber(numero);
        if(!numero)continue;
        if(numero.length<8||!/[0-9]/.test(numero)||/^(PROCESSO|TOTAL|OBSERVACAO)/.test(numero)){rejected++;continue;}
        const record={numero, setorAtual:sector,setorResponsavel:sector,historicoEnvios:[],historicoAcoes:[]};
        const set=(field,val)=>{if(valueAsText(val)!=='')record[field]=val;};
        set('modalidade',pick(row,[/MODALIDADE/]));
        set('numeroLicitacao',pick(row,[/LICITACAO/,/CERTAME/]));
        set('fonte',pick(row,[/FONTE/,/RECURSO/]));
        set('objeto',pick(row,[/OBJETO/,/ASSUNTO/,/DESCRICAO/]));
        set('orgao',pick(row,[/^ORGAO$/, /ORGAO SOLICITANTE/]));
        set('dataEntradaSelic',excelDate(pick(row,[/DATA ENTRADA SELIC/,/ENTRADA SELIC/])));
        set('anoLicitacao',pick(row,[/ANO LICITACAO/,/ANO DO PREGAO/]));
        set('linkProcesso',pick(row,[/LINK PROCESSO/,/URL PROCESSO/]));
        if(dipregLayout){
          set('modalidade',at(row,1));set('numeroLicitacao',at(row,2));set('fonte',at(row,3));
          set('objeto',at(row,4));set('orgao',at(row,5));
          set('dataEntradaSelic',excelDate(at(row,6)));
          set('dataEntradaDipreg',excelDate(at(row,7)));set('dataSaidaDipreg',excelDate(at(row,8)));
          set('statusDipreg',at(row,9));set('dataInicial',excelDate(at(row,12)));set('dataFinal',excelDate(at(row,13)));
          set('dataAbertura',excelDate(at(row,14)));set('aberturaPregaoDipreg',excelDate(at(row,14)));
          set('hora',excelTime(at(row,15)));set('itensLote',at(row,16));
          set('valorEstimado',at(row,17));set('valorDesertoFracassado',at(row,18));
          set('valorEstimadoAtualizado',at(row,19));set('valorAdjudicado',at(row,20));
          set('seiPlanilhaComparativa',at(row,21));set('andamento',at(row,22));
        }
        if(sector==='DIPREG'){
          record.pregoeiroDipreg=pregoeiro;
          record.responsavel=pregoeiro;
          record.recebidoDipreg=true;
          record.origemRecebimentoDipreg='IMPORTAÇÃO ADMINISTRATIVA';
          record.fontePlanilhaDipreg=fileName;
          if(!record.statusDipreg)set('statusDipreg',pick(row,[/^STATUS$/, /SITUACAO/]));
        } else {
          const cap=sector[0]+sector.slice(1).toLowerCase();
          set('status'+cap,pick(row,[/^STATUS$/, /SITUACAO/]));
          if(sector==='CEC')record.recebidoCec=true;
          if(sector==='CPC')record.recebidoCpc=true;
          if(sector==='DIVCON'){
            record.recebidoDivcon=true;
            set('situacaoMinutEdital',pick(row,[/SITUACAO.*MINUT/,/MINUT.*EDITAL/]));
            set('responsavelPublicacao',pick(row,[/RESPONSAVEL.*PUBLICACAO/]));
          }
        }
        set('status',pick(row,[/^STATUS$/]));
        if(record.modalidade){record.modalidade=record.modalidade.replace(/PREGAO\s+ELETRONICO/gi,'PREGÃO ELETRÔNICO').replace(/PREGÃO\s+ELETRONICO/gi,'PREGÃO ELETRÔNICO');}
        result.push(record);
      }
    }
    if(!result.length)throw Error('Nenhum processo válido foi encontrado. Verifique se a planilha contém a coluna Nº Processo e os dados esperados.');
    const byNumber=new Map();
    for(const r of result){const prior=byNumber.get(r.numero);if(!prior){byNumber.set(r.numero,r);continue;}
      // No mesmo arquivo, completar informações sem descartar dados anteriores.
      for(const [k,v] of Object.entries(r))if((prior[k]==null||prior[k]==='')&&v!==''&&v!=null)prior[k]=v;
    }
    return {records:[...byNumber.values()], rejected, repeated:result.length-byNumber.size};
  }
  function loadCurrent(sector){
    const raw=localStorage.getItem(keys[sector]);if(!raw)return [];
    const list=JSON.parse(raw);if(!Array.isArray(list))throw Error('Os dados locais deste setor não estão em formato de lista.');
    return list;
  }
  function compare(records,existing,sector){
    const map=new Map(existing.filter(p=>p?.numero).map(p=>[normalizeNumber(p.numero),p]));
    let added=0, updated=0, reassigned=0;
    for(const p of records){const old=map.get(p.numero);if(!old){added++;continue;}updated++;
      if(sector==='DIPREG'&&normalized(old.pregoeiroDipreg||old.responsavel)!==normalized(p.pregoeiroDipreg))reassigned++;
    }
    return {added,updated,reassigned,map};
  }
  function mergeData(existing,records,sector){
    const result=existing.slice(),index=new Map();
    result.forEach((p,i)=>{if(p?.numero)index.set(normalizeNumber(p.numero),i);});
    for(const incoming of records){
      const found=index.get(incoming.numero);
      if(found===undefined){
        const safe=incoming.numero.replace(/[^A-Z0-9]/g,'_').slice(0,65);
        result.push({...incoming,id:`import-admin-${sector.toLowerCase()}-${safe}-${result.length}`,importadoPelaAdministracao:true});
        index.set(incoming.numero,result.length-1);
      }else{
        const old=result[found];
        const next={...old};
        for(const [field,value] of Object.entries(incoming)){
          if(field==='numero'||field==='id'||field==='historicoEnvios'||field==='historicoAcoes'||field==='setorAtual')continue;
          if(sector==='DIPREG'&&(field==='responsavel'||field==='pregoeiroDipreg')){next[field]=value;continue;}
          if((next[field]===undefined||next[field]===null||next[field]==='')&&value!==''&&value!=null)next[field]=value;
        }
        result[found]=next;
      }
    }
    return result;
  }
  function downloadJson(name,data){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);
  }
  function init(){
    const file=$('selicImportFile'),sector=$('selicImportSector'),person=$('selicImportPregoeiro');
    if(!file||!sector||!person)return;
    person.innerHTML='<option value="">Selecione o pregoeiro</option>'+pregoeiros.map(p=>`<option value="${escape(p)}">${escape(p)}</option>`).join('');
    // Acessível apenas a quem possui perfil de Administração aprovado.
    const invalidate=()=>{clearPreview();status('');};
    file.addEventListener('change',invalidate);person.addEventListener('change',invalidate);
    sector.addEventListener('change',()=>{$('selicImportPregoeiroWrap').hidden=sector.value!=='DIPREG';person.value='';invalidate();});
    $('selicImportCancel').addEventListener('click',()=>{invalidate();});
    $('selicImportBackup').addEventListener('click',()=>{
      if(!getCurrentUser())return status('Somente a Administração pode exportar esta base.','error');
      if(!keys[sector.value])return status('Selecione primeiro o setor para gerar o backup.','error');
      try{downloadJson(`SELIC-backup-${sector.value}-${new Date().toISOString().slice(0,10)}.json`,loadCurrent(sector.value));status('Backup JSON do setor solicitado para download.','success');}
      catch(err){status('Falha ao gerar backup: '+err.message,'error');}
    });
    $('selicImportReview').addEventListener('click',async()=>{
      invalidate();
      if(!getCurrentUser())return status('O perfil de Administração é obrigatório para importar.','error');
      const target=sector.value, owner=person.value, selected=file.files?.[0];
      if(!selected)return status('Escolha a planilha antes de continuar.','error');
      if(!keys[target])return status('Informe para qual setor a planilha deve ser importada.','error');
      if(target==='DIPREG'&&!pregoeiros.includes(owner))return status('Selecione o pregoeiro que será responsável pelos processos da DIPREG.','error');
      if(selected.size>40*1024*1024)return status('Arquivo acima de 40 MB. Separe em planilhas menores.','error');
      if(!/\.(xlsx|csv)$/i.test(selected.name))return status('Formato não reconhecido. Selecione .xlsx ou .csv.','error');
      try{
        status('Analisando planilha; aguarde...');
        const sheets=/\.csv$/i.test(selected.name)?parseCsv(await selected.text()):await readExcel(selected);
        const parsed=readRecords(sheets,target,owner,selected.name);
        const current=loadCurrent(target);
        const comparison=compare(parsed.records,current,target);
        preview={sector:target,owner,file:selected,records:parsed.records,parsed};
        $('selicImportSummary').textContent=`${parsed.records.length} processo(s) único(s) • ${comparison.added} novo(s) • ${comparison.updated} já existente(s) • ${comparison.reassigned} responsável(is) diferente(s) • ${parsed.repeated} repetição(ões) dentro do arquivo.`;
        const map=comparison.map;
        $('selicImportTable').innerHTML=parsed.records.slice(0,20).map(p=>`<tr><td>${escape(p.numero)}</td><td>${escape(p.modalidade||'—')}</td><td>${escape(p.orgao||'—')}</td><td>${escape(target==='DIPREG'?owner:'—')}</td><td>${map.has(p.numero)?'Já existe — conciliar':'Novo'}</td></tr>`).join('');
        $('selicImportPreview').hidden=false;
        status(`Conferência pronta: ${parsed.records.length} processo(s). Exibindo até 20 na prévia. ${parsed.rejected?'Linhas sem número de processo válido ignoradas: '+parsed.rejected+'.':''}`);
      }catch(err){clearPreview();status('Não foi possível ler a planilha: '+err.message,'error');console.error('SELIC importação:',err);}
    });
    $('selicImportApply').addEventListener('click',()=>{
      if(!getCurrentUser())return status('Somente a Administração pode concluir a importação.','error');
      if(!preview||preview.sector!==sector.value||preview.owner!==person.value||preview.file!==file.files?.[0])return status('Selecione e confira novamente o arquivo antes de importar.','error');
      const target=preview.sector, owner=preview.owner, old=loadCurrent(target),stats=compare(preview.records,old,target);
      const warning=stats.reassigned?` Atenção: ${stats.reassigned} processo(s) existente(s) serão atribuídos ao pregoeiro selecionado.`:'';
      if(!confirm(`Confirmar importação de ${preview.records.length} processos para ${target}${target==='DIPREG'?' / '+preview.owner:''}? ${stats.added} novos e ${stats.updated} já existentes.${warning} Os demais dados preenchidos serão preservados.`))return;
      try{
        const merged=mergeData(old,preview.records,target);
        localStorage.setItem(keys[target],JSON.stringify(merged));
        // Evita que a inicialização de treinamento apague a primeira importação administrativa.
        localStorage.setItem('selic_inicio_producao_sem_treinamento_v1','1');
        // Atualiza também as telas que já estão abertas neste navegador.
        localStorage.setItem('selic_ultima_importacao_admin_v1',JSON.stringify({setor:target,pregoeiro:preview.owner,quantidade:preview.records.length,em:new Date().toISOString()}));
        if(typeof state!=='undefined' && Array.isArray(state.audit)){
          state.audit.unshift({id:`import_${Date.now()}`,action:'IMPORTAÇÃO DE PLANILHA',detail:`${target} ${preview.owner||''}: ${preview.records.length} processos (${stats.added} novos)`,at:new Date().toISOString()});
          if(typeof saveState==='function')saveState();
        }
        clearPreview();file.value='';
        status(`Importação concluída! ${stats.added} processo(s) novo(s), ${stats.updated} conciliado(s) no setor ${target}${target==='DIPREG'?' / '+owner:''}. Acesse a página do setor para consultar os registros e os relatórios.`, 'success');
      }catch(err){status('Não foi possível salvar: '+err.message+'. Baixe o backup e verifique o espaço de armazenamento deste navegador.','error');}
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
