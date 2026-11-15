// 🔐 SENHA DE ACESSO DO APP
const SENHA_ACESSO = "1234";

// 🟢 CONFIGURAÇÃO SUPABASE JM-EVENTOS
const SUPABASE_URL = "https://dpdvvwnybjoeyzqgdaru.supabase.co";
const SUPABASE_KEY = "sb_publishable_Bbu0Z3jm3USgVhkn8dFuTA_qoPgtoct";

const API_URL = `${SUPABASE_URL}/rest/v1/eventos`;
const CLIENTES_URL = `${SUPABASE_URL}/rest/v1/clientes`;
const CONFIG_URL = `${SUPABASE_URL}/rest/v1/config`;

const HEADERS = {
  "apikey": SUPABASE_KEY,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

let regrasGeraisCache = `INFORMAÇÕES SOBRE ESPAÇO DE LAZER (JM EVENTOS)
🚨⚠️⚠️⚠️⚠️⚠️⚠️⚠️
Obs: Se deixar o espaço sujo é cobrado uma taxa de limpeza no valor de R$ 50,00 reais.

🚨⚠️⚠️⚠️⚠️⚠️⚠️
♦️ CUIDADO COM AS CRIANÇAS NA PISCINA PRA NÃO PULAR E SE MACHUCAR.
♦️ ANTES DE ENTRAR NA PISCINA TOMAR BANHO NO CHUVEIRO.
♦️ SOM PELO SISTEMA ALEXA.
⚠️⚠️❌🔇 NÃO ACEITAMOS SOM DE CARRO NEM PAREDÃO.
♦️ SOMENTE SOM AMBIENTE.`;

let eventosCache = [];
let clientesCache = [];

// ==========================================
// 1. TELA DE SENHA E BLOQUEIO (PRIMEIRO DE TUDO)
// ==========================================
const telaLogin = document.getElementById("tela-login");
const inputSenha = document.getElementById("input-senha");
const erroSenha = document.getElementById("erro-senha");

if (sessionStorage.getItem("jm_auth") === "ok") {
  telaLogin.style.display = "none";
}

function validarLogin() {
  if (inputSenha.value === SENHA_ACESSO) {
    sessionStorage.setItem("jm_auth", "ok");
    telaLogin.style.display = "none";
    erroSenha.style.display = "none";
    inputSenha.value = "";
  } else {
    erroSenha.style.display = "block";
    inputSenha.value = "";
    inputSenha.focus();
  }
}

document.getElementById("btn-entrar").addEventListener("click", validarLogin);
inputSenha.addEventListener("keypress", (e) => { if (e.key === "Enter") validarLogin(); });
document.getElementById("btn-sair").addEventListener("click", () => {
  sessionStorage.removeItem("jm_auth");
  telaLogin.style.display = "flex";
});

// ==========================================
// 2. MÁSCARAS DE TELEFONE, MOEDA E DATAS
// ==========================================
function aplicarMascaraTelefone(valor) {
  let v = String(valor || "").replace(/\D/g, "").slice(0, 11);
  if (v.length > 6) {
    return v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
  } else if (v.length > 2) {
    return v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  } else if (v.length > 0) {
    return v.replace(/^(\d*)/, "($1");
  }
  return "";
}

function aplicarMascaraMoeda(valor) {
  let v = String(valor || "").replace(/\D/g, "");
  if (!v) return "R$ 0,00";
  v = (parseInt(v, 10) / 100).toFixed(2);
  let partes = v.split(".");
  partes = partes.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return "R$ " + partes.join(",");
}

function desformatarMoeda(texto) {
  if (typeof texto === "number") return texto;
  const limpo = String(texto || "").replace(/[^\d,]/g, "").replace(",", ".");
  return parseFloat(limpo) || 0;
}

document.getElementById("telefone").addEventListener("input", (e) => {
  e.target.value = aplicarMascaraTelefone(e.target.value);
});

document.getElementById("cad-telefone").addEventListener("input", (e) => {
  e.target.value = aplicarMascaraTelefone(e.target.value);
});

["valorTotal", "valorPago", "despesas"].forEach((id) => {
  const campo = document.getElementById(id);
  campo.addEventListener("input", (e) => {
    e.target.value = aplicarMascaraMoeda(e.target.value);
    e.target.setSelectionRange(e.target.value.length, e.target.value.length);
  });
  campo.addEventListener("focus", (e) => {
    e.target.setSelectionRange(e.target.value.length, e.target.value.length);
  });
});

document.getElementById("data").addEventListener("change", (e) => {
  const dataIni = e.target.value;
  const campoFim = document.getElementById("dataFim");
  campoFim.min = dataIni;
  if (!campoFim.value || campoFim.value < dataIni) {
    campoFim.value = dataIni;
  }
});
// ==========================================
// 3. SINCRONIZAÇÃO COM SUPABASE (EVENTOS, CLIENTES E REGRAS)
// ==========================================
function formatarPeriodoBR(ev) {
  const ini = ev.data.split("-").reverse().join("/");
  if (ev.dataFim && ev.dataFim > ev.data) {
    const fim = ev.dataFim.split("-").reverse().join("/");
    return `${ini} até ${fim}`;
  }
  return ini;
}

function eventoCobreDia(ev, diaISO) {
  const fim = ev.dataFim && ev.dataFim >= ev.data ? ev.dataFim : ev.data;
  return diaISO >= ev.data && diaISO <= fim;
}

function eventoNoMes(ev, mesISO) {
  if (!mesISO) return true;
  const fim = ev.dataFim && ev.dataFim >= ev.data ? ev.dataFim : ev.data;
  return ev.data.startsWith(mesISO) || fim.startsWith(mesISO) || (ev.data <= `${mesISO}-01` && fim >= `${mesISO}-28`);
}

let primeiraCarga = true;

async function carregarEventos() {
  const statusEl = document.getElementById("status-conexao");
  try {
    const res = await fetch(`${API_URL}?select=*&order=data.asc`, { headers: HEADERS });
    if (!res.ok) throw new Error(await res.text());
    const lista = await res.json();

    eventosCache = lista.map(item => ({
      ...item,
      dataFim: item.data_fim || item.data,
      valorTotal: Number(item.valor_total || 0),
      valorPago: Number(item.valor_pago || 0),
      despesas: Number(item.despesas || 0)
    }));

    if (primeiraCarga && eventosCache.length > 0) {
      primeiraCarga = false;
      const temNoMesAtual = eventosCache.some(ev => eventoNoMes(ev, filtroMes.value));
      if (!temNoMesAtual) {
        filtroMes.value = "";
      }
    }

    statusEl.innerHTML = "● Sincronizado";
    statusEl.style.color = "#10b981";
    atualizarSistema();
  } catch (err) {
    statusEl.innerHTML = "● Erro Banco";
    statusEl.style.color = "#ef4444";
    console.error("Erro Supabase:", err);
  }
}

async function carregarClientes() {
  try {
    const res = await fetch(`${CLIENTES_URL}?select=*&order=nome.asc`, { headers: HEADERS });
    if (!res.ok) return;
    clientesCache = await res.json();
    renderizarClientes();
    atualizarSelectClientes();
  } catch (err) {
    console.error("Erro ao carregar clientes:", err);
  }
}

async function carregarRegras() {
  try {
    const res = await fetch(`${CONFIG_URL}?id=eq.1&select=*`, { headers: HEADERS });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.length > 0 && data.regras_recibo) {
      regrasGeraisCache = data.regras_recibo;
    }
    document.getElementById("texto-regras-gerais").value = regrasGeraisCache;
  } catch (err) {
    document.getElementById("texto-regras-gerais").value = regrasGeraisCache;
  }
}

