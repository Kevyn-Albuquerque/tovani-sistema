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
  getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const recebidoAnterior = document.getElementById("recebidoAnterior");
const faturamentoMesAtual = document.getElementById("faturamentoMesAtual");
const receberProximos = document.getElementById("receberProximos");
const tabelaMensal = document.getElementById("tabelaMensal");
const custosPrevistos = document.getElementById("custosPrevistos");

let cadastros = [];
let lancamentosES = [];
let consultoriasParceladasES = [];

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function adicionarMeses(data, meses) {
  const novaData = new Date(data);
  novaData.setMonth(novaData.getMonth() + meses);
  return novaData;
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

  return novaData;
}

function chaveMesAno(data) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${ano}-${mes}`;
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

function ehParcelaMensal(item) {
  const descricao = String(item.descricao || "").toLowerCase();
  return descricao.includes("0.4%") || descricao.includes("0.25%");
}

function ehSaldoPendente(item) {
  return String(item.descricao || "").toLowerCase().includes("saldo pendente");
}

function ehReferenciaAdiantamento(item) {
  const descricao = String(item.descricao || "").toLowerCase();

  return (
    descricao.includes("referência de adiantamento") ||
    descricao.includes("adiantamento contemplação")
  );
}

async function carregarDadosFirebase() {
  try {
    const snapClientes = await getDocs(collection(db, "clientes"));
    const snapLancamentos = await getDocs(collection(db, "lancamentosES"));
    const snapConsultorias = await getDocs(collection(db, "consultoriasParceladasES"));

    cadastros = [];
    lancamentosES = [];
    consultoriasParceladasES = [];

    snapClientes.forEach(docItem => {
      cadastros.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });
    });

    snapLancamentos.forEach(docItem => {
      lancamentosES.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });
    });

    snapConsultorias.forEach(docItem => {
      consultoriasParceladasES.push({
        firebaseId: docItem.id,
        ...docItem.data()
      });
    });

    calcularDashboard();

  } catch (erro) {
    console.error("Erro ao carregar dados no dashboard:", erro);

    if (tabelaMensal) {
      tabelaMensal.innerHTML = `
        <div class="card">
          Erro ao carregar dados do Firebase.
        </div>
      `;
    }
  }
}

function gerarRecebimentosConsorcio() {
  const recebimentos = [];

  cadastros.forEach(cadastro => {
    if (!cadastro.dataVenda || !cadastro.calculo || !cadastro.calculo.fluxo) {
      return;
    }

    const dataVenda = new Date(cadastro.dataVenda + "T00:00:00");
    const ativo = cadastro.ativo !== false;

    const dataInativacao =
      !ativo && cadastro.dataInativacao
        ? new Date(cadastro.dataInativacao + "T00:00:00")
        : null;

    const contemplado = cadastro.contemplado && cadastro.dataContemplacao;
    const contemplacaoPaga = cadastro.contemplacaoPaga && cadastro.dataPagamentoContemplacao;

    const dataContemplacao = contemplado
      ? new Date(cadastro.dataContemplacao + "T00:00:00")
      : null;

    const dataPagamentoContemplacao = contemplacaoPaga
      ? new Date(cadastro.dataPagamentoContemplacao + "T00:00:00")
      : null;

    const mesContemplacao = contemplado ? chaveMesAno(dataContemplacao) : null;
    const mesPagamentoContemplacao = contemplacaoPaga ? chaveMesAno(dataPagamentoContemplacao) : null;

    let parcelasAdiantadas = 0;
    let mesesSemReceber = 0;

    cadastro.calculo.fluxo.forEach(item => {
      if (ehReferenciaAdiantamento(item)) return;

      if (ehSaldoPendente(item)) {
        if (contemplacaoPaga) {
          recebimentos.push({
            origem: "Saldo contemplação",
            cliente: cadastro.cliente,
            cota: cadastro.numeroCota,
            vendedor: cadastro.vendedor,
            plano: cadastro.plano,
            data: dataPagamentoContemplacao,
            mesAno: mesPagamentoContemplacao,
            descricao: "Saldo da contemplação pago",
            valor: Number(item.valor) || 0
          });
        }

        return;
      }

      const dataOriginal = adicionarMeses(dataVenda, item.mes - 1);
      const mesOriginal = chaveMesAno(dataOriginal);

      if (!ativo && dataInativacao && dataOriginal > dataInativacao) return;

      if (
        contemplado &&
        ehParcelaMensal(item) &&
        mesOriginal > mesContemplacao &&
        mesesSemReceber < 3
      ) {
        mesesSemReceber++;

        if (parcelasAdiantadas < 2) {
          parcelasAdiantadas++;

          recebimentos.push({
            origem: "Adiantamento",
            cliente: cadastro.cliente,
            cota: cadastro.numeroCota,
            vendedor: cadastro.vendedor,
            plano: cadastro.plano,
            data: dataContemplacao,
            mesAno: mesContemplacao,
            descricao: `Adiantamento ${parcelasAdiantadas}/2 - ${item.descricao}`,
            valor: Number(item.valor) || 0
          });
        }

        return;
      }

      recebimentos.push({
        origem: "Comissão",
        cliente: cadastro.cliente,
        cota: cadastro.numeroCota,
        vendedor: cadastro.vendedor,
        plano: cadastro.plano,
        data: dataOriginal,
        mesAno: mesOriginal,
        descricao: item.descricao,
        valor: Number(item.valor) || 0
      });
    });
  });

  return recebimentos;
}

function gerarConsultoriasParceladas() {
  const recebimentos = [];

  consultoriasParceladasES.forEach(consultoria => {
    if (consultoria.status === "inativo") return;

    for (let i = 0; i < Number(consultoria.quantidadeParcelas || 0); i++) {
      const dataParcela = adicionarMesesTexto(consultoria.dataPrimeiraParcela, i);

      recebimentos.push({
        origem: "Consultoria parcelada",
        cliente: consultoria.cliente,
        cota: "-",
        vendedor: "-",
        plano: "-",
        data: dataParcela,
        mesAno: chaveMesAno(dataParcela),
        descricao: `${consultoria.descricao} - Parcela ${i + 1}/${consultoria.quantidadeParcelas}`,
        valor: Number(consultoria.valorParcela) || 0
      });
    }
  });

  return recebimentos;
}

function gerarLancamentosFinanceiros() {
  const lancamentos = [];

  lancamentosES.forEach(item => {
    if (!item.data) return;

    const data = new Date(item.data + "T00:00:00");
    const mesAno = chaveMesAno(data);
    const valor = Number(item.valor) || 0;
    const tipo = item.tipo || "";
    const categoria = String(item.categoria || "").toLowerCase().trim();

    const descricao =
      item.descricao ||
      item.nome ||
      item.categoria ||
      "Lançamento financeiro";

    // REGRA IMPORTANTE:
    // Comissão de ENTRADA não soma no dashboard,
    // porque ela já está prevista pelo cadastro das cotas.
    if (tipo === "entrada" && categoria === "comissão") {
      return;
    }

    if (tipo === "entrada") {
      lancamentos.push({
        origem: "Entrada extra",
        tipo: "entrada",
        data,
        mesAno,
        descricao,
        valor
      });

      return;
    }

    // Comissão de SAÍDA continua entrando como custo normalmente,
    // por exemplo comissão paga para funcionário.
    lancamentos.push({
      origem: "Saída",
      tipo: "saida",
      data,
      mesAno,
      descricao,
      valor
    });
  });

  return lancamentos;
}

function agruparClientes(detalhes) {
  const agrupado = {};

  detalhes.forEach(item => {
    const chave = item.cliente || "Sem cliente";

    if (!agrupado[chave]) {
      agrupado[chave] = {
        cliente: chave,
        cotas: new Set(),
        total: 0
      };
    }

    if (item.cota && item.cota !== "-") {
      agrupado[chave].cotas.add(item.cota);
    }

    agrupado[chave].total += Number(item.valor) || 0;
  });

  return Object.values(agrupado).map(item => ({
    cliente: item.cliente,
    quantidadeCotas: item.cotas.size,
    total: item.total
  }));
}

function calcularDashboard() {
  const hoje = new Date();
  const mesAtual = chaveMesAno(hoje);

  const mesBase = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const recebimentos = [
    ...gerarRecebimentosConsorcio(),
    ...gerarConsultoriasParceladas()
  ];

  const lancamentosFinanceiros = gerarLancamentosFinanceiros();
  const agrupadoPorMes = {};

  for (let i = -3; i <= 8; i++) {
    const data = adicionarMeses(mesBase, i);
    const chave = chaveMesAno(data);

    agrupadoPorMes[chave] = {
      comissao: 0,
      entradaExtra: 0,
      custo: 0,
      faturamentoTotal: 0,
      resultadoPrevisto: 0,
      detalhesReceitas: [],
      detalhesCustos: []
    };
  }

  let totalRecebidoAnterior = 0;
  let totalFaturamentoMesAtual = 0;
  let totalProximos = 0;
  let totalCustosPrevistos = 0;

  recebimentos.forEach(item => {
    if (item.mesAno < mesAtual) totalRecebidoAnterior += item.valor;
    if (item.mesAno === mesAtual) totalFaturamentoMesAtual += item.valor;
    if (item.mesAno > mesAtual) totalProximos += item.valor;

    if (agrupadoPorMes[item.mesAno]) {
      agrupadoPorMes[item.mesAno].comissao += item.valor;
      agrupadoPorMes[item.mesAno].detalhesReceitas.push(item);
    }
  });

  lancamentosFinanceiros.forEach(item => {
    if (item.tipo === "entrada") {
      if (item.mesAno < mesAtual) totalRecebidoAnterior += item.valor;
      if (item.mesAno === mesAtual) totalFaturamentoMesAtual += item.valor;
      if (item.mesAno > mesAtual) totalProximos += item.valor;

      if (agrupadoPorMes[item.mesAno]) {
        agrupadoPorMes[item.mesAno].entradaExtra += item.valor;
        agrupadoPorMes[item.mesAno].detalhesReceitas.push(item);
      }

      return;
    }

    if (item.mesAno >= mesAtual) {
      totalCustosPrevistos += item.valor;
    }

    if (agrupadoPorMes[item.mesAno]) {
      agrupadoPorMes[item.mesAno].custo += item.valor;
      agrupadoPorMes[item.mesAno].detalhesCustos.push(item);
    }
  });

  Object.keys(agrupadoPorMes).forEach(mes => {
    agrupadoPorMes[mes].faturamentoTotal =
      agrupadoPorMes[mes].comissao + agrupadoPorMes[mes].entradaExtra;

    agrupadoPorMes[mes].resultadoPrevisto =
      agrupadoPorMes[mes].faturamentoTotal - agrupadoPorMes[mes].custo;
  });

  recebidoAnterior.textContent = formatarMoeda(totalRecebidoAnterior);
  faturamentoMesAtual.textContent = formatarMoeda(totalFaturamentoMesAtual);
  receberProximos.textContent = formatarMoeda(totalProximos);

  if (custosPrevistos) {
    custosPrevistos.textContent = formatarMoeda(totalCustosPrevistos);
  }

  renderizarTabelaMensal(agrupadoPorMes, mesAtual);
}

function renderizarResumoClientes(detalhes) {
  const clientes = agruparClientes(detalhes.filter(item => item.cliente));

  if (clientes.length === 0) {
    return `<div class="detalhe-vazio">Nenhuma receita de cliente neste mês.</div>`;
  }

  return `
    <div class="resumo-clientes">
      ${clientes.map(item => `
        <div class="resumo-cliente-card">
          <strong>${item.cliente}</strong>
          <span>${item.quantidadeCotas} cota(s)</span>
          <b>${formatarMoeda(item.total)}</b>
        </div>
      `).join("")}
    </div>
  `;
}

function renderizarDetalhesReceitas(detalhes) {
  if (detalhes.length === 0) {
    return `<div class="detalhe-vazio">Nenhuma receita prevista para este mês.</div>`;
  }

  return `
    <table class="tabela-detalhes">
      <thead>
        <tr>
          <th>Origem</th>
          <th>Cliente</th>
          <th>Cota</th>
          <th>Vendedor</th>
          <th>Descrição</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        ${detalhes.map(item => `
          <tr>
            <td>${item.origem || "-"}</td>
            <td>${item.cliente || "-"}</td>
            <td>${item.cota || "-"}</td>
            <td>${item.vendedor || "-"}</td>
            <td>${item.descricao || "-"}</td>
            <td class="texto-positivo">${formatarMoeda(item.valor)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderizarDetalhesCustos(detalhes) {
  if (detalhes.length === 0) {
    return `<div class="detalhe-vazio">Nenhum custo previsto para este mês.</div>`;
  }

  return `
    <table class="tabela-detalhes">
      <thead>
        <tr>
          <th>Origem</th>
          <th>Descrição</th>
          <th>Valor</th>
        </tr>
      </thead>
      <tbody>
        ${detalhes.map(item => `
          <tr>
            <td>${item.origem || "-"}</td>
            <td>${item.descricao || "-"}</td>
            <td class="texto-negativo">${formatarMoeda(item.valor)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function alternarDetalhesMes(mes) {
  const linha = document.getElementById(`detalhes-${mes}`);
  const botao = document.getElementById(`btn-detalhes-${mes}`);

  if (!linha || !botao) return;

  const aberta = linha.classList.contains("ativo");

  linha.classList.toggle("ativo");
  botao.textContent = aberta ? "Ver detalhes" : "Ocultar";
}

function renderizarTabelaMensal(agrupadoPorMes, mesAtual) {
  const meses = Object.keys(agrupadoPorMes).sort();

  const linhas = meses.map(mes => {
    let status = "Futuro";
    let classeLinha = "futuro";

    if (mes < mesAtual) {
      status = "Anterior";
      classeLinha = "passado";
    }

    if (mes === mesAtual) {
      status = "Mês atual";
      classeLinha = "mes-atual";
    }

    const dados = agrupadoPorMes[mes];

    const classeResultado =
      dados.resultadoPrevisto >= 0 ? "texto-positivo" : "texto-negativo";

    return `
      <tr class="${classeLinha}">
        <td>${nomeMesAno(mes)}</td>
        <td>${status}</td>
        <td class="texto-positivo">${formatarMoeda(dados.comissao)}</td>
        <td class="texto-positivo">${formatarMoeda(dados.entradaExtra)}</td>
        <td class="texto-negativo">${formatarMoeda(dados.custo)}</td>
        <td class="texto-positivo"><strong>${formatarMoeda(dados.faturamentoTotal)}</strong></td>
        <td class="${classeResultado}"><strong>${formatarMoeda(dados.resultadoPrevisto)}</strong></td>
        <td>
          <button
            class="btn-detalhes"
            id="btn-detalhes-${mes}"
            onclick="alternarDetalhesMes('${mes}')"
          >
            Ver detalhes
          </button>
        </td>
      </tr>

      <tr class="linha-detalhes" id="detalhes-${mes}">
        <td colspan="8">
          <div class="painel-detalhes">
            <h3>Detalhamento de ${nomeMesAno(mes)}</h3>

            <h4>Resumo por cliente</h4>
            ${renderizarResumoClientes(dados.detalhesReceitas)}

            <h4>Receitas do mês</h4>
            ${renderizarDetalhesReceitas(dados.detalhesReceitas)}

            <h4>Custos do mês</h4>
            ${renderizarDetalhesCustos(dados.detalhesCustos)}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tabelaMensal.innerHTML = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Mês</th>
          <th>Status</th>
          <th>Comissões / Consultorias</th>
          <th>Entradas Extras</th>
          <th>Custos</th>
          <th>Faturamento</th>
          <th>Resultado</th>
          <th>Detalhes</th>
        </tr>
      </thead>
      <tbody>
        ${linhas}
      </tbody>
    </table>
  `;
}

window.alternarDetalhesMes = alternarDetalhesMes;

carregarDadosFirebase();


