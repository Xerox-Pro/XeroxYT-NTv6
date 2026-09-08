const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const routeCode = `
  // --- AI Studio API ---
  app.post("/api/aistudio/chat", express.json({ limit: '50mb' }), async (req, res) => {
    try {
      const { messages, systemInstruction, temperature } = req.body;
      
      const response = await genAI.models.generateContent({
        model: 'gemini-3.0-flash',
        contents: messages,
        config: {
          systemInstruction,
          temperature: temperature || 0.7,
        }
      });
      
      res.json({ text: response.text });
    } catch (e) {
      console.error("[AI Studio] Error calling Gemini API:", e);
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  // ---------------------
`;

code = code.replace(/app\.listen\(PORT/, routeCode + '\n  app.listen(PORT');
fs.writeFileSync('server.ts', code);
console.log('Route added successfully');
