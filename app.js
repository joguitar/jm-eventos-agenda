// 🔐 DEFINA SUA SENHA DE ACESSO AQUI
const SENHA_ACESSO = "1234";

// ⚠️ COLE AQUI AS CREDENCIAIS REAIS DO SEU PROJETO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyAeMUCVEsDW9bocBxBqkVv2UEUyr5aPlhU",
  authDomain: "jm-eventos.firebaseapp.com",
  projectId: "jm-eventos",
  storageBucket: "jm-eventos.firebasestorage.app",
  messagingSenderId: "1013643921839",
  appId: "1:1013643921839:web:159ac653bd7aa19883c75a",
  measurementId: "G-6RGCNV8EX4"
};

// ==========================================
// 1. AUTENTICAÇÃO E TRAVA DE TELA
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
// 2. INICIALIZAÇÃO DO FIREBASE (MODO COMPAT)
// ==========================================
let db = null;
let eventosRef = null;
let eventosCache = [];

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
  eventosRef = db.collection("eventos");

  eventosRef.orderBy("data", "asc").onSnapshot((snapshot) => {
    eventosCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    document.getElementById("status-conexao").innerHTML = "● Sincronizado";
    document.getElementById("status-conexao").style.color = "#10b981";
    atualizarSistema();
  }, (err) => {
    document.getElementById("status-conexao").innerHTML = "● Erro Firebase";
    document.getElementById("status-conexao").style.color = "#ef4444";
    console.error(err);
  });
} catch (e) {
  document.getElementById("status-conexao").innerHTML = "● Configure o Firebase";
  document.getElementById("status-conexao").style.color = "#f59e0b";
}

// ==========================================
// 3. DATA ATUAL E ABAS
// ==========================================
const filtroMes = document.getElementById("filtro-mes");
const hoje = new Date();
filtroMes.value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const view = btn.dataset.view;
    document.getElementById("view-lista").style.display = view === "lista" ? "flex" : "none";
    document.getElementById("box-filtros").style.display = view === "lista" ? "flex" : "none";
    document.getElementById("view-calendario").style.display = view === "calendario" ? "block" : "none";
  });
});

