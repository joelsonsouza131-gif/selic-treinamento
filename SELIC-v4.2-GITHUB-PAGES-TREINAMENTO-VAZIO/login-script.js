"use strict";
const STORAGE_KEY="selic_access_admin_demo_v2";
const REMEMBER_KEY="selic_login_remember_v2";
const SESSION_KEY="selic_session_v1";
const SECTOR_PAGES={DIVACP:"DIVACP.html",DIVCON:"DIVCON.html",CEC:"CEC.html",CPC:"CPC.html",DIPREG:"DIPREG.html"};
const sectors=["DIVACP","DIVCON","CEC","CPC","DIPREG"];
const nowIso=()=>new Date().toISOString();
const today=()=>new Date().toLocaleDateString("pt-BR");
const uid=(p="id")=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const escapeHtml=(v)=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
// Padrão de senha provisória da Administração: SELIC + 4 dígitos (ex.: SELIC0042).
// Usa sorteio criptográfico com rejeição para evitar viés e não repete credenciais ativas ou emitidas no mesmo lote.
function tempPassword(usedPasswords = new Set()) {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Navegador sem geração segura de senhas.");
  const range = 10000;
  const limit = Math.floor(0x100000000 / range) * range;
  const random = new Uint32Array(1);
  for (let attempt = 0; attempt < 1000; attempt++) {
    crypto.getRandomValues(random);
    if (random[0] >= limit) continue;
    const candidate = "SELIC" + String(random[0] % range).padStart(4, "0");
    if (usedPasswords.has(candidate) || state.users.some(u => u.password === candidate)) continue;
    usedPasswords.add(candidate);
    return candidate;
  }
  throw new Error("Não foi possível emitir senha provisória exclusiva.");
}
function seedState(){return{users:[{id:"admin_1",name:"Administrador SELIC",username:"admin",password:"ADMIN1234",profiles:["ADMINISTRADOR","DIVACP","DIVCON","CEC","CPC","DIPREG"],active:true,forcePasswordChange:false,lastAccess:"—"}],requests:[],passwordRequests:[],sectors:sectors.map(s=>({id:s,name:s,active:true})),statuses:["PROCESSOS","PUBLICAR LICON","REL ANDAMENTO","SUSPENSO QUEST IMPUG","SUSPENSO PARA PARECER","RECURSO","FINALIZADOS"].map((name,i)=>({id:`status_${i}`,name,active:true})),processes:[],audit:[]};}
function loadState(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");return s&&s.users? s:seedState();}catch{return seedState();}}
// Pré-cadastros administrativos: não são solicitações enviadas pelos usuários.
// Apenas tornam visíveis na Administração os pregoeiros indicados para revisão.
const SELIC_PRE_CADASTROS_PREGOEIROS = [
  ["aline.souto", "Aline Souto"],
  ["brunaa.almeida", "Bruna Almeida"],
  ["carolyne.renata", "Carolyne Renata"],
  ["franciscosouza.neto", "Francisco Souza Neto"],
  ["francisco.inacio", "Francisco Inácio"],
  ["gardenio.martins", "Gardênio Martins"],
  ["greice.silva", "Greice Silva"],
  ["janaina.cunha", "Janaína Cunha"],
  ["janda.araujo", "Janda Araújo"],
  ["joelson.amorim", "Joelson Amorim"],
  ["jose.castro", "jose.castro"],
  ["sandra.barbosa", "Sandra Barbosa"],
  ["valdemir.almeida", "Valdemir Almeida"],
  ["wilton.silva", "Wilton Silva"],
  ["laura.monteiro", "Laura Monteiro"],
  ["juanez.barroso", "Juanez Barroso"]
];
function garantirPreCadastrosPregoeiros() {
  if (!Array.isArray(state.users)) state.users = [];
  if (!Array.isArray(state.requests)) state.requests = [];
  const usuarios = new Set(state.users.map(u => String(u.username || "").trim().toLowerCase()));
  const solicitados = new Set(state.requests.map(r => String(r.username || "").trim().toLowerCase()));
  let novos = 0;
  let alterados = false;
  for (const registro of [...state.users, ...state.requests]) {
    if (String(registro.username || '').toLowerCase() === 'jose.castro' && /^alberto$/i.test(String(registro.name||'').trim())) {
      registro.name = 'jose.castro'; alterados = true;
    }
  }
  for (const [username, name] of SELIC_PRE_CADASTROS_PREGOEIROS) {
    if (usuarios.has(username) || solicitados.has(username)) continue;
    state.requests.push({
      id: `pre_dipreg_${username.replace(/[^a-z0-9]/g, "_")}`,
      name, username, sector: "DIPREG", desiredPassword: "",
      origin: "PRE_CADASTRO_ADMIN", status: "PENDENTE",
      createdAt: nowIso(), decisionAt: "", decision: ""
    });
    novos++;
  }
  if (novos || alterados) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
let state=loadState();
garantirPreCadastrosPregoeiros();
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));renderAll();}
function audit(action,detail){state.audit.unshift({id:uid("audit"),action,detail,at:nowIso()});}
let sessionUser=null,activeProfile=null,currentRequestTab="pending",currentPasswordTab="pending",currentRecordTab="statuses",editingUserId=null;
let requestedLoginProfile=null;
const selecionadosParaRedefinir = new Set();
function allowedLoginProfile(user, profile) {
  if (!user || !user.active || !profile) return false;
  const profiles = user.profiles || [];
  if (profile === "ADMINISTRADOR") return profiles.includes("ADMINISTRADOR");
  return sectors.includes(profile)
    && (profiles.includes(profile) || profiles.includes("ADMINISTRADOR"))
    && state.sectors.some(s => s.name === profile && s.active);
}
const $=(s)=>document.querySelector(s), $$=(s)=>[...document.querySelectorAll(s)];
function showToast(msg){let t=$("#toast");if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t)}t.textContent=msg;t.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove("show"),2600)}
function initials(name){return String(name||"US").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function dateTime(v){if(!v)return"—";return new Date(v).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}
function formatProfiles(p){return p.map(x=>`<span class="status-pill active">${escapeHtml(x)}</span>`).join(" ")}
function saveSession(user,profile){
  const payload={userId:user.id,username:user.username,name:user.name,profiles:[...(user.profiles||[])],activeProfile:profile,isAdmin:(user.profiles||[]).includes("ADMINISTRADOR"),passwordVersion:user.passwordVersion||0,loggedAt:nowIso()};
  localStorage.setItem(SESSION_KEY,JSON.stringify(payload));
  return payload;
}
function clearSession(){localStorage.removeItem(SESSION_KEY)}
function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null")}catch{return null}}
function goToProfile(profile){
  if(profile==="ADMINISTRADOR")return false;
  const page=SECTOR_PAGES[profile];
  if(page){location.href=page;return true}
  return false;
}

function openDialog(id){const d=document.getElementById(id);if(d?.showModal)d.showModal()}
function closeDialog(id){const d=document.getElementById(id);if(d?.open)d.close()}
$$('[data-close]').forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));

