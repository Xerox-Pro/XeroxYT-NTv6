import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  
  // try getHomeFeed or getExplore
  const home = await yt.getHomeFeed();
  console.log("Home keys:", Object.keys(home));
  console.log("Home videos:", home.videos ? home.videos.length : 'no videos prop');
  if (home.videos && home.videos.length > 0) {
    console.log("First video:", home.videos[0].id, home.videos[0].title?.text);
  } else {
    // maybe it is home.contents?
    console.log("Home contents:", home.contents ? home.contents.length : 'no contents');
    if (home.contents) console.log("First content type:", home.contents[0].type);
  }
}
run().catch(console.error);
