import { db, auth } from "../firebase/firebaseConfig.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../Login/login.html";
    return;
  }

  carregarClientesFirebase();
});

import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const listaClientes = document.getElementById("listaClientes");
const pesquisaClientes = document.getElementById("pesquisaClientes");
const paginacaoClientes = document.getElementById("paginacaoClientes");

const totalClientes = document.getElementById("totalClientes");
const totalCotas = document.getElementById("totalCotas");
const totalAtivas = document.getElementById("totalAtivas");
const totalInativas = document.getElementById("totalInativas");
const totalFinalizadas = document.getElementById("totalFinalizadas");
const valorTotalVendido = document.getElementById("valorTotalVendido");
const valorAtivoCarteira = document.getElementById("valorAtivoCarteira");
const totalContempladas = document.getElementById("totalContempladas");
const totalFaltamContemplar = document.getElementById("totalFaltamContemplar");
const totalContemplacoesPendentes = document.getElementById("totalContemplacoesPendentes");

let cadastros = [];
let paginaAtual = 1;

const clientesPorPagina = 5;
const percentualRetencaoHabiteSe = 0.06;
const versaoFinanceiroCliente = 3;

const dadosFinanceirosIniciaisClientes = [
  {
    cliente: "marcos azevedo",
    numeroCota: "3455",
    valorCredito: 280000,
    percentualLance: 59.9000,
    dataPagamentoCliente: "2025-10-15"
  },
  {
    cliente: "marcos azevedo",
    numeroCota: "3091",
    valorCredito: 260000,
    percentualLance: 62.9000,
    dataPagamentoCliente: "2026-02-19"
  },
  {
    cliente: "marcos azevedo",
    numeroCota: "0123",
    valorCredito: 260000,
    percentualLance: 64.3000,
    dataPagamentoCliente: "2026-04-15"
  },
  {
    cliente: "marcos azevedo",
    numeroCota: "0735",
    valorCredito: 280000,
    percentualLance: 63.2999,
    dataPagamentoCliente: "2026-05-15"
  }
];

async function carregarClientesFirebase() {
  try {
    const snapshot = await getDocs(collection(db, "clientes"));

    cadastros = [];

    snapshot.forEach(docItem => {
      cadastros.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });
    });

    await normalizarCadastrosAntigos();
    await aplicarDadosFinanceirosIniciais();
    renderizarClientes();

  } catch (erro) {
    console.error("Erro ao carregar clientes:", erro);

    if (listaClientes) {
      listaClientes.innerHTML = `
        <div class="card">
          Erro ao carregar clientes do Firebase.
        </div>
      `;
    }
  }
}

async function atualizarClienteFirebase(firebaseId, dados) {
  await updateDoc(doc(db, "clientes", firebaseId), dados);
}

async function excluirClienteFirebase(firebaseId) {
  await deleteDoc(doc(db, "clientes", firebaseId));
}

async function normalizarCadastrosAntigos() {
  const atualizacoes = [];

  cadastros.forEach(cadastro => {
    const dadosAtualizar = {};

    if (cadastro.contemplacaoPaga === undefined) {
      cadastro.contemplacaoPaga = false;
      dadosAtualizar.contemplacaoPaga = false;
    }

    if (cadastro.dataPagamentoContemplacao === undefined) {
      cadastro.dataPagamentoContemplacao = null;
      dadosAtualizar.dataPagamentoContemplacao = null;
    }

    if (cadastro.ativo === undefined) {
      cadastro.ativo = true;
      dadosAtualizar.ativo = true;
    }

    if (cadastro.dataInativacao === undefined) {
      cadastro.dataInativacao = null;
      dadosAtualizar.dataInativacao = null;
    }

    if (Object.keys(dadosAtualizar).length > 0 && cadastro.firebaseId) {
      atualizacoes.push(
        atualizarClienteFirebase(cadastro.firebaseId, dadosAtualizar)
      );
    }
  });

  if (atualizacoes.length > 0) {
    await Promise.all(atualizacoes);
  }
}

async function aplicarDadosFinanceirosIniciais() {
  const atualizacoes = [];

  dadosFinanceirosIniciaisClientes.forEach(dadosFinanceiros => {
    const cadastro = cadastros.find(item => {
      const nomeCliente = normalizarTextoBusca(item.cliente);
      const termosCliente = normalizarTextoBusca(dadosFinanceiros.cliente)
        .split(" ")
        .filter(Boolean);

      const mesmoCliente = termosCliente.every(termo => {
        return nomeCliente.includes(termo);
      });

      const mesmaCota =
        String(item.numeroCota || "").padStart(4, "0") ===
        String(dadosFinanceiros.numeroCota).padStart(4, "0");

      return mesmoCliente && mesmaCota;
    });

    if (
      !cadastro ||
      cadastro.versaoFinanceiroCliente === versaoFinanceiroCliente
    ) {
      return;
    }

    const valorLance =
      dadosFinanceiros.valorCredito *
      (dadosFinanceiros.percentualLance / 100);

    const dadosAtualizar = {
      valorCredito: dadosFinanceiros.valorCredito,
      contemplado: true,
      dataContemplacao: cadastro.dataContemplacao || dadosFinanceiros.dataPagamentoCliente,
      contemplacaoPaga: true,
      dataPagamentoContemplacao:
        cadastro.dataPagamentoContemplacao || dadosFinanceiros.dataPagamentoCliente,
      percentualLance: dadosFinanceiros.percentualLance,
      valorLance,
      dataPagamentoCliente: dadosFinanceiros.dataPagamentoCliente,
      financeiroClienteImportado: true,
      versaoFinanceiroCliente
    };

    Object.assign(cadastro, dadosAtualizar);

    atualizacoes.push(
      atualizarClienteFirebase(cadastro.firebaseId, dadosAtualizar)
    );
  });

  if (atualizacoes.length > 0) {
    await Promise.all(atualizacoes);
  }
}

