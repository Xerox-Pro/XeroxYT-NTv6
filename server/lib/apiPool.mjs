export function apiPool(env) {
 const entries=Object.entries(env).filter(([key,value])=>/^API_BASE_URL(?:_\d+)?$/.test(key)&&typeof value==='string'&&value.trim()).sort(([a],[b])=>{const ai=a==='API_BASE_URL'?0:Number(a.split('_').at(-1)),bi=b==='API_BASE_URL'?0:Number(b.split('_').at(-1));return ai-bi;});
 return [...new Set(entries.map(([key,value])=>{const url=new URL(value.trim());if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error(`${key} must be an HTTPS origin`);return url.origin;}))];
}
export function canRetry(method,path,status){return ['GET','HEAD'].includes(method)&&!/^\/api\/(account|auth)(\/|$)/.test(path)&&[408,429,500,502,503,504].includes(status);}
