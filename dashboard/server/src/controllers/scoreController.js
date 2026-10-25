import { getDB } from '../config/db.js';
import cache from '../utils/cache.js';
import { toCSV } from '../utils/csv.js';
import { buildMatchCubo, parsePagination } from '../services/filtros.js';

export async function getScoreKpis(req, res) {
  const cacheKey = cache.generateKey('score:kpis', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);

    const agg = await db.collection('cubo').aggregate([
      { $match: matchCubo },
      {
        $group: {
          _id: null,
          total_itens: { $sum: '$n' },
          total_com_score: { $sum: '$n_score' },
          aud_alto: { $sum: '$aud_alto' },
          aud_medio_alto: { $sum: '$aud_medio_alto' },
          aud_medio: { $sum: '$aud_medio' },
          aud_baixo: { $sum: '$aud_baixo' },
          sum_score_aud: { $sum: '$sum_score_aud' },
          valor_estoque_aud_alto: { $sum: '$valor_estoque_aud_alto' },
          n_com_acao: { $sum: '$n_com_acao' },
        },
      },
    ]).toArray();

    const row = agg[0] || {};
    const totalComScore = row.total_com_score || 0;
    const alto = row.aud_alto || 0;
    const medioAlto = row.aud_medio_alto || 0;
    const medio = row.aud_medio || 0;
    const baixo = row.aud_baixo || 0;
    const scoreMedio = totalComScore > 0 ? Math.round((row.sum_score_aud / totalComScore) * 1000) / 1000 : 0;
    const valorEstoqueAlto = Math.round((row.valor_estoque_aud_alto || 0) * 100) / 100;
    const nComAcao = row.n_com_acao || 0;
    const percAltoMedioAlto = totalComScore > 0 ? Math.round(((alto + medioAlto) / totalComScore) * 10000) / 100 : 0;
    const percComAcao = totalComScore > 0 ? Math.round((nComAcao / totalComScore) * 10000) / 100 : 0;

    const result = {
      total_itens: row.total_itens || 0,
      total_com_score: totalComScore,
      aud_alto: alto,
      aud_medio_alto: medioAlto,
      aud_medio: medio,
      aud_baixo: baixo,
      score_medio: scoreMedio,
      valor_estoque_aud_alto: valorEstoqueAlto,
      n_com_acao: nComAcao,
      perc_alto_medio_alto: percAltoMedioAlto,
      perc_com_acao: percComAcao,
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getScoreKpis:', error);
    res.status(500).json({ erro: 'Erro ao calcular KPIs do Score de Auditoria', detalhe: error.message });
  }
}

export async function getDistribuicaoScore(req, res) {
  const cacheKey = cache.generateKey('score:distribuicao', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);

    const agg = await db.collection('cubo').aggregate([
      { $match: matchCubo },
      {
        $group: {
          _id: null,
          total: { $sum: '$n_score' },
          alto: { $sum: '$aud_alto' },
          medio_alto: { $sum: '$aud_medio_alto' },
          medio: { $sum: '$aud_medio' },
          baixo: { $sum: '$aud_baixo' },
        },
      },
    ]).toArray();

    const row = agg[0] || {};
    const total = row.total || 0;

    const items = [
      {
        id: 'Alto Risco',
        label: 'Alto Risco',
        value: row.alto || 0,
        color: '#EF4444',
        perc: total > 0 ? Math.round(((row.alto || 0) / total) * 10000) / 100 : 0,
      },
      {
        id: 'Médio-Alto Risco',
        label: 'Médio-Alto Risco',
        value: row.medio_alto || 0,
        color: '#F97316',
        perc: total > 0 ? Math.round(((row.medio_alto || 0) / total) * 10000) / 100 : 0,
      },
      {
        id: 'Médio Risco',
        label: 'Médio Risco',
        value: row.medio || 0,
        color: '#EAB308',
        perc: total > 0 ? Math.round(((row.medio || 0) / total) * 10000) / 100 : 0,
      },
      {
        id: 'Baixo Risco',
        label: 'Baixo Risco',
        value: row.baixo || 0,
        color: '#10B981',
        perc: total > 0 ? Math.round(((row.baixo || 0) / total) * 10000) / 100 : 0,
      },
    ];

    cache.set(cacheKey, items, 300);
    res.json(items);
  } catch (error) {
    console.error('Erro em getDistribuicaoScore:', error);
    res.status(500).json({ erro: 'Erro ao buscar distribuição de score', detalhe: error.message });
  }
}

