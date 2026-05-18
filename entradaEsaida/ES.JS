import { db, auth } from "../firebase/firebaseConfig.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "../login/login.html";
  }

});


import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

console.log("ES Firebase carregado");

const formRegistro = document.getElementById("formRegistro");
const listaRegistros = document.getElementById("listaRegistros");

const totalEntradas = document.getElementById("totalEntradas");
const totalSaidas = document.getElementById("totalSaidas");
const saldoFinal = document.getElementById("saldoFinal");
const fechamentoMensal = document.getElementById("fechamentoMensal");

const filtroMes = document.getElementById("filtroMes");
const btnFiltrarMes = document.getElementById("btnFiltrarMes");
const btnLimparFiltro = document.getElementById("btnLimparFiltro");
const btnGerarPDF = document.getElementById("btnGerarPDF");

const btnTipoLancamento = document.getElementById("btnTipoLancamento");
const btnTipoCustoFixo = document.getElementById("btnTipoCustoFixo");
const btnTipoConsultoria = document.getElementById("btnTipoConsultoria");

const modoRegistro = document.getElementById("modoRegistro");

const campoTipo = document.getElementById("campoTipo");
const campoDataLancamento = document.getElementById("campoDataLancamento");
const campoDiaVencimento = document.getElementById("campoDiaVencimento");
const campoDataInicio = document.getElementById("campoDataInicio");
const campoDataFim = document.getElementById("campoDataFim");
const campoStatus = document.getElementById("campoStatus");

const campoClienteConsultoria = document.getElementById("campoClienteConsultoria");
const campoValorParcelaConsultoria = document.getElementById("campoValorParcelaConsultoria");
const campoParcelasConsultoria = document.getElementById("campoParcelasConsultoria");
const campoDataPrimeiraParcela = document.getElementById("campoDataPrimeiraParcela");

const btnSalvarRegistro = document.getElementById("btnSalvarRegistro");
const btnCancelarEdicao = document.getElementById("btnCancelarEdicao");

let lancamentos = [];
let custosFixos = [];
let consultoriasParceladas = [];

let idEditando = null;
let tipoEditando = null;
let graficoFinanceiro = null;

async function carregarDadosFirebase() {
  try {
    const snapLancamentos = await getDocs(collection(db, "lancamentosES"));
    const snapCustos = await getDocs(collection(db, "custosFixosES"));
    const snapConsultorias = await getDocs(collection(db, "consultoriasParceladasES"));

    lancamentos = [];
    custosFixos = [];
    consultoriasParceladas = [];

    snapLancamentos.forEach(docItem => {
      lancamentos.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });
    });

    snapCustos.forEach(docItem => {
      custosFixos.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });
    });

    snapConsultorias.forEach(docItem => {
      consultoriasParceladas.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });
    });

    renderizarTudo();

  } catch (erro) {
    console.error("Erro ao carregar dados do Firebase:", erro);
    alert("Erro ao carregar dados financeiros.");
  }
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarData(data) {
  if (!data) return "-";
  return new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
}

function obterMesAno(data) {
  const d = new Date(data + "T00:00:00");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();

  return `${ano}-${mes}`;
}

