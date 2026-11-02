import {apiPool} from '../server/lib/apiPool.mjs';
const pool=apiPool(process.env);
if(process.env.VERCEL&&!pool.length)throw new Error('Deploy XeroxYT-NTv6-APIv1, then set API_BASE_URL_1 (or API_BASE_URL) in Vercel.');
