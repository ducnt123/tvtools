(function(){
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const state = {
  data: null,
  query: "",
  genre: "Tất cả",
  quality: "Tất cả",
  selectedProviders: new Set(),
  selectedPackages: {}, // providerId -> Set(packageId)
};

function vnd(n){
  if (!n) return "Miễn phí";
  return Number(n).toLocaleString("vi-VN") + "₫";
}

function uniq(arr){ return Array.from(new Set(arr)); }

function renderChips(container, items, current, onClick){
  container.innerHTML = "";
  items.forEach(txt => {
    const b = document.createElement("button");
    b.className = "chip" + (current===txt ? " active": "");
    b.textContent = txt;
    b.addEventListener("click", () => onClick(txt));
    container.appendChild(b);
  });
}

function buildHead(providers){
  const head = $("#matrixHead");
  head.style.gridTemplateColumns = `minmax(220px,1fr) ${"minmax(140px,1fr) ".repeat(providers.length)}`;
  head.innerHTML = `<div></div>` + providers.map(p => `<div class="muted small" style="text-align:center"><b>${p.name}</b></div>`).join("");
}

function channelCell(ch, p, selectedPackages){
  const selectedPkgIds = Array.from(selectedPackages[p.id] || []);
  const availablePkgs = (ch.availability && ch.availability[p.id]) ? ch.availability[p.id] : [];
  const match = selectedPkgIds.length ? availablePkgs.some(id => selectedPkgIds.includes(id)) : availablePkgs.length>0;
  const title = availablePkgs.length ? "Có trong: " + availablePkgs.map(id => (p.packages.find(x=>x.id===id)||{name:id}).name).join(", ") : "Không có";
  return `<div class="cell ${match ? "yes":"no"}" title="${title}">${availablePkgs.length ? "Có":"Không"}</div>`;
}

function buildRow(ch, providers){
  const genres = ch.genres && ch.genres.length ? ch.genres.join(" • ") : "";
  const notes = ch.notes ? `<div class="muted xsmall">${ch.notes}</div>` : "";
  const left = `<div class="channel-card">
    <div><b>${ch.name}</b> <span class="badge">${ch.quality || "HD"}</span></div>
    <div class="xsmall muted" style="margin-top:4px">${genres}</div>
    ${notes}
  </div>`;
  const cells = providers.map(p => channelCell(ch, p, state.selectedPackages)).join("");
  return `<div class="matrix-row" style="grid-template-columns:minmax(220px,1fr) ${"minmax(140px,1fr) ".repeat(providers.length)}">${left}${cells}</div>`;
}

function renderMatrix(){
  const body = $("#matrixBody");
  const providers = state.data.providers.filter(p => state.selectedProviders.has(p.id));
  buildHead(providers);

  const list = state.data.channels.filter(c => {
    if (state.query && !c.name.toLowerCase().includes(state.query.toLowerCase())) return false;
    if (state.genre !== "Tất cả" && !(c.genres||[]).includes(state.genre)) return false;
    if (state.quality !== "Tất cả" && (c.quality||"HD") !== state.quality) return false;
    return true;
  });

  $("#count").textContent = list.length + " kênh phù hợp";
  body.innerHTML = list.map(ch => buildRow(ch, providers)).join("");
}

function renderProviderArea(){
  const wrap = $("#packages");
  wrap.innerHTML = "";
  const providers = state.data.providers.filter(p => state.selectedProviders.has(p.id));
  providers.forEach(p => {
    const card = document.createElement("div");
    card.className = "provider-card";
    const pkgs = p.packages.map(pkg => {
      const active = (state.selectedPackages[p.id]||new Set()).has(pkg.id);
      return `<div class="pkg ${active?"active":""}" data-p="${p.id}" data-id="${pkg.id}" title="${pkg.name} – ${vnd(pkg.priceVND)}/${pkg.billing}">
        <span>${pkg.name}</span><span>${vnd(pkg.priceVND)}</span>
      </div>`;
    }).join("");
    card.innerHTML = `<div class="muted small" style="margin-bottom:6px"><b>${p.name}</b></div>${pkgs}`;
    wrap.appendChild(card);
  });

  // bind toggle package
  $$(".pkg", wrap).forEach(el => {
    el.addEventListener("click", () => {
      const pid = el.getAttribute("data-p");
      const id = el.getAttribute("data-id");
      const set = state.selectedPackages[pid] || new Set();
      if (set.has(id)) set.delete(id); else set.add(id);
      state.selectedPackages[pid] = set;
      renderProviderArea();
      renderTotals();
      renderMatrix();
    });
  });
}

function renderProviderToggles(){
  const cont = $("#providersToggle");
  cont.innerHTML = "";
  state.data.providers.forEach(p => {
    const b = document.createElement("button");
    b.className = "chip" + (state.selectedProviders.has(p.id) ? " active": "");
    b.textContent = p.name;
    b.addEventListener("click", () => {
      if (state.selectedProviders.has(p.id)) state.selectedProviders.delete(p.id);
      else state.selectedProviders.add(p.id);
      renderProviderToggles();
      renderProviderArea();
      renderMatrix();
    });
    cont.appendChild(b);
  });
}

function renderFilters(){
  // genres
  const allGenres = uniq(state.data.channels.flatMap(c => c.genres||[])).sort();
  renderChips($("#genres"), ["Tất cả", ...allGenres], state.genre, (g)=>{state.genre=g; renderMatrix();});
  // qualities
  const allQualities = ["SD","HD","Full HD","4K"];
  renderChips($("#qualities"), ["Tất cả", ...allQualities], state.quality, (q)=>{state.quality=q; renderMatrix();});
}

function renderTotals(){
  const providers = state.data.providers.filter(p => state.selectedProviders.has(p.id));
  let sum = 0;
  providers.forEach(p => {
    const sel = Array.from(state.selectedPackages[p.id]||[]);
    if (sel.length){
      const min = Math.min(...sel.map(id => (p.packages.find(x=>x.id===id)||{}).priceVND || 0));
      sum += Number.isFinite(min) ? min : 0;
    }
  });
  $("#total").textContent = vnd(sum);
}

function initEvents(){
  $("#q").addEventListener("input", (e)=>{
    state.query = e.target.value || "";
    renderMatrix();
  });
}

function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }

function start(){
  $("#year").textContent = new Date().getFullYear();
  show($("#loading"));
  fetch("./data/data.json", {cache:"no-store"})
    .then(r => { if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .then(json => {
      state.data = json;
      // init selections
      state.selectedProviders = new Set(json.providers.map(p=>p.id));
      state.selectedPackages = {};
      json.providers.forEach(p => state.selectedPackages[p.id] = new Set());
      renderProviderToggles();
      renderProviderArea();
      renderFilters();
      initEvents();
      renderTotals();
      renderMatrix();
    })
    .catch(err => {
      console.error(err);
      show($("#error"));
    })
    .finally(() => hide($("#loading")));
}

document.addEventListener("DOMContentLoaded", start);
})();