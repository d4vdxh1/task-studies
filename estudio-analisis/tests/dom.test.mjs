import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as curriculum from '../curriculum.mjs';
const html=await readFile(new URL('../../guia-interactiva-analisis-diseno.html',import.meta.url),'utf8');
const script=(await readFile(new URL('../app.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'const {missions,questions,byId,shuffle,evaluate,examQuestions}=window.curriculum;\n');
const KEY='modo-practica-ad-v1';
function app(saved){const dom=new JSDOM(html,{url:'https://d4vdxh1.github.io/task-studies/guia-interactiva-analisis-diseno.html',runScripts:'outside-only'}),w=dom.window;w.curriculum=curriculum;w.scrollTo=()=>{};w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};if(saved)w.localStorage.setItem(KEY,saved);w.eval(script);return w;}
const click=(w,s)=>{const x=w.document.querySelector(s);assert.ok(x,`Falta ${s}`);assert.ok(!x.disabled,`Deshabilitado ${s}`);x.click();};
const saved=w=>JSON.parse(w.localStorage.getItem(KEY));
function solve(w,q){
 if(q.type==='choice')click(w,`[data-choice="${q.answer}"]`);
 if(q.type==='classify')q.items.forEach((x,i)=>{const el=w.document.querySelector(`[data-class="${i}"]`);el.value=String(x[1]);el.dispatchEvent(new w.Event('change',{bubbles:true}));});
 if(q.type==='order'){for(let i=0;i<q.items.length;i++){for(let attempt=0;attempt<q.items.length;attempt++){const rows=[...w.document.querySelectorAll('.order-list li')];const j=rows.findIndex(row=>row.children[1].textContent===q.items[i]);if(j===i)break;click(w,`[data-move="${j}"][data-dir="-1"]`);}}}
 if(q.type==='open'){const el=w.document.querySelector('#answer');el.value=q.model;el.dispatchEvent(new w.Event('input',{bubbles:true}));click(w,'[data-action="selfcheck"]');click(w,'[data-action="next-open"]');return;}
 click(w,'[data-action="check"]');
}
test('Todas las misiones se pueden completar y repetir no duplica puntos',()=>{const w=app();try{
 for(const m of curriculum.missions){click(w,`[data-mission="${m.id}"]`);click(w,`[data-start="${m.id}"]`);for(const q of m.questions){solve(w,q);if(q.type!=='open'){assert.ok(w.document.querySelector('#feedback').textContent.includes('Bien pensado'));click(w,'[data-action="next"]');}}assert.ok(w.document.querySelector('h1').textContent.includes('encajando'));click(w,'[data-action="finish"]');}
 const before=saved(w);assert.equal(Object.values(before.records).filter(r=>r.mastered).length,44);assert.ok(w.document.querySelector('.stats').textContent.includes('440'));
 click(w,'[data-mission="mapa"]');click(w,'[data-start="mapa"]');solve(w,curriculum.byId.get('mapa-1'));click(w,'[data-action="next"]');assert.equal(Object.values(saved(w).records).filter(r=>r.mastered).length,44);
 }finally{w.close();}});
test('Error, guardado, reanudación y repaso hasta resolver',()=>{let w=app();click(w,'[data-mission="mapa"]');click(w,'[data-start="mapa"]');click(w,'[data-choice="0"]');click(w,'[data-action="check"]');assert.equal(w.document.querySelector('#mistake-count').textContent,'1');click(w,'[data-action="next"]');const data=w.localStorage.getItem(KEY);w.close();w=app(data);try{click(w,'[data-action="resume"]');assert.ok(w.document.querySelector('h2').textContent.includes('Cada evidencia'));click(w,'[data-action="map"]');click(w,'nav [data-nav="review"]');click(w,'[data-review="mapa-1"]');solve(w,curriculum.byId.get('mapa-1'));assert.equal(w.document.querySelector('#mistake-count').textContent,'0');}finally{w.close();}});
test('Simulacro conserva feedback para el final y computa 12 resultados',()=>{const w=app();try{click(w,'[data-action="exam"]');const ids=saved(w).session.ids;for(const id of ids){const q=curriculum.byId.get(id);assert.equal(w.document.querySelector('[data-action="hint"]'),null);solve(w,q);}assert.ok(w.document.querySelector('.result-ring').textContent.includes('12/12'));assert.equal(saved(w).session.results.length,12);}finally{w.close();}});
test('Borrador abierto es texto seguro y autoevaluación no da puntos',()=>{const w=app();try{click(w,'[data-mission="mapa"]');click(w,'[data-start="mapa"]');for(const q of curriculum.missions[0].questions.slice(0,3)){solve(w,q);click(w,'[data-action="next"]');}const input=w.document.querySelector('#answer');input.value='<img src=x onerror=alert(1)> Mi respuesta';input.dispatchEvent(new w.Event('input',{bubbles:true}));click(w,'[data-action="selfcheck"]');click(w,'[data-action="next-open"]');click(w,'.result-row:last-child summary');assert.equal(w.document.querySelector('.result-row img'),null);assert.equal(saved(w).records['mapa-4'],undefined);assert.ok(saved(w).drafts['mapa-4'].includes('<img'));}finally{w.close();}});
test('Un guardado malformado no impide empezar',()=>{const w=app('{malformed');try{assert.equal(w.document.querySelectorAll('.mission-card').length,12);}finally{w.close();}});
