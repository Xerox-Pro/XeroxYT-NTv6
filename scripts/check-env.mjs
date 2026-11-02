import {apiPool} from '../server/lib/apiPool.mjs';
const pool=apiPool(process.env);
if(process.env.VERCEL&&!pool.length)throw new Error('Deploy XeroxYT-NTv6-APIv1, then set API_BASE_URL_1 (or API_BASE_URL) in Vercel.');

if(process.env.VERCEL&&!process.env.API_SHARED_SECRET)throw new Error('Set the same server-only API_SHARED_SECRET on the frontend gateway and API servers.');