document.getElementById("form-regras").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-salvar-regras");
  btn.disabled = true;
  btn.innerText = "⏳ Salvando Regras...";
  const novoTexto = document.getElementById("texto-regras-gerais").value.trim();

  try {
    const res = await fetch(`${CONFIG_URL}?id=eq.1`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ regras_recibo: novoTexto })
    });
    if (!res.ok) throw new Error(await res.text());
    regrasGeraisCache = novoTexto;
    alert("✅ Regras do recibo atualizadas com sucesso!");
  } catch (err) {
    alert("Erro ao salvar regras: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "💾 Salvar Regras na Nuvem";
  }
});

// ==========================================
// 4. CONTROLE DE MÊS SINCRONIZADO E ABAS
// ==========================================
const filtroMes = document.getElementById("filtro-mes");
const calMesPicker = document.getElementById("cal-mes-picker");
const hoje = new Date();
const mesInicial = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

filtroMes.value = mesInicial;
calMesPicker.value = mesInicial;

function alterarMesGlobal(novoMes) {
  filtroMes.value = novoMes;
  if (novoMes) calMesPicker.value = novoMes;
  atualizarSistema();
}

filtroMes.addEventListener("change", () => alterarMesGlobal(filtroMes.value));
calMesPicker.addEventListener("change", () => alterarMesGlobal(calMesPicker.value));
document.getElementById("btn-todos-meses").addEventListener("click", () => alterarMesGlobal(""));