function normalizarTextoBusca(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function formatarPercentual(valor) {
  if (valor === undefined || valor === null || valor === "") return "-";

  return `${Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  })}%`;
}

function obterNumeroPercentual(valor) {
  const texto = String(valor || "")
    .replace("%", "")
    .trim();

  const valorNormalizado = texto.includes(",")
    ? texto
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
    : texto.replace(/[^\d.]/g, "");

  return Number(valorNormalizado || 0);
}

function calcularValorBaseRecebimento(cadastro) {
  return Number(cadastro.valorCredito || 0);
}

function calcularValorLance(cadastro) {
  if (
    cadastro.valorLance !== undefined &&
    cadastro.valorLance !== null &&
    cadastro.valorLance !== ""
  ) {
    return Number(cadastro.valorLance) || 0;
  }

  return calcularValorBaseRecebimento(cadastro) *
    ((Number(cadastro.percentualLance) || 0) / 100);
}

function calcularValorRecebidoCliente(cadastro) {
  return calcularValorBaseRecebimento(cadastro) - calcularValorLance(cadastro);
}

function calcularValorRetidoHabiteSe(cadastro) {
  return calcularValorBaseRecebimento(cadastro) * percentualRetencaoHabiteSe;
}

function dataHojeInput() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function cotaFinalizada(cadastro) {
  if (cadastro.ativo === false) return false;

  const fluxo = cadastro.calculo?.fluxo || [];

  const parcelasNormais = fluxo.filter(item => item.mes !== 999);

  if (parcelasNormais.length === 0) return false;

  const ultimoMes = Math.max(
    ...parcelasNormais.map(item => Number(item.mes))
  );

  const dataVenda = new Date(cadastro.dataVenda + "T00:00:00");

  const dataFinal = new Date(dataVenda);
  dataFinal.setMonth(dataFinal.getMonth() + ultimoMes - 1);

  const hoje = new Date();

  const fluxoParcelasFinalizado = hoje > dataFinal;

  const saldoContemplacaoResolvido =
    !cadastro.contemplado || cadastro.contemplacaoPaga;

  return fluxoParcelasFinalizado && saldoContemplacaoResolvido;
}

function calcularResumoClientes() {
  const nomesClientes = new Set();

  let cotasAtivas = 0;
  let cotasInativas = 0;
  let cotasFinalizadas = 0;
  let valorTotal = 0;
  let valorAtivo = 0;
  let contempladas = 0;
  let faltamContemplar = 0;
  let pendentesPagamento = 0;

  cadastros.forEach(cadastro => {
    if (cadastro.cliente) {
      nomesClientes.add(cadastro.cliente.trim().toLowerCase());
    }

    const valorCredito = Number(cadastro.valorCredito) || 0;

    valorTotal += valorCredito;

    const finalizada = cotaFinalizada(cadastro);

    if (cadastro.ativo === false) {
      cotasInativas++;
    } else if (finalizada) {
      cotasFinalizadas++;
    } else {
      cotasAtivas++;
      valorAtivo += valorCredito;
    }

    if (cadastro.contemplado) {
      contempladas++;

      if (!cadastro.contemplacaoPaga) {
        pendentesPagamento++;
      }
    } else if (cadastro.ativo !== false && !finalizada) {
      faltamContemplar++;
    }
  });

  if (totalClientes) totalClientes.textContent = nomesClientes.size;
  if (totalCotas) totalCotas.textContent = cadastros.length;
  if (totalAtivas) totalAtivas.textContent = cotasAtivas;
  if (totalInativas) totalInativas.textContent = cotasInativas;
  if (totalFinalizadas) totalFinalizadas.textContent = cotasFinalizadas;
  if (valorTotalVendido) valorTotalVendido.textContent = formatarMoeda(valorTotal);
  if (valorAtivoCarteira) valorAtivoCarteira.textContent = formatarMoeda(valorAtivo);
  if (totalContempladas) totalContempladas.textContent = contempladas;
  if (totalFaltamContemplar) totalFaltamContemplar.textContent = faltamContemplar;
  if (totalContemplacoesPendentes) totalContemplacoesPendentes.textContent = pendentesPagamento;
}

if (pesquisaClientes) {
  pesquisaClientes.addEventListener("input", function() {
    paginaAtual = 1;
    renderizarClientes();
  });
}

function limparPesquisaClientes() {
  if (!pesquisaClientes) return;

  pesquisaClientes.value = "";
  paginaAtual = 1;
  renderizarClientes();
}

function mudarPaginaClientes(pagina) {
  paginaAtual = pagina;
  renderizarClientes();

  const secao = document.querySelector(".resultado");

  if (secao) {
    secao.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

async function excluirCadastro(firebaseId) {
  const confirmar = confirm("Deseja excluir esta cota?");

  if (!confirmar) return;

  try {
    await excluirClienteFirebase(firebaseId);
    await carregarClientesFirebase();
  } catch (erro) {
    console.error("Erro ao excluir cliente:", erro);
    alert("Erro ao excluir cliente.");
  }
}

function abrirCampoContemplacao(firebaseId) {
  const area = document.getElementById(`area-contemplacao-${firebaseId}`);
  const cadastro = cadastros.find(item => item.firebaseId === firebaseId);

  if (!area) return;

  fecharMenusEditar();
  area.classList.toggle("ativa");

  const input = document.getElementById(`data-contemplacao-${firebaseId}`);
  const forma = document.getElementById(`forma-pagamento-contemplacao-${firebaseId}`);
  const lance = document.getElementById(`lance-contemplacao-${firebaseId}`);

  if (input && !input.value) {
    input.value = cadastro?.dataContemplacao || dataHojeInput();
  }

  if (forma && !forma.value && cadastro?.formaPagamentoContemplacao) {
    forma.value = cadastro.formaPagamentoContemplacao;
  }

  if (lance && !lance.value && cadastro?.percentualLance !== undefined) {
    lance.value = formatarPercentual(cadastro.percentualLance);
  }
}

function confirmarContemplacao(firebaseId) {
  const input = document.getElementById(`data-contemplacao-${firebaseId}`);
  const forma = document.getElementById(`forma-pagamento-contemplacao-${firebaseId}`);
  const lance = document.getElementById(`lance-contemplacao-${firebaseId}`);

  if (!input || !input.value) {
    alert("Informe a data da contemplação.");
    return;
  }

  if (!forma || !forma.value) {
    alert("Selecione a forma de pagamento da contemplação.");
    return;
  }

  if (!lance || !lance.value) {
    alert("Informe o percentual do lance.");
    return;
  }

  marcarContemplado(
    firebaseId,
    input.value,
    forma.value,
    obterNumeroPercentual(lance.value)
  );
}

async function marcarContemplado(
  firebaseId,
  dataContemplacao,
  formaPagamentoContemplacao,
  percentualLance
) {
  try {
    const cadastro = cadastros.find(item => item.firebaseId === firebaseId);

    if (!cadastro) return;

    const dataPagamentoContemplacao =
      formaPagamentoContemplacao === "avista"
        ? dataContemplacao
        : calcularDataQuartaParcela(dataContemplacao);

    const valorLance = calcularValorBaseRecebimento(cadastro) *
      ((Number(percentualLance) || 0) / 100);

    await atualizarClienteFirebase(firebaseId, {
      contemplado: true,
      dataContemplacao,
      formaPagamentoContemplacao,
      contemplacaoPaga: true,
      dataPagamentoContemplacao,
      dataPagamentoCliente: dataPagamentoContemplacao,
      percentualLance,
      valorLance
    });

    await carregarClientesFirebase();

    alert("Dados de contemplação salvos.");

  } catch (erro) {
    console.error("Erro ao marcar contemplação:", erro);
    alert("Erro ao marcar contemplação.");
  }
}

function calcularDataQuartaParcela(dataBase) {
  const data = new Date(dataBase + "T00:00:00");

  data.setMonth(data.getMonth() + 3);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}


async function desfazerContemplacao(firebaseId) {
  const confirmar = confirm("Deseja remover a contemplação desta cota?");

  if (!confirmar) return;

  try {
    await atualizarClienteFirebase(firebaseId, {
      contemplado: false,
      dataContemplacao: null,
      contemplacaoPaga: false,
      dataPagamentoContemplacao: null
    });

    await carregarClientesFirebase();

  } catch (erro) {
    console.error("Erro ao remover contemplação:", erro);
    alert("Erro ao remover contemplação.");
  }
}

function abrirCampoPagamentoContemplacao(firebaseId) {
  const area = document.getElementById(`area-pagamento-contemplacao-${firebaseId}`);

  if (!area) return;

  fecharMenusEditar();
  area.classList.toggle("ativa");

  const input = document.getElementById(`data-pagamento-contemplacao-${firebaseId}`);

  if (input && !input.value) {
    input.value = dataHojeInput();
  }
}

function confirmarPagamentoContemplacao(firebaseId) {
  const input = document.getElementById(`data-pagamento-contemplacao-${firebaseId}`);

  if (!input || !input.value) {
    alert("Informe a data do pagamento da contemplação.");
    return;
  }

  marcarContemplacaoPaga(firebaseId, input.value);
}

async function marcarContemplacaoPaga(firebaseId, dataPagamento) {
  try {
    const cadastro = cadastros.find(item => item.firebaseId === firebaseId);

    if (!cadastro) return;

    if (!cadastro.contemplado) {
      alert("A cota precisa estar contemplada antes de marcar o pagamento.");
      return;
    }

    await atualizarClienteFirebase(firebaseId, {
      contemplacaoPaga: true,
      dataPagamentoContemplacao: dataPagamento
    });

    await carregarClientesFirebase();

    alert("Pagamento da contemplação confirmado.");

  } catch (erro) {
    console.error("Erro ao marcar pagamento:", erro);
    alert("Erro ao marcar pagamento.");
  }
}

async function desfazerPagamentoContemplacao(firebaseId) {
  const confirmar = confirm(
    "Deseja remover a confirmação de pagamento da contemplação?"
  );

  if (!confirmar) return;

  try {
    await atualizarClienteFirebase(firebaseId, {
      contemplacaoPaga: false,
      dataPagamentoContemplacao: null
    });

    await carregarClientesFirebase();

  } catch (erro) {
    console.error("Erro ao remover pagamento:", erro);
    alert("Erro ao remover pagamento.");
  }
}

function abrirCampoInativacao(firebaseId) {
  const area = document.getElementById(`area-inativacao-${firebaseId}`);

  if (!area) return;

  fecharMenusEditar();
  area.classList.toggle("ativa");

  const input = document.getElementById(`data-inativacao-${firebaseId}`);

  if (input && !input.value) {
    input.value = dataHojeInput();
  }
}

function confirmarInativacao(firebaseId) {
  const input = document.getElementById(`data-inativacao-${firebaseId}`);

  if (!input || !input.value) {
    alert("Informe a data da inativação.");
    return;
  }

  inativarCadastro(firebaseId, input.value);
}

async function inativarCadastro(firebaseId, dataInativacao) {
  try {
    await atualizarClienteFirebase(firebaseId, {
      ativo: false,
      dataInativacao
    });

    await carregarClientesFirebase();

    alert("Cota marcada como inativa.");

  } catch (erro) {
    console.error("Erro ao inativar cota:", erro);
    alert("Erro ao inativar cota.");
  }
}

async function reativarCadastro(firebaseId) {
  const confirmar = confirm("Deseja reativar esta cota?");

  if (!confirmar) return;

  try {
    await atualizarClienteFirebase(firebaseId, {
      ativo: true,
      dataInativacao: null
    });

    await carregarClientesFirebase();

    alert("Cota reativada.");

  } catch (erro) {
    console.error("Erro ao reativar cota:", erro);
    alert("Erro ao reativar cota.");
  }
}

function renderizarFluxo(fluxo = []) {
  return fluxo.map(item => {
    return `
      <tr>
        <td>${item.mes === 999 ? "Contemplação" : item.mes}</td>
        <td>${item.percentual}</td>
        <td>${item.descricao}</td>
        <td class="texto-positivo">
          ${formatarMoeda(item.valor)}
        </td>
      </tr>
    `;
  }).join("");
}

function renderizarFinanceiroContemplacao(cadastro) {
  if (!cadastro.contemplado) {
    return "";
  }

  const valorRetidoHabiteSe = calcularValorRetidoHabiteSe(cadastro);
  const valorLance = calcularValorLance(cadastro);
  const valorRecebidoCliente = calcularValorRecebidoCliente(cadastro);

  return `
    <div class="financeiro-cota">
      <div>
        <span>Valor base da cota</span>
        <strong>${formatarMoeda(calcularValorBaseRecebimento(cadastro))}</strong>
      </div>

      <div>
        <span>Habite-se (6%)</span>
        <strong>${formatarMoeda(valorRetidoHabiteSe)}</strong>
      </div>

      <div>
        <span>Valor do lance</span>
        <strong>${formatarMoeda(valorLance)}</strong>
      </div>

      <div>
        <span>Lance (%)</span>
        <strong>${formatarPercentual(cadastro.percentualLance)}</strong>
      </div>

      <div>
        <span>Valor líquido recebido</span>
        <strong>${formatarMoeda(valorRecebidoCliente)}</strong>
      </div>

      <div>
        <span>Data de pagamento ao cliente</span>
        <strong>${formatarData(cadastro.dataPagamentoCliente || cadastro.dataPagamentoContemplacao)}</strong>
      </div>
    </div>

    <p class="observacao-financeira">
      Valor líquido recebido pelo cliente = valor da cota menos valor do lance.
      Habite-se representa 6% do valor da cota.
    </p>
  `;
}

function gerarPdfCliente(clienteId) {
  const cliente = agruparClientes(cadastros)
    .find(item => item.id === clienteId);

  if (!cliente) {
    alert("Cliente não encontrado para gerar PDF.");
    return;
  }

  const { jsPDF } = window.jspdf || {};

  if (!jsPDF) {
    alert("Biblioteca de PDF não carregada.");
    return;
  }

  const docPdf = new jsPDF();

  const cotasContempladasLista = cliente.cotas
    .filter(cota => cota.contemplado)
    .sort((a, b) => {
      return new Date(a.dataContemplacao || a.dataPagamentoCliente || 0) -
        new Date(b.dataContemplacao || b.dataPagamentoCliente || 0);
    });

  const cotasNaoContempladasLista = cliente.cotas
    .filter(cota => !cota.contemplado)
    .sort((a, b) => {
      return String(a.numeroCota || "").localeCompare(
        String(b.numeroCota || ""),
        "pt-BR",
        { numeric: true }
      );
    });

  if (cotasContempladasLista.length === 0) {
    alert("Este cliente ainda não possui cotas contempladas para relatório.");
    return;
  }

  const totalRetido = cotasContempladasLista.reduce((total, cota) => {
    return total + calcularValorRetidoHabiteSe(cota);
  }, 0);

  const totalLance = cotasContempladasLista.reduce((total, cota) => {
    return total + calcularValorLance(cota);
  }, 0);

  const totalRecebido = cotasContempladasLista.reduce((total, cota) => {
    return total + calcularValorRecebidoCliente(cota);
  }, 0);

  const cotasContempladas = cotasContempladasLista.length;
  const creditoContemplado = cotasContempladasLista.reduce((total, cota) => {
    return total + calcularValorBaseRecebimento(cota);
  }, 0);

  const corBordo = [69, 10, 10];

  docPdf.setFillColor(...corBordo);
  docPdf.rect(0, 0, 210, 25, "F");

  docPdf.setTextColor(255, 255, 255);
  docPdf.setFontSize(18);
  docPdf.setFont(undefined, "bold");
  docPdf.text("TOVANI CONSULTORIA", 105, 16, { align: "center" });

  docPdf.setTextColor(17, 24, 39);
  docPdf.setFontSize(16);
  docPdf.text("Relatório do Cliente", 14, 38);

  docPdf.setFont(undefined, "normal");
  docPdf.setFontSize(10);
  docPdf.text(`Cliente: ${cliente.nome}`, 14, 48);
  docPdf.text(`Cotas contempladas no relatório: ${cotasContempladas}`, 14, 55);
  docPdf.text(`Crédito contemplado: ${formatarMoeda(creditoContemplado)}`, 14, 62);
  docPdf.text(`Habite-se (6%): ${formatarMoeda(totalRetido)}`, 108, 48);
  docPdf.text(`Total de lances: ${formatarMoeda(totalLance)}`, 108, 55);
  docPdf.text(`Valor líquido recebido: ${formatarMoeda(totalRecebido)}`, 108, 62);

  docPdf.autoTable({
    startY: 73,
    theme: "striped",
    head: [[
      "Grupo",
      "Cota",
      "Crédito",
      "Contemplação",
      "Lance %",
      "Valor lance",
      "Pagamento",
      "Habite-se 6%",
      "Líquido"
    ]],
    body: cotasContempladasLista.map(cota => [
      cota.grupo || "-",
      cota.numeroCota || "-",
      formatarMoeda(cota.valorCredito),
      formatarData(cota.dataContemplacao),
      formatarPercentual(cota.percentualLance),
      formatarMoeda(calcularValorLance(cota)),
      formatarData(cota.dataPagamentoCliente || cota.dataPagamentoContemplacao),
      formatarMoeda(calcularValorRetidoHabiteSe(cota)),
      formatarMoeda(calcularValorRecebidoCliente(cota))
    ]),
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [31, 41, 55],
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
      valign: "middle"
    },
    headStyles: {
      fillColor: corBordo,
      textColor: [255, 255, 255],
      fontStyle: "bold"
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 15 },
      2: { cellWidth: 25 },
      3: { cellWidth: 24 },
      4: { cellWidth: 18 },
      5: { cellWidth: 25 },
      6: { cellWidth: 24 },
      7: { cellWidth: 24 },
      8: { cellWidth: 25 }
    },
    margin: { left: 10, right: 10 }
  });

  if (cotasNaoContempladasLista.length > 0) {
    const yCotasPendentes = docPdf.lastAutoTable.finalY + 12;

    docPdf.setTextColor(17, 24, 39);
    docPdf.setFontSize(13);
    docPdf.setFont(undefined, "bold");
    docPdf.text("Cotas a contemplar", 14, yCotasPendentes);

    docPdf.autoTable({
      startY: yCotasPendentes + 6,
      theme: "striped",
      head: [[
        "Grupo",
        "Cota",
        "Crédito",
        "Plano",
        "Venda",
        "Status"
      ]],
      body: cotasNaoContempladasLista.map(cota => [
        cota.grupo || "-",
        cota.numeroCota || "-",
        formatarMoeda(cota.valorCredito),
        cota.plano ? `${cota.plano} meses` : "-",
        formatarData(cota.dataVenda),
        "A contemplar"
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [31, 41, 55],
        lineColor: [229, 231, 235],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: corBordo,
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      margin: { left: 14, right: 14 }
    });
  }

  const nomeArquivo = cliente.nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  docPdf.save(`relatorio-${nomeArquivo || "cliente"}.pdf`);
}

function filtrarCadastros() {
  const termo = pesquisaClientes
    ? pesquisaClientes.value.toLowerCase().trim()
    : "";

  if (!termo) {
    return cadastros;
  }

  return cadastros.filter(cadastro => {
    const finalizada = cotaFinalizada(cadastro);

    const statusPagamento = cadastro.contemplacaoPaga
      ? "contemplação paga quitada"
      : "contemplação pendente pagamento";

    const statusAtivo = cadastro.ativo === false
      ? "inativo inadimplente desativado"
      : finalizada
        ? "finalizada finalizado encerrada encerrado"
        : "ativo ativa";

    const statusContemplacao = cadastro.contemplado
      ? "contemplado contemplada"
      : "não contemplado não contemplada falta contemplar faltam contemplar";

    return (
      String(cadastro.cliente || "").toLowerCase().includes(termo) ||
      String(cadastro.vendedor || "").toLowerCase().includes(termo) ||
      String(cadastro.numeroCota || "").toLowerCase().includes(termo) ||
      String(cadastro.grupo || "").toLowerCase().includes(termo) ||
      String(cadastro.plano || "").toLowerCase().includes(termo) ||
      statusPagamento.includes(termo) ||
      statusAtivo.includes(termo) ||
      statusContemplacao.includes(termo) ||
      formatarMoeda(cadastro.valorCredito).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataVenda).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataContemplacao).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataPagamentoContemplacao).toLowerCase().includes(termo) ||
      formatarData(cadastro.dataInativacao).toLowerCase().includes(termo)
    );
  });
}

