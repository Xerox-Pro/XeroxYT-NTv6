import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  const search = await yt.search("nature", { type: "video" });
  console.log(search.videos[0].thumbnails[0].url);
}
run().catch(console.error);
