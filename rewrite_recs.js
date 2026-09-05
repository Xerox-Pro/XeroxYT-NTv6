import fs from 'fs';
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('// 履歴から動的に大量のパーソナライズクエリを生成'));
const endIdx = lines.findIndex(l => l.includes('// フォールバック: デフォルト検索'));

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find boundaries");
  process.exit(1);
}

const replacement = `
      // 一般ジャンルプール
      const categoryPool = [
        "日本 トレンド 総合 2026",
        "YouTube Music 日本 話題の曲",
        "人気 ゲーム実況 最新",
        "エンタメ 話題 バラエティ",
        "最新 ガジェット レビュー",
        "アニメ 話題 2026",
        "料理 レシピ 簡単 人気",
        "最新 ニュース 解説 注目",
        "お笑い コント 漫才 人気"
      ];
      
      // 1. History から関連動画 (watch_next_feed) を取得
      let sampledHistoryIds = [];
      if (historyIds.length > 0) {
        const hCopy = [...historyIds];
        for (let i = hCopy.length - 1; i > 0; i--) {
          const j = Math.floor(getSeedRandom(page * 7 + i) * (i + 1));
          [hCopy[i], hCopy[j]] = [hCopy[j], hCopy[i]];
        }
        sampledHistoryIds = hCopy.slice(0, 10);
      }

      let personalizedVideos = [];
      
      if (sampledHistoryIds.length > 0) {
        const relatedTasks = sampledHistoryIds.map(async (id) => {
          try {
            const info = await youtube.getInfo(id);
            return info.watch_next_feed || [];
          } catch {
            return [];
          }
        });
        
        const relatedResults = await Promise.all(relatedTasks);
        relatedResults.forEach(vList => {
          if (vList && Array.isArray(vList)) {
            personalizedVideos.push(...vList);
          }
        });
        
        // データが足りない場合（例：40件未満）、関連動画のさらに関連動画を取得（ディープフェッチ）
        if (personalizedVideos.length < 40) {
          const fetchedIds = new Set(sampledHistoryIds);
          const candidateDeepIds = personalizedVideos
            .map((v) => v.id || v.videoId || v.content_id)
            .filter((id) => id && !fetchedIds.has(id));
            
          if (candidateDeepIds.length > 0) {
            // ランダムに数件選ぶ
            for (let i = candidateDeepIds.length - 1; i > 0; i--) {
              const j = Math.floor(getSeedRandom(page * 11 + i) * (i + 1));
              [candidateDeepIds[i], candidateDeepIds[j]] = [candidateDeepIds[j], candidateDeepIds[i]];
            }
            const deepSample = candidateDeepIds.slice(0, 5);
            const deepRelatedTasks = deepSample.map(async (id) => {
              try {
                const info = await youtube.getInfo(id);
                return info.watch_next_feed || [];
              } catch {
                return [];
              }
            });
            const deepRelatedResults = await Promise.all(deepRelatedTasks);
            deepRelatedResults.forEach(vList => {
              if (vList && Array.isArray(vList)) {
                personalizedVideos.push(...vList);
              }
            });
          }
        }
      }

      // 一般の検索結果（5%用 または フォールバック用）
      const shuffledCategories = [...categoryPool];
      for (let i = shuffledCategories.length - 1; i > 0; i--) {
        const j = Math.floor(getSeedRandom(page * 13 + i) * (i + 1));
        [shuffledCategories[i], shuffledCategories[j]] = [shuffledCategories[j], shuffledCategories[i]];
      }
      
      // AI検索結果があればそれを追加
      const generalQueries = [];
      if (usedAi && geminiKeywords.length > 0) {
        generalQueries.push(...geminiKeywords.slice(0, 2));
      }
      generalQueries.push(...shuffledCategories.slice(0, 3));
      
      const searchTasks = generalQueries.slice(0, 4).map(q => 
        youtube.search(q, { type: "video", prioritize: "popularity" }).catch(() => null)
      );
      const searchResults = await Promise.all(searchTasks);
      
      let generalVideos = [];
      searchResults.forEach(r => {
        if (r && r.videos && Array.isArray(r.videos)) {
          generalVideos.push(...r.videos);
        }
      });
      
      // フォーマット処理
      let formattedPersonalized = personalizedVideos
        .map((v) => formatVideoObject(v))
        .filter((v) => v && v.videoId && !isUnwantedVideo(v));
        
      let formattedGeneral = generalVideos
        .map((v) => formatVideoObject(v))
        .filter((v) => v && v.videoId && !isUnwantedVideo(v));

      // 重複排除 (重複した場合は、パーソナライズを優先)
      const uniqueMap = new Map();
      formattedPersonalized.forEach(item => {
        if (!uniqueMap.has(item.videoId)) uniqueMap.set(item.videoId, item);
      });
      formattedPersonalized = Array.from(uniqueMap.values());
      
      // 一般動画の重複排除 (パーソナライズに無いもの)
      const uniqueGeneralMap = new Map();
      formattedGeneral.forEach(item => {
        if (!uniqueMap.has(item.videoId) && !uniqueGeneralMap.has(item.videoId)) {
          uniqueGeneralMap.set(item.videoId, item);
        }
      });
      formattedGeneral = Array.from(uniqueGeneralMap.values());

      // 95% パーソナライズ (履歴関連動画), 5% 一般
      const totalRequested = 40;
      let finalVideos = [];
      
      if (formattedPersonalized.length > 0 || formattedGeneral.length > 0) {
        // パーソナライズをシャッフル
        for (let i = formattedPersonalized.length - 1; i > 0; i--) {
          const j = Math.floor(getSeedRandom(page * 31 + i * 17) * (i + 1));
          [formattedPersonalized[i], formattedPersonalized[j]] = [formattedPersonalized[j], formattedPersonalized[i]];
        }
        
        // 一般をシャッフル
        for (let i = formattedGeneral.length - 1; i > 0; i--) {
          const j = Math.floor(getSeedRandom(page * 41 + i * 19) * (i + 1));
          [formattedGeneral[i], formattedGeneral[j]] = [formattedGeneral[j], formattedGeneral[i]];
        }

        const pCount = Math.floor(totalRequested * 0.95);
        const gCount = totalRequested - pCount;
        
        const selectedP = formattedPersonalized.slice(0, Math.max(pCount, totalRequested - formattedGeneral.length));
        const selectedG = formattedGeneral.slice(0, Math.min(gCount, totalRequested - selectedP.length));
        
        // 足りなければ general からもっと足す
        if (selectedP.length + selectedG.length < totalRequested && formattedGeneral.length > selectedG.length) {
          const remaining = totalRequested - (selectedP.length + selectedG.length);
          selectedG.push(...formattedGeneral.slice(selectedG.length, selectedG.length + remaining));
        }
        
        finalVideos = [...selectedP, ...selectedG];
        
        // 全体をさらにシャッフルしてばらけさせる
        for (let i = finalVideos.length - 1; i > 0; i--) {
          const j = Math.floor(getSeedRandom(page * 51 + i) * (i + 1));
          [finalVideos[i], finalVideos[j]] = [finalVideos[j], finalVideos[i]];
        }

        return res.json({ 
          videos: finalVideos,
          aiKeywords: geminiKeywords,
          seed: seed
        });
      }
`;

const newLines = [
  ...lines.slice(0, startIdx),
  replacement,
  ...lines.slice(endIdx)
];

fs.writeFileSync('server.ts', newLines.join('\n'));
