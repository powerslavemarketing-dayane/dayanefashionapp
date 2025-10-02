// netlify/functions/generate-image.js
// Este arquivo é uma Netlify Function que atua como um proxy seguro para o Gemini API.

// A chave API é injetada automaticamente pela variável de ambiente NETLIFY_GEMINI_API_KEY
// configurada no painel do Netlify.
const API_KEY = process.env.NETLIFY_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${API_KEY}`;

// Define a função manipuladora (handler) que o Netlify irá executar
exports.handler = async function(event, context) {
    // A função só aceita requisições POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: "Método Não Permitido. Use POST." }),
        };
    }

    try {
        // Analisa o corpo da requisição JSON (enviado pelo frontend)
        const { fullPrompt, modelImage, itemImage } = JSON.parse(event.body);

        if (!API_KEY) {
             return {
                statusCode: 500,
                body: JSON.stringify({ message: "Chave API não configurada. Verifique as variáveis de ambiente." }),
            };
        }

        // Constrói a estrutura de partes (parts) para o payload da API
        // O modelo image-to-image recebe o texto seguido das imagens
        const contents = [
            {
                role: "user",
                parts: [
                    { text: fullPrompt }, // 1. O prompt descrevendo a tarefa
                    { // 2. A imagem da Modelo (Pessoa)
                        inlineData: {
                            mimeType: modelImage.mimeType,
                            data: modelImage.data
                        }
                    },
                    { // 3. A imagem da Roupa (Item)
                        inlineData: {
                            mimeType: itemImage.mimeType,
                            data: itemImage.data
                        }
                    }
                ]
            }
        ];

        const payload = {
            contents: contents,
            // Configuração para indicar que a resposta deve incluir uma imagem
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            },
        };

        // ----------------------------------------------------
        // Lógica de Chamada da API com Retentativas (Backoff)
        // ----------------------------------------------------
        const MAX_RETRIES = 5;
        let lastError = null;
        
        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const apiResponse = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                const result = await apiResponse.json();

                if (apiResponse.ok) {
                    // Extrai os dados da imagem (base64) da resposta
                    const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

                    if (base64Data) {
                        return {
                            statusCode: 200,
                            body: JSON.stringify({ 
                                base64Image: base64Data, 
                                message: "Imagem gerada com sucesso." 
                            }),
                        };
                    } else {
                        // Se a API retornou 200, mas sem imagem, é um erro de conteúdo
                        throw new Error("Resposta da API Gemini não continha dados de imagem válidos.");
                    }
                } else {
                    // Trata erros de status HTTP (e.g., 400, 500)
                    const errorDetails = result.error ? result.error.message : 'Erro desconhecido da API.';
                    console.error(`Erro da API (Status ${apiResponse.status}): ${errorDetails}`);
                    
                    if (apiResponse.status === 429) {
                        // Limite de taxa (Rate Limit), tenta novamente
                        throw new Error("Limite de taxa atingido (429). Tentando novamente...");
                    } else {
                        // Outros erros, talvez não faça sentido tentar novamente, mas faremos
                        throw new Error(`Erro na chamada da API: ${errorDetails}`);
                    }
                }
            } catch (error) {
                lastError = error;
                // Aplica backoff exponencial antes de tentar novamente
                const delay = Math.pow(2, i) * 1000;
                if (i < MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // Se todas as retentativas falharem
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                message: "Falha na comunicação com a API Gemini após várias tentativas.",
                error: lastError ? lastError.message : "Erro desconhecido."
            }),
        };

    } catch (error) {
        // Trata erros de parsing ou outros erros de execução
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                message: "Erro interno no servidor ao processar a requisição.", 
                error: error.message 
            }),
        };
    }
};