import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');
const replacement = `  // Shorts等の動的再生用プロキシエンドポイント（チャンク中継）
  app.get("/api/video/:id/stream", async (req, res) => {
    const videoId = req.params.id;
    try {
      const resp = await axios.get(\`https://min-plum.vercel.app/360/\${encodeURIComponent(videoId)}\`, {
        timeout: 10000,
        responseType: 'text'
      });
      const streamingUrl = (typeof resp.data === 'string' ? resp.data : String(resp.data)).trim();

      if (!streamingUrl || !streamingUrl.startsWith('http')) {
        return res.status(404).send("Stream URL not found");
      }

      const range = req.headers.range;
      const axiosResponse = await axios({
        url: streamingUrl,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          ...(range ? { 'Range': range } : {})
        },
        validateStatus: () => true
      });

      const headersToForward = ['content-type', 'content-length', 'accept-ranges', 'content-range'];
      for (const key of headersToForward) {
        if (axiosResponse.headers[key]) {
          res.setHeader(key, axiosResponse.headers[key]);
        }
      }
      res.status(axiosResponse.status);
      axiosResponse.data.pipe(res);
    } catch (err) {
      console.error("Stream Proxy Error:", err.message);
      res.status(500).send("Failed to proxy video stream");
    }
  });

  app.get("/api/video/:id", async (req, res) => {`;
content = content.replace('  app.get("/api/video/:id", async (req, res) => {', replacement);
fs.writeFileSync('server.ts', content);
