import { getDB } from '../config/db.js';
import cache from '../utils/cache.js';
import { buildMatchCubo, buildMatchCuboMensal, buildMatchInventarios, parsePagination } from '../services/filtros.js';

export async function getInventarioKpis(req, res) {
  const cacheKey = cache.generateKey('inventario:kpis', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchInventarios(req.query);

    const [agg, ultimos, historico] = await Promise.all([
      db.collection('inventarios').aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total_inventarios: { $sum: 1 },
            acuracidade_media: { $avg: '$Acuracidade_Perc' },
            valor_sobra: { $sum: '$Valor_Sobra' },
            valor_falta: { $sum: '$Valor_Falta' },
            diferenca_liquida: { $sum: '$Diferenca_Liquida' },
            dentro_meta: {
              $sum: { $cond: [{ $eq: ['$Status_Acuracidade', 'Dentro da Meta'] }, 1, 0] },
            },
            atencao: {
              $sum: { $cond: [{ $eq: ['$Status_Acuracidade', 'Atenção'] }, 1, 0] },
            },
            urgente: {
              $sum: { $cond: [{ $eq: ['$Status_Acuracidade', 'Urgente'] }, 1, 0] },
            },
          },
        },
      ]).toArray(),

      db.collection('inventarios').aggregate([
        { $match: match },
        { $sort: { Data: -1 } },
        {
          $group: {
            _id: '$Filial',
            status: { $first: '$Status_Acuracidade' },
            acuracidade: { $first: '$Acuracidade_Perc' },
          },
        },
      ]).toArray(),

      db.collection('inventarios').find(
        match,
        { projection: { Filial: 1, Data: 1, Acuracidade_Perc: 1, Status_Acuracidade: 1 }, sort: { Filial: 1, Data: 1 } }
      ).toArray(),
    ]);

    const row = agg[0] || {};
    const total = row.total_inventarios || 0;
    const acuracidade = Math.round((row.acuracidade_media || 0) * 100) / 100;
    const sobra = Math.round((row.valor_sobra || 0) * 100) / 100;
    const falta = Math.round((row.valor_falta || 0) * 100) / 100;
    const liquida = Math.round((row.diferenca_liquida || 0) * 100) / 100;
    const dentro = row.dentro_meta || 0;
    const atencao = row.atencao || 0;
    const urgente = row.urgente || 0;

    // Cálculo do Estado Urgente baseado na matriz do último inventário
    const totalFiliaisUltimo = ultimos.length;
    const filiaisUrgentesUltimo = ultimos.filter((u) => u.status === 'Urgente').length;
    const percUrgenteUltimo = totalFiliaisUltimo > 0 ? Math.round((filiaisUrgentesUltimo / totalFiliaisUltimo) * 10000) / 100 : 0;

    // Cálculo da Taxa de Reincidência (não atingiu a meta de 99.5% 2 vezes seguidas)
    const filialHistMap = new Map();
    historico.forEach((inv) => {
      if (!filialHistMap.has(inv.Filial)) filialHistMap.set(inv.Filial, []);
      filialHistMap.get(inv.Filial).push(inv);
    });

    let filiaisReincidentes = 0;
    filialHistMap.forEach((hist) => {
      let consecutivosFora = 0;
      for (const inv of hist) {
        const ac = inv.Acuracidade_Perc ?? 100;
        if (ac < 99.5) {
          consecutivosFora += 1;
          if (consecutivosFora >= 2) {
            filiaisReincidentes += 1;
            break;
          }
        } else {
          consecutivosFora = 0;
        }
      }
    });

    const taxaReincidencia = filialHistMap.size > 0 ? Math.round((filiaisReincidentes / filialHistMap.size) * 10000) / 100 : 0;

    const result = {
      total_inventarios: total,
      acuracidade_media: acuracidade,
      meta_acuracidade: 99.5,
      limite_urgente: 99.0,
      valor_sobra: sobra,
      valor_falta: falta,
      diferenca_liquida: liquida,
      lojas_dentro_meta: dentro,
      lojas_atencao: atencao,
      lojas_urgente: urgente,
      perc_dentro_meta: total > 0 ? Math.round((dentro / total) * 10000) / 100 : 0,
      perc_urgente: total > 0 ? Math.round((urgente / total) * 10000) / 100 : 0,
      filiais_urgentes_ultimo: filiaisUrgentesUltimo,
      total_filiais_ultimo: totalFiliaisUltimo,
      perc_urgente_ultimo: percUrgenteUltimo,
      filiais_reincidentes: filiaisReincidentes,
      taxa_reincidencia: taxaReincidencia,
    };

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getInventarioKpis:', error);
    res.status(500).json({ erro: 'Erro ao calcular KPIs de Inventário', detalhe: error.message });
  }
}

