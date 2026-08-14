import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  
  console.log("Fetching home feed...");
  const home = await yt.getHomeFeed();
  console.log("Home video 0:", home.videos[0].id, home.videos[0].title.text, home.videos[0].view_count?.text);

  console.log("Fetching search...");
  const search = await yt.search("hello");
  console.log("Search video 0:", search.results[0].id, search.results[0].title.text);

  console.log("Fetching info...");
  const info = await yt.getInfo(home.videos[0].id);
  console.log("Info:", info.basic_info.title, info.basic_info.view_count);
}
run().catch(console.error);
