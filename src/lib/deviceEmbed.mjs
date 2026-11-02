// Public player configuration is fetched directly by the browser, never by our API.
const SOURCE='https://raw.githubusercontent.com/siawaseok3/wakame/master/video_config.json';
let lastParams='';
export async function getDeviceEmbedUrl(id,signal) {
  signal?.throwIfAborted();
  let params='';
  try {
    const response=await fetch(`${SOURCE}?t=${Date.now()}`,{credentials:'omit',cache:'no-store',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Configuration unavailable');
    let text=(await response.text()).replace(/&amp;/g,'&').trim();
    if(text.startsWith('{')){const data=JSON.parse(text);if(typeof data.params!=='string')throw new Error('Invalid configuration');text=data.params.replace(/&amp;/g,'&').trim();}
    const index=text.indexOf('?');if(index>=0)text=text.slice(index+1);else text=text.replace(/^[?&]/,'');
    if(!text||/[<>]/.test(text)||!text.includes('='))throw new Error('Invalid configuration');
    params=text;lastParams=text;
  }catch(error){if(signal?.aborted)throw error;params=lastParams;}
  const url=new URL(`https://${params?'www.youtubeeducation.com':'www.youtube-nocookie.com'}/embed/${encodeURIComponent(id)}`);
  url.search=params||'rel=0';
  return url.toString();
}
