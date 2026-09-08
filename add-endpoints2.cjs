const fs = require('fs');

const streamCacheStr = `
const streamCache = new Map<string, { url: string; expires: number }>();

app.get("/api/stream/:videoId", async (req, res) => {
  try {
    const videoId = req.params.videoId;
    if (!videoId) return res.status(400).send("Video ID is required");

    const now = Date.now();
    const cached = streamCache.get(videoId);
    if (cached && cached.expires > now) {
      res.setHeader("Content-Type", "text/plain");
      return res.send(cached.url);
    }

    const apiUrl = \`https://getlate.dev/api/tools/youtube-live-downloader?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv=\${videoId}&formatId=2\`;
    
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      redirect: "follow"
    });

    if (!response.ok) {
      return res.status(response.status).send("Error fetching stream URL");
    }

    const finalUrl = response.url;
    streamCache.set(videoId, { url: finalUrl, expires: now + 60000 });
    
    if (streamCache.size > 1000) {
      for (const [k, v] of streamCache.entries()) {
        if (v.expires <= now) streamCache.delete(k);
      }
    }

    res.setHeader("Content-Type", "text/plain");
    return res.send(finalUrl);
  } catch (err) {
    console.error("Stream API Error:", err);
    res.status(500).send("Internal Server Error");
  }
});

const eduConfigCache = { params: "", expires: 0 };

app.get("/api/edu/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).send("ID is required");

    let params = "?rel=0&autoplay=1";
    const now = Date.now();

    if (eduConfigCache.expires > now) {
      params = eduConfigCache.params;
    } else {
      try {
        const confRes = await fetch("https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json");
        if (confRes.ok) {
          const config = await confRes.json();
          if (config && typeof config.params === "string") {
            params = config.params;
            eduConfigCache.params = params;
            eduConfigCache.expires = now + 5 * 60 * 1000;
          }
        }
      } catch (e) {
        console.warn("Failed to fetch edu config, using fallback/cache:", e);
        if (eduConfigCache.params) {
           params = eduConfigCache.params;
        }
      }
    }

    const eduUrl = \`https://www.youtubeeducation.com/embed/\${id}\${params}\`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(eduUrl);
  } catch (err) {
    console.error("Edu API Error:", err);
    res.status(500).send("Internal Server Error");
  }
});
`;

let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace('const app = express();', 'const app = express();\n' + streamCacheStr);
fs.writeFileSync('server.ts', content);
