import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY || GEMINI_API_KEY === 'SUA_CHAVE_AQUI') {
  console.error('❌ GEMINI_API_KEY não encontrada no .env');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function main() {
  console.log('🔍 Listando modelos disponíveis para esta chave...\n');
  try {
    const page = await ai.models.list();
    const models: string[] = [];
    for await (const model of page) {
      models.push(model.name || 'unknown');
    }
    console.log(`✅ ${models.length} modelos encontrados:\n`);
    models.forEach((m) => console.log('  • ' + m));
  } catch (error: any) {
    console.error('❌ ERRO ao listar modelos:', error.message || error);
  }
}

main();
