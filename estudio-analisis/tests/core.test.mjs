import test from 'node:test';
import assert from 'node:assert/strict';
import {missions,questions,evaluate,examQuestions} from '../curriculum.mjs';
import {createTutorServer} from '../tutor/server.mjs';

test('Contenido: IDs únicos, 12 misiones y criterios completos',()=>{
 assert.equal(missions.length,12);assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 for(const m of missions){assert.ok(m.idea&&m.source&&m.anchor);assert.equal(m.questions.filter(q=>q.type==='open').length,1);}
 for(const q of questions){if(q.type==='choice'){assert.ok(q.options[q.answer]);assert.equal(evaluate(q,q.answer),true);assert.equal(evaluate(q,(q.answer+1)%q.options.length),false);}
 if(q.type==='classify'){assert.equal(evaluate(q,q.items.map(i=>i[1])),true);assert.equal(evaluate(q,[]),false);assert.equal(evaluate(q,q.items.map(()=>-1)),false);}
 if(q.type==='order'){assert.equal(evaluate(q,q.items.map((_,i)=>i)),true);assert.equal(evaluate(q,q.items.map((_,i)=>i).reverse()),false);}
 if(q.type==='open'){assert.ok(q.rubric.length>=3&&q.model);assert.equal(evaluate(q,q.model),null);}}
});
test('Simulacro equilibrado, sin respuestas abiertas ni repeticiones',()=>{
 for(let i=0;i<20;i++){const ids=examQuestions();assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);assert.equal(new Set(ids.map(id=>questions.find(q=>q.id===id).missionId)).size,12);assert.ok(ids.every(id=>questions.find(q=>q.id===id).type!=='open'));}
});
const accessToken='a-private-test-token-123456789';
const valid={verdict:'partial',explanation:'Falta justificar la vista dinámica.',missing:['Mencionar mensajes o estados'],nextQuestion:'¿Cómo cambia el estado?'};
async function withServer(config,fn){const server=createTutorServer(config);await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(r=>server.close(r));}}
const payload={questionId:'mapa-4',mode:'grade',answer:'El modelo funcional indica las metas y el de objetos las relaciones.'};
const options=(body=payload,extra={})=>({method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${accessToken}`,...extra},body:JSON.stringify(body)});
test('Tutor falla de forma explícita sin credenciales',async()=>withServer({apiKey:'',accessToken:''},async base=>{const r=await fetch(base+'/api/tutor',options());assert.equal(r.status,503);}));
test('Tutor valida acceso, origen, entrada, archivos y contrato del proveedor',async()=>{
 let calls=0;
 await withServer({apiKey:'server-secret',accessToken,maxDaily:2,fetchImpl:async(url,opts)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const data=JSON.parse(opts.body);assert.equal(data.store,false);assert.equal(data.text.format.type,'json_schema');assert.ok(data.instructions.includes('modelo de análisis'));assert.equal(opts.headers.Authorization,'Bearer server-secret');return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(valid)}]}]});}},async base=>{
  assert.equal((await fetch(base+'/api/tutor',options(payload,{Authorization:'Bearer bad'}))).status,401);
  assert.equal((await fetch(base+'/api/tutor',options(payload,{Origin:'https://evil.example'}))).status,403);
  assert.equal((await fetch(base+'/api/tutor',options({...payload,questionId:'unknown'}))).status,400);
  assert.equal((await fetch(base+'/api/tutor',options({...payload,answer:'x'.repeat(3001)}))).status,400);
  assert.equal((await fetch(base+'/api/tutor',options({...payload,questionId:'mapa-1'}))).status,400);
  assert.equal((await fetch(base+'/estudio-analisis/tutor/server.mjs')).status,404);
  assert.equal((await fetch(base+'/.env')).status,404);
  const result=await fetch(base+'/api/tutor',options(payload,{Origin:'https://d4vdxh1.github.io'}));assert.equal(result.status,200);assert.equal(result.headers.get('access-control-allow-origin'),'https://d4vdxh1.github.io');assert.deepEqual(await result.json(),valid);
  assert.equal(calls,1);
  const explain=await fetch(base+'/api/tutor',options({...payload,questionId:'mapa-1',mode:'explain'}));assert.equal(explain.status,200);
  assert.equal((await fetch(base+'/api/tutor',options())).status,429);
  assert.equal(calls,2);
 });
});
test('Tutor no expone errores del proveedor ni acepta una devolución malformada',async()=>{
 await withServer({apiKey:'secret',accessToken,fetchImpl:async()=>Response.json({error:'secret data'},{status:500})},async base=>{const r=await fetch(base+'/api/tutor',options());assert.equal(r.status,502);assert.ok(!(await r.text()).includes('secret data'));});
 await withServer({apiKey:'secret',accessToken,fetchImpl:async()=>Response.json({output:[{content:[{type:'output_text',text:'{}'}]}]})},async base=>{assert.equal((await fetch(base+'/api/tutor',options())).status,502);});
});
