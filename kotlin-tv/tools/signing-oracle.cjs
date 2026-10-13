// Regenerate deterministic compatibility fixtures from the pinned upstream source.
const fs = require('fs'); const vm = require('vm'); const path = require('path');
const source = fs.readFileSync(path.join(__dirname,'../../server/vendor/hongguo.cjs'),'utf8');
const ctx = vm.createContext({require,Buffer,URL,URLSearchParams});
vm.runInContext(source+`;globalThis.oracle = {branchOf,hashF13,xGorgon,helios,buildMedusa,sm3};`,ctx);
const result=[];
for(let variant=0;variant<12;variant++) {
 const ts=1800500000+variant;
 vm.runInContext(`Date.now=()=>${ts*1000}; letSeed=17; Math.random=()=>{letSeed=(Math.imul(letSeed,1664525)+1013904223)>>>0;return letSeed/4294967296;};`,ctx);
 const body=variant%2===0?Buffer.from('{"video":"1234567890"}'):null;
 let url;for(let ticket=0;ticket<128;ticket++){url=`https://example.com/api?q=${encodeURIComponent('短剧')}&ticket=${ticket}`;if(ctx.oracle.branchOf(url,body,ts)===0)break;}
 const query=url.split('?')[1];const md5=body?require('crypto').createHash('md5').update(body).digest():Buffer.alloc(16);
 const hash=ctx.oracle.hashF13(ctx.oracle.sm3(query),md5,Buffer.from(Uint32Array.of(ts).buffer),ts).toString('hex');
 result.push({ts,url,body:body?.toString()??null,hash,gorgon:ctx.oracle.xGorgon(query,body,ts,42131),helios:ctx.oracle.helios(ts),medusa:ctx.oracle.buildMedusa(url,body,ts)});
}
fs.writeFileSync(path.join(__dirname,'../core/src/test/resources/signing.json'),JSON.stringify(result,null,2)+'\n');