// ==========================================
// 4. SALVAR / EDITAR EVENTOS E TRAVA DE CONFLITO
// ==========================================
document.getElementById("form-evento").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!eventosRef) {
    alert("Configure as chaves do Firebase no arquivo app.js antes de salvar.");
    return;
  }

  const idEdicao = document.getElementById("evento-id").value;
  const dataEvento = document.getElementById("data").value;
  const turnoEvento = document.getElementById("turno").value;
  const statusEvento = document.getElementById("status").value;

  if (statusEvento !== "cancelado") {
    const conflito = eventosCache.find(ev =>
      ev.id !== idEdicao &&
      ev.status !== "cancelado" &&
      ev.data === dataEvento &&
      (ev.turno === turnoEvento || ev.turno === "Integral (Dia Todo)" || turnoEvento === "Integral (Dia Todo)")
    );

    if (conflito) {
      alert(`⚠️ CONFLITO DE AGENDA!\nA data ${dataEvento.split("-").reverse().join("/")} já possui reserva (${conflito.cliente} - ${conflito.turno}).`);
      return;
    }
  }

  const dados = {
    cliente: document.getElementById("cliente").value.trim(),
    telefone: document.getElementById("telefone").value.trim(),
    convidados: parseInt(document.getElementById("convidados").value) || 0,
    tipo: document.getElementById("tipo").value,
    status: statusEvento,
    data: dataEvento,
    turno: turnoEvento,
    valorTotal: parseFloat(document.getElementById("valorTotal").value) || 0,
    valorPago: parseFloat(document.getElementById("valorPago").value) || 0,
    despesas: parseFloat(document.getElementById("despesas").value) || 0,
    pagamento: document.getElementById("pagamento").value,
    obs: document.getElementById("obs").value.trim()
  };

  try {
    if (idEdicao) {
      await eventosRef.doc(idEdicao).update(dados);
    } else {
      await eventosRef.add(dados);
    }
    fecharModal();
  } catch (err) {
    alert("Erro ao salvar na nuvem: " + err.message);
  }
});
// ==========================================
// 5. ATUALIZAÇÃO GERAL (FINANCEIRO, LISTA E CALENDÁRIO)
// ==========================================
function formatarBRL(val) {
  return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function atualizarSistema() {
  const mesSel = filtroMes.value;
  const eventosMes = eventosCache.filter(ev => !mesSel || ev.data.startsWith(mesSel));

  let recebido = 0, aReceber = 0, despesas = 0;
  eventosMes.forEach(ev => {
    if (ev.status !== "cancelado") {
      recebido += ev.valorPago || 0;
      const falta = (ev.valorTotal || 0) - (ev.valorPago || 0);
      if (falta > 0) aReceber += falta;
      despesas += ev.despesas || 0;
    }
  });
  const lucro = recebido - despesas;

  document.getElementById("res-recebido").innerText = formatarBRL(recebido);
  document.getElementById("res-receber").innerText = formatarBRL(aReceber);
  document.getElementById("res-despesas").innerText = formatarBRL(despesas);
  document.getElementById("res-lucro").innerText = formatarBRL(lucro);

  renderizarLista(eventosMes);
  renderizarCalendario(mesSel, eventosMes);
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
    lista.innerHTML = `<p class="msg-vazia">Nenhum agendamento encontrado para este período.</p>`;
    return;
  }

  lista.innerHTML = filtrados.map(ev => {
    const dataBR = ev.data.split("-").reverse().join("/");
    const restante = Math.max(0, (ev.valorTotal || 0) - (ev.valorPago || 0));

    return `
      <div class="event-item ${ev.status}">
        <div class="event-header">
          <span class="event-date">📅 ${dataBR} • ${ev.turno}</span>
          <span class="badge ${ev.status}">${ev.status}</span>
        </div>
        <h3 class="event-title">${ev.cliente}</h3>
        <div class="event-meta">🎉 ${ev.tipo} ${ev.convidados ? `• 👥 ${ev.convidados} conv.` : ''} • 💳 ${ev.pagamento || 'PIX'}</div>
        ${ev.obs ? `<div class="event-obs">📝 ${ev.obs}</div>` : ''}

        <div class="finance-strip">
          <span><small>Total</small><b>${formatarBRL(ev.valorTotal)}</b></span>
          <span><small>Pago</small><b class="c-green">${formatarBRL(ev.valorPago)}</b></span>
          <span><small>Restante</small><b style="color:${restante > 0 ? '#ef4444' : '#10b981'}">${formatarBRL(restante)}</b></span>
        </div>

        <div class="card-actions">
          <button type="button" class="btn-act btn-whats" onclick="enviarComprovanteWhats('${ev.id}')">📲 Comprovante</button>
          <button type="button" class="btn-act btn-pdf" onclick="gerarReciboPDF('${ev.id}')">📄 Recibo</button>
          <button type="button" class="btn-act btn-edit" onclick="editarEvento('${ev.id}')">✏️ Editar</button>
          <button type="button" class="btn-act btn-del" onclick="excluirEvento('${ev.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 6. CALENDÁRIO VISUAL INTERATIVO
// ==========================================
function renderizarCalendario(mesSel, eventosMes) {
  const grid = document.getElementById("cal-grid");
  const detalhe = document.getElementById("cal-detalhe-dia");
  detalhe.innerHTML = `<span style="color:var(--text-muted)">Toque em um dia para ver detalhes ou agendar.</span>`;

  if (!mesSel) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center;">Selecione um mês no topo para ver o calendário.</p>`;
    return;
  }

  const [ano, mes] = mesSel.split("-").map(Number);
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDiasMes = new Date(ano, mes, 0).getDate();

  let html = "";
  for (let i = 0; i < primeiroDiaSemana; i++) {
    html += `<div class="cal-day empty"></div>`;
  }

  for (let dia = 1; dia <= totalDiasMes; dia++) {
    const dataISO = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const evsDia = eventosMes.filter(e => e.data === dataISO && e.status !== "cancelado");
    
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
  const evsDia = eventosCache.filter(e => e.data === dataISO && e.status !== "cancelado");
  const detalhe = document.getElementById("cal-detalhe-dia");

  if (evsDia.length === 0) {
    detalhe.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span>✅ Dia <b>${dataBR}</b> está livre!</span>
        <button type="button" class="btn-act btn-whats" style="padding:8px 14px;" onclick="agendarNaData('${dataISO}')">+ Reservar Data</button>
      </div>
    `;
  } else {
    detalhe.innerHTML = evsDia.map(ev => `
      <div style="margin-bottom:8px;">
        <strong style="color:var(--gold)">📅 ${dataBR} (${ev.turno})</strong><br>
        Cliente: <b>${ev.cliente}</b> — ${ev.tipo} (${ev.status.toUpperCase()})
      </div>
    `).join("");
  }
};

window.agendarNaData = (dataISO) => {
  abrirModal();
  document.getElementById("data").value = dataISO;
};
// ==========================================
// 7. COMPROVANTE WHATSAPP E RECIBO PDF
// ==========================================
window.enviarComprovanteWhats = (id) => {
  const ev = eventosCache.find(item => item.id === id);
  if (!ev) return;

  const dataBR = ev.data.split("-").reverse().join("/");
  const restante = Math.max(0, (ev.valorTotal || 0) - (ev.valorPago || 0));
  const numLimpo = ev.telefone.replace(/\D/g, "");

  const mensagem = `*JM EVENTOS - COMPROVANTE DE RESERVA* ✨\n\n` +
    `👤 *Cliente:* ${ev.cliente}\n` +
    `🎉 *Evento:* ${ev.tipo}\n` +
    `📅 *Data:* ${dataBR}\n` +
    `⏰ *Turno:* ${ev.turno}\n` +
    `📌 *Status:* ${ev.status.toUpperCase()}\n\n` +
    `💰 *Valor Total:* ${formatarBRL(ev.valorTotal)}\n` +
    `✅ *Valor Pago (Sinal):* ${formatarBRL(ev.valorPago)}\n` +
    `⏳ *Saldo Restante:* ${formatarBRL(restante)}\n\n` +
    (ev.obs ? `📝 *Observações:* ${ev.obs}\n\n` : ``) +
    `_Agradecemos a preferência! Qualquer dúvida estamos à disposição._`;

  const url = `https://wa.me{numLimpo}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");
};

window.gerarReciboPDF = (id) => {
  const ev = eventosCache.find(item => item.id === id);
  if (!ev) return;

  const dataBR = ev.data.split("-").reverse().join("/");
  const restante = Math.max(0, (ev.valorTotal || 0) - (ev.valorPago || 0));
  const areaRecibo = document.getElementById("area-recibo");

  areaRecibo.innerHTML = `
    <div style="border: 2px solid #000; padding: 24px; max-width: 700px; margin: 0 auto;">
      <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 24px;">JM EVENTOS</h1>
        <p style="margin: 4px 0 0 0; font-size: 14px;">Comprovante de Locação e Reserva de Espaço</p>
      </div>
      <h2 style="font-size: 18px; margin-bottom: 12px;">RECIBO / FICHA DE RESERVA</h2>
      <p><strong>Cliente:</strong> ${ev.cliente}</p>
      <p><strong>Telefone:</strong> ${ev.telefone}</p>
      <p><strong>Tipo de Evento:</strong> ${ev.tipo} ${ev.convidados ? `(${ev.convidados} convidados)` : ''}</p>
      <p><strong>Data Reservada:</strong> ${dataBR} — <strong>Turno:</strong> ${ev.turno}</p>
      <p><strong>Status Atual:</strong> ${ev.status.toUpperCase()}</p>
      <hr style="margin: 16px 0;">
      <p><strong>Valor Total Acordado:</strong> ${formatarBRL(ev.valorTotal)}</p>
      <p><strong>Valor Recebido (Sinal):</strong> ${formatarBRL(ev.valorPago)} (${ev.pagamento || 'PIX'})</p>
      <p><strong>Saldo Restante a Pagar:</strong> ${formatarBRL(restante)}</p>
      ${ev.obs ? `<p><strong>Itens Inclusos / Observações:</strong> ${ev.obs}</p>` : ''}
      <div style="margin-top: 50px; display: flex; justify-content: space-between; text-align: center;">
        <div style="width: 45%; border-top: 1px solid #000; padding-top: 6px;">JM Eventos (Locador)</div>
        <div style="width: 45%; border-top: 1px solid #000; padding-top: 6px;">${ev.cliente} (Locatário)</div>
      </div>
    </div>
  `;

  window.print();
};

// ==========================================
// 8. CONTROLES DO MODAL E EVENTOS
// ==========================================
function abrirModal() {
  document.getElementById("form-evento").reset();
  document.getElementById("evento-id").value = "";
  document.getElementById("modal-titulo").innerText = "Novo Agendamento";
  document.getElementById("modal-form").classList.add("active");
}

function fecharModal() {
  document.getElementById("modal-form").classList.remove("active");
}

window.editarEvento = (id) => {
  const ev = eventosCache.find(item => item.id === id);
  if (!ev) return;
  document.getElementById("evento-id").value = ev.id;
  document.getElementById("cliente").value = ev.cliente;
  document.getElementById("telefone").value = ev.telefone;
  document.getElementById("convidados").value = ev.convidados || "";
  document.getElementById("tipo").value = ev.tipo;
  document.getElementById("status").value = ev.status;
  document.getElementById("data").value = ev.data;
  document.getElementById("turno").value = ev.turno;
  document.getElementById("valorTotal").value = ev.valorTotal;
  document.getElementById("valorPago").value = ev.valorPago;
  document.getElementById("despesas").value = ev.despesas || 0;
  document.getElementById("pagamento").value = ev.pagamento || "PIX";
  document.getElementById("obs").value = ev.obs || "";

  document.getElementById("modal-titulo").innerText = "Editar Agendamento";
  document.getElementById("modal-form").classList.add("active");
};

window.excluirEvento = async (id) => {
  if (confirm("Deseja realmente excluir este evento da agenda?")) {
    await eventosRef.doc(id).delete();
  }
};

document.getElementById("btn-novo").addEventListener("click", abrirModal);
document.getElementById("btn-cancelar").addEventListener("click", fecharModal);
document.getElementById("btn-fechar-x").addEventListener("click", fecharModal);
document.getElementById("busca").addEventListener("input", atualizarSistema);
document.getElementById("filtro-status").addEventListener("change", atualizarSistema);
filtroMes.addEventListener("change", atualizarSistema);

// Registro do PWA no Android
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