export async function getAcoesRecomendadas(req, res) {
  const cacheKey = cache.generateKey('score:acoes', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);

    const agg = await db.collection('cubo_acoes').aggregate([
      { $match: matchCubo },
      {
        $group: {
          _id: '$Acao_Recomendada',
          qtd: { $sum: '$n' },
        },
      },
      { $sort: { qtd: -1 } },
    ]).toArray();

    const result = agg
      .filter((a) => a._id && a._id !== '' && a._id !== 'Nenhuma')
      .map((a) => ({
        acao: a._id,
        qtd: a.qtd,
      }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getAcoesRecomendadas:', error);
    res.status(500).json({ erro: 'Erro ao buscar ações recomendadas', detalhe: error.message });
  }
}

export async function getHeatmap(req, res) {
  const cacheKey = cache.generateKey('score:heatmap', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);

    const agg = await db.collection('cubo').aggregate([
      { $match: matchCubo },
      {
        $group: {
          _id: { categoria: '$Categoria', supervisor: '$Supervisor' },
          sum_score: { $sum: '$sum_score_aud' },
          n_score: { $sum: '$n_score' },
        },
      },
    ]).toArray();

    const supervisoresSet = new Set();
    const catMap = new Map();

    agg.forEach((item) => {
      const cat = item._id.categoria || 'OUTROS';
      const supervisor = item._id.supervisor || 'OUTROS';
      if (supervisor) supervisoresSet.add(supervisor);
      const score = item.n_score > 0 ? Math.round((item.sum_score / item.n_score) * 1000) / 1000 : 0;

      if (!catMap.has(cat)) {
        catMap.set(cat, {});
      }
      catMap.get(cat)[supervisor] = score;
    });

    const supervisores = Array.from(supervisoresSet).sort();

    // Formato Nivo Heatmap: [{ id: 'MEDICAMENTOS', data: [{ x: 'Marcelo Barbosa - Nordeste', y: 0.18 }, ...] }]
    const result = Array.from(catMap.entries()).map(([categoria, supScores]) => ({
      id: categoria,
      data: supervisores.map((s) => ({
        x: s.includes(' - ') ? s.split(' - ')[0] : s,
        y: supScores[s] !== undefined ? supScores[s] : 0,
      })),
    }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getHeatmap:', error);
    res.status(500).json({ erro: 'Erro ao gerar heatmap', detalhe: error.message });
  }
}

export async function getTabelaScore(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCubo(req.query);

    if (req.query.classificacao) {
      match.Classificacao_Risco_Auditoria = req.query.classificacao;
    }

    if (req.query.grupo) {
      match.Grupo = req.query.grupo;
    }

    if (req.query.acao) {
      match.Acao_Recomendada = req.query.acao;
    }

    if (req.query.q) {
      const q = req.query.q.trim();
      if (!isNaN(Number(q))) {
        match.Codigo_Produto = Number(q);
      } else {
        match.$text = { $search: q };
      }
    }

    const sortFieldMap = {
      codigo: 'Codigo_Produto',
      nome: 'Nome_Produto',
      filial: 'Filial',
      nome_filial: 'Nome_Filial',
      grupo: 'Grupo',
      categoria: 'Categoria',
      comprador: 'Comprador',
      score: 'Score_Auditoria',
      classificacao: 'Classificacao_Risco_Auditoria',
      acao: 'Acao_Recomendada',
      valor_estoque: 'Valor_Estoque_Custo',
      estoque: 'Estoque_Atual',
      dias_cobertura: 'Dias_Cobertura',
    };

    const { page, pageSize, skip, sort } = parsePagination(req.query, 'Score_Auditoria', -1, sortFieldMap);

    const [total, docs] = await Promise.all([
      db.collection('indicadores').countDocuments(match),
      db.collection('indicadores')
        .find(match, {
          projection: {
            _id: 1,
            Filial: 1,
            Nome_Filial: 1,
            Codigo_Produto: 1,
            Nome_Produto: 1,
            Principio_Ativo: 1,
            Grupo: 1,
            Categoria: 1,
            Comprador: 1,
            Score_Auditoria: 1,
            Classificacao_Risco_Auditoria: 1,
            Acao_Recomendada: 1,
            Valor_Estoque_Custo: 1,
            Estoque_Atual: 1,
            Dias_Cobertura: 1,
            Prazo_Validade_Meses: 1,
          },
        })
        .sort(sort)
        .skip(skip)
        .limit(pageSize)
        .toArray(),
    ]);

    res.json({
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      dados: docs.map((d) => ({
        id: d._id,
        filial: d.Filial,
        nome_filial: d.Nome_Filial,
        codigo: d.Codigo_Produto,
        nome: d.Nome_Produto,
        principio_ativo: d.Principio_Ativo,
        grupo: d.Grupo,
        categoria: d.Categoria,
        comprador: d.Comprador,
        score: d.Score_Auditoria,
        classificacao: d.Classificacao_Risco_Auditoria,
        acao: d.Acao_Recomendada,
        valor_estoque: Math.round((d.Valor_Estoque_Custo || 0) * 100) / 100,
        estoque: d.Estoque_Atual,
        dias_cobertura: d.Dias_Cobertura,
        prazo_validade_meses: d.Prazo_Validade_Meses,
      })),
    });
  } catch (error) {
    console.error('Erro em getTabelaScore:', error);
    res.status(500).json({ erro: 'Erro ao buscar tabela do Score', detalhe: error.message });
  }
}

export async function exportScoreCSV(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCubo(req.query);

    if (req.query.classificacao) match.Classificacao_Risco_Auditoria = req.query.classificacao;
    if (req.query.grupo) match.Grupo = req.query.grupo;
    if (req.query.acao) match.Acao_Recomendada = req.query.acao;
    if (req.query.q) {
      const q = req.query.q.trim();
      if (!isNaN(Number(q))) {
        match.Codigo_Produto = Number(q);
      } else {
        match.$text = { $search: q };
      }
    }

    const docs = await db.collection('indicadores')
      .find(match, {
        projection: {
          _id: 0,
          Filial: 1,
          Nome_Filial: 1,
          Codigo_Produto: 1,
          Nome_Produto: 1,
          Principio_Ativo: 1,
          Grupo: 1,
          Categoria: 1,
          Comprador: 1,
          Score_Auditoria: 1,
          Classificacao_Risco_Auditoria: 1,
          Acao_Recomendada: 1,
          Valor_Estoque_Custo: 1,
          Estoque_Atual: 1,
          Dias_Cobertura: 1,
          Prazo_Validade_Meses: 1,
        },
      })
      .sort({ Score_Auditoria: -1 })
      .limit(50000)
      .toArray();

    const csvData = toCSV(docs);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="score_auditoria.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('Erro em exportScoreCSV:', error);
    res.status(500).json({ erro: 'Erro ao exportar CSV do Score', detalhe: error.message });
  }
}