function agruparClientes(lista = []) {
  const grupos = {};

  lista.forEach(cadastro => {
    const nomeCliente = String(cadastro.cliente || "Cliente sem nome").trim();
    const chave = nomeCliente.toLowerCase();

    if (!grupos[chave]) {
      grupos[chave] = {
        id: chave.replace(/[^a-z0-9]/gi, "-"),
        nome: nomeCliente,
        cotas: [],
        creditoTotal: 0,
        vendedores: new Set(),
        planos: new Set(),
        datasVenda: [],
        contempladas: 0,
        ativas: 0,
        inativas: 0,
        finalizadas: 0,
        pendentesContemplacao: 0
      };
    }

    const finalizada = cotaFinalizada(cadastro);

    grupos[chave].cotas.push(cadastro);
    grupos[chave].creditoTotal += Number(cadastro.valorCredito) || 0;

    if (cadastro.vendedor) grupos[chave].vendedores.add(cadastro.vendedor);
    if (cadastro.plano) grupos[chave].planos.add(`${cadastro.plano} meses`);
    if (cadastro.dataVenda) grupos[chave].datasVenda.push(cadastro.dataVenda);

    if (cadastro.contemplado) {
      grupos[chave].contempladas++;
    } else {
      grupos[chave].pendentesContemplacao++;
    }

    if (cadastro.ativo === false) {
      grupos[chave].inativas++;
    } else if (finalizada) {
      grupos[chave].finalizadas++;
    } else {
      grupos[chave].ativas++;
    }
  });

  return Object.values(grupos).map(cliente => {
    cliente.cotas.sort((a, b) => {
      return new Date(b.dataVenda || 0) - new Date(a.dataVenda || 0);
    });

    cliente.dataMaisRecente = cliente.datasVenda.length
      ? cliente.datasVenda.sort().reverse()[0]
      : null;

    return cliente;
  });
}

