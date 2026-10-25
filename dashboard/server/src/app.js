import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import metaRoutes from './routes/metaRoutes.js';
import overviewRoutes from './routes/overviewRoutes.js';
import excessoRoutes from './routes/excessoRoutes.js';
import rupturaRoutes from './routes/rupturaRoutes.js';
import scoreRoutes from './routes/scoreRoutes.js';
import vendasAvRoutes from './routes/vendasAvRoutes.js';
import inventarioRoutes from './routes/inventarioRoutes.js';

const app = express();

// Segurança e utilitários
app.use(helmet());
app.use(cors({
  origin: '*', // Permitir acesso local e do deploy frontend
  methods: ['GET'], // API somente leitura de analytics
}));
app.use(compression());
app.use(express.json());

// Logger em desenvolvimento / produção
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('tiny'));
}

// Rate Limiter: 300 requisições por IP a cada 5 minutos
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  message: { erro: 'Muitas requisições deste IP, tente novamente em 5 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Rota de Health check direta na raiz (para liveness probe do Render)
app.get('/health', (req, res) => res.status(200).json({ ok: true, timestamp: new Date().toISOString() }));

// Montagem das rotas sob o prefixo /api
app.use('/api', metaRoutes);
app.use('/api', overviewRoutes);
app.use('/api', excessoRoutes);
app.use('/api', rupturaRoutes);
app.use('/api', scoreRoutes);
app.use('/api/vendas-av', vendasAvRoutes);
app.use('/api/inventario', inventarioRoutes);

// Tratamento de 404 para rotas inexistentes
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada', path: req.originalUrl });
});

// Middleware centralizado de tratamento de erros
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    erro: 'Erro interno no servidor',
    detalhe: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

export default app;
