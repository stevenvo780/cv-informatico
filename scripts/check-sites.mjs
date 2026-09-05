import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const live=process.argv.includes('--live');
const base={tech:live?'https://informatico.stevenvallejo.com/':'http://127.0.0.1:8764/cv-informatico/public/',filo:live?'https://filosofo.stevenvallejo.com/':'http://127.0.0.1:8764/cv-filosofo/public/'};
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
try {
for(const site of ['tech','filo']) for(const lang of ['es','en']) for(const width of [1440,390]) {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width,height:1000,deviceScaleFactor:1});
 await page.goto(base[site],{waitUntil:'networkidle0'});
 await page.evaluate(({site,lang})=>localStorage.setItem(site==='filo'?'cv-filo-lang':'cv-tech-lang',lang==='es'?'en':'es'),{site,lang});
 await page.goto(base[site]+'?lang='+lang,{waitUntil:'networkidle0'});
 const state=await page.evaluate(({site,lang})=>({
 lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth>innerWidth,
 featured:document.querySelectorAll('#timeline > .tl-item').length,
 archive:document.querySelectorAll('#timeline-full > .tl-item').length,
 open:document.querySelector('.career-archive')?.open,
 leaked:[...document.querySelectorAll(lang==='es'?'[data-lang-en]':'[data-lang-es]')].filter(e=>getComputedStyle(e).display!=='none').length,
 cauce:document.querySelector('#mainProjects')?.innerText.includes('Cauce V3'),
 stale:/Reubicable a España|Relocatable to Spain/.test(document.body.innerText),
 pdfs:[...document.querySelectorAll('a[href$=".pdf"]')].filter(a=>a.getClientRects().length).map(a=>a.href)
 }),{site,lang});
 assert.equal(state.lang,lang);assert.equal(state.overflow,false,JSON.stringify({site,lang,width,state}));assert.deepEqual(errors,[]);
 if(site==='tech'){assert.equal(state.featured,3);assert.ok(state.archive>3);assert.equal(state.open,false);assert.equal(state.cauce,true);assert.equal(state.stale,false);await page.click('.career-archive summary');assert.equal(await page.$eval('.career-archive',e=>e.open),true);}
 else assert.equal(state.leaked,0);
 for(const url of new Set(state.pdfs)){const r=await page.evaluate(async url=>{const r=await fetch(url);return {status:r.status,type:r.headers.get('content-type')};},url);assert.equal(r.status,200);assert.ok(r.type?.includes('application/pdf'));}
 await page.screenshot({path:`/tmp/jarvis-${live?'live':'local'}-${site}-${lang}-${width}.png`});
 results.push({site,lang,width,...state,errors});await page.close();
}
console.log(JSON.stringify({pass:results.length,live,results}));
} finally {await browser.close();}
