import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  
  const search = await yt.search("nature");
  console.log("Search result keys:", Object.keys(search));
  console.log("Search videos:", search.videos ? search.videos.length : 'no videos prop');
  if (search.videos && search.videos.length > 0) {
    console.log("First video:", search.videos[0].id, search.videos[0].title?.text);
  } else if (search.results && search.results.length > 0) {
    console.log("First result:", search.results[0].type, search.results[0].id, search.results[0].title?.text);
  }
}
run().catch(console.error);
