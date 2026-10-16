"use strict";
(() => {
  const SESSION_KEY="selic_session_v1";
  const pages={DIVACP:"DIVACP.html",DIVCON:"DIVCON.html",CEC:"CEC.html",CPC:"CPC.html",DIPREG:"DIPREG.html",ADMINISTRADOR:"index.html"};
  const current=(location.pathname.split("/").pop()||"").replace(/\.html$/i,"").toUpperCase();
  if(!pages[current] || current==="ADMINISTRADOR") return;
  let session=null;
  try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||"null")}catch{}
  // Revalida a sessão também após redefinição administrativa de senha.
  let account=null;
  try {
    const access=JSON.parse(localStorage.getItem("selic_access_admin_demo_v2")||"null");
    account=access?.users?.find(u=>u.id===session?.userId) || null;
  } catch {}
  const allowed=Boolean(session && account && account.active && !account.forcePasswordChange
    && (account.passwordVersion||0)===(session.passwordVersion||0)
    && (account.profiles||[]).some(p=>p===current||p==="ADMINISTRADOR")
    && (session.isAdmin || (session.profiles||[]).includes(current)));
  if(!allowed){localStorage.removeItem(SESSION_KEY);location.replace("index.html");return;}
  session.activeProfile=current;localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  window.SELIC_SESSION=session;
  window.SELIC_ACTIVE_SECTOR=current;

  const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const switchProfile=profile=>{
    if(!pages[profile])return;
    session.activeProfile=profile;localStorage.setItem(SESSION_KEY,JSON.stringify(session));location.href=pages[profile];
  };
  const logout=()=>{localStorage.removeItem(SESSION_KEY);location.replace("index.html")};

  const init=()=>{
    const nav=document.querySelector(".settings-tab-nav");
    const area=document.querySelector(".settings-panel-area");
    if(nav&&area&&!nav.querySelector('[data-settings-tab="access"]')){
      const tab=document.createElement("button");tab.className="settings-tab-button";tab.type="button";tab.dataset.settingsTab="access";
      tab.innerHTML='<span class="settings-tab-icon">⇄</span><span>TROCAR PERFIL</span>';nav.appendChild(tab);
      const panel=document.createElement("section");panel.className="settings-tab-panel";panel.dataset.settingsPanel="access";
      const profiles=[...new Set(session.isAdmin?["ADMINISTRADOR","DIVACP","DIVCON","CEC","CPC","DIPREG"]:(session.profiles||[]))];
      panel.innerHTML=`<div class="settings-section"><div class="settings-section-head"><div><span class="panel-kicker">ACESSO</span><h4>Trocar perfil</h4><p>${esc(session.name)} • ${esc(session.username)}</p></div></div><div class="selic-profile-switch-grid">${profiles.map(p=>`<button type="button" class="secondary-btn settings-compact-btn selic-profile-choice" data-selic-profile="${p}">${p}${p===current?' • ATUAL':''}</button>`).join("")}</div></div>`;
      area.appendChild(panel);
      tab.addEventListener("click",()=>{
        nav.querySelectorAll(".settings-tab-button").forEach(b=>b.classList.toggle("active",b===tab));
        area.querySelectorAll(".settings-tab-panel").forEach(p=>p.classList.toggle("active",p===panel));
      });
      panel.querySelectorAll("[data-selic-profile]").forEach(b=>b.addEventListener("click",()=>switchProfile(b.dataset.selicProfile)));
    }
    const logoutBtn=document.querySelector("#logoutButton");
    logoutBtn?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();logout();},true);
    const nameEls=[document.querySelector("#sidebarProfileName"),document.querySelector("#topProfileName")].filter(Boolean);
    nameEls.forEach(el=>el.textContent=session.name||session.username);
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