$("#toggleLoginPassword").addEventListener("click",()=>{const i=$("#loginPassword");i.type=i.type==="password"?"text":"password"});
try{const u=localStorage.getItem(REMEMBER_KEY);if(u)$("#loginUsername").value=u}catch{}
const authFrame=$("#authFrame");
function showRegisterMode(){ $("#registerForm").reset();$("#registerFeedback").hidden=true;authFrame?.classList.add("register-mode"); }
function showLoginMode(){authFrame?.classList.remove("register-mode");}
$("#openRegister")?.addEventListener("click",showRegisterMode);
$("#panelOpenRegister")?.addEventListener("click",showRegisterMode);
$("#backToLogin")?.addEventListener("click",showLoginMode);
$("#panelBackToLogin")?.addEventListener("click",showLoginMode);
$("#openReset").addEventListener("click",()=>{ $("#resetForm").reset();$("#resetFeedback").hidden=true;openDialog("resetDialog")});

$("#registerForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#regName").value.trim(),username=$("#regUsername").value.trim().toLowerCase(),sector=$("#regSector").value,pass=$("#regPassword").value,pass2=$("#regPassword2").value,fb=$("#registerFeedback");fb.hidden=true;if(!name||!username||!sector||!pass||!pass2){fb.textContent="Preencha todos os campos.";fb.hidden=false;return}if(!/^[a-z0-9._-]{3,}$/i.test(username)){fb.textContent="Use apenas letras, números, ponto, hífen ou sublinhado no usuário.";fb.hidden=false;return}if(pass.length<6||pass!==pass2){fb.textContent=pass.length<6?"A senha deve ter ao menos 6 caracteres.":"As senhas não coincidem.";fb.hidden=false;return}if(state.users.some(u=>u.username.toLowerCase()===username)||state.requests.some(r=>r.username.toLowerCase()===username&&r.status==="PENDENTE")){fb.textContent="Este usuário já existe ou possui solicitação pendente.";fb.hidden=false;return}state.requests.unshift({id:uid("req"),name,username,sector,desiredPassword:pass,status:"PENDENTE",createdAt:nowIso(),decisionAt:"",decision:""});audit("SOLICITAÇÃO DE CADASTRO",`${username} solicitou acesso ao setor ${sector}`);saveState();showLoginMode();showToast("Solicitação enviada ao administrador.")});

