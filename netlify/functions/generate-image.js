import { GoogleGenAI } from "@google/genai";

// A chave de API é injetada automaticamente pelo Netlify a partir da variável de ambiente GEMINI_API_KEY
// O Netlify usa um 'handler' que expõe a chave através de process.env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Função auxiliar para converter o Base64 para o formato necessário pela API
function base64ToGenerativePart(base64Data, mimeType) {
  // O Netlify envia a imagem como um JSON, que pode conter o prefixo 'data:image/jpeg;base64,'
  // Removemos o prefixo para obter apenas os dados puros em Base64
  const data = base64Data.replace(/^data:image\/[a-z]+;base64,/, "");
  return {
    inlineData: {
      data,
      mimeType,
    },
  };
}

exports.handler = async (event) => {
  // CORS Headers: Essencial para permitir que o navegador chame a função
  const headers = {
    'Access-Control-Allow-Origin': '*', // Permite que o site faça a chamada
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Lida com requisições OPTIONS (pré-voo do CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  try {
    const { modelImageBase64, itemImageBase64, stylePrompt } = JSON.parse(event.body);

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY não está configurada.");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Chave de API do Gemini não configurada no servidor." })
      };
    }

    if (!modelImageBase64 || !itemImageBase64) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Imagens do modelo ou item estão faltando." })
      };
    }

    // 1. Converte as imagens
    const modelPart = base64ToGenerativePart(modelImageBase64, 'image/jpeg');
    const itemPart = base64ToGenerativePart(itemImageBase64, 'image/jpeg');

    // 2. Cria o prompt
    const prompt = `Combine estas duas imagens. Coloque o item de roupa (segunda imagem) na pessoa (primeira imagem). O resultado deve parecer uma foto realística onde a roupa está sendo usada. Mantenha o estilo e a pose do modelo. Use o seguinte estilo: "${stylePrompt}".`;

    // 3. Chamada da API - MODELO DE IMAGEM RESTAURADO
    const result = await ai.models.generateContent({
      model: 'imagen-3.0-generate-002',
      contents: [
        modelPart,
        itemPart,
        prompt
      ],
      config: {
        sampleCount: 1,
      }
    });

    // 4. Retorna a imagem gerada (Base64)
    const base64Image = result.candidates[0].image.imageBytes;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ base64Image })
    };
  } catch (error) {
    console.error("Erro na função generate-image:", error);
    // Retorna uma mensagem de erro mais detalhada se for possível
    const errorMessage = error.message || "Erro desconhecido. Verifique o faturamento do seu projeto Google Cloud.";
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Falha na geração: ${errorMessage}` })
    };
  }
};
