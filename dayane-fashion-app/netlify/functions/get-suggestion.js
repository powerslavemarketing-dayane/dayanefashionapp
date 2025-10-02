// netlify/functions/get-suggestion.js
// Este arquivo é uma Netlify Function que gera sugestões de prompt de texto.

const API_KEY = process.env.NETLIFY_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: "Método Não Permitido. Use POST." }),
        };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        if (!API_KEY) {
             return {
                statusCode: 500,
                body: JSON.stringify({ message: "Chave API não configurada. Verifique as variáveis de ambiente." }),
            };
        }

        const systemPrompt = "Você é um assistente criativo de fotografia de moda. Sua única tarefa é criar uma sugestão concisa (máximo 2 frases) de prompt de estilo e cena para uma foto de prova virtual de roupas. Concentre-se em iluminação, cenário e pose. A resposta deve ser apenas o texto do prompt.";

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            // A geração de sugestão de estilo não precisa de pesquisa
            tools: [], 
        };

        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await apiResponse.json();

        if (apiResponse.ok) {
            const generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (generatedText) {
                return {
                    statusCode: 200,
                    body: JSON.stringify({ text: generatedText }),
                };
            } else {
                return {
                    statusCode: 500,
                    body: JSON.stringify({ message: "Resposta de texto vazia da API." }),
                };
            }
        } else {
            const errorDetails = result.error ? result.error.message : 'Erro desconhecido da API.';
            console.error("Erro na API Gemini Suggestion:", errorDetails);
            return {
                statusCode: apiResponse.status,
                body: JSON.stringify({ message: `Erro na API: ${errorDetails}` }),
            };
        }

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                message: "Erro interno no servidor ao processar a requisição de sugestão.", 
                error: error.message 
            }),
        };
    }
};