$("#resetForm").addEventListener("submit",e=>{e.preventDefault();const username=$("#resetUsername").value.trim().toLowerCase(),fb=$("#resetFeedback");fb.hidden=true;const user=state.users.find(u=>u.username.toLowerCase()===username&&u.active);if(!user){fb.textContent="Usuário ativo não encontrado.";fb.hidden=false;return}if(state.passwordRequests.some(r=>r.username===username&&r.status==="PENDENTE")){fb.textContent="Já existe uma solicitação pendente para este usuário.";fb.hidden=false;return}state.passwordRequests.unshift({id:uid("pwd"),userId:user.id,username:user.username,name:user.name,status:"PENDENTE",createdAt:nowIso(),decisionAt:"",decision:""});audit("REDEFINIÇÃO SOLICITADA",username);saveState();closeDialog("resetDialog");showToast("Solicitação de senha enviada ao administrador.")});

$("#loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const username = $("#loginUsername").value.trim().toLowerCase();
  const pass = $("#loginPassword").value;
  const profile = $("#loginSector").value;
  const fb = $("#loginFeedback");
  fb.hidden = true;
  if (!username || !pass || !profile) {
    fb.textContent = "Preencha usuário, senha e selecione o setor de acesso.";
    fb.hidden = false;
    return;
  }
  const user = state.users.find(u => u.username.toLowerCase() === username && u.active);
  if (!user || user.password !== pass) {
    fb.textContent = "Usuário ou senha inválidos, ou acesso ainda não aprovado.";
    fb.hidden = false;
    return;
  }
  if (!allowedLoginProfile(user, profile)) {
    fb.textContent = `Seu usuário não possui acesso aprovado ao perfil ${profile}. Se necessário, solicite a autorização ao administrador.`;
    fb.hidden = false;
    return;
  }
  if ($("#rememberUser").checked) localStorage.setItem(REMEMBER_KEY, username);
  else localStorage.removeItem(REMEMBER_KEY);
  requestedLoginProfile = profile;
  sessionUser = user;
  user.lastAccess = nowIso();
  saveState();
  if (user.forcePasswordChange) {
    openDialog("firstPasswordDialog");
    return;
  }
  enterProfile(profile);
});
function chooseProfileAfterLogin(){if(!sessionUser)return;const profiles=sessionUser.profiles.filter(p=>p==="ADMINISTRADOR"||state.sectors.some(s=>s.name===p&&s.active));if(profiles.length===1)enterProfile(profiles[0]);else{renderProfilePicker();openDialog("profileDialog")}}
function renderProfilePicker(){const profiles=sessionUser?.profiles||[];$("#profilePicker").innerHTML=profiles.map(p=>`<button class="profile-choice" type="button" data-profile-choice="${p}"><strong>${p}</strong><span>${p==="ADMINISTRADOR"?"Administração total":"Acessar setor"} →</span></button>`).join("");$$('[data-profile-choice]').forEach(b=>b.addEventListener("click",()=>{closeDialog("profileDialog");enterProfile(b.dataset.profileChoice)}))}
function enterProfile(profile){activeProfile=profile;saveSession(sessionUser,profile);if(goToProfile(profile))return;$("#loginView").hidden=true;$("#workspace").hidden=false;$("#activeProfileLabel").textContent=profile;updateUserUi();$("#adminNav").style.display="grid";showScreen("overview");renderAll()}
$("#firstPasswordForm").addEventListener("submit",e=>{e.preventDefault();const p=$("#firstPassword").value,p2=$("#firstPassword2").value,fb=$("#firstPasswordFeedback");fb.hidden=true;if(p.length<6||p!==p2||p===sessionUser.password){fb.textContent=p.length<6?"A nova senha deve ter ao menos 6 caracteres.":p!==p2?"As senhas não coincidem.":"Escolha uma senha diferente da senha provisória.";fb.hidden=false;return}sessionUser.password=p;sessionUser.forcePasswordChange=false;sessionUser.passwordVersion=(sessionUser.passwordVersion||0)+1;audit("PRIMEIRO ACESSO",`${sessionUser.username} definiu senha definitiva`);saveState();closeDialog("firstPasswordDialog");if(requestedLoginProfile && allowedLoginProfile(sessionUser,requestedLoginProfile)) enterProfile(requestedLoginProfile); else chooseProfileAfterLogin()});
function updateUserUi(){if(!sessionUser)return;const ini=initials(sessionUser.name);$("#sidebarInitials").textContent=ini;$("#topInitials").textContent=ini;$("#sidebarUserName").textContent=sessionUser.name;$("#topUserName").textContent=sessionUser.name;$("#sidebarProfileName").textContent=activeProfile||"Perfil"}
function logout(){clearSession();sessionUser=null;activeProfile=null;requestedLoginProfile=null;$("#workspace").hidden=true;$("#loginView").hidden=false;showLoginMode();$("#loginPassword").value=""}
$("#topUserPill").addEventListener("click",logout);$("#profileMenuBtn").addEventListener("click",logout);$("#logoutSectorBtn").addEventListener("click",logout);
["switchProfileBtn","topSwitchProfile","returnAdminBtn"].forEach(id=>$("#"+id)?.addEventListener("click",()=>{renderProfilePicker();openDialog("profileDialog")}));

