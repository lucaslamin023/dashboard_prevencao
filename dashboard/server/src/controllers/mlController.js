import { getDB } from '../config/db.js';
import cache from '../utils/cache.js';
import { buildMatchCubo, parsePagination } from '../services/filtros.js';

export async function getMlKpis(req, res) {
  const cacheKey = cache.generateKey('ml:kpis', req.query);
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
          total_produtos: { $sum: '$n' },
          ml_critico: { $sum: '$ml_critico' },
          ml_alto: { $sum: '$ml_alto' },
          ml_medio: { $sum: '$ml_medio' },
          ml_baixo: { $sum: '$ml_baixo' },
          valor_av_ml_critico: { $sum: '$valor_av_ml_critico' },
          sum_score_ml: { $sum: '$sum_score_ml' },
        },
      },
    ]).toArray();

    const row = agg[0] || {};
    const total = row.total_produtos || 0;
    const critico = row.ml_critico || 0;
    const alto = row.ml_alto || 0;
    const medio = row.ml_medio || 0;
    const baixo = row.ml_baixo || 0;
    const valorAvCritico = Math.round((row.valor_av_ml_critico || 0) * 100) / 100;
    const scoreMedio = total > 0 ? Math.round((row.sum_score_ml / total) * 1000) / 1000 : 0;
    const percCriticoAlto = total > 0 ? Math.round(((critico + alto) / total) * 10000) / 100 : 0;

    const result = {
      total_produtos: total,
      ml_critico: critico,
      ml_alto: alto,
      ml_medio: medio,
      ml_baixo: baixo,
      valor_av_ml_critico: valorAvCritico,
      score_ml_medio: scoreMedio,
      perc_critico_alto: percCriticoAlto,
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getMlKpis:', error);
    res.status(500).json({ erro: 'Erro ao calcular KPIs de Risco ML', detalhe: error.message });
  }
}

export async function getTopProdutos(req, res) {
  const cacheKey = cache.generateKey('ml:top-produtos', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCubo(req.query);

    const docs = await db.collection('indicadores')
      .find(match, {
        projection: {
          _id: 1,
          Filial: 1,
          Nome_Filial: 1,
          Codigo_Produto: 1,
          Nome_Produto: 1,
          Categoria: 1,
          Comprador: 1,
          Score_Risco_Perda_ML: 1,
          Categoria_Risco_Perda: 1,
          Valor_AV: 1,
          Qtd_AV: 1,
          Demanda_Ponderada: 1,
          Estoque_Atual: 1,
        },
      })
      .sort({ Score_Risco_Perda_ML: -1, Valor_AV: -1 })
      .limit(10)
      .toArray();

    const result = docs.map((d) => ({
      id: d._id,
      filial: d.Filial,
      nome_filial: d.Nome_Filial,
      codigo: d.Codigo_Produto,
      nome: d.Nome_Produto,
      categoria: d.Categoria,
      comprador: d.Comprador,
      score_ml: d.Score_Risco_Perda_ML,
      categoria_risco: d.Categoria_Risco_Perda,
      valor_av: Math.round((d.Valor_AV || 0) * 100) / 100,
      qtd_av: d.Qtd_AV || 0,
      demanda_ponderada: d.Demanda_Ponderada,
      estoque: d.Estoque_Atual,
    }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getTopProdutos:', error);
    res.status(500).json({ erro: 'Erro ao buscar top produtos ML', detalhe: error.message });
  }
}

export async function getScatter(req, res) {
  const cacheKey = cache.generateKey('ml:scatter', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCubo(req.query);

    // Amostra de até 2.000 pontos dos maiores Valor_AV
    const docs = await db.collection('indicadores')
      .find(match, {
        projection: {
          _id: 1,
          Codigo_Produto: 1,
          Nome_Produto: 1,
          Filial: 1,
          Categoria: 1,
          Demanda_Ponderada: 1,
          Valor_AV: 1,
          Score_Risco_Perda_ML: 1,
          Categoria_Risco_Perda: 1,
        },
      })
      .sort({ Valor_AV: -1 })
      .limit(2000)
      .toArray();

    const result = docs.map((d) => ({
      id: d._id,
      codigo: d.Codigo_Produto,
      nome: d.Nome_Produto,
      filial: d.Filial,
      categoria: d.Categoria,
      x: Math.round((d.Demanda_Ponderada || 0) * 10) / 10,
      y: Math.round((d.Valor_AV || 0) * 100) / 100,
      score_ml: d.Score_Risco_Perda_ML,
      categoria_risco: d.Categoria_Risco_Perda,
    }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getScatter:', error);
    res.status(500).json({ erro: 'Erro ao gerar dados do scatter plot ML', detalhe: error.message });
  }
}

export async function getTabelaMl(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCubo(req.query);

    if (req.query.categoria_risco) {
      match.Categoria_Risco_Perda = req.query.categoria_risco;
    }

    if (req.query.q) {
      const q = req.query.q.trim();
      if (!isNaN(Number(q))) {
        match.Codigo_Produto = Number(q);
      } else {
        match.$text = { $search: q };
      }
    }

    const { page, pageSize, skip, sort } = parsePagination(req.query, 'Score_Risco_Perda_ML', -1);

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
            Categoria: 1,
            Comprador: 1,
            Estoque_Atual: 1,
            Demanda_Ponderada: 1,
            Dias_Cobertura: 1,
            Qtd_AV: 1,
            Valor_AV: 1,
            Score_Risco_Perda_ML: 1,
            Categoria_Risco_Perda: 1,
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
        categoria: d.Categoria,
        comprador: d.Comprador,
        estoque: d.Estoque_Atual,
        demanda_ponderada: d.Demanda_Ponderada,
        dias_cobertura: d.Dias_Cobertura,
        qtd_av: d.Qtd_AV,
        valor_av: Math.round((d.Valor_AV || 0) * 100) / 100,
        score_ml: d.Score_Risco_Perda_ML,
        categoria_risco: d.Categoria_Risco_Perda,
      })),
    });
  } catch (error) {
    console.error('Erro em getTabelaMl:', error);
    res.status(500).json({ erro: 'Erro ao buscar tabela ML', detalhe: error.message });
  }
}

export default {
  getMlKpis,
  getTopProdutos,
  getScatter,
  getTabelaMl,
};