function adicionarMesesTexto(dataTexto, meses) {
  const data = new Date(dataTexto + "T00:00:00");

  const diaOriginal = data.getDate();

  const novaData = new Date(
    data.getFullYear(),
    data.getMonth() + meses,
    1
  );

  const ultimoDiaMes = new Date(
    novaData.getFullYear(),
    novaData.getMonth() + 1,
    0
  ).getDate();

  novaData.setDate(Math.min(diaOriginal, ultimoDiaMes));

  const ano = novaData.getFullYear();
  const mes = String(novaData.getMonth() + 1).padStart(2, "0");
  const dia = String(novaData.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function nomeMesAno(chave) {
  const [ano, mes] = chave.split("-");
  const data = new Date(Number(ano), Number(mes) - 1);

  const texto = data.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function hojeMesAno() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ano = hoje.getFullYear();

  return `${ano}-${mes}`;
}

function mostrarCampo(campo, mostrar) {
  if (!campo) return;
  campo.style.display = mostrar ? "flex" : "none";
}

function definirModo(modo) {
  modoRegistro.value = modo;

  btnTipoLancamento.classList.remove("tipo-ativo");
  btnTipoCustoFixo.classList.remove("tipo-ativo");

  if (btnTipoConsultoria) {
    btnTipoConsultoria.classList.remove("tipo-ativo");
  }

  mostrarCampo(campoTipo, false);
  mostrarCampo(campoDataLancamento, false);
  mostrarCampo(campoDiaVencimento, false);
  mostrarCampo(campoDataInicio, false);
  mostrarCampo(campoDataFim, false);
  mostrarCampo(campoStatus, false);

  mostrarCampo(campoClienteConsultoria, false);
  mostrarCampo(campoValorParcelaConsultoria, false);
  mostrarCampo(campoParcelasConsultoria, false);
  mostrarCampo(campoDataPrimeiraParcela, false);

  document.getElementById("tipo").required = false;
  document.getElementById("data").required = false;
  document.getElementById("diaVencimento").required = false;
  document.getElementById("dataInicio").required = false;

  if (document.getElementById("clienteConsultoria")) {
    document.getElementById("clienteConsultoria").required = false;
  }

  if (document.getElementById("valorParcelaConsultoria")) {
    document.getElementById("valorParcelaConsultoria").required = false;
  }

  if (document.getElementById("quantidadeParcelas")) {
    document.getElementById("quantidadeParcelas").required = false;
  }

  if (document.getElementById("dataPrimeiraParcela")) {
    document.getElementById("dataPrimeiraParcela").required = false;
  }

  document.getElementById("valor").required = true;

  if (modo === "lancamento") {
    btnTipoLancamento.classList.add("tipo-ativo");

    mostrarCampo(campoTipo, true);
    mostrarCampo(campoDataLancamento, true);

    document.getElementById("tipo").required = true;
    document.getElementById("data").required = true;

    btnSalvarRegistro.textContent = "Salvar Lançamento";
  }

  if (modo === "fixo") {
    btnTipoCustoFixo.classList.add("tipo-ativo");

    mostrarCampo(campoDiaVencimento, true);
    mostrarCampo(campoDataInicio, true);
    mostrarCampo(campoDataFim, true);
    mostrarCampo(campoStatus, true);

    document.getElementById("diaVencimento").required = true;
    document.getElementById("dataInicio").required = true;

    btnSalvarRegistro.textContent = "Salvar Custo Fixo";
  }

  if (modo === "consultoria") {
    btnTipoConsultoria.classList.add("tipo-ativo");

    mostrarCampo(campoClienteConsultoria, true);
    mostrarCampo(campoValorParcelaConsultoria, true);
    mostrarCampo(campoParcelasConsultoria, true);
    mostrarCampo(campoDataPrimeiraParcela, true);
    mostrarCampo(campoStatus, true);

    document.getElementById("valor").required = false;
    document.getElementById("categoria").value = "Consultoria";

    document.getElementById("clienteConsultoria").required = true;
    document.getElementById("valorParcelaConsultoria").required = true;
    document.getElementById("quantidadeParcelas").required = true;
    document.getElementById("dataPrimeiraParcela").required = true;

    btnSalvarRegistro.textContent = "Salvar Consultoria Parcelada";
  }
}

function limparFormulario() {
  formRegistro.reset();

  idEditando = null;
  tipoEditando = null;

  btnCancelarEdicao.style.display = "none";

  definirModo("lancamento");
}

function gerarMesesParaCustosFixos() {
  const meses = [];

  if (filtroMes.value) {
    meses.push(filtroMes.value);
    return meses;
  }

  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();

  for (let offset = -3; offset <= 8; offset++) {
    const data = new Date(anoAtual, mesAtual + offset, 1);

    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");

    meses.push(`${ano}-${mes}`);
  }

  return meses;
}

function gerarLancamentosCustosFixos() {
  const lancamentosFixos = [];
  const meses = gerarMesesParaCustosFixos();

  meses.forEach(chaveMes => {
    const [ano, mes] = chaveMes.split("-");

    custosFixos.forEach(custo => {
      const dataInicio = new Date(custo.dataInicio + "T00:00:00");
      const ultimoDiaMes = new Date(Number(ano), Number(mes), 0).getDate();
      const dia = Math.min(Number(custo.diaVencimento), ultimoDiaMes);

      const dataCustoTexto =
        `${ano}-${mes}-${String(dia).padStart(2, "0")}`;

      const dataCusto = new Date(dataCustoTexto + "T00:00:00");

      if (dataCusto < dataInicio) return;

      if (custo.dataFim) {
        const dataFim = new Date(custo.dataFim + "T00:00:00");
        if (dataCusto > dataFim) return;
      }

      if (custo.status === "inativo" && !custo.dataFim) return;

      lancamentosFixos.push({
        id: `fixo-${custo.firebaseId}-${chaveMes}`,
        origem: "fixo",
        tipo: "saida",
        descricao: custo.descricao,
        categoria: custo.categoria,
        valor: Number(custo.valor) || 0,
        data: dataCustoTexto,
        custoFixoId: custo.firebaseId
      });
    });
  });

  return lancamentosFixos;
}

function gerarLancamentosConsultoriasParceladas() {
  const parcelas = [];

  consultoriasParceladas.forEach(consultoria => {
    if (consultoria.status === "inativo") return;

    for (let i = 0; i < consultoria.quantidadeParcelas; i++) {
      const dataParcela = adicionarMesesTexto(
        consultoria.dataPrimeiraParcela,
        i
      );

      parcelas.push({
        id: `consultoria-${consultoria.firebaseId}-${i + 1}`,
        origem: "consultoria",
        tipo: "entrada",
        cliente: consultoria.cliente,
        descricao: `${consultoria.descricao} - Parcela ${i + 1}/${consultoria.quantidadeParcelas}`,
        categoria: "Consultoria",
        valor: Number(consultoria.valorParcela) || 0,
        data: dataParcela,
        consultoriaId: consultoria.firebaseId,
        numeroParcela: i + 1,
        quantidadeParcelas: consultoria.quantidadeParcelas
      });
    }
  });

  return parcelas;
}

function obterTodosLancamentos() {
  return [
    ...lancamentos.map(item => ({
      ...item,
      origem: "manual"
    })),
    ...gerarLancamentosCustosFixos(),
    ...gerarLancamentosConsultoriasParceladas()
  ];
}

function obterLancamentosFiltrados() {
  let todos = obterTodosLancamentos();

  if (filtroMes.value) {
    todos = todos.filter(item => obterMesAno(item.data) === filtroMes.value);
  }

  return todos;
}

function calcularTotais() {
  const dados = obterLancamentosFiltrados();

  let entradas = 0;
  let saidas = 0;

  dados.forEach(item => {
    if (item.tipo === "entrada") entradas += Number(item.valor) || 0;
    if (item.tipo === "saida") saidas += Number(item.valor) || 0;
  });

  const saldo = entradas - saidas;

  totalEntradas.textContent = formatarMoeda(entradas);
  totalSaidas.textContent = formatarMoeda(saidas);
  saldoFinal.textContent = formatarMoeda(saldo);

  saldoFinal.classList.remove("negativo");

  if (saldo < 0) {
    saldoFinal.classList.add("negativo");
  }
}

function renderizarRegistros() {
  const dados = obterLancamentosFiltrados();

  if (dados.length === 0) {
    listaRegistros.innerHTML = `
      <div class="card">
        Nenhum registro encontrado.
      </div>
    `;
    return;
  }

  const lancamentosHtml = dados
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map(item => {
      const isFixo = item.origem === "fixo";
      const isConsultoria = item.origem === "consultoria";

      return `
        <div class="card">
          <div class="lancamento-card">

            <div>
              <h3>${item.descricao}</h3>

              ${item.cliente ? `<p>Cliente: ${item.cliente}</p>` : ""}
              <p>Categoria: ${item.categoria}</p>
              <p>Data: ${formatarData(item.data)}</p>

              ${
                isFixo
                  ? `<p><strong>Custo fixo automático</strong></p>`
                  : isConsultoria
                    ? `<p><strong>Consultoria parcelada automática</strong></p>`
                    : `<p><strong>Lançamento manual</strong></p>`
              }

              <span class="${item.tipo === "entrada" ? "tag-entrada" : "tag-saida"}">
                ${String(item.tipo || "").toUpperCase()}
              </span>
            </div>

            <div>
              <div class="valor-lancamento ${item.tipo}">
                ${item.tipo === "entrada" ? "+" : "-"}
                ${formatarMoeda(item.valor)}
              </div>


              ${
                isFixo
                  ? `
                    <button class="botao-editar" onclick="editarCustoFixo('${item.custoFixoId}')">
                      Editar
                    </button>

                    <button class="botao-excluir" onclick="excluirCustoFixo('${item.custoFixoId}')">
                      Excluir
                    </button>
                  `
                  : isConsultoria
                    ? `
                      <button class="botao-editar" onclick="editarConsultoriaParcelada('${item.consultoriaId}')">
                        Editar
                      </button>

                      <button class="botao-excluir" onclick="excluirConsultoriaParcelada('${item.consultoriaId}')">
                        Excluir
                      </button>
                    `
                    : `
                      <button class="botao-editar" onclick="editarLancamento('${item.firebaseId}')">
                        Editar
                      </button>

                      <button class="botao-excluir" onclick="excluirLancamento('${item.firebaseId}')">
                        Excluir
                      </button>
                    `
              }
            </div>

          </div>
        </div>
      `;
    }).join("");

  listaRegistros.innerHTML = `
    <h3 class="subtitulo-lista">Lançamentos do período</h3>
    ${lancamentosHtml}
  `;
}

function renderizarFechamentoMensal() {
  const dados = obterTodosLancamentos();
  const agrupado = {};

  dados.forEach(item => {
    const chave = obterMesAno(item.data);

    if (!agrupado[chave]) {
      agrupado[chave] = {
        entradas: 0,
        saidas: 0,
        saldo: 0
      };
    }

    if (item.tipo === "entrada") {
      agrupado[chave].entradas += Number(item.valor) || 0;
    }

    if (item.tipo === "saida") {
      agrupado[chave].saidas += Number(item.valor) || 0;
    }

    agrupado[chave].saldo =
      agrupado[chave].entradas - agrupado[chave].saidas;
  });

  const meses = Object.keys(agrupado).sort().reverse();

  if (meses.length === 0) {
    fechamentoMensal.innerHTML = `
      <div class="card">
        Nenhum fechamento encontrado.
      </div>
    `;
    return;
  }

  fechamentoMensal.innerHTML = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Mês</th>
          <th>Entradas</th>
          <th>Saídas</th>
          <th>Saldo</th>
          <th>Status</th>
        </tr>
      </thead>

      <tbody>
        ${meses.map(mes => {
          const dadosMes = agrupado[mes];
          const positivo = dadosMes.saldo >= 0;

          return `
            <tr>
              <td>${nomeMesAno(mes)}</td>

              <td class="texto-positivo">
                ${formatarMoeda(dadosMes.entradas)}
              </td>

              <td class="texto-negativo">
                ${formatarMoeda(dadosMes.saidas)}
              </td>

              <td class="${positivo ? "texto-positivo" : "texto-negativo"}">
                <strong>${formatarMoeda(dadosMes.saldo)}</strong>
              </td>

              <td class="${positivo ? "texto-positivo" : "texto-negativo"}">
                <strong>${positivo ? "POSITIVO" : "NEGATIVO"}</strong>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function renderizarGrafico() {
  const dados = obterLancamentosFiltrados();
  const agrupado = {};

  dados.forEach(item => {
    const chave = obterMesAno(item.data);

    if (!agrupado[chave]) {
      agrupado[chave] = {
        entradas: 0,
        saidas: 0,
        saldo: 0
      };
    }

    if (item.tipo === "entrada") {
      agrupado[chave].entradas += Number(item.valor) || 0;
    }

    if (item.tipo === "saida") {
      agrupado[chave].saidas += Number(item.valor) || 0;
    }

    agrupado[chave].saldo =
      agrupado[chave].entradas - agrupado[chave].saidas;
  });

  const meses = Object.keys(agrupado).sort();

  const labels = meses.map(mes => nomeMesAno(mes));
  const entradas = meses.map(mes => agrupado[mes].entradas);
  const saidas = meses.map(mes => agrupado[mes].saidas);
  const saldos = meses.map(mes => agrupado[mes].saldo);

  const canvas = document.getElementById("graficoFinanceiro");

  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  if (graficoFinanceiro) {
    graficoFinanceiro.destroy();
  }

  graficoFinanceiro = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Entradas",
          data: entradas,
          backgroundColor: "rgba(22, 163, 74, 0.85)",
          borderColor: "#16a34a",
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 46
        },
        {
          type: "bar",
          label: "Saídas",
          data: saidas,
          backgroundColor: "rgba(220, 38, 38, 0.82)",
          borderColor: "#dc2626",
          borderWidth: 1,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 46
        },
        {
          type: "line",
          label: "Saldo",
          data: saldos,
          borderColor: "#0f172a",
          backgroundColor: "#0f172a",
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.35,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 22,
            color: "#334155",
            font: {
              size: 13,
              weight: "700"
            }
          }
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleColor: "#ffffff",
          bodyColor: "#e2e8f0",
          borderColor: "#1e293b",
          borderWidth: 1,
          padding: 14,
          cornerRadius: 12,
          displayColors: true,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${formatarMoeda(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: "#475569",
            font: {
              size: 12,
              weight: "700"
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(148, 163, 184, 0.22)"
          },
          ticks: {
            color: "#64748b",
            callback: function(value) {
              return formatarMoeda(value);
            }
          }
        }
      }
    }
  });
}









function renderizarTudo() {
  calcularTotais();
  renderizarGrafico();
  renderizarFechamentoMensal();
  renderizarRegistros();
}

formRegistro.addEventListener("submit", async function(event) {
  event.preventDefault();

  const modo = modoRegistro.value;
  const descricao = document.getElementById("descricao").value;
  const categoria = document.getElementById("categoria").value;

  try {
    if (modo === "lancamento") {
      const tipo = document.getElementById("tipo").value;
      const data = document.getElementById("data").value;
      const valor = Number(document.getElementById("valor").value);

      const dados = {
        tipo,
        descricao,
        categoria,
        valor,
        data,
        criadoEm: new Date().toISOString()
      };

      if (idEditando && tipoEditando === "lancamento") {
        await updateDoc(doc(db, "lancamentosES", idEditando), dados);
      } else {
        await addDoc(collection(db, "lancamentosES"), dados);
      }
    }

    if (modo === "fixo") {
      const valor = Number(document.getElementById("valor").value);
      const diaVencimento = Number(document.getElementById("diaVencimento").value);
      const dataInicio = document.getElementById("dataInicio").value;
      const dataFim = document.getElementById("dataFim").value;
      const status = document.getElementById("status").value;

      const dados = {
        descricao,
        categoria,
        valor,
        diaVencimento,
        dataInicio,
        dataFim,
        status,
        criadoEm: new Date().toISOString()
      };

      if (idEditando && tipoEditando === "fixo") {
        await updateDoc(doc(db, "custosFixosES", idEditando), dados);
      } else {
        await addDoc(collection(db, "custosFixosES"), dados);
      }
    }

    if (modo === "consultoria") {
      const cliente = document.getElementById("clienteConsultoria").value;
      const valorParcela = Number(document.getElementById("valorParcelaConsultoria").value);
      const quantidadeParcelas = Number(document.getElementById("quantidadeParcelas").value);
      const dataPrimeiraParcela = document.getElementById("dataPrimeiraParcela").value;
      const status = document.getElementById("status").value;

      const dados = {
        cliente,
        descricao,
        categoria: "Consultoria",
        valorParcela,
        quantidadeParcelas,
        dataPrimeiraParcela,
        status,
        criadoEm: new Date().toISOString()
      };

      if (idEditando && tipoEditando === "consultoria") {
        await updateDoc(doc(db, "consultoriasParceladasES", idEditando), dados);
      } else {
        await addDoc(collection(db, "consultoriasParceladasES"), dados);
      }
    }

    limparFormulario();
    await carregarDadosFirebase();

    alert("Registro salvo com sucesso.");

  } catch (erro) {
    console.error("Erro ao salvar no Firebase:", erro);
    alert("Erro ao salvar no Firebase.");
  }
});

function editarLancamento(id) {
  const item = lancamentos.find(lancamento => lancamento.firebaseId === id);

  if (!item) return;

  definirModo("lancamento");

  idEditando = item.firebaseId;
  tipoEditando = "lancamento";

  document.getElementById("tipo").value = item.tipo;
  document.getElementById("descricao").value = item.descricao;
  document.getElementById("categoria").value = item.categoria;
  document.getElementById("valor").value = item.valor;
  document.getElementById("data").value = item.data;

  btnSalvarRegistro.textContent = "Atualizar Lançamento";
  btnCancelarEdicao.style.display = "inline-block";

  window.scrollTo({
    top: formRegistro.offsetTop - 120,
    behavior: "smooth"
  });
}

function editarCustoFixo(id) {
  const item = custosFixos.find(custo => custo.firebaseId === id);

  if (!item) return;

  definirModo("fixo");

  idEditando = item.firebaseId;
  tipoEditando = "fixo";

  document.getElementById("descricao").value = item.descricao;
  document.getElementById("categoria").value = item.categoria;
  document.getElementById("valor").value = item.valor;
  document.getElementById("diaVencimento").value = item.diaVencimento;
  document.getElementById("dataInicio").value = item.dataInicio;
  document.getElementById("dataFim").value = item.dataFim || "";
  document.getElementById("status").value = item.status;

  btnSalvarRegistro.textContent = "Atualizar Custo Fixo";
  btnCancelarEdicao.style.display = "inline-block";

  window.scrollTo({
    top: formRegistro.offsetTop - 120,
    behavior: "smooth"
  });
}

function editarConsultoriaParcelada(id) {
  const item = consultoriasParceladas.find(consultoria => consultoria.firebaseId === id);

  if (!item) return;

  definirModo("consultoria");

  idEditando = item.firebaseId;
  tipoEditando = "consultoria";

  document.getElementById("descricao").value = item.descricao;
  document.getElementById("categoria").value = "Consultoria";
  document.getElementById("clienteConsultoria").value = item.cliente;
  document.getElementById("valorParcelaConsultoria").value = item.valorParcela;
  document.getElementById("quantidadeParcelas").value = item.quantidadeParcelas;
  document.getElementById("dataPrimeiraParcela").value = item.dataPrimeiraParcela;
  document.getElementById("status").value = item.status;

  btnSalvarRegistro.textContent = "Atualizar Consultoria Parcelada";
  btnCancelarEdicao.style.display = "inline-block";

  window.scrollTo({
    top: formRegistro.offsetTop - 120,
    behavior: "smooth"
  });
}

async function excluirLancamento(id) {
  const confirmar = confirm("Deseja excluir este lançamento?");

  if (!confirmar) return;

  await deleteDoc(doc(db, "lancamentosES", id));
  await carregarDadosFirebase();
}

async function excluirCustoFixo(id) {
  const confirmar = confirm("Deseja excluir este custo fixo?");

  if (!confirmar) return;

  await deleteDoc(doc(db, "custosFixosES", id));
  await carregarDadosFirebase();
}

async function excluirConsultoriaParcelada(id) {
  const confirmar = confirm("Deseja excluir esta consultoria parcelada?");

  if (!confirmar) return;

  await deleteDoc(doc(db, "consultoriasParceladasES", id));
  await carregarDadosFirebase();
}

window.editarLancamento = editarLancamento;
window.editarCustoFixo = editarCustoFixo;
window.editarConsultoriaParcelada = editarConsultoriaParcelada;

window.excluirLancamento = excluirLancamento;
window.excluirCustoFixo = excluirCustoFixo;
window.excluirConsultoriaParcelada = excluirConsultoriaParcelada;

btnCancelarEdicao.addEventListener("click", function() {
  limparFormulario();
});

btnTipoLancamento.addEventListener("click", function() {
  limparFormulario();
  definirModo("lancamento");
});

btnTipoCustoFixo.addEventListener("click", function() {
  limparFormulario();
  definirModo("fixo");
});

btnTipoConsultoria.addEventListener("click", function() {
  limparFormulario();
  definirModo("consultoria");
});

btnFiltrarMes.addEventListener("click", function() {
  renderizarTudo();
});

btnLimparFiltro.addEventListener("click", function() {
  filtroMes.value = "";
  renderizarTudo();
});

btnGerarPDF.addEventListener("click", gerarPDF);

function gerarPDF() {
  const dataInicial = document.getElementById("dataInicialRelatorio").value;
  const dataFinal = document.getElementById("dataFinalRelatorio").value;

  if (!dataInicial || !dataFinal) {
    alert("Selecione a data inicial e final.");
    return;
  }

  const filtrados = obterTodosLancamentos().filter(item => {
    return item.data >= dataInicial && item.data <= dataFinal;
  });

  if (filtrados.length === 0) {
    alert("Nenhum lançamento encontrado.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Relatório Financeiro", 14, 20);

  doc.setFontSize(11);
  doc.text(
    `Período: ${formatarData(dataInicial)} até ${formatarData(dataFinal)}`,
    14,
    28
  );

  const tabela = filtrados.map(item => [
    formatarData(item.data),
    String(item.tipo || "").toUpperCase(),
    item.descricao,
    item.categoria,
    formatarMoeda(item.valor),
    item.origem === "fixo"
      ? "Custo fixo"
      : item.origem === "consultoria"
        ? "Consultoria parcelada"
        : "Manual"
  ]);

  doc.autoTable({
    startY: 35,
    head: [[
      "Data",
      "Tipo",
      "Descrição",
      "Categoria",
      "Valor",
      "Origem"
    ]],
    body: tabela
  });

  doc.save("relatorio-financeiro.pdf");
}

btnCancelarEdicao.style.display = "none";
filtroMes.value = hojeMesAno();

definirModo("lancamento");
carregarDadosFirebase();