function renderizarPaginacao(totalItens) {
  if (!paginacaoClientes) return;

  const totalPaginas = Math.ceil(totalItens / clientesPorPagina);

  if (totalPaginas <= 1) {
    paginacaoClientes.innerHTML = "";
    return;
  }

  let botoes = `
    <button
      onclick="mudarPaginaClientes(${paginaAtual - 1})"
      ${paginaAtual === 1 ? "disabled" : ""}
    >
      Anterior
    </button>
  `;

  for (let i = 1; i <= totalPaginas; i++) {
    botoes += `
      <button
        class="${i === paginaAtual ? "ativo" : ""}"
        onclick="mudarPaginaClientes(${i})"
      >
        ${i}
      </button>
    `;
  }

  botoes += `
    <button
      onclick="mudarPaginaClientes(${paginaAtual + 1})"
      ${paginaAtual === totalPaginas ? "disabled" : ""}
    >
      Próxima
    </button>

    <div class="paginacao-info">
      Página ${paginaAtual} de ${totalPaginas} • ${totalItens} cliente(s)
    </div>
  `;

  paginacaoClientes.innerHTML = botoes;
}

function renderizarStatusCota(cadastro, finalizada) {
  return `
    <div class="status-linha">
      ${
        cadastro.ativo === false
          ? `<div class="status-inativo">COTA INATIVA</div>`
          : finalizada
            ? `<div class="status-finalizada">COTA FINALIZADA</div>`
            : `<div class="status-contemplado">COTA ATIVA</div>`
      }

      ${
        cadastro.contemplado
          ? `<div class="status-contemplado">CONTEMPLADA</div>`
          : `<div class="status-pendente">FALTA CONTEMPLAR</div>`
      }

      ${
        cadastro.contemplado
          ? cadastro.formaPagamentoContemplacao === "parcelado"
            ? `<div class="status-finalizada">CONTEMPLAÇÃO 4X</div>`
            : `<div class="status-contemplado">CONTEMPLAÇÃO À VISTA</div>`
          : ""
      }
    </div>
  `;
}
function renderizarAcoesCota(cadastro, finalizada) {
  const id = cadastro.firebaseId;

  return `
    <div class="cota-acoes">

      <button class="btn-editar" onclick="toggleMenuEditar('${id}')">
        Editar
        <span>⌄</span>
      </button>

      <div class="menu-editar" id="menu-editar-${id}">

        ${
          !cadastro.contemplado
            ? `
              <button class="acao-verde" onclick="abrirCampoContemplacao('${id}')">
                Marcar Contemplada
              </button>
            `
            : `
              <button class="acao-verde" onclick="abrirCampoContemplacao('${id}')">
                Editar Contemplação
              </button>

              <button class="acao-vermelha" onclick="desfazerContemplacao('${id}')">
                Remover Contemplação
              </button>
            `
        }

        ${
          cadastro.ativo === false
            ? `
              <button class="acao-verde" onclick="reativarCadastro('${id}')">
                Reativar Cota
              </button>
            `
            : finalizada
              ? ""
              : `
                <button class="acao-laranja" onclick="abrirCampoInativacao('${id}')">
                  Inativar Cota
                </button>
              `
        }

        <button class="acao-vermelha" onclick="excluirCadastro('${id}')">
          Excluir Cota
        </button>

      </div>

    </div>

    <div class="area-contemplacao-card" id="area-contemplacao-${id}">

      <label>
        <span>Data contemplação</span>
        <input
          type="date"
          id="data-contemplacao-${id}"
          value="${cadastro.dataContemplacao || ""}"
        >
      </label>

      <label>
        <span>Pagamento</span>
        <select id="forma-pagamento-contemplacao-${id}">
          <option value="">Forma de pagamento</option>
          <option value="avista" ${cadastro.formaPagamentoContemplacao === "avista" ? "selected" : ""}>
            À vista
          </option>
          <option value="parcelado" ${cadastro.formaPagamentoContemplacao === "parcelado" ? "selected" : ""}>
            Parcelado em 4x
          </option>
        </select>
      </label>

      <label>
        <span>Lance (%)</span>
        <input
          type="text"
          id="lance-contemplacao-${id}"
          inputmode="decimal"
          placeholder="Ex: 59,9000%"
          value="${cadastro.percentualLance !== undefined ? formatarPercentual(cadastro.percentualLance) : ""}"
        >
      </label>

      <button onclick="confirmarContemplacao('${id}')">
        Salvar
      </button>

      <button class="btn-cancelar" onclick="abrirCampoContemplacao('${id}')">
        Cancelar
      </button>
    </div>

    ${
      cadastro.ativo !== false && !finalizada
        ? `
          <div class="area-contemplacao-card" id="area-inativacao-${id}">
            <input type="date" id="data-inativacao-${id}">

            <button onclick="confirmarInativacao('${id}')">
              Confirmar
            </button>

            <button class="btn-cancelar" onclick="abrirCampoInativacao('${id}')">
              Cancelar
            </button>
          </div>
        `
        : ""
    }
  `;
}

