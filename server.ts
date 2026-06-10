import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // We need express.json with generous body limits since we will receive base64 image data!
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Shared Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  }) : null;

  // API Endpoint to transform a user's photo into a custom pixel matrix (16x16, 32x32, 64x64, 128x128)
  app.post("/api/gemini/photo-to-sprite", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ 
          error: "API Key de Gemini no configurada. Por favor, añádela en el menú 'Settings > Secrets' de AI Studio con el nombre GEMINI_API_KEY." 
        });
      }

      const { base64Image, paletteColors, size = 16 } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: "Falta la imagen base64." });
      }

      const targetSize = parseInt(size, 10) || 16;

      // Format palette description to guide Gemini to use the specific custom palette
      const paletteDesc = paletteColors.map((color: string, i: number) => {
        if (i === 0) return `${i}: transparente (no pintes este color para la silueta principal)`;
        if (i === 11) return `${i}: contorno exterior de silueta (negro/oscuro obligatorio para bordes)`;
        return `${i}: color hex ${color}`;
      }).join("\n");

      const systemInstruction = `Eres un talentoso artista pixel-art con décadas de experiencia en diseño de personajes retro de alta fidelidad para videojuegos clásicos y modernos.
Tu especialidad es transformar fotos de personas reales en hermosos sprites jugables de resolución ${targetSize}x${targetSize} pixeles.

Debes crear un personaje pixel-art Chibi de pie que capture los rasgos característicos de la persona en la foto:
- Color de pelo, estilo de cabello.
- Tono de piel o mejillas.
- Ropa, chamarra, sombrero o accesorios que traiga puestos.

Debes obligatoriamente mapear cada pixel utilizando únicamente los índices de color del 0 al 15 según sus colores reales correspondientes:
Paleta disponible:
${paletteDesc}

Directrices para un sprite espectacular de ${targetSize}x${targetSize}:
1. Una matriz cuadrada de exactamente ${targetSize} filas y ${targetSize} columnas (indexada de 0 a 15).
2. El personaje debe estar centrado, de pie, mirando al frente.
3. El personaje debe estar rodeado por un contorno exterior limpio (índice 11: negro/obsidiana) para que destaque perfectamente en el juego de plataformas.
4. El fondo y las áreas vacías alrededor del personaje deben ser '0' (transparentes).
5. Para resoluciones altas (32, 64, o 128), aprovecha la mayor densidad de pixeles para añadir sombreado sutil, pliegues de ropa detallados y una cara más definida manteniendo un encanto pixel-art limpio y profesional.

IMPORTANTE: Responde estrictamente con un objeto JSON en formato JSON limpio con una propiedad ${targetSize === 16 ? '"matrix" o "rows"' : '"rows"'}.
Si respondes con "rows", debe ser una lista/array de exactamente ${targetSize} strings, donde cada string tiene longitud exacta de ${targetSize} caracteres e incluye únicamente caracteres hexadecimales en minúsculas '0' hasta 'f' ('0'-'9', 'a' para 10, 'b' para 11, 'c' para 12, 'd' para 13, 'e' para 14, 'f' para 15).`;

      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image.replace(/^data:image\/\w+;base64,/, ""),
        },
      };

      const promptPart = `Por favor analiza la persona de esta selfie o fotografía y tradúcela a un espectacular sprite pixel-art carismático de tamaño ${targetSize}x${targetSize} según la paleta.`;

      const responseSchemaProperties: any = {};
      const requiredFields: string[] = [];

      if (targetSize === 16) {
        responseSchemaProperties.matrix = {
          type: Type.ARRAY,
          description: "Matriz bidimensional de 16x16 que contiene números enteros del 0 al 15",
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.INTEGER
            }
          }
        };
        responseSchemaProperties.rows = {
          type: Type.ARRAY,
          description: "Opcional: Array de 16 strings de longitud 16 con caracteres hex representando los colores",
          items: {
            type: Type.STRING
          }
        };
        requiredFields.push("matrix"); // we require matrix by default for 16x16, but accept rows too
      } else {
        responseSchemaProperties.rows = {
          type: Type.ARRAY,
          description: `Array de exactamente ${targetSize} strings, donde cada string tiene exactamente longitud ${targetSize} y contiene caracteres hexadecimales de '0' a 'f'`,
          items: {
            type: Type.STRING
          }
        };
        requiredFields.push("rows");
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [imagePart, promptPart],
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: responseSchemaProperties,
            required: requiredFields
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No se obtuvo respuesta de texto de Gemini.");
      }

      const result = JSON.parse(text);
      res.json(result);

    } catch (error: any) {
      console.error("Error generating photo to sprite:", error);
      res.status(500).json({ error: error.message || "Ocurrió un error en el procesador Gemini de fotos de jugador." });
    }
  });

  // API Endpoint to transform a text prompt description into a custom pixel matrix (16x16, 32x32, 64x64, 128x128)
  app.post("/api/gemini/prompt-to-sprite", async (req, res) => {
    try {
      if (!ai) {
        return res.status(500).json({ 
          error: "API Key de Gemini no configurada. Por favor, añádela en el menú 'Settings > Secrets' de AI Studio con el nombre GEMINI_API_KEY." 
        });
      }

      const { promptDescription, paletteColors, size = 16 } = req.body;
      if (!promptDescription) {
        return res.status(400).json({ error: "Falta la descripción del personaje." });
      }

      const targetSize = parseInt(size, 10) || 16;

      // Format palette description to guide Gemini to use the specific custom palette
      const paletteDesc = paletteColors.map((color: string, i: number) => {
        if (i === 0) return `${i}: transparente (no pintes este color para la silueta principal)`;
        if (i === 11) return `${i}: contorno exterior de silueta (negro/oscuro obligatorio para bordes)`;
        return `${i}: color hex ${color}`;
      }).join("\n");

      const systemInstruction = `Eres un diseñador de sprites y pixel-artist legendario galardonado con múltiples premios, con especialización en diseño de personajes retro de consola portátil Chibi de alta definición.
Debes crear un personaje pixel-art Chibi de pie que cumpla exactamente y al pie de la letra con la descripción detallada dada por el usuario.

Debes obligatoriamente mapear cada pixel utilizando únicamente los índices de color del 0 al 15 (hexadecimal '0'-'f') según sus correspondencias de color de la paleta.
Paleta de colores disponible:
${paletteDesc}

Directrices obligatorias para un sprite espectacular de resolución ${targetSize}x${targetSize}:
1. Una matriz totalmente cuadrada de exactamente ${targetSize} filas y ${targetSize} columnas (indexada de 0 a 15, es decir, caracteres hexadecimales '0'-'f' en cada fila).
2. El personaje debe estar centrado, parado de frente o en diagonal.
3. El personaje debe tener un contorno exterior negro/oscuro (índice 11) limpio para contrastar perfectamente con los escenarios del juego.
4. El fondo y las áreas sin pintar a los lados, por encima y por debajo deben ser '0' (transparentes).
5. Usa la resolución ${targetSize}x${targetSize} de forma óptima para que se noten los elementos pedidos (por ejemplo, si pide sombrero, dibuja una hermosa copa de sombrero de ala ancha arriba; si pide camisa de resaque, dibuja los hombros descubiertos; si pide botas negras, píntalas en gris oscuro/negro abajo con contorno 11).
6. Mantén el estilo pixel-art sumamente limpio, profesional y asombroso.

IMPORTANTE: Responde estrictamente con un objeto JSON limpio con una propiedad ${targetSize === 16 ? '"matrix" o "rows"' : '"rows"'}.
Si respondes con "rows", debe ser una lista/array de exactamente ${targetSize} strings, donde cada string tiene longitud exacta de ${targetSize} caracteres e incluye únicamente caracteres hexadecimales en minúsculas '0' hasta 'f' ('0'-'9', 'a' para 10, 'b' para 11, 'c' para 12, 'd' para 13, 'e' para 14, 'f' para 15). No añadas texto de salida que no sea el JSON solicitado.`;

      const promptPart = `Por favor genera un sprite de tamaño ${targetSize}x${targetSize} basado estrictamente en el siguiente deseo e indicación de características del personaje:
"${promptDescription}"`;

      const responseSchemaProperties: any = {};
      const requiredFields: string[] = [];

      if (targetSize === 16) {
        responseSchemaProperties.matrix = {
          type: Type.ARRAY,
          description: "Matriz bidimensional de 16x16 que contiene números enteros del 0 al 15",
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.INTEGER
            }
          }
        };
        responseSchemaProperties.rows = {
          type: Type.ARRAY,
          description: "Opcional: Array de 16 strings de longitud 16 con caracteres hex representando los colores",
          items: {
            type: Type.STRING
          }
        };
        requiredFields.push("matrix");
      } else {
        responseSchemaProperties.rows = {
          type: Type.ARRAY,
          description: `Array de exactamente ${targetSize} strings, donde cada string tiene exactamente longitud ${targetSize} y contiene caracteres hexadecimales de '0' a 'f'`,
          items: {
            type: Type.STRING
          }
        };
        requiredFields.push("rows");
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptPart,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: responseSchemaProperties,
            required: requiredFields
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No se obtuvo respuesta de texto de Gemini.");
      }

      const result = JSON.parse(text);
      res.json(result);

    } catch (error: any) {
      console.error("Error generating prompt to sprite:", error);
      res.status(500).json({ error: error.message || "Ocurrió un error en el procesador Gemini de generación de personajes por texto." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