function mudarMesPasso(delta) {
  const atual = calMesPicker.value || mesInicial;
  const [ano, mes] = atual.split("-").map(Number);
  const novaData = new Date(ano, mes - 1 + delta, 1);
  const formatado = `${novaData.getFullYear()}-${String(novaData.getMonth() + 1).padStart(2, "0")}`;
  alterarMesGlobal(formatado);
}

document.getElementById("btn-mes-ant").addEventListener("click", () => mudarMesPasso(-1));
document.getElementById("btn-mes-prox").addEventListener("click", () => mudarMesPasso(1));

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    document.getElementById("view-lista").style.display = view === "lista" ? "flex" : "none";
    document.getElementById("box-filtros").style.display = view === "lista" ? "flex" : "none";
    document.getElementById("view-calendario").style.display = view === "calendario" ? "block" : "none";
    document.getElementById("view-clientes").style.display = view === "clientes" ? "block" : "none";
    document.getElementById("view-regras").style.display = view === "regras" ? "block" : "none";
  });
});

carregarEventos();
carregarClientes();
carregarRegras();
setInterval(() => {
  carregarEventos();
  carregarClientes();
}, 15000);
// ==========================================
// 5. CADASTRO DE CLIENTES
// ==========================================
document.getElementById("form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-salvar-cliente");
  btn.disabled = true;
  btn.innerText = "⏳ Salvando...";

  const nome = document.getElementById("cad-nome").value.trim();
  const telefone = document.getElementById("cad-telefone").value.trim();

  try {
    const res = await fetch(CLIENTES_URL, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({ nome, telefone })
    });
    if (!res.ok) throw new Error(await res.text());
    document.getElementById("form-cliente").reset();
    await carregarClientes();
  } catch (err) {
    alert("Erro ao salvar cliente: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = "Salvar Cliente";
  }
});

function renderizarClientes() {
  const lista = document.getElementById("lista-clientes");
  const termo = document.getElementById("busca-cliente").value.toLowerCase();
  const filtrados = clientesCache.filter(c =>
    c.nome.toLowerCase().includes(termo) || c.telefone.includes(termo)
  );

  if (filtrados.length === 0) {
    lista.innerHTML = `<p class="msg-vazia">Nenhum cliente cadastrado.</p>`;
    return;
  }

  lista.innerHTML = filtrados.map(c => {
    const numLimpo = c.telefone.replace(/\D/g, "");
    return `
      <div class="event-item" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h3 class="event-title" style="margin:0 0 4px 0;">${c.nome}</h3>
          <div class="event-meta" style="margin:0;">📞 ${aplicarMascaraTelefone(c.telefone)}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <a href="https://whatsapp.com{numLimpo}" target="_blank" rel="noopener noreferrer" class="btn-act btn-whats" style="padding:8px 12px; text-decoration:none;">WhatsApp</a>
          <button type="button" class="btn-act btn-del" style="padding:8px 10px;" onclick="excluirCliente('${c.id}')">🗑️</button>
        </div>
      </div>`;
  }).join("");
}

function atualizarSelectClientes() {
  const sel = document.getElementById("select-cliente-rapido");
  sel.innerHTML = `<option value="">-- Selecionar cliente salvo --</option>` +
    clientesCache.map(c => `<option value="${c.id}">${c.nome} (${aplicarMascaraTelefone(c.telefone)})</option>`).join("");
}

