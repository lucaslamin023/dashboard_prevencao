import { getDB } from '../config/db.js';
import cache from '../utils/cache.js';

export async function getHealth(req, res) {
  // Liveness probe para Render - responde instantaneamente sem consulta ao DB
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
}

export async function getFiltros(req, res) {
  const cacheKey = 'meta:filtros';
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const db = getDB();
    if (!db) {
      return res.status(503).json({ erro: 'Banco de dados não conectado' });
    }

    // 1. Meta
    const metaDoc = await db.collection('meta').findOne({}) || {};

    // 2. dFilial
    const filiaisDocs = await db.collection('dFilial').find({}, {
      projection: { _id: 0, Filial: 1, Nome_Filial: 1, Regiao: 1, Estado: 1 }
    }).sort({ Filial: 1 }).toArray();

    const regioesSet = new Set();
    const estadosPorRegiao = {};

    filiaisDocs.forEach((f) => {
      if (f.Regiao) {
        regioesSet.add(f.Regiao);
        if (!estadosPorRegiao[f.Regiao]) {
          estadosPorRegiao[f.Regiao] = new Set();
        }
        if (f.Estado) estadosPorRegiao[f.Regiao].add(f.Estado);
      }
    });

    const estadosFormatados = {};
    for (const [r, estSet] of Object.entries(estadosPorRegiao)) {
      estadosFormatados[r] = Array.from(estSet).sort();
    }

    // 3. Compradores e Categorias distintos a partir de cubo e meses de cubo_mensal
    const [compradores, categorias, meses] = await Promise.all([
      db.collection('cubo').distinct('Comprador'),
      db.collection('cubo').distinct('Categoria'),
      db.collection('cubo_mensal').distinct('Ano_Mes'),
    ]);

    const result = {
      data_referencia: metaDoc.data_referencia || '2026-09-30',
      pesos: metaDoc.pesos || {},
      peso_categoria: metaDoc.peso_categoria || {},
      versao: metaDoc.versao || '1.0',
      regioes: Array.from(regioesSet).sort(),
      estados_por_regiao: estadosFormatados,
      filiais: filiaisDocs.map((f) => ({
        filial: f.Filial,
        nome: f.Nome_Filial,
        regiao: f.Regiao,
        estado: f.Estado,
      })),
      compradores: compradores.filter(Boolean).sort(),
      categorias: categorias.filter(Boolean).sort(),
      meses_disponiveis: meses.filter(Boolean).sort(),
    };

    cache.set(cacheKey, result, 600); // 10 min TTL
    res.json(result);
  } catch (error) {
    console.error('Erro em getFiltros:', error);
    res.status(500).json({ erro: 'Erro ao buscar metadados de filtros', detalhe: error.message });
  }
}

export default {
  getHealth,
  getFiltros,
};
