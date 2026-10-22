import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env do diretório do server e da raiz do projeto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

let client = null;
let db = null;

export async function connectDB() {
  if (db) return db;

  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!mongoUrl) {
    console.warn('⚠️ AVISO: MONGO_URL não definida nas variáveis de ambiente.');
    return null;
  }

  try {
    client = new MongoClient(mongoUrl, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 15000,
    });

    await client.connect();
    // Obtém o nome do banco da URL ou usa 'prevencao_perdas'
    let dbName = 'prevencao_perdas';
    const parsedUrl = new URL(mongoUrl.replace('mongodb+srv://', 'http://').replace('mongodb://', 'http://'));
    if (parsedUrl.pathname && parsedUrl.pathname.length > 1) {
      dbName = parsedUrl.pathname.substring(1).split('?')[0] || 'prevencao_perdas';
    }

    db = client.db(dbName);
    console.log(`✓ Conectado ao MongoDB Atlas (Database: ${dbName})`);
    return db;
  } catch (error) {
    console.error('❌ Erro ao conectar ao MongoDB Atlas:', error.message);
    throw error;
  }
}

export function getDB() {
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('✓ Conexão com MongoDB encerrada.');
  }
}