function showScreen(name){$$('.screen').forEach(s=>s.classList.remove("active"));$("#screen-"+name)?.classList.add("active");$$('.nav-btn').forEach(b=>b.classList.toggle("active",b.dataset.screen===name));const titles={overview:"Visão geral",requests:"Solicitações",passwords:"Redefinições de senha",users:"Usuários",sectors:"Setores",records:"Cadastros",importacao:"Importar planilhas","sector-placeholder":activeProfile||"Setor"};$("#screenTitle").textContent=titles[name]||"SELIC";renderAll()}
$$('.nav-btn').forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));$$('[data-open-screen]').forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.openScreen)));

function renderOverview(){const req=state.requests.filter(r=>r.status==="PENDENTE"),pwd=state.passwordRequests.filter(r=>r.status==="PENDENTE"),users=state.users.filter(u=>u.active),secs=state.sectors.filter(s=>s.active);$("#statRequests").textContent=req.length;$("#statPasswords").textContent=pwd.length;$("#statUsers").textContent=users.length;$("#statSectors").textContent=secs.length;$("#requestBadge").textContent=req.length;$("#requestBadge").style.display=req.length?"grid":"none";$("#passwordBadge").textContent=pwd.length;$("#passwordBadge").style.display=pwd.length?"grid":"none";$("#recentRequests").innerHTML=req.length?req.slice(0,5).map(r=>`<div class="request-card"><span><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.username)} • ${r.sector}</small></span><span class="status-pill pending">PENDENTE</span></div>`).join(""):`<div class="empty">Nenhuma solicitação pendente.</div>`;$("#adminProfiles").innerHTML=(sessionUser?.profiles||[]).map(p=>`<div class="profile-chip"><strong>${p}</strong><span>${p==="ADMINISTRADOR"?"Acesso total":"Acesso setorial"}</span></div>`).join("")}
function renderRequests(){const list=state.requests.filter(r=>currentRequestTab==="pending"?r.status==="PENDENTE":r.status!=="PENDENTE");$("#pendingTabCount").textContent=state.requests.filter(r=>r.status==="PENDENTE").length;$("#doneTabCount").textContent=state.requests.filter(r=>r.status!=="PENDENTE").length;$("#requestsTable").innerHTML=list.length?list.map(r=>`<tr><td><strong>${escapeHtml(r.name)}</strong>${r.origin==="PRE_CADASTRO_ADMIN"?`<small style="display:block;opacity:.7">Pré-cadastro administrativo</small>`:""}</td><td>${escapeHtml(r.username)}</td><td>${r.sector}</td><td>${dateTime(r.createdAt)}</td><td><span class="status-pill ${r.status==="APROVADO"?"approved":r.status==="REPROVADO"?"rejected":"pending"}">${r.status}</span></td><td><div class="row-actions">${r.status==="PENDENTE"?`<button class="mini-btn approve" data-approve-request="${r.id}">Aprovar</button><button class="mini-btn reject" data-reject-request="${r.id}">Reprovar</button>`:`<span>${r.decisionAt?dateTime(r.decisionAt):"—"}</span>`}</div></td></tr>`).join(""):`<tr><td colspan="6" class="empty">Nenhuma solicitação nesta lista.</td></tr>`;$$('[data-approve-request]').forEach(b=>b.addEventListener("click",()=>approveRequest(b.dataset.approveRequest)));$$('[data-reject-request]').forEach(b=>b.addEventListener("click",()=>rejectRequest(b.dataset.rejectRequest)))}
function approveRequest(id){
  const r=state.requests.find(x=>x.id===id);
  if(!r||r.status!=="PENDENTE")return;
  const existing=state.users.find(u=>u.username.toLowerCase()===r.username.toLowerCase());
  if(existing){
    r.status="APROVADO";r.decisionAt=nowIso();r.decision="CADASTRO PREEXISTENTE";
    audit("PRÉ-CADASTRO CONCILIADO",r.username);saveState();
    showToast("Usuário existente. Utilize Redefinir senha na aba Usuários.");
    return;
  }
  let temporary;
  try {temporary=tempPassword();}catch(err){showToast("Não foi possível gerar senha segura neste navegador.");return;}
  state.users.push({id:uid("user"),name:r.name,username:r.username,password:temporary,profiles:[r.sector],active:true,forcePasswordChange:true,passwordVersion:1,lastAccess:"—"});
  r.status="APROVADO";r.decisionAt=nowIso();r.decision="APROVADO";
  audit("CADASTRO APROVADO",`${r.username} • ${r.sector}`);saveState();
  $("#credentialUsername").textContent=r.username;
  $("#temporaryPassword").textContent=temporary;
  openDialog("credentialDialog");
}
function rejectRequest(id){const r=state.requests.find(x=>x.id===id);if(!r)return;r.status="REPROVADO";r.decisionAt=nowIso();r.decision="REPROVADO";audit("CADASTRO REPROVADO",r.username);saveState();showToast("Solicitação reprovada.")}
$$('[data-request-tab]').forEach(b=>b.addEventListener("click",()=>{currentRequestTab=b.dataset.requestTab;$$('[data-request-tab]').forEach(x=>x.classList.toggle("active",x===b));renderRequests()}));
$("#copyTempPassword").addEventListener("click",async()=>{try{await navigator.clipboard.writeText($("#temporaryPassword").textContent);showToast("Senha provisória copiada.")}catch{showToast("Copie a senha exibida manualmente.")}});
$("#closeCredentialDialog").addEventListener("click",()=>closeDialog("credentialDialog"));
$("#credentialDialog").addEventListener("close",()=>{$("#temporaryPassword").textContent="—";});

