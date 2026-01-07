import { Injectable } from '@angular/core';

export interface GeminiAnalysisResult {
  label: string;
  confidence: number;
  explanation: string;
  recommendations: string[];
}

@Injectable({ providedIn: 'root' })
export class GeminiService {
  private readonly API_KEY = 'AIzaSyCURk_h_OImlmUHC3E-R-tR6j-iBo6UbNw';

  async analyzeImage(dataUrl: string): Promise<GeminiAnalysisResult> {
    // Comprimir imagen para reducir uso de cuota
    const compressedDataUrl = await this.compressImage(dataUrl, 800, 0.7);
    
    const match = compressedDataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
      throw new Error('Formato de imagen inválido');
    }
    const [, mimeType, base64Data] = match;

    const prompt = `Analiza esta imagen de hoja de papa. Responde SOLO con JSON válido (sin markdown, sin backticks):

{"label":"Tizón temprano"|"Tizón tardío"|"Saludable"|"No es hoja de papa","confidence":0.0-1.0,"explanation":"máximo 50 palabras","recommendations":["rec1","rec2","rec3"]}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `Error ${response.status}`;
      
      if (response.status === 429) {
        throw new Error('Límite de solicitudes excedido. Intenta en unos minutos.');
      }
      
      throw new Error(`Error de Gemini API: ${errorMessage}`);
    }

    const data = await response.json();
    
    // Buscar el texto en todas las partes (gemini-2.5 puede tener múltiples parts)
    const parts = data?.candidates?.[0]?.content?.parts || [];
    let textContent = '';
    
    for (const part of parts) {
      if (part.text) {
        textContent += part.text;
      }
    }
    
    if (!textContent) {
      console.error('Respuesta completa:', JSON.stringify(data, null, 2));
      throw new Error('La API no devolvió contenido');
    }

    // Buscar JSON en el texto
    let cleanedText = textContent.trim();
    
    // Método 1: Buscar entre backticks de markdown
    const codeBlockMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleanedText = codeBlockMatch[1].trim();
    } else {
      // Método 2: Extraer solo el objeto JSON
      const jsonStart = cleanedText.indexOf('{');
      const jsonEnd = cleanedText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        cleanedText = cleanedText.slice(jsonStart, jsonEnd + 1);
      }
    }
    
    // Limpiar caracteres problemáticos
    cleanedText = cleanedText.replace(/[\x00-\x1F\x7F]/g, ' ').trim();

    try {
      const result = JSON.parse(cleanedText) as GeminiAnalysisResult;
      
      if (!result.label || typeof result.confidence !== 'number') {
        throw new Error('Respuesta incompleta');
      }
      
      return {
        label: result.label,
        confidence: Math.max(0, Math.min(1, result.confidence)),
        explanation: result.explanation || 'Sin explicación disponible',
        recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
      };
    } catch (parseError) {
      console.error('Error parseando respuesta:', cleanedText);
      throw new Error('Error procesando la respuesta de la IA');
    }
  }

  private compressImage(dataUrl: string, maxSize: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Redimensionar si es muy grande
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo crear canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Error cargando imagen'));
      img.src = dataUrl;
    });
  }
}