document.getElementById("select-cliente-rapido").addEventListener("change", (e) => {
  const cli = clientesCache.find(c => c.id === e.target.value);
  if (cli) {
    document.getElementById("cliente").value = cli.nome;
    document.getElementById("telefone").value = aplicarMascaraTelefone(cli.telefone);
  }
});

window.excluirCliente = async (id) => {
  if (confirm("Remover este cliente da lista?")) {
    await fetch(`${CLIENTES_URL}?id=eq.${id}`, { method: "DELETE", headers: HEADERS });
    await carregarClientes();
  }
};

document.getElementById("busca-cliente").addEventListener("input", renderizarClientes);
// ==========================================
// 6. SALVAR E EDITAR EVENTOS
// ==========================================
document.getElementById("form-evento").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btnSalvar = document.getElementById("btn-salvar");
  btnSalvar.disabled = true;
  btnSalvar.innerText = "⏳ Salvando...";

  const idEdicao = document.getElementById("evento-id").value;
  const dataInicio = document.getElementById("data").value;
  const dataFimInput = document.getElementById("dataFim").value;
  const dataFinal = dataFimInput && dataFimInput >= dataInicio ? dataFimInput : dataInicio;

  if (dataFimInput && dataFimInput < dataInicio) {
    alert("⚠️ A Data Fim não pode ser anterior à Data Início.");
    btnSalvar.disabled = false;
    btnSalvar.innerText = "💾 Salvar na Nuvem";
    return;
  }

  const turnoEvento = document.getElementById("turno").value;
  const statusEvento = document.getElementById("status").value;

  if (statusEvento !== "cancelado") {
    const conflito = eventosCache.find(ev => {
      if (ev.id === idEdicao || ev.status === "cancelado") return false;
      const evFim = ev.dataFim && ev.dataFim >= ev.data ? ev.dataFim : ev.data;
      const sobrepoeDatas = dataInicio <= evFim && dataFinal >= ev.data;
      const mesmoTurno = ev.turno === turnoEvento || ev.turno === "Integral (Dia Todo)" || turnoEvento === "Integral (Dia Todo)";
      return sobrepoeDatas && mesmoTurno;
    });

    if (conflito) {
      alert(`⚠️ CONFLITO DE AGENDA!\nJá existe reserva no período (${formatarPeriodoBR(conflito)} - ${conflito.cliente}).`);
      btnSalvar.disabled = false;
      btnSalvar.innerText = "💾 Salvar na Nuvem";
      return;
    }
  }

  const dados = {
    cliente: document.getElementById("cliente").value.trim(),
    telefone: document.getElementById("telefone").value.trim(),
    convidados: parseInt(document.getElementById("convidados").value) || 0,
    tipo: document.getElementById("tipo").value,
    status: statusEvento,
    data: dataInicio,
    data_fim: dataFinal,
    turno: turnoEvento,
    valor_total: desformatarMoeda(document.getElementById("valorTotal").value),
    valor_pago: desformatarMoeda(document.getElementById("valorPago").value),
    despesas: desformatarMoeda(document.getElementById("despesas").value),
    pagamento: document.getElementById("pagamento").value
  };

  try {
    let url = API_URL;
    let method = "POST";
    if (idEdicao) {
      url = `${API_URL}?id=eq.${idEdicao}`;
      method = "PATCH";
    }

    const res = await fetch(url, {
      method,
      headers: HEADERS,
      body: JSON.stringify(dados)
    });

    if (!res.ok) throw new Error(await res.text());

    fecharModal();
    if (dataInicio && dataInicio.length >= 7) {
      const mesDoEvento = dataInicio.slice(0, 7);
      filtroMes.value = mesDoEvento;
      calMesPicker.value = mesDoEvento;
    }
    await carregarEventos();
  } catch (err) {
    alert("Erro ao salvar na nuvem: " + err.message);
  } finally {
    btnSalvar.disabled = false;
    btnSalvar.innerText = "💾 Salvar na Nuvem";
  }
});