function renderPasswordRequests(){const list=state.passwordRequests.filter(r=>currentPasswordTab==="pending"?r.status==="PENDENTE":r.status!=="PENDENTE");$("#pendingPasswordCount").textContent=state.passwordRequests.filter(r=>r.status==="PENDENTE").length;$("#donePasswordCount").textContent=state.passwordRequests.filter(r=>r.status!=="PENDENTE").length;$("#passwordRequestsTable").innerHTML=list.length?list.map(r=>`<tr><td>${escapeHtml(r.username)}</td><td>${escapeHtml(r.name)}</td><td>${dateTime(r.createdAt)}</td><td><span class="status-pill ${r.status==="APROVADO"?"approved":r.status==="REPROVADO"?"rejected":"pending"}">${r.status}</span></td><td><div class="row-actions">${r.status==="PENDENTE"?`<button class="mini-btn approve" data-approve-password="${r.id}">Aprovar</button><button class="mini-btn reject" data-reject-password="${r.id}">Reprovar</button>`:`${dateTime(r.decisionAt)}`}</div></td></tr>`).join(""):`<tr><td colspan="5" class="empty">Nenhuma solicitação nesta lista.</td></tr>`;$$('[data-approve-password]').forEach(b=>b.addEventListener("click",()=>approvePassword(b.dataset.approvePassword)));$$('[data-reject-password]').forEach(b=>b.addEventListener("click",()=>rejectPassword(b.dataset.rejectPassword)))}
function approvePassword(id){
  const r=state.passwordRequests.find(x=>x.id===id),u=state.users.find(x=>x.id===r?.userId);
  if(!r||r.status!=="PENDENTE"||!u||!u.active)return;
  let temporary;
  try{temporary=tempPassword();}catch(err){showToast("Não foi possível gerar senha segura neste navegador.");return;}
  u.password=temporary;
  u.forcePasswordChange=true;
  u.passwordVersion=(u.passwordVersion||0)+1;
  r.status="APROVADO";r.decisionAt=nowIso();r.decision="SENHA PROVISÓRIA EMITIDA";
  delete r.desiredPassword;
  audit("REDEFINIÇÃO APROVADA COM TROCA OBRIGATÓRIA",u.username);
  saveState();
  $("#credentialUsername").textContent=u.username;
  $("#temporaryPassword").textContent=temporary;
  openDialog("credentialDialog");
}
function rejectPassword(id){const r=state.passwordRequests.find(x=>x.id===id);if(!r)return;r.status="REPROVADO";r.decisionAt=nowIso();audit("REDEFINIÇÃO REPROVADA",r.username);saveState();showToast("Redefinição reprovada.")}
$$('[data-password-tab]').forEach(b=>b.addEventListener("click",()=>{currentPasswordTab=b.dataset.passwordTab;$$('[data-password-tab]').forEach(x=>x.classList.toggle("active",x===b));renderPasswordRequests()}));

