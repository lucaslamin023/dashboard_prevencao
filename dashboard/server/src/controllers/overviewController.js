import { getDB } from '../config/db.js';
import cache from '../utils/cache.js';
import { buildMatchCubo, buildMatchCuboMensal, parsePagination } from '../services/filtros.js';

export async function getOverviewKpis(req, res) {
  const cacheKey = cache.generateKey('overview:kpis', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);
    const matchMensal = buildMatchCuboMensal(req.query);

    const [aggCubo, aggMensal, serieSparkline] = await Promise.all([
      db.collection('cubo').aggregate([
        { $match: matchCubo },
        {
          $group: {
            _id: null,
            total_n: { $sum: '$n' },
            estoque_un: { $sum: '$estoque_un' },
            excesso_un: { $sum: '$excesso_un' },
            rupt_consumada: { $sum: '$rupt_consumada' },
            rupt_critico: { $sum: '$rupt_critico' },
            aud_alto: { $sum: '$aud_alto' },
          },
        },
      ]).toArray(),

      db.collection('cubo_mensal').aggregate([
        { $match: matchMensal },
        {
          $group: {
            _id: null,
            faturamento: { $sum: '$faturamento' },
            faturamento_av: { $sum: '$faturamento_av' },
            total_av: { $sum: '$total_av' },
            perda_vencimento: { $sum: '$perda_vencimento' },
            perdas: { $sum: '$perda_valor' },
          },
        },
      ]).toArray(),

      db.collection('cubo_mensal').aggregate([
        { $match: matchMensal },
        {
          $group: {
            _id: '$Ano_Mes',
            faturamento: { $sum: '$faturamento' },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray(),
    ]);

    const c = aggCubo[0] || {};
    const m = aggMensal[0] || {};

    const faturamento = Math.round((m.faturamento || 0) * 100) / 100;
    const perdas = Math.round((m.perdas || 0) * 100) / 100;
    const faturamentoAv = Math.round((m.faturamento_av || 0) * 100) / 100;
    const totalAv = Math.round(((m.total_av || (faturamentoAv + (m.perda_vencimento || 0)))) * 100) / 100;
    const percVendasAv = totalAv > 0 ? Math.round((faturamentoAv / totalAv) * 10000) / 100 : 0;
    const estoqueUn = c.estoque_un || 0;
    const excessoUn = c.excesso_un || 0;
    const totalN = c.total_n || 0;
    const ruptSevera = (c.rupt_consumada || 0) + (c.rupt_critico || 0);

    const result = {
      faturamento,
      perdas,
      faturamento_av: faturamentoAv,
      total_av: totalAv,
      perc_perda_faturamento: faturamento > 0 ? Math.round((perdas / faturamento) * 10000) / 100 : 0,
      perc_vendas_av: percVendasAv,
      meta_vendas_av: 80.0,
      perc_indice_excesso: estoqueUn > 0 ? Math.round((excessoUn / estoqueUn) * 10000) / 100 : 0,
      perc_ruptura_severa: totalN > 0 ? Math.round((ruptSevera / totalN) * 10000) / 100 : 0,
      qtd_alto_risco_score: c.aud_alto || 0,
      sparkline_faturamento: serieSparkline.map((s) => ({
        ano_mes: s._id,
        faturamento: Math.round(s.faturamento * 100) / 100,
      })),
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getOverviewKpis:', error);
    res.status(500).json({ erro: 'Erro ao calcular KPIs do Overview', detalhe: error.message });
  }
}

export async function getSerieMensal(req, res) {
  const cacheKey = cache.generateKey('overview:serie-mensal', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchMensal = buildMatchCuboMensal(req.query);

    const docs = await db.collection('cubo_mensal').aggregate([
      { $match: matchMensal },
      {
        $group: {
          _id: '$Ano_Mes',
          faturamento: { $sum: '$faturamento' },
          perdas: { $sum: '$perda_valor' },
          faturamento_av: { $sum: '$faturamento_av' },
          perda_vencimento: { $sum: '$perda_vencimento' },
          qtd_vendida: { $sum: '$qtd_vendida' },
          perda_qtd: { $sum: '$perda_qtd' },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    const result = docs.map((d) => ({
      ano_mes: d._id,
      faturamento: Math.round(d.faturamento * 100) / 100,
      perdas: Math.round(d.perdas * 100) / 100,
      faturamento_av: Math.round(d.faturamento_av * 100) / 100,
      perda_vencimento: Math.round(d.perda_vencimento * 100) / 100,
      qtd_vendida: d.qtd_vendida,
      perda_qtd: d.perda_qtd,
    }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getSerieMensal:', error);
    res.status(500).json({ erro: 'Erro ao buscar série mensal', detalhe: error.message });
  }
}

export async function getMixAv(req, res) {
  const cacheKey = cache.generateKey('overview:mix-av', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchMensal = buildMatchCuboMensal(req.query);

    const agg = await db.collection('cubo_mensal').aggregate([
      { $match: matchMensal },
      {
        $group: {
          _id: null,
          total_fat: { $sum: '$faturamento' },
          fat_av: { $sum: '$faturamento_av' },
        },
      },
    ]).toArray();

    const row = agg[0] || {};
    const total = Math.round((row.total_fat || 0) * 100) / 100;
    const av = Math.round((row.fat_av || 0) * 100) / 100;
    const normal = Math.max(0, Math.round((total - av) * 100) / 100);

    const result = {
      normal,
      av,
      total,
      perc_normal: total > 0 ? Math.round((normal / total) * 10000) / 100 : 0,
      perc_av: total > 0 ? Math.round((av / total) * 10000) / 100 : 0,
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getMixAv:', error);
    res.status(500).json({ erro: 'Erro ao buscar mix AV', detalhe: error.message });
  }
}

export async function getFiliais(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const matchCubo = buildMatchCubo(req.query);
    const matchMensal = buildMatchCuboMensal(req.query);

    // Agrega dados de estoque e cobertura do cubo por filial
    const [filiaisCubo, filiaisMensal] = await Promise.all([
      db.collection('cubo').aggregate([
        { $match: matchCubo },
        {
          $group: {
            _id: '$Filial',
            nome_filial: { $first: '$Nome_Filial' },
            regiao: { $first: '$Regiao' },
            estado: { $first: '$Estado' },
            estoque_un: { $sum: '$estoque_un' },
            excesso_un: { $sum: '$excesso_un' },
            sum_dias_cobertura: { $sum: '$sum_dias_cobertura' },
            n: { $sum: '$n' },
          },
        },
      ]).toArray(),

      db.collection('cubo_mensal').aggregate([
        { $match: matchMensal },
        {
          $group: {
            _id: '$Filial',
            faturamento: { $sum: '$faturamento' },
            perdas: { $sum: '$perda_valor' },
          },
        },
      ]).toArray(),
    ]);

    const mapaMensal = new Map();
    filiaisMensal.forEach((m) => {
      mapaMensal.set(m._id, m);
    });

    let lista = filiaisCubo.map((fc) => {
      const fm = mapaMensal.get(fc._id) || { faturamento: 0, perdas: 0 };
      const faturamento = Math.round(fm.faturamento * 100) / 100;
      const perdas = Math.round(fm.perdas * 100) / 100;
      const estoqueUn = fc.estoque_un || 0;
      const excessoUn = fc.excesso_un || 0;
      const n = fc.n || 1;
      const diasMedio = Math.round((fc.sum_dias_cobertura / n) * 10) / 10;

      let statusCobertura = 'Adequada';
      if (diasMedio < 15) statusCobertura = 'Crítica Baixa';
      else if (diasMedio < 30) statusCobertura = 'Baixa';
      else if (diasMedio > 60) statusCobertura = 'Elevada';

      return {
        filial: fc._id,
        nome_filial: fc.nome_filial || `Filial ${fc._id}`,
        regiao: fc.regiao,
        estado: fc.estado,
        faturamento,
        perdas,
        perc_perda: faturamento > 0 ? Math.round((perdas / faturamento) * 10000) / 100 : 0,
        estoque_un: estoqueUn,
        excesso_un: excessoUn,
        perc_excesso: estoqueUn > 0 ? Math.round((excessoUn / estoqueUn) * 10000) / 100 : 0,
        dias_cobertura_medio: diasMedio,
        status_cobertura: statusCobertura,
      };
    });

    // Ordenação e paginação em memória (<= 232 filiais)
    const { page, pageSize, sort } = parsePagination(req.query, 'faturamento', -1);
    const sortField = Object.keys(sort)[0];
    const sortDir = sort[sortField];

    lista.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];
      if (typeof va === 'string') return sortDir * va.localeCompare(vb);
      return sortDir * ((va || 0) - (vb || 0));
    });

    const total = lista.length;
    const paginada = lista.slice(page * pageSize, (page + 1) * pageSize);

    res.json({
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      dados: paginada,
    });
  } catch (error) {
    console.error('Erro em getFiliais:', error);
    res.status(500).json({ erro: 'Erro ao buscar dados das filiais', detalhe: error.message });
  }
}

export default {
  getOverviewKpis,
  getSerieMensal,
  getMixAv,
  getFiliais,
};
