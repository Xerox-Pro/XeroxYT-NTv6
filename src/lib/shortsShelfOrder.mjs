export function shuffleShelfCandidates(videos,previousFirst='',random=Math.random){
 const result=[...new Map(videos.filter(v=>v?.videoId).map(v=>[v.videoId,v])).values()].slice(0,64);
 for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
 if(result.length>1&&result[0].videoId===previousFirst)[result[0],result[1]]=[result[1],result[0]];
 return result;
}
