import { Innertube } from "youtubei.js";
(async () => {
  const yt = await Innertube.create();
  const search = await yt.search("#shorts", { type: "video" });
  const videoId = search.videos[0].id;
  const info = await yt.getInfo(videoId);
  const format = info.chooseFormat({ type: 'video+audio', quality: 'best' }) || info.chooseFormat({ type: 'video' });
  if (format) {
    console.log(format.decipher(yt.session.player));
  } else {
    console.log("No format found");
  }
})();
