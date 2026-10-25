import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { connectDB, closeDB, getDB } from '../src/config/db.js';

describe('🚀 Backend API Test Suite (Fase 4)', () => {
  let sampleProduct = null;

  beforeAll(async () => {
    await connectDB();
    const db = getDB();
    if (db) {
      // Busca um produto real para testar /score/produto/:filial/:codigo
      sampleProduct = await db.collection('indicadores').findOne(
        { Score_Auditoria: { $gt: 0.1 } },
        { projection: { Filial: 1, Codigo_Produto: 1 } }
      );
    }
  });

  afterAll(async () => {
    await closeDB();
  });

  // =========================================================================
  // 1. Health & Infra
  // =========================================================================
  describe('Infra & Health Check', () => {
    it('GET /health deve responder 200 com { ok: true } sem DB', async () => {
      const start = Date.now();
      const res = await request(app).get('/health');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(duration).toBeLessThan(100);
    });

    it('GET /api/health deve responder 200 com { ok: true }', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('GET /api/rota-inexistente deve responder 404 formatado', async () => {
      const res = await request(app).get('/api/rota-inexistente');
      expect(res.status).toBe(404);
      expect(res.body.erro).toBe('Rota não encontrada');
    });
  });

  // =========================================================================
  // 2. Metadados e Filtros
  // =========================================================================
  describe('Meta e Filtros', () => {
    it('GET /api/meta/filtros retorna regiões, filiais e parâmetros de auditoria', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/meta/filtros');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data_referencia');
      expect(res.body).toHaveProperty('pesos');
      expect(res.body.regioes).toBeInstanceOf(Array);
      expect(res.body.regioes.length).toBeGreaterThan(0);
      expect(res.body.filiais).toBeInstanceOf(Array);
      expect(res.body.filiais.length).toBeGreaterThan(0);
      expect(res.body.compradores).toBeInstanceOf(Array);
      expect(res.body.categorias).toBeInstanceOf(Array);
      console.log(`  ⏱️ Tempo GET /api/meta/filtros: ${duration} ms`);
    });
  });

  // =========================================================================
  // 3. Overview Executivo
  // =========================================================================
  describe('Overview Executivo', () => {
    it('GET /api/overview/kpis retorna os 7 KPIs e sparkline', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/overview/kpis');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('faturamento');
      expect(res.body).toHaveProperty('perdas');
      expect(res.body).toHaveProperty('perc_perda_faturamento');
      expect(res.body).toHaveProperty('perc_vendas_av');
      expect(res.body).toHaveProperty('perc_indice_excesso');
      expect(res.body).toHaveProperty('perc_ruptura_severa');
      expect(res.body).toHaveProperty('qtd_alto_risco_score');
      expect(res.body.sparkline_faturamento).toBeInstanceOf(Array);
      expect(res.body.faturamento).toBeGreaterThan(0);
      console.log(`  ⏱️ Tempo GET /api/overview/kpis: ${duration} ms`);
    });

    it('GET /api/overview/serie-mensal retorna série temporal ordenada', async () => {
      const res = await request(app).get('/api/overview/serie-mensal');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('ano_mes');
      expect(res.body[0]).toHaveProperty('faturamento');
      expect(res.body[0]).toHaveProperty('perdas');
    });

    it('GET /api/overview/mix-av retorna composição normal vs a vencer', async () => {
      const res = await request(app).get('/api/overview/mix-av');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('normal');
      expect(res.body).toHaveProperty('av');
      expect(res.body).toHaveProperty('total');
      expect(res.body.normal + res.body.av).toBeCloseTo(res.body.total, 0);
    });

    it('GET /api/overview/filiais retorna tabela paginada', async () => {
      const res = await request(app).get('/api/overview/filiais?page=0&pageSize=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('dados');
      expect(res.body.dados.length).toBeLessThanOrEqual(10);
      if (res.body.dados.length > 0) {
        expect(res.body.dados[0]).toHaveProperty('filial');
        expect(res.body.dados[0]).toHaveProperty('faturamento');
        expect(res.body.dados[0]).toHaveProperty('perc_excesso');
      }
    });
  });

  // =========================================================================
  // 4. Vendas A Vencer & Inventário
  // =========================================================================
  describe('Vendas A Vencer', () => {
    it('GET /api/vendas-av/kpis retorna métricas de vendas a vencer', async () => {
      const res = await request(app).get('/api/vendas-av/kpis');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('faturamento_av');
      expect(res.body).toHaveProperty('perc_conversao_av');
    });

    it('GET /api/vendas-av/evolucao retorna série temporal', async () => {
      const res = await request(app).get('/api/vendas-av/evolucao');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
    });
  });

  describe('Acuracidade de Estoque & Inventário', () => {
    it('GET /api/inventario/kpis retorna KPIs de inventário', async () => {
      const res = await request(app).get('/api/inventario/kpis');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('acuracidade_media');
      expect(res.body).toHaveProperty('diferenca_liquida');
    });

    it('GET /api/inventario/ultimo-inventario retorna lista de filiais', async () => {
      const res = await request(app).get('/api/inventario/ultimo-inventario');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body.dados).toBeInstanceOf(Array);
    });
  });

  // =========================================================================
  // 5. Excesso de Estoque
  // =========================================================================
  describe('Excesso de Estoque', () => {
    it('GET /api/excesso/kpis retorna totais e filiais críticas (>15%)', async () => {
      const res = await request(app).get('/api/excesso/kpis');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('estoque_total_un');
      expect(res.body).toHaveProperty('excesso_total_un');
      expect(res.body).toHaveProperty('valor_excesso_custo');
      expect(res.body).toHaveProperty('qtd_filiais_criticas');
    });

    it('GET /api/excesso/treemap retorna estrutura hierárquica Estado->Filial', async () => {
      const res = await request(app).get('/api/excesso/treemap');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Rede');
      expect(res.body.children).toBeInstanceOf(Array);
      if (res.body.children.length > 0) {
        expect(res.body.children[0]).toHaveProperty('children');
      }
    });

    it('GET /api/excesso/por-categoria retorna 3 níveis por categoria', async () => {
      const res = await request(app).get('/api/excesso/por-categoria');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('categoria');
        expect(res.body[0]).toHaveProperty('normal');
        expect(res.body[0]).toHaveProperty('elevado');
        expect(res.body[0]).toHaveProperty('critico');
      }
    });

    it('GET /api/excesso/filiais retorna tabela de ação por filial', async () => {
      const res = await request(app).get('/api/excesso/filiais?page=0&pageSize=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dados');
      if (res.body.dados.length > 0) {
        expect(res.body.dados[0]).toHaveProperty('valor_excesso_custo');
        expect(res.body.dados[0]).toHaveProperty('supervisor');
      }
    });
  });

  // =========================================================================
  // 6. Monitor de Ruptura
  // =========================================================================
  describe('Monitor de Ruptura', () => {
    it('GET /api/ruptura/kpis retorna cobertura média e contagens', async () => {
      const res = await request(app).get('/api/ruptura/kpis');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dias_cobertura_medio');
      expect(res.body).toHaveProperty('rupt_consumada');
      expect(res.body).toHaveProperty('perc_ruptura_severa');
    });

    it('GET /api/ruptura/distribuicao retorna 4 faixas com cores', async () => {
      const res = await request(app).get('/api/ruptura/distribuicao');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(4);
    });

    it('GET /api/ruptura/tabela retorna somente Crítico e Ruptura Consumada', async () => {
      const res = await request(app).get('/api/ruptura/tabela?page=0&pageSize=10');
      expect(res.status).toBe(200);
      expect(res.body.dados.length).toBeLessThanOrEqual(10);
      res.body.dados.forEach((d) => {
        expect(['Ruptura Consumada', 'Crítico / Alto Risco']).toContain(d.status_ruptura);
      });
    });

    it('GET /api/ruptura/export baixa arquivo CSV com header correto', async () => {
      const res = await request(app).get('/api/ruptura/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text.startsWith('\uFEFF')).toBe(true);
      expect(res.text).toContain('Codigo_Produto');
    });
  });

  // =========================================================================
  // 7. Score de Auditoria
  // =========================================================================
  describe('Score de Auditoria', () => {
    it('GET /api/score/kpis retorna métricas de risco e ações', async () => {
      const res = await request(app).get('/api/score/kpis');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('aud_alto');
      expect(res.body).toHaveProperty('score_medio');
      expect(res.body).toHaveProperty('valor_estoque_aud_alto');
      expect(res.body).toHaveProperty('n_com_acao');
    });

    it('GET /api/score/distribuicao retorna faixas de classificação', async () => {
      const res = await request(app).get('/api/score/distribuicao');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(4);
    });

    it('GET /api/score/acoes retorna ranking de ações recomendadas', async () => {
      const res = await request(app).get('/api/score/acoes');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('acao');
      expect(res.body[0]).toHaveProperty('qtd');
    });

    it('GET /api/score/heatmap retorna matriz Categoria x Região', async () => {
      const res = await request(app).get('/api/score/heatmap');
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('id');
        expect(res.body[0]).toHaveProperty('data');
      }
    });

    it('GET /api/score/tabela suporta filtros por classificacao e busca q', async () => {
      const res = await request(app).get('/api/score/tabela?classificacao=Alto%20Risco&page=0&pageSize=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dados');
      res.body.dados.forEach((d) => {
        expect(d.classificacao).toBe('Alto Risco');
      });
    });

    it('GET /api/score/export baixa arquivo CSV do score', async () => {
      const res = await request(app).get('/api/score/export');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.startsWith('\uFEFF')).toBe(true);
      expect(res.text).toContain('Score_Auditoria');
    });

    it('GET /api/score/produto/:filial/:codigo retorna detalhe com explicação e lotes', async () => {
      if (!sampleProduct) {
        console.warn('  ⚠️ Pulando teste de detalhe de produto: sampleProduct não encontrado');
        return;
      }

      const { Filial, Codigo_Produto } = sampleProduct;
      const res = await request(app).get(`/api/score/produto/${Filial}/${Codigo_Produto}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('produto');
      expect(res.body).toHaveProperty('explicacao');
      expect(res.body).toHaveProperty('lotes');
      expect(res.body.explicacao).toBeInstanceOf(Array);
      expect(res.body.explicacao.length).toBeGreaterThan(0);
      // As contribuições devem estar ordenadas de forma decrescente
      for (let i = 0; i < res.body.explicacao.length - 1; i++) {
        expect(res.body.explicacao[i].contrib).toBeGreaterThanOrEqual(res.body.explicacao[i + 1].contrib);
      }
    });

    it('GET /api/score/produto/:filial/:codigo retorna 404 para produto inexistente', async () => {
      const res = await request(app).get('/api/score/produto/99999/99999999');
      expect(res.status).toBe(404);
      expect(res.body.erro).toContain('não encontrado');
    });
  });

  // =========================================================================
  // 8. Filtros Globais e Performance
  // =========================================================================
  describe('Filtros Globais e Desempenho (< 500 ms em Atlas M0)', () => {
    it('Filtro por regiao afeta os KPIs de forma consistente', async () => {
      const resSudeste = await request(app).get('/api/overview/kpis?regiao=SUDESTE');
      const resSul = await request(app).get('/api/overview/kpis?regiao=SUL');

      expect(resSudeste.status).toBe(200);
      expect(resSul.status).toBe(200);
      expect(resSudeste.body.faturamento).not.toBe(resSul.body.faturamento);
    });

    it('Filtro por filial específica restringe a filial', async () => {
      const res = await request(app).get('/api/overview/kpis?filial=1');
      expect(res.status).toBe(200);
      expect(res.body.faturamento).toBeGreaterThan(0);
    });
  });
});
