import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  
  console.log("Fetching trending...");
  const trending = await yt.getTrending();
  console.log("Trending video 0:", trending.videos[0].id, trending.videos[0].title.text, trending.videos[0].view_count.text);

  console.log("Fetching search...");
  const search = await yt.search("hello");
  console.log("Search video 0:", search.videos[0].id, search.videos[0].title.text);

  console.log("Fetching info...");
  const info = await yt.getInfo(trending.videos[0].id);
  console.log("Info:", info.basic_info.title, info.basic_info.view_count);
}
run().catch(console.error);
