import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';

// Run from cv-informatico/scripts. Existing Cloud Atlas HTML owns the layout;
// public/data.js owns the content shared by the website and both PDF formats.
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir=path.resolve(repo,'../mi-cv/cv-pdf');
const context={window:{}};
vm.runInNewContext(await fs.readFile(path.join(repo,'public/data.js'),'utf8'),context);
const D=context.window.CV_DATA,R=context.window.CV_RESUME;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
 for(const lang of ['es','en']) for(const variant of ['tech','tech_ats']) {
  const p=await browser.newPage();
  const filename=`cv_${variant}_${lang}.html`;
  await p.goto('file://'+path.join(sourceDir,filename),{waitUntil:'networkidle0',timeout:30000});
  const rows=R.featuredOrgs.map((org,i)=>{
   const e=D.experience.find(e=>e.org===org);
   if(!e)throw Error('Unknown organization: '+org);
   return {org:e.org,role:e.role[lang],period:e.period[lang],type:e.tags[0][lang],desc:R.experienceSummary[i][lang]};
  });
  const projects=R.projects.map(e=>`<div class="proj"><b>${esc(e.name)}</b> · <a href="${esc(e.url)}">${esc(new URL(e.url).hostname)}</a><div class="pd">${esc(e[lang])}</div></div>`).join('\n');
  const archive=`<div class="prev">${esc(R.archive[lang])} <a href="https://informatico.stevenvallejo.com/?lang=${lang}#experience">informatico.stevenvallejo.com</a></div>`;
  const jobs=rows.map(e=>variant==='tech'
   ?`<div class="exp"><div class="row"><div class="co">${esc(e.org)} <span class="at">· ${esc(e.role)}</span></div><div class="dt">${esc(e.period)} · ${esc(e.type)}</div></div><div class="desc">${esc(e.desc)}</div></div>`
   :`<div class="job"><div class="job-head"><span class="job-title">${esc(e.role)}</span> — <span class="job-org">${esc(e.org)}</span></div><div class="job-meta">${esc(e.period)} · ${esc(e.type)}</div><ul><li>${esc(e.desc)}</li></ul></div>`).join('\n');
  await p.evaluate(({variant,lang,profile,jobs,projects,archive,availability})=>{
   document.querySelector(variant==='tech'?'.profile':'.summary').textContent=profile;
   if(variant==='tech'){
    const sections=[...document.querySelectorAll('main section')];
    const exp=sections.find(s=>/Experiencia|Experience/i.test(s.querySelector('.m-title')?.textContent||''));
    const proj=sections.find(s=>/Proyectos|Projects/i.test(s.querySelector('.m-title')?.textContent||''));
    if(!exp||!proj)throw Error('CV sections missing');
    exp.innerHTML=exp.querySelector('.m-title').outerHTML+jobs+archive;
    proj.innerHTML=proj.querySelector('.m-title').outerHTML+projects;
   } else {
    const headings=[...document.querySelectorAll('h2')];
    const exp=headings.find(h=>/Experiencia|Experience/i.test(h.textContent));
    const proj=headings.find(h=>/Proyectos|Projects/i.test(h.textContent));
    const edu=headings.find(h=>/Educación|Education/i.test(h.textContent));
    if(!exp||!proj||!edu)throw Error('ATS sections missing');
    while(exp.nextElementSibling!==proj)exp.nextElementSibling.remove();
    exp.insertAdjacentHTML('afterend',jobs+archive);
    while(proj.nextElementSibling!==edu)proj.nextElementSibling.remove();
    proj.insertAdjacentHTML('afterend',projects);
    const contact=document.querySelector('.contact');
    contact.innerHTML=contact.innerHTML.replace(/Medellín, Colombia[^<]*<br>/,availability+'<br>');
   }
   let style=document.getElementById('coherent-export');
   if(!style){style=document.createElement('style');style.id='coherent-export';document.head.append(style);}
   style.textContent=variant==='tech'
    ? '.exp .row{display:block}.exp .dt{white-space:normal;margin-top:.5mm}.proj a,.prev a{color:#276c62;text-decoration:underline}.proj{break-inside:avoid}.exp{break-inside:avoid}'
    : '.proj .pd{font-size:9.1pt;line-height:1.26}.proj a,.prev a{color:#222}.prev{font-size:9pt;margin:2mm 0}.job,.proj{break-inside:avoid}';
  },{variant,lang,profile:R.profile[lang],jobs,projects,archive,availability:D.ui[lang].heroChipRemote});
  const html=await p.content();
  if(/relocat\w* to Spain|reubic\w* a España/i.test(html))throw Error('Stale geography in '+filename);
  await fs.writeFile(path.join(sourceDir,filename),html+'\n');
  const out=path.join(repo,`public/pdf/CV_${variant}_${lang}.pdf`);
  await fs.mkdir(path.dirname(out),{recursive:true});
  await p.pdf({path:out,format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  await fs.copyFile(out,path.resolve(repo,`../mi-cv/public/pdf/CV_${variant}_${lang}.pdf`));
  console.log(JSON.stringify({file:path.basename(out),bytes:(await fs.stat(out)).size,organizations:rows.length,projects:R.projects.length}));
  await p.close();
 }
}finally{await browser.close();}