// Redefinição administrativa (individual ou em lote).
// As credenciais provisórias são exibidas apenas no momento da emissão.
function resetCredentials(ids) {
  const unique=[...new Set(ids)];
  const users=unique.map(id=>state.users.find(u=>u.id===id)).filter(u=>u&&u.active&&u.username!=="admin"&&!(u.profiles||[]).includes("ADMINISTRADOR"));
  if(!users.length){showToast("Aprove os cadastros primeiro ou selecione usuários ativos.");return;}
  if(!confirm(`Redefinir a senha de ${users.length} usuário(s)? As senhas anteriores deixarão de funcionar e será exigida troca no próximo acesso.`))return;
  let credentials=[];
  try {
    const usedPasswords=new Set();
    credentials=users.map(u=>({username:u.username,password:tempPassword(usedPasswords)}));
  }catch(err){showToast("Não foi possível gerar senhas seguras neste navegador.");return;}
  credentials.forEach(row=>{
    const u=state.users.find(x=>x.username===row.username);
    u.password=row.password;
    u.forcePasswordChange=true;
    u.passwordVersion=(u.passwordVersion||0)+1;
    audit("SENHA REDEFINIDA PELO ADMINISTRADOR",u.username);
  });
  selecionadosParaRedefinir.clear();
  saveState();
  $("#resetCredentialsList").innerHTML=credentials.map(c=>`<tr><td><strong>${escapeHtml(c.username)}</strong></td><td><code>${escapeHtml(c.password)}</code></td></tr>`).join("");
  const allText=credentials.map(c=>`${c.username}: ${c.password}`).join("\n");
  const copyButton=$("#copyResetCredentials");
  copyButton.onclick=async()=>{
    try{await navigator.clipboard.writeText(allText);showToast("Credenciais copiadas. Envie individualmente, por canal seguro.");}
    catch{showToast("Selecione e copie as senhas exibidas.");}
  };
  openDialog("adminResetCredentialsDialog");
}
function renderUsers(){
  const eligible=u=>u.username!=="admin"&&!(u.profiles||[]).includes("ADMINISTRADOR");
  for(const id of [...selecionadosParaRedefinir]){
    if(!state.users.some(u=>u.id===id&&u.active&&eligible(u)))selecionadosParaRedefinir.delete(id);
  }
  $("#selectedUserCount").textContent=String(selecionadosParaRedefinir.size);
  $("#resetSelectedUsers").disabled=selecionadosParaRedefinir.size===0;
  $("#usersTable").innerHTML=state.users.map(u=>`<tr>
    <td>${u.active&&eligible(u)?`<input type="checkbox" data-user-check="${escapeHtml(u.id)}" ${selecionadosParaRedefinir.has(u.id)?"checked":""} aria-label="Selecionar ${escapeHtml(u.username)}" />`:"—"}</td>
    <td><strong>${escapeHtml(u.username)}</strong></td><td>${escapeHtml(u.name)}</td>
    <td>${formatProfiles(u.profiles)}</td>
    <td><span class="status-pill ${u.active?"active":"inactive"}">${u.active?"ATIVO":"INATIVO"}</span></td>
    <td>${u.lastAccess==="—"?"—":dateTime(u.lastAccess)}</td>
    <td><div class="row-actions"><button class="mini-btn" data-edit-user="${escapeHtml(u.id)}">Perfis</button>
      ${eligible(u)?`<button class="mini-btn" data-reset-user="${escapeHtml(u.id)}" ${!u.active?"disabled":""}>Redefinir senha</button><button class="mini-btn ${u.active?"reject":"approve"}" data-toggle-user="${escapeHtml(u.id)}">${u.active?"Inativar":"Ativar"}</button>`:""}
    </div></td></tr>`).join("");
  $$('[data-edit-user]').forEach(b=>b.addEventListener("click",()=>editUserProfiles(b.dataset.editUser)));
  $$('[data-toggle-user]').forEach(b=>b.addEventListener("click",()=>toggleUser(b.dataset.toggleUser)));
  $$('[data-reset-user]').forEach(b=>b.addEventListener("click",()=>resetCredentials([b.dataset.resetUser])));
  $$('[data-user-check]').forEach(b=>b.addEventListener("change",()=>{
    if(b.checked)selecionadosParaRedefinir.add(b.dataset.userCheck);
    else selecionadosParaRedefinir.delete(b.dataset.userCheck);
    renderUsers();
  }));
  const all=state.users.filter(u=>u.active&&eligible(u));
  const selectAll=$("#selectAllUsers");
  selectAll.checked=all.length>0&&all.every(u=>selecionadosParaRedefinir.has(u.id));
  selectAll.indeterminate=all.some(u=>selecionadosParaRedefinir.has(u.id))&&!selectAll.checked;
}
$("#selectAllUsers").addEventListener("change",e=>{
  const mark=e.target.checked;
  for(const u of state.users.filter(u=>u.active&&u.username!=="admin"&&!(u.profiles||[]).includes("ADMINISTRADOR"))){
    if(mark)selecionadosParaRedefinir.add(u.id);else selecionadosParaRedefinir.delete(u.id);
  }
  renderUsers();
});
$("#resetSelectedUsers").addEventListener("click",()=>resetCredentials([...selecionadosParaRedefinir]));
$("#resetAllPregoeiros").addEventListener("click",()=>{
  const nomes=new Set(SELIC_PRE_CADASTROS_PREGOEIROS.map(([username])=>username));
  const ids=state.users.filter(u=>u.active&&nomes.has(u.username.toLowerCase())).map(u=>u.id);
  resetCredentials(ids);
});
function clearGeneratedCredentialList(){
  $("#resetCredentialsList").innerHTML="";
  $("#copyResetCredentials").onclick=null;
}
$("#closeResetCredentials").addEventListener("click",()=>closeDialog("adminResetCredentialsDialog"));
$("#adminResetCredentialsDialog").addEventListener("close",clearGeneratedCredentialList);
function toggleUser(id){const u=state.users.find(x=>x.id===id);if(!u)return;u.active=!u.active;audit(u.active?"USUÁRIO REATIVADO":"USUÁRIO INATIVADO",u.username);saveState();showToast(u.active?"Usuário reativado.":"Usuário inativado sem excluir histórico.")}
function editUserProfiles(id){const u=state.users.find(x=>x.id===id);if(!u)return;editingUserId=id;$("#userEditDescription").textContent=`${u.name} • ${u.username}`;const options=["ADMINISTRADOR",...sectors];$("#userProfileChecks").innerHTML=options.map(p=>`<label class="profile-check"><input type="checkbox" value="${p}" ${u.profiles.includes(p)?"checked":""}><span>${p}</span></label>`).join("");openDialog("userEditDialog")}
$("#userEditForm").addEventListener("submit",e=>{e.preventDefault();const u=state.users.find(x=>x.id===editingUserId);if(!u)return;const profiles=$$('#userProfileChecks input:checked').map(x=>x.value);if(!profiles.length){showToast("Selecione ao menos um perfil.");return}u.profiles=profiles;audit("PERFIS ALTERADOS",`${u.username}: ${profiles.join(", ")}`);saveState();closeDialog("userEditDialog");showToast("Perfis atualizados.")});