export async function getProdutoDetalhe(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const filial = parseInt(req.params.filial, 10);
    const codigo = parseInt(req.params.codigo, 10);

    if (isNaN(filial) || isNaN(codigo)) {
      return res.status(400).json({ erro: 'Filial e Código devem ser números inteiros' });
    }

    const [produto, lotes] = await Promise.all([
      db.collection('indicadores').findOne({ Filial: filial, Codigo_Produto: codigo }),
      db.collection('avencer').find({ Filial: filial, Codigo_Produto: codigo }).toArray(),
    ]);

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado para a filial especificada' });
    }

    // Mapeamento dos 10 fatores de contribuição do Score de Auditoria
    const fatores = [
      {
        chave: 'Contrib_meses_desde_ultima_venda',
        nome: 'Meses Sem Venda (Recência)',
        peso: 0.22,
        valor_bruto: produto.Ultima_Venda ? `${produto.Ultima_Venda}` : 'Nunca vendeu',
        contrib: produto.Contrib_meses_desde_ultima_venda || 0,
      },
      {
        chave: 'Contrib_estoque_sobre_demanda_log',
        nome: 'Dias de Cobertura (Giro)',
        peso: 0.15,
        valor_bruto: produto.Dias_Cobertura !== undefined && produto.Dias_Cobertura !== null ? `${produto.Dias_Cobertura} dias` : '0 dias',
        contrib: produto.Contrib_estoque_sobre_demanda_log || 0,
      },
      {
        chave: 'Contrib_proporcao_a_vencer',
        nome: 'Prazo de Validade / A Vencer',
        peso: 0.13,
        valor_bruto: produto.Qtd_A_Vencer ? `${produto.Qtd_A_Vencer} un a vencer` : (produto.Prazo_Validade_Meses ? `${produto.Prazo_Validade_Meses} meses` : '0 un a vencer'),
        contrib: produto.Contrib_proporcao_a_vencer || 0,
      },
      {
        chave: 'Contrib_proporcao_perda',
        nome: 'Histórico de Perdas',
        peso: 0.13,
        valor_bruto: produto.Qtd_Perdida_Ano !== undefined && produto.Qtd_Perdida_Ano !== null ? `${produto.Qtd_Perdida_Ano} un perdidas` : '0 un',
        contrib: produto.Contrib_proporcao_perda || 0,
      },
      {
        chave: 'Contrib_custo_total_estoque',
        nome: 'Custo Total em Estoque',
        peso: 0.13,
        valor_bruto: produto.Valor_Estoque_Custo !== undefined && produto.Valor_Estoque_Custo !== null ? `R$ ${produto.Valor_Estoque_Custo.toFixed(2)}` : 'R$ 0,00',
        contrib: produto.Contrib_custo_total_estoque || 0,
      },
      {
        chave: 'Contrib_TENDENCIA_NUM',
        nome: 'Tendência de Perda (Slope)',
        peso: 0.08,
        valor_bruto: produto.Tendencia_Perda !== undefined && produto.Tendencia_Perda !== null ? String(produto.Tendencia_Perda) : '0',
        contrib: produto.Contrib_TENDENCIA_NUM || 0,
      },
      {
        chave: 'Contrib_venda_max_log',
        nome: 'Concentração na Maior Loja',
        peso: 0.065,
        valor_bruto: produto.Filial_Maior_Venda ? `Loja #${produto.Filial_Maior_Venda} (${produto.Qtd_Vendida_Maior_Filial || 0} un)` : 'N/A',
        contrib: produto.Contrib_venda_max_log || 0,
      },
      {
        chave: 'Contrib_demanda_rede_log',
        nome: 'Demanda na Rede',
        peso: 0.065,
        valor_bruto: produto.Demanda_Rede !== undefined && produto.Demanda_Rede !== null ? `${produto.Demanda_Rede} un` : '0 un',
        contrib: produto.Contrib_demanda_rede_log || 0,
      },
      {
        chave: 'Contrib_dias_desde_ultima_entrada',
        nome: 'Tempo Desde Última Entrada',
        peso: 0.03,
        valor_bruto: produto.Ultima_Entrada ? String(produto.Ultima_Entrada) : 'N/A',
        contrib: produto.Contrib_dias_desde_ultima_entrada || 0,
      },
      {
        chave: 'Contrib_Categoria',
        nome: 'Bônus de Risco da Categoria',
        peso: 0.10,
        valor_bruto: produto.Categoria || 'N/A',
        contrib: produto.Contrib_Categoria || 0,
      },
    ];

    // Ordena por maior contribuição para responder: "Por que este score?"
    fatores.sort((a, b) => b.contrib - a.contrib);

    const explicacao = fatores.map((f) => ({
      ...f,
      contrib: Math.round(f.contrib * 1000) / 1000,
      relevante: f.contrib > 0.02,
    }));

    res.json({
      produto,
      explicacao,
      lotes: lotes.map((l) => ({
        id: l.ZJ1_ID,
        lote: l.ZJ1_Lote,
        vencimento: l.Vencimento,
        estoque: l.Estoque,
        custo_unitario: l.Custo_Unitario,
        total_av: l.Total_AV,
        preco_venda: l.Preco_Venda,
        resolvido: l.Resolvido,
      })),
    });
  } catch (error) {
    console.error('Erro em getProdutoDetalhe:', error);
    res.status(500).json({ erro: 'Erro ao buscar detalhes do produto', detalhe: error.message });
  }
}

export default {
  getScoreKpis,
  getDistribuicaoScore,
  getAcoesRecomendadas,
  getHeatmap,
  getTabelaScore,
  exportScoreCSV,
  getProdutoDetalhe,
};