export async function getEvolucaoAcuracidade(req, res) {
  const cacheKey = cache.generateKey('inventario:evolucao', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchInventarios(req.query);

    const agg = await db.collection('inventarios').aggregate([
      { $match: match },
      {
        $group: {
          _id: '$Ano_Mes',
          acuracidade_media: { $avg: '$Acuracidade_Perc' },
          total_inventarios: { $sum: 1 },
          valor_sobra: { $sum: '$Valor_Sobra' },
          valor_falta: { $sum: '$Valor_Falta' },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray();

    const result = agg.map((r) => ({
      ano_mes: r._id,
      acuracidade: Math.round((r.acuracidade_media || 0) * 100) / 100,
      total_inventarios: r.total_inventarios,
      valor_sobra: Math.round((r.valor_sobra || 0) * 100) / 100,
      valor_falta: Math.round((r.valor_falta || 0) * 100) / 100,
      meta: 99.5,
      limite_urgente: 99.0,
    }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getEvolucaoAcuracidade:', error);
    res.status(500).json({ erro: 'Erro ao buscar evolução de acuracidade', detalhe: error.message });
  }
}

export async function getUltimoInventarioFiliais(req, res) {
  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const match = buildMatchInventarios(req.query);

    if (req.query.status_acuracidade) {
      match.Status_Acuracidade = req.query.status_acuracidade;
    }

    if (req.query.q) {
      const q = req.query.q.trim();
      if (!isNaN(Number(q))) {
        match.Filial = Number(q);
      } else {
        match.$or = [
          { Nome_Filial: new RegExp(q, 'i') },
          { Supervisor: new RegExp(q, 'i') },
          { Estado: new RegExp(q, 'i') },
        ];
      }
    }

    // Agrupa para pegar o inventário mais recente de cada filial
    const pipeline = [
      { $match: match },
      { $sort: { Data: -1 } },
      {
        $group: {
          _id: '$Filial',
          doc: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$doc' } },
    ];

    const sortMap = {
      filial: 'Filial',
      nome_filial: 'Nome_Filial',
      data: 'Data',
      acuracidade_perc: 'Acuracidade_Perc',
      status_acuracidade: 'Status_Acuracidade',
      estoque_anterior: 'Estoque_Anterior_Valor',
      valor_sobra: 'Valor_Sobra',
      valor_falta: 'Valor_Falta',
      diferenca_liquida: 'Diferenca_Liquida',
      perc_diferenca: 'Perc_Diferenca',
    };

    const rawSort = req.query.sort || 'Acuracidade_Perc';
    const sortField = sortMap[rawSort] || rawSort;
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    pipeline.push({ $sort: { [sortField]: sortOrder } });

    const todos = await db.collection('inventarios').aggregate(pipeline).toArray();

    const page = Math.max(0, parseInt(req.query.page, 10) || 0);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
    const paginados = todos.slice(page * pageSize, (page + 1) * pageSize);

    res.json({
      total: todos.length,
      page,
      pageSize,
      totalPages: Math.ceil(todos.length / pageSize),
      dados: paginados.map((d) => ({
        id: d._id,
        filial: d.Filial,
        nome_filial: d.Nome_Filial,
        regiao: d.Regiao,
        estado: d.Estado,
        supervisor: d.Supervisor,
        data: d.Data,
        estoque_anterior: Math.round((d.Estoque_Anterior_Valor || 0) * 100) / 100,
        valor_sobra: Math.round((d.Valor_Sobra || 0) * 100) / 100,
        valor_falta: Math.round((d.Valor_Falta || 0) * 100) / 100,
        diferenca_liquida: Math.round((d.Diferenca_Liquida || 0) * 100) / 100,
        perc_diferenca: d.Perc_Diferenca,
        acuracidade_perc: d.Acuracidade_Perc,
        status_acuracidade: d.Status_Acuracidade,
        metodo: d.Metodo,
      })),
    });
  } catch (error) {
    console.error('Erro em getUltimoInventarioFiliais:', error);
    res.status(500).json({ erro: 'Erro ao buscar últimos inventários por filial', detalhe: error.message });
  }
}

export async function getDivergenciasCategoria(req, res) {
  const cacheKey = cache.generateKey('inventario:divergencias-cat', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const raw = await db.collection('inventario_divergencias_categoria').find({}).toArray();

    const catMap = new Map();
    raw.forEach((item) => {
      const cat = item.Categoria || 'Outros';
      if (!catMap.has(cat)) {
        catMap.set(cat, {
          categoria: cat,
          falta_valor: 0,
          sobra_valor: 0,
          lote_valor: 0,
          cadastro_valor: 0,
          total_divergencia: 0,
        });
      }
      const entry = catMap.get(cat);
      const val = Math.round((item.valor_divergente || 0) * 100) / 100;
      entry.total_divergencia += val;

      const tipo = String(item.Tipo_Divergencia || '').toLowerCase();
      if (tipo.includes('falta')) entry.falta_valor += val;
      else if (tipo.includes('sobra')) entry.sobra_valor += val;
      else if (tipo.includes('lote')) entry.lote_valor += val;
      else if (tipo.includes('cadastro')) entry.cadastro_valor += val;
    });

    const result = Array.from(catMap.values())
      .map((c) => ({
        ...c,
        total_divergencia: Math.round(c.total_divergencia * 100) / 100,
        falta_valor: Math.round(c.falta_valor * 100) / 100,
        sobra_valor: Math.round(c.sobra_valor * 100) / 100,
        lote_valor: Math.round(c.lote_valor * 100) / 100,
        cadastro_valor: Math.round(c.cadastro_valor * 100) / 100,
      }))
      .sort((a, b) => b.total_divergencia - a.total_divergencia);

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getDivergenciasCategoria:', error);
    res.status(500).json({ erro: 'Erro ao buscar divergências por categoria', detalhe: error.message });
  }
}

export async function getTopDivergenciasProdutos(req, res) {
  const cacheKey = cache.generateKey('inventario:top-produtos', req.query);
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const db = getDB();
    if (!db) return res.status(503).json({ erro: 'Banco de dados não conectado' });

    const docs = await db.collection('inventario_top_produtos')
      .find({})
      .sort({ valor_total_divergencia: -1 })
      .limit(15)
      .toArray();

    const result = docs.map((d) => ({
      codigo: d.Codigo_Produto,
      nome: d.Nome_Produto,
      categoria: d.Categoria,
      total_ocorrencias: d.total_ocorrencias,
      qtd_divergencia: d.qtd_total_divergencia,
      valor_divergencia: Math.round(d.valor_total_divergencia * 100) / 100,
    }));

    cache.set(cacheKey, result, 300);
    res.json(result);
  } catch (error) {
    console.error('Erro em getTopDivergenciasProdutos:', error);
    res.status(500).json({ erro: 'Erro ao buscar top produtos divergentes', detalhe: error.message });
  }
}

export default {
  getInventarioKpis,
  getEvolucaoAcuracidade,
  getUltimoInventarioFiliais,
  getDivergenciasCategoria,
  getTopDivergenciasProdutos,
};