// ==========================================
// 7. FINANCEIRO E LISTA DE EVENTOS
// ==========================================
function formatarBRL(val) {
  return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function atualizarSistema() {
  const mesSel = filtroMes.value;
  const eventosMes = eventosCache.filter(ev => eventoNoMes(ev, mesSel));

  let recebido = 0, aReceber = 0, despesas = 0;
  eventosMes.forEach(ev => {
    if (ev.status !== "cancelado") {
      recebido += ev.valorPago || 0;
      const falta = (ev.valorTotal || 0) - (ev.valorPago || 0);
      if (falta > 0) aReceber += falta;
      despesas += ev.despesas || 0;
    }
  });

  document.getElementById("res-recebido").innerText = formatarBRL(recebido);
  document.getElementById("res-receber").innerText = formatarBRL(aReceber);
  document.getElementById("res-despesas").innerText = formatarBRL(despesas);
  document.getElementById("res-lucro").innerText = formatarBRL(recebido - despesas);

  renderizarLista(eventosMes);
  renderizarCalendario(calMesPicker.value || mesSel, eventosCache);
}

function renderizarLista(eventosMes) {
  const lista = document.getElementById("view-lista");
  const termo = document.getElementById("busca").value.toLowerCase();
  const statusFiltro = document.getElementById("filtro-status").value;

  const filtrados = eventosMes.filter(ev => {
    const matchTexto = ev.cliente.toLowerCase().includes(termo) ||
                       ev.tipo.toLowerCase().includes(termo) ||
                       ev.telefone.includes(termo);
    const matchStatus = statusFiltro === "todos" || ev.status === statusFiltro;
    return matchTexto && matchStatus;
  });

  if (filtrados.length === 0) {
    lista.innerHTML = `<p class="msg-vazia">Nenhum agendamento encontrado neste filtro.</p>`;
    return;
  }

  lista.innerHTML = filtrados.map(ev => {
    const periodoBR = formatarPeriodoBR(ev);
    const restante = Math.max(0, (ev.valorTotal || 0) - (ev.valorPago || 0));

    let numLimpo = String(ev.telefone || "").replace(/\D/g, "");
    if (numLimpo.startsWith("55") && numLimpo.length >= 12) {
      numLimpo = numLimpo.slice(2);
    }

    const mensagem = `*JM EVENTOS - RESUMO DE RESERVA* ✨\n\n` +
      `👤 *Cliente:* ${ev.cliente}\n` +
      `🎉 *Evento:* ${ev.tipo}\n` +
      `📅 *Período:* ${periodoBR}\n` +
      `⏰ *Turno:* ${ev.turno}\n` +
      `📌 *Status:* ${ev.status.toUpperCase()}\n\n` +
      `💰 *Valor Total:* ${formatarBRL(ev.valorTotal)}\n` +
      `✅ *Valor Pago (Sinal):* ${formatarBRL(ev.valorPago)}\n` +
      `⏳ *Saldo Restante:* ${formatarBRL(restante)}\n\n` +
      `_Agradecemos a preferência!_`;

       const linkWhats = `https://wa.me{numLimpo}?text=${encodeURIComponent(mensagem)}`;

    return `
      <div class="event-item ${ev.status}">
        <div class="event-header">
          <span class="event-date">📅 ${periodoBR} • ${ev.turno}</span>
          <span class="badge ${ev.status}">${ev.status}</span>
        </div>
        <h3 class="event-title">${ev.cliente}</h3>
        <div class="event-meta">🎉 ${ev.tipo} ${ev.convidados ? `• 👥 ${ev.convidados} conv.` : ''} • 💳 ${ev.pagamento || 'PIX'}</div>

        <div class="finance-strip">
          <span><small>Total</small><b>${formatarBRL(ev.valorTotal)}</b></span>
          <span><small>Pago</small><b class="c-green">${formatarBRL(ev.valorPago)}</b></span>
          <span><small>Restante</small><b style="color:${restante > 0 ? '#ef4444' : '#10b981'}">${formatarBRL(restante)}</b></span>
        </div>

        <div class="card-actions">
          <a href="${linkWhats}" class="btn-act btn-whats" style="display:flex; align-items:center; justify-content:center; gap:5px; text-decoration:none;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z"/></svg>
            <span>WhatsApp</span>
          </a>
          <button type="button" class="btn-act btn-pdf" onclick="gerarReciboPDF('${ev.id}')">📄 Recibo</button>
          <button type="button" class="btn-act btn-edit" onclick="editarEvento('${ev.id}')">✏️ Editar</button>
          <button type="button" class="btn-act btn-del" onclick="excluirEvento('${ev.id}')">🗑️</button>
        </div>
      </div>`;

  }).join("");
}
// ==========================================
// 8. CALENDÁRIO VISUAL, RECIBO PDF E MODAL
// ==========================================
function renderizarCalendario(mesSel, todosEventos) {
  const grid = document.getElementById("cal-grid");
  const detalhe = document.getElementById("cal-detalhe-dia");
  detalhe.innerHTML = `<span style="color:var(--text-muted)">Toque em um dia para ver detalhes ou agendar.</span>`;

  if (!mesSel) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center;">Selecione um mês acima.</p>`;
    return;
  }

  const [ano, mes] = mesSel.split("-").map(Number);
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDiasMes = new Date(ano, mes, 0).getDate();

  let html = "";
  for (let i = 0; i < primeiroDiaSemana; i++) html += `<div class="cal-day empty"></div>`;

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const dataISO = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const evsDia = todosEventos.filter(e => e.status !== "cancelado" && eventoCobreDia(e, dataISO));
    let classeStatus = "";
    if (evsDia.some(e => e.status === "confirmado" || e.status === "concluido")) classeStatus = "has-confirmado";
    else if (evsDia.some(e => e.status === "orcamento")) classeStatus = "has-orcamento";
    html += `<div class="cal-day ${classeStatus}" onclick="selecionarDiaCalendario('${dataISO}', this)">${dia}</div>`;
  }
  grid.innerHTML = html;
}

