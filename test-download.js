import { Innertube } from "youtubei.js";
(async () => {
  const yt = await Innertube.create();
  const search = await yt.search("#shorts", { type: "video" });
  const videoId = search.videos[0].id;
  try {
     const stream = await yt.download(videoId, { type: 'video+audio' });
     console.log("yt.download works. returns:", stream.constructor.name);
  } catch (e) {
     console.log("yt.download failed:", e.message);
  }
})();
