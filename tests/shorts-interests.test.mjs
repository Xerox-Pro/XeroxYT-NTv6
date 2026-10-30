import test from 'node:test';
import assert from 'node:assert/strict';
import { saveShortsInterest, saveVideoHashtags, readShortsInterests, personalShortsTerm } from '../src/lib/shortsInterests.mjs';
test('interests save normal hashtags and searches per account, exclude shorts and rotate terms', () => {
 const data = new Map(); globalThis.localStorage = { getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v) };
 localStorage.setItem('xerox_last_account_id','alice');
 saveShortsInterest('ギター #shorts'); saveVideoHashtags({title:'#音楽',description:'#演奏 #shorts'});
 saveVideoHashtags({isShort:true,title:'#猫'});
 assert.deepEqual(readShortsInterests().map(x=>x.term),['#演奏','#音楽','ギター']);
 assert.equal(personalShortsTerm(1),'#演奏'); assert.equal(personalShortsTerm(2),'#音楽');
 saveShortsInterest('https://youtu.be/example'); assert.equal(readShortsInterests().length,3);
 localStorage.setItem('xerox_last_account_id','bob'); assert.equal(readShortsInterests().length,0);
 saveShortsInterest('ゲーム'); assert.equal(personalShortsTerm(1),'ゲーム');
});