function fecharMenusEditar() {
  document.querySelectorAll(".menu-editar").forEach(menu => {
    menu.classList.remove("ativo");
  });
}

function toggleMenuEditar(firebaseId) {
  document.querySelectorAll(".area-contemplacao-card").forEach(area => {
    area.classList.remove("ativa");
  });

  document.querySelectorAll(".menu-editar").forEach(menu => {
    if (menu.id !== `menu-editar-${firebaseId}`) {
      menu.classList.remove("ativo");
    }
  });

  const menu = document.getElementById(`menu-editar-${firebaseId}`);

  if (menu) {
    menu.classList.toggle("ativo");
  }
}

function renderizarCotasCliente(cliente) {
  return cliente.cotas
    .sort((a, b) => {
      const aFinalizada = cotaFinalizada(a);
      const bFinalizada = cotaFinalizada(b);

      const prioridadeA =
        a.ativo === false || aFinalizada
          ? 3
          : !a.contemplado
            ? 1
            : 2;

      const prioridadeB =
        b.ativo === false || bFinalizada
          ? 3
          : !b.contemplado
            ? 1
            : 2;

      return prioridadeA - prioridadeB;
    })
    .map(cadastro => {
      const finalizada = cotaFinalizada(cadastro);

      return `
        <div class="cliente-cota-item">

          <div class="cliente-cota-topo">

            <div>
              <strong>
                Grupo ${cadastro.grupo || "-"} — Cota ${cadastro.numeroCota || "-"}
              </strong>

              <div class="linha-info">
                <span>
                  <strong>Vendedor:</strong>
                  ${cadastro.vendedor || "-"}
                </span>

                <span>
                  <strong>Plano:</strong>
                  ${cadastro.plano || "-"} meses
                </span>

                <span>
                  <strong>Crédito:</strong>
                  ${formatarMoeda(cadastro.valorCredito)}
                </span>

                <span>
                  <strong>Venda:</strong>
                  ${formatarData(cadastro.dataVenda)}
                </span>

                ${
                  cadastro.contemplado
                    ? `
                      <span>
                        <strong>Contemplação:</strong>
                        ${formatarData(cadastro.dataContemplacao)}
                      </span>
                    `
                    : ""
                }

                ${
                  cadastro.contemplacaoPaga
                    ? `
                      <span>
                        <strong>Pagamento contemplação:</strong>
                        ${formatarData(cadastro.dataPagamentoContemplacao)}
                      </span>
                    `
                    : ""
                }

                ${
                  cadastro.ativo === false
                    ? `
                      <span>
                        <strong>Inativada em:</strong>
                        ${formatarData(cadastro.dataInativacao)}
                      </span>
                    `
                    : ""
                }
              </div>
            </div>

            <div>
              ${renderizarStatusCota(cadastro, finalizada)}
            </div>

          </div>

          ${renderizarAcoesCota(cadastro, finalizada)}
          ${renderizarFinanceiroContemplacao(cadastro)}

          <details class="detalhes-fluxo">

            <summary>
              Ver fluxo de comissão
            </summary>

            <div class="tabela-wrapper">

              <table class="tabela">

                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>%</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                  </tr>
                </thead>

                <tbody>
                  ${renderizarFluxo(cadastro.calculo?.fluxo || [])}
                </tbody>

              </table>

            </div>

          </details>

        </div>
      `;
    }).join("");
}