window.selecionarDiaCalendario = (dataISO, elemento) => {
  document.querySelectorAll(".cal-day").forEach(d => d.classList.remove("selected"));
  elemento.classList.add("selected");
  const dataBR = dataISO.split("-").reverse().join("/");
  const evsDia = eventosCache.filter(e => e.status !== "cancelado" && eventoCobreDia(e, dataISO));
  const detalhe = document.getElementById("cal-detalhe-dia");

  if (evsDia.length === 0) {
    detalhe.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span>✅ Dia <b>${dataBR}</b> está livre!</span>
        <button type="button" class="btn-act btn-whats" style="padding:8px 14px;" onclick="agendarNaData('${dataISO}')">+ Reservar Data</button>
      </div>`;
  } else {
    detalhe.innerHTML = evsDia.map(ev => `
      <div style="margin-bottom:8px;">
        <strong style="color:var(--gold)">📅 ${formatarPeriodoBR(ev)} (${ev.turno})</strong><br>
        Cliente: <b>${ev.cliente}</b> — ${ev.tipo} (${ev.status.toUpperCase()})
      </div>`).join("");
  }
};

window.agendarNaData = (dataISO) => {
  abrirModal();
  document.getElementById("data").value = dataISO;
  document.getElementById("dataFim").value = dataISO;
  document.getElementById("dataFim").min = dataISO;
};

window.gerarReciboPDF = (id) => {
  const ev = eventosCache.find(item => String(item.id) === String(id));
  if (!ev) return;
  const periodoBR = formatarPeriodoBR(ev);
  const restante = Math.max(0, (ev.valorTotal || 0) - (ev.valorPago || 0));
  const areaRecibo = document.getElementById("area-recibo");

  areaRecibo.innerHTML = `
    <div style="border: 2px solid #000; padding: 24px; max-width: 700px; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 14px; margin-bottom: 20px;">
        <img id="logo-recibo-img" src="/icon.png" alt="JM Eventos" style="height: 95px; width: auto; object-fit: contain; margin-bottom: 8px;">
        <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px;">JM EVENTOS</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px;">Comprovante de Locação e Reserva de Espaço</p>
      </div>
      <h2 style="font-size: 18px; margin-bottom: 12px;">RECIBO / FICHA DE RESERVA</h2>
      <p><strong>Cliente:</strong> ${ev.cliente}</p>
      <p><strong>Telefone:</strong> ${aplicarMascaraTelefone(ev.telefone)}</p>
      <p><strong>Tipo de Evento:</strong> ${ev.tipo} ${ev.convidados ? `(${ev.convidados} convidados)` : ''}</p>
      <p><strong>Período Reservado:</strong> ${periodoBR} — <strong>Turno:</strong> ${ev.turno}</p>
      <p><strong>Status Atual:</strong> ${ev.status.toUpperCase()}</p>
      <hr style="margin: 16px 0;">
      <p><strong>Valor Total Acordado:</strong> ${formatarBRL(ev.valorTotal)}</p>
      <p><strong>Valor Recebido (Sinal):</strong> ${formatarBRL(ev.valorPago)} (${ev.pagamento || 'PIX'})</p>
      <p><strong>Saldo Restante a Pagar:</strong> ${formatarBRL(restante)}</p>
      ${regrasGeraisCache ? `<div style="white-space: pre-line; margin-top: 14px; padding: 12px; border: 1px solid #000; background-color: #f9f9f9; font-size: 13px;">${regrasGeraisCache}</div>` : ''}
      <div style="margin-top: 45px; display: flex; justify-content: space-between; text-align: center;">
        <div style="width: 45%; border-top: 1px solid #000; padding-top: 6px;">JM Eventos (Locador)</div>
        <div style="width: 45%; border-top: 1px solid #000; padding-top: 6px;">${ev.cliente} (Locatário)</div>
      </div>
    </div>`;

  const imgLogo = document.getElementById("logo-recibo-img");
  if (imgLogo.complete) {
    window.print();
  } else {
    imgLogo.onload = () => window.print();
    imgLogo.onerror = () => window.print();
  }
};

function abrirModal() {
  document.getElementById("form-evento").reset();
  document.getElementById("evento-id").value = "";
  document.getElementById("dataFim").min = "";
  document.getElementById("valorTotal").value = "R$ 0,00";
  document.getElementById("valorPago").value = "R$ 0,00";
  document.getElementById("despesas").value = "R$ 0,00";
  document.getElementById("modal-titulo").innerText = "Novo Agendamento";
  document.getElementById("modal-form").classList.add("active");
}

function fecharModal() {
  document.getElementById("modal-form").classList.remove("active");
}

window.editarEvento = (id) => {
  const ev = eventosCache.find(item => String(item.id) === String(id));
  if (!ev) return;
  document.getElementById("evento-id").value = ev.id;
  document.getElementById("cliente").value = ev.cliente;
  document.getElementById("telefone").value = aplicarMascaraTelefone(ev.telefone);
  document.getElementById("convidados").value = ev.convidados || "";
  document.getElementById("tipo").value = ev.tipo;
  document.getElementById("status").value = ev.status;
  document.getElementById("data").value = ev.data;
  document.getElementById("dataFim").value = ev.dataFim || ev.data;
  document.getElementById("dataFim").min = ev.data;
  document.getElementById("turno").value = ev.turno;
  document.getElementById("valorTotal").value = formatarBRL(ev.valorTotal);
  document.getElementById("valorPago").value = formatarBRL(ev.valorPago);
  document.getElementById("despesas").value = formatarBRL(ev.despesas || 0);
  document.getElementById("pagamento").value = ev.pagamento || "PIX";
  document.getElementById("modal-titulo").innerText = "Editar Agendamento";
  document.getElementById("modal-form").classList.add("active");
};

window.excluirEvento = async (id) => {
  if (confirm("Deseja realmente excluir este evento da agenda?")) {
    try {
      await fetch(`${API_URL}?id=eq.${id}`, { method: "DELETE", headers: HEADERS });
      await carregarEventos();
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    }
  }
};

document.getElementById("btn-novo").addEventListener("click", abrirModal);
document.getElementById("btn-cancelar").addEventListener("click", fecharModal);
document.getElementById("btn-fechar-x").addEventListener("click", fecharModal);
document.getElementById("busca").addEventListener("input", atualizarSistema);
document.getElementById("filtro-status").addEventListener("change", atualizarSistema);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}








