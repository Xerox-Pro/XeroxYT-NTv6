import { Innertube } from "youtubei.js";
(async () => {
  const yt = await Innertube.create({ generate_session_locally: true });
  const search = await yt.search("#shorts", { type: "video" });
  const videoId = search.videos[0].id;
  try {
     const info = await yt.getInfo(videoId, 'IOS');
     const format = info.chooseFormat({ type: 'video+audio', quality: 'best' }) || info.chooseFormat({ type: 'video' });
     console.log("yt.chooseFormat works. returns url:", format ? format.url : 'none');
  } catch (e) {
     console.log("yt.chooseFormat failed:", e.message);
  }
})();
