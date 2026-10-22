import { getDB } from '../config/db.js';
import cache from '../utils/cache.js';
import { toCSV } from '../utils/csv.js';
import { buildMatchCubo, parsePagination } from '../services/filtros.js';

export async function getRupturaKpis(req, res) {
  const cacheKey = cache.generateKey('ruptura:kpis', req.query);
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
          sum_dias_cobertura: { $sum: '$sum_dias_cobertura' },
          rupt_consumada: { $sum: '$rupt_consumada' },
          rupt_critico: { $sum: '$rupt_critico' },
          rupt_moderado: { $sum: '$rupt_moderado' },
          rupt_sem_risco: { $sum: '$rupt_sem_risco' },
        },
      },
    ]).toArray();

    const row = agg[0] || {};
    const total = row.total_itens || 0;
    const consumada = row.rupt_consumada || 0;
    const critico = row.rupt_critico || 0;
    const moderado = row.rupt_moderado || 0;
    const semRisco = row.rupt_sem_risco || 0;
    const diasMedio = total > 0 ? Math.round((row.sum_dias_cobertura / total) * 10) / 10 : 0;
    const severa = consumada + critico;
    const percSevera = total > 0 ? Math.round((severa / total) * 10000) / 100 : 0;

    const result = {
      total_itens: total,
      dias_cobertura_medio: diasMedio,
      rupt_consumada: consumada,
      rupt_critico: critico,
      rupt_moderado: moderado,
      rupt_sem_risco: semRisco,
      ruptura_severa: severa,
      perc_ruptura_severa: percSevera,
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getRupturaKpis:', error);
    res.status(500).json({ erro: 'Erro ao calcular KPIs de Ruptura', detalhe: error.message });
  }
}

export async function getDistribuicaoRuptura(req, res) {
  const cacheKey = cache.generateKey('ruptura:distribuicao', req.query);
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
          total: { $sum: '$n' },
          consumada: { $sum: '$rupt_consumada' },
          critico: { $sum: '$rupt_critico' },
          moderado: { $sum: '$rupt_moderado' },
          sem_risco: { $sum: '$rupt_sem_risco' },
        },
      },
    ]).toArray();

    const row = agg[0] || {};
    const total = row.total || 0;

    const items = [
      {
        id: 'Ruptura Consumada',
        label: 'Ruptura Consumada',
        value: row.consumada || 0,
        color: '#E11D48',
        perc: total > 0 ? Math.round(((row.consumada || 0) / total) * 10000) / 100 : 0,
      },
      {
        id: 'Crítico / Alto Risco',
        label: 'Crítico / Alto Risco',
        value: row.critico || 0,
        color: '#F43F5E',
        perc: total > 0 ? Math.round(((row.critico || 0) / total) * 10000) / 100 : 0,
      },
      {
        id: 'Risco Moderado',
        label: 'Risco Moderado',
        value: row.moderado || 0,
        color: '#F59E0B',
        perc: total > 0 ? Math.round(((row.moderado || 0) / total) * 10000) / 100 : 0,
      },
      {
        id: 'Sem Risco',
        label: 'Sem Risco',
        value: row.sem_risco || 0,
        color: '#10B981',
        perc: total > 0 ? Math.round(((row.sem_risco || 0) / total) * 10000) / 100 : 0,
      },
    ];

    cache.set(cacheKey, items, 300);
    res.json(items);
  } catch (error) {
    console.error('Erro em getDistribuicaoRuptura:', error);
    res.status(500).json({ erro: 'Erro ao buscar distribuição de ruptura', detalhe: error.message });
  }
}

export async function getTabelaRuptura(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCubo(req.query);

    // Tabela de ressuprimento: somente Crítico / Ruptura
    match.Status_Ruptura = { $in: ['Ruptura Consumada', 'Crítico / Alto Risco'] };

    if (req.query.q) {
      const q = req.query.q.trim();
      if (!isNaN(Number(q))) {
        match.Codigo_Produto = Number(q);
      } else {
        match.$text = { $search: q };
      }
    }

    const { page, pageSize, skip, sort } = parsePagination(req.query, 'Dias_Cobertura', 1);

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
            Demanda_Atual: 1,
            Demanda_Ponderada: 1,
            Dias_Cobertura: 1,
            Status_Ruptura: 1,
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
        demanda: d.Demanda_Atual,
        demanda_ponderada: d.Demanda_Ponderada,
        dias_cobertura: d.Dias_Cobertura,
        status_ruptura: d.Status_Ruptura,
      })),
    });
  } catch (error) {
    console.error('Erro em getTabelaRuptura:', error);
    res.status(500).json({ erro: 'Erro ao buscar tabela de ruptura', detalhe: error.message });
  }
}

export async function exportRupturaCSV(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchCubo(req.query);
    match.Status_Ruptura = { $in: ['Ruptura Consumada', 'Crítico / Alto Risco'] };

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
          Categoria: 1,
          Comprador: 1,
          Estoque_Atual: 1,
          Demanda_Atual: 1,
          Demanda_Ponderada: 1,
          Dias_Cobertura: 1,
          Status_Ruptura: 1,
        },
      })
      .sort({ Dias_Cobertura: 1 })
      .limit(50000)
      .toArray();

    const csvData = toCSV(docs);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ruptura_ressuprimento.csv"');
    res.send(csvData);
  } catch (error) {
    console.error('Erro em exportRupturaCSV:', error);
    res.status(500).json({ erro: 'Erro ao exportar CSV de ruptura', detalhe: error.message });
  }
}

export default {
  getRupturaKpis,
  getDistribuicaoRuptura,
  getTabelaRuptura,
  exportRupturaCSV,
};