function renderizarClientes() {
  calcularResumoClientes();

  if (!listaClientes) return;

  const cadastrosFiltrados = filtrarCadastros();

  if (cadastros.length === 0) {
    listaClientes.innerHTML = `
      <div class="card">
        Nenhum cliente cadastrado.
      </div>
    `;

    if (paginacaoClientes) {
      paginacaoClientes.innerHTML = "";
    }

    return;
  }

  if (cadastrosFiltrados.length === 0) {
    listaClientes.innerHTML = `
      <div class="card">
        Nenhum resultado encontrado para a pesquisa.
      </div>
    `;

    if (paginacaoClientes) {
      paginacaoClientes.innerHTML = "";
    }

    return;
  }

  const clientesAgrupados = agruparClientes(cadastrosFiltrados)
    .sort((a, b) => {
      return new Date(b.dataMaisRecente || 0) - new Date(a.dataMaisRecente || 0);
    });

  const totalPaginas = Math.ceil(clientesAgrupados.length / clientesPorPagina);

  if (paginaAtual > totalPaginas) {
    paginaAtual = totalPaginas;
  }

  const inicio = (paginaAtual - 1) * clientesPorPagina;
  const fim = inicio + clientesPorPagina;

  const clientesPagina = clientesAgrupados.slice(inicio, fim);

  listaClientes.innerHTML = clientesPagina.map(cliente => {
    const cotasTexto = cliente.cotas
      .map(cota => cota.numeroCota)
      .filter(Boolean)
      .join(", ");

    return `
      <div class="card cliente-card-crm">

        <div class="card-topo cliente-resumo-crm">

          <div class="card-info">

            <div class="cliente-nome">
              ${cliente.nome}
            </div>

            <div class="linha-info">

              <span>
                <strong>Total de cotas:</strong>
                ${cliente.cotas.length}
              </span>

              <span>
                <strong>Crédito total:</strong>
                ${formatarMoeda(cliente.creditoTotal)}
              </span>

              <span>
                <strong>Vendedor(es):</strong>
                ${[...cliente.vendedores].join(", ") || "-"}
              </span>

              <span>
                <strong>Planos:</strong>
                ${[...cliente.planos].join(", ") || "-"}
              </span>

              <span>
                <strong>Última venda:</strong>
                ${formatarData(cliente.dataMaisRecente)}
              </span>

            </div>

            <div class="linha-info cotas-resumo">
              <span>
                <strong>Cotas:</strong>
                ${cotasTexto || "-"}
              </span>
            </div>

          </div>

          <div class="card-acoes resumo-acoes-crm">

            <button
              class="btn-pdf-cliente"
              onclick="gerarPdfCliente('${cliente.id}')"
            >
              Gerar PDF
            </button>

            <div class="status-contemplado">
              ${cliente.ativas} ativa(s)
            </div>

            ${
              cliente.inativas > 0
                ? `<div class="status-inativo">${cliente.inativas} inativa(s)</div>`
                : ""
            }

            ${
              cliente.finalizadas > 0
                ? `<div class="status-finalizada">${cliente.finalizadas} finalizada(s)</div>`
                : ""
            }

            <div class="status-contemplado">
              ${cliente.contempladas} contemplada(s)
            </div>

            ${
              cliente.pendentesContemplacao > 0
                ? `<div class="status-pendente">${cliente.pendentesContemplacao} falta(m) contemplar</div>`
                : ""
            }

          </div>

        </div>

        <details class="detalhes-cliente-crm">

          <summary>
            Ver cotas do cliente
          </summary>

          <div class="cliente-cotas-lista">
            ${renderizarCotasCliente(cliente)}
          </div>

        </details>

      </div>
    `;
  }).join("");

  renderizarPaginacao(clientesAgrupados.length);
}

window.limparPesquisaClientes = limparPesquisaClientes;
window.mudarPaginaClientes = mudarPaginaClientes;
window.excluirCadastro = excluirCadastro;
window.abrirCampoContemplacao = abrirCampoContemplacao;
window.confirmarContemplacao = confirmarContemplacao;
window.desfazerContemplacao = desfazerContemplacao;
window.abrirCampoPagamentoContemplacao = abrirCampoPagamentoContemplacao;
window.confirmarPagamentoContemplacao = confirmarPagamentoContemplacao;
window.desfazerPagamentoContemplacao = desfazerPagamentoContemplacao;
window.abrirCampoInativacao = abrirCampoInativacao;
window.confirmarInativacao = confirmarInativacao;
window.reativarCadastro = reativarCadastro;
window.toggleMenuEditar = toggleMenuEditar;
window.fecharMenusEditar = fecharMenusEditar;
window.gerarPdfCliente = gerarPdfCliente;
