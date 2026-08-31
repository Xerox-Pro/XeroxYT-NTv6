import { Innertube } from "youtubei.js";
import axios from 'axios';
(async () => {
  const yt = await Innertube.create();
  try {
     const info = await yt.getInfo("jNQXAC9IVRw", 'WEB');
     const format = info.chooseFormat({ type: 'video+audio', quality: 'best' }) || info.chooseFormat({ type: 'video' });
     console.log("yt.chooseFormat works. returns url:", format ? format.url || format.decipher(yt.session.player) : 'none');
     const streamingUrl = format.url || format.decipher(yt.session.player);
     const axiosResponse = await axios({
        url: streamingUrl,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });
      console.log("Axios response:", axiosResponse.status);
  } catch (e) {
     console.log("yt.chooseFormat failed:", e.message);
  }
})();
