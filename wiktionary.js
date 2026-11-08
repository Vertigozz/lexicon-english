const API='https://ru.wiktionary.org/w/api.php';
export const WIKI_LICENSE='https://creativecommons.org/licenses/by-sa/4.0/';
export function searchWord(value){
  const word=value.normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[’‘]/g,"'");
  if(word.length>80||! /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/.test(word))throw new Error('Введите английское слово или выражение, до 80 символов.');
  return word;
}
export function sourceURL(entry){
  const url=new URL('https://ru.wiktionary.org/w/index.php');
  url.searchParams.set('title',entry.source_title);
  url.searchParams.set('oldid',String(entry.source_revision));
  url.hash='Английский';
  return url.href;
}
export function audioURL(value){
  try{
    const url=new URL(value,'https://ru.wiktionary.org');
    return url.protocol==='https:'&&url.hostname==='upload.wikimedia.org'&&url.pathname.startsWith('/wikipedia/commons/')?url.href:'';
  }catch{return '';}
}
export function audioCredit(file){
  return 'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file);
}
function pronunciationsAfter(heading){
  const variants=[];
  let next=(heading.closest('.mw-heading')||heading).nextElementSibling;
  while(next&&!next.matches('h1,h2,h3,h4,h5,h6,.mw-heading')){
    const containers=new Set([...next.querySelectorAll('.IPA')].map(ipa=>ipa.closest('li')||ipa.parentElement));
    for(const container of containers){
      const ipa=container.querySelector('.IPA')?.textContent.trim();
      if(!ipa||ipa.length>120||variants.some(v=>v.ipa===ipa))continue;
      const audio=container.querySelector('audio[data-mwprovider="wikimediacommons"]');
      const source=audio?.querySelector('source[type="audio/mpeg"]')||audio?.querySelector('source');
      variants.push({ipa,audio_url:audioURL(source?.getAttribute('src')||''),audio_file:audio?.getAttribute('data-mwtitle')||''});
    }
    next=next.nextElementSibling;
  }
  return variants.slice(0,4);
}
export function parseArticle(article){
  if(!article||typeof article.text!=='string'||!Number.isSafeInteger(article.revid)||article.revid<=0)throw new Error('Викисловарь вернул неполную статью. Повторите поиск позже.');
  const doc=new DOMParser().parseFromString(article.text,'text/html');
  const headings=[...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  const english=headings.find(h=>h.textContent.trim()==='Английский');
  if(!english)return [];
  const level=Number(english.tagName.slice(1)),start=headings.indexOf(english);
  const meanings=[];
  let pronunciations=[];
  for(const h of headings.slice(start+1)){
    if(Number(h.tagName.slice(1))<=level)break;
    if(Number(h.tagName.slice(1))===level+1&&h.textContent.trim().startsWith(article.title))pronunciations=[];
    if(h.textContent.trim()==='Произношение')pronunciations=pronunciationsAfter(h);
    if(h.textContent.trim()!=='Значение')continue;
    const container=h.closest('.mw-heading')||h;
    let next=container.nextElementSibling;
    // Ignore notices between a heading and its definition list, never another section.
    while(next&&!next.matches('ol,h1,h2,h3,h4,h5,h6,.mw-heading'))next=next.nextElementSibling;
    if(!next?.matches('ol'))continue;
    for(const li of next.children){
      if(li.tagName!=='LI')continue;
      const copy=li.cloneNode(true);
      copy.querySelectorAll('.example-fullblock,.example,.quotation,sup,script,style,ol,ul').forEach(e=>e.remove());
      const translation=copy.textContent.replace(/\s+/g,' ').replace(/◆.*$/,'').trim();
      if(!/[А-Яа-яЁё]/.test(translation)||translation.length>800||/значени[ея] (?:не|отсутств)|нет определения/i.test(translation))continue;
      if(!meanings.some(m=>m.translation===translation))meanings.push({word:article.title,translation,source_title:article.title,source_revision:article.revid,pronunciations});
    }
  }
  return meanings;
}
export async function lookupWord(value,{signal,revision}={}){
  const word=searchWord(value),url=new URL(API);
  for(const spelling of new Set([word,word.toLowerCase()])){
    url.search=new URLSearchParams({action:'parse',page:spelling,prop:'text|revid',format:'json',formatversion:'2',origin:'*',redirects:'1'});
    if(revision){url.searchParams.delete('page');url.searchParams.delete('redirects');url.searchParams.set('oldid',String(revision));}
    const response=await fetch(url,{signal,credentials:'omit'});
    if(!response.ok)throw new Error('Викисловарь временно недоступен. Попробуйте позже.');
    const data=await response.json();
    if(data.error?.code==='missingtitle')continue;
    if(data.error)throw new Error('Не удалось получить статью Викисловаря. Попробуйте позже.');
    const meanings=parseArticle(data.parse);
    if(meanings.length)return meanings;
  }
  return [];
}
