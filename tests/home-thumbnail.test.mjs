import test from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
test('home max resolution bypasses responsive selection; other thumbnails keep responsive sources',async()=>{
 const folder=await mkdtemp(path.resolve('node_modules/.thumbnail-test-')),out=path.join(folder,'ui.mjs');
 try{await build({entryPoints:['src/components/VideoThumbnail.tsx'],outfile:out,bundle:true,packages:'external',platform:'node',format:'esm',jsx:'automatic'});const Thumbnail=(await import(pathToFileURL(out))).default;
 const home=renderToStaticMarkup(React.createElement(Thumbnail,{videoId:'abcdefghijk',preferMaxResolution:true}));assert.match(home,/src="https:\/\/i.ytimg.com\/vi\/abcdefghijk\/maxresdefault.jpg"/);assert.doesNotMatch(home,/srcSet=/i);
 const other=renderToStaticMarkup(React.createElement(Thumbnail,{videoId:'abcdefghijk'}));assert.match(other,/hqdefault.jpg/);assert.match(other,/srcSet=/i);
 }finally{await rm(folder,{recursive:true,force:true});}
});