function renderSectors(){$("#sectorCards").innerHTML=state.sectors.map(s=>`<article class="sector-card"><h4>${s.name}</h4><p>Unidade disponível para perfis autorizados. Administradores podem percorrer e gerenciar todos os setores.</p><div class="sector-card-foot"><span class="status-pill ${s.active?"active":"inactive"}">${s.active?"ATIVO":"INATIVO"}</span><button class="mini-btn ${s.active?"reject":"approve"}" data-toggle-sector="${s.id}">${s.active?"Inativar":"Ativar"}</button></div></article>`).join("");$$('[data-toggle-sector]').forEach(b=>b.addEventListener("click",()=>{const s=state.sectors.find(x=>x.id===b.dataset.toggleSector);if(!s)return;s.active=!s.active;audit(s.active?"SETOR REATIVADO":"SETOR INATIVADO",s.name);saveState();showToast(`${s.name} ${s.active?"reativado":"inativado"}.`) }))}
function renderRecords(){const panel=$("#recordsPanel");if(currentRecordTab==="statuses"){panel.innerHTML=`<div class="record-list">${state.statuses.map(s=>`<div class="record-row"><strong>${s.name}</strong><span class="status-pill ${s.active?"active":"inactive"}">${s.active?"ATIVO":"INATIVO"}</span><button class="mini-btn ${s.active?"reject":"approve"}" data-toggle-status="${s.id}">${s.active?"Inativar":"Ativar"}</button></div>`).join("")}</div>`;$$('[data-toggle-status]').forEach(b=>b.addEventListener("click",()=>{const s=state.statuses.find(x=>x.id===b.dataset.toggleStatus);s.active=!s.active;audit(s.active?"STATUS REATIVADO":"STATUS INATIVADO",s.name);saveState();showToast(s.active?"Status reativado.":"Status inativado. Processos existentes mantêm o status.")}))}else{panel.innerHTML=`<div class="record-list">${state.processes.map(p=>`<div class="record-row"><span><strong>${p.number}</strong><small style="display:block;color:#8191a2;margin-top:3px">Status: ${p.status}</small></span><span class="status-pill ${p.active?"active":"inactive"}">${p.active?"ATIVO":"INATIVO"}</span><button class="mini-btn ${p.active?"reject":"approve"}" data-toggle-process="${p.id}">${p.active?"Inativar":"Ativar"}</button></div>`).join("")}</div>`;$$('[data-toggle-process]').forEach(b=>b.addEventListener("click",()=>{const p=state.processes.find(x=>x.id===b.dataset.toggleProcess);p.active=!p.active;audit(p.active?"PROCESSO REATIVADO":"PROCESSO INATIVADO",p.number);saveState();showToast(p.active?"Processo reativado.":"Processo inativado sem apagar o histórico.")}))}}
$$('[data-record-tab]').forEach(b=>b.addEventListener("click",()=>{currentRecordTab=b.dataset.recordTab;$$('[data-record-tab]').forEach(x=>x.classList.toggle("active",x===b));renderRecords()}));

function renderAll(){renderOverview();renderRequests();renderPasswordRequests();renderUsers();renderSectors();renderRecords();updateUserUi()}
(function resumeSession(){
  const sess=readSession(); if(!sess)return;
  const user=state.users.find(u=>u.id===sess.userId&&u.active); if(!user || user.forcePasswordChange || (user.passwordVersion||0)!==(sess.passwordVersion||0)){clearSession();return}
  sessionUser=user;activeProfile=sess.activeProfile||"ADMINISTRADOR";
  if (!allowedLoginProfile(user, activeProfile)) { clearSession();sessionUser=null;activeProfile=null;return; }
  if(activeProfile!=="ADMINISTRADOR" && goToProfile(activeProfile))return;
  if(activeProfile==="ADMINISTRADOR"){ $("#loginView").hidden=true;$("#workspace").hidden=false;$("#activeProfileLabel").textContent=activeProfile;$("#adminNav").style.display="grid";showScreen("overview"); }
})();
renderAll();
