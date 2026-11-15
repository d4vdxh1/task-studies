import test from 'node:test';
import assert from 'node:assert/strict';
import {createProvider,ProviderError} from '../tutor/providers.mjs';
import {createTutorServer} from '../tutor/server.mjs';
const schema={type:'object'},valid={verdict:'correct',explanation:'Distinguís metas, conceptos e interacciones.',missing:[],nextQuestion:'¿Qué diagrama muestra los mensajes?'};
const input={instructions:'Criterios del tutor.',input:JSON.stringify({mode:'grade',studentText:'La vista funcional muestra la meta del alumno.'}),schema};
const gemini=(fetchImpl,extra={})=>createProvider({env:{},provider:'gemini',geminiApiKey:'private-gemini-key',fetchImpl,...extra});
const completion=(content=JSON.stringify(valid),finish_reason='stop')=>Response.json({choices:[{finish_reason,message:{content}}]});
test('Gemini envía la clave solo al servidor de Google y conserva el contrato de la guía',async()=>{
 const provider=gemini(async(url,opts)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');assert.equal(opts.headers.Authorization,'Bearer private-gemini-key');const body=JSON.parse(opts.body);assert.equal(body.model,'gemini-3.1-flash-lite');assert.deepEqual(body.messages,[{role:'system',content:input.instructions},{role:'user',content:input.input}]);assert.deepEqual(body.response_format.json_schema.schema,schema);assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.max_tokens,2048);assert.equal(body.reasoning_effort,'minimal');assert.equal(body.instructions,undefined);return completion();});
 assert.equal(provider.configured,true);assert.deepEqual(await provider.complete(input),valid);
});
test('Proveedor y modelo se eligen explícitamente; no hay fallback con gasto en otro proveedor',async()=>{
 const p=createProvider({env:{AI_PROVIDER:'gemini',GEMINI_API_KEY:'google',GEMINI_MODEL:'chosen-model',OPENAI_API_KEY:'openai',OPENAI_MODEL:'wrong-model'}});assert.equal(p.name,'gemini');assert.equal(p.model,'chosen-model');assert.equal(p.configured,true);
 assert.equal(createProvider({env:{OPENAI_API_KEY:'key'}}).name,'openai');
 assert.equal(createProvider({env:{AI_PROVIDER:'gemini',OPENAI_API_KEY:'key'}}).configured,false);
 assert.equal(createProvider({env:{AI_PROVIDER:'unsupported',GEMINI_API_KEY:'key'}}).configured,false);
 let calls=0;const rejected=gemini(async()=>{calls++;return Response.json({error:{code:429,status:'RESOURCE_EXHAUSTED',message:'secret internals'}},{status:429});});await assert.rejects(rejected.complete(input),e=>e instanceof ProviderError&&e.status===429&&e.message.includes('Gemini')&&!e.message.includes('secret'));assert.equal(calls,1);
});
test('Errores del proveedor son accionables sin exponer su respuesta interna',async()=>{
 for(const [status,code,expected] of [[429,'insufficient_quota','provider_insufficient_quota'],[429,'credit_balance_exhausted','provider_credit_balance'],[429,'project_spend_limit_exceeded','provider_spend_limit'],[429,'organization_usage_limit_exceeded','provider_usage_limit'],[429,'rate_limit_exceeded','provider_limit'],[401,'invalid_api_key','provider_access'],[404,'model_not_found','provider_model'],[400,'bad_request','provider_configuration'],[500,'server_error','provider_unavailable']]){
  const p=createProvider({env:{},apiKey:'private',fetchImpl:async()=>Response.json({error:{code,message:'secret full upstream payload'}},{status})});await assert.rejects(p.complete(input),e=>e.code===expected&&!e.message.includes('secret'));
 }
});
test('Gemini no califica respuestas truncadas, bloqueadas o JSON incompleto',async()=>{
 for(const [response,expected] of [[()=>completion('{}','length'),'provider_incomplete'],[()=>completion('{}','content_filter'),'provider_refusal'],[()=>completion('not JSON'),'provider_invalid_response'],[()=>completion('{}'),'provider_invalid_response'],[()=>completion('null'),'provider_invalid_response'],[()=>completion(JSON.stringify({...valid,missing:[42]})),'provider_invalid_response']])await assert.rejects(gemini(async()=>response()).complete(input),e=>e.code===expected);
 await assert.rejects(gemini(async()=>{throw new Error('private network data');}).complete(input),e=>e.code==='provider_connection'&&!e.message.includes('private'));
});
test('Mismo endpoint: salud, CORS, corrección y explicación con Gemini',async()=>{
 const accessToken='private-access-code-for-test';let calls=0;
 const server=createTutorServer({env:{},provider:'gemini',geminiApiKey:'private-key',accessToken,fetchImpl:async()=>{calls++;return completion();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const health=await (await fetch(base+'/health')).json();assert.deepEqual(health,{ok:true,tutorConfigured:true,provider:'gemini',model:'gemini-3.1-flash-lite'});assert.ok(!JSON.stringify(health).includes('private'));
  for(const mode of ['grade','explain']){const r=await fetch(base+'/api/tutor',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`,Origin:'https://d4vdxh1.github.io'},body:JSON.stringify({questionId:mode==='grade'?'mapa-4':'mapa-1',mode,answer:'La vista funcional muestra metas de los actores.'})});assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'https://d4vdxh1.github.io');assert.deepEqual(await r.json(),valid);}
  assert.equal(calls,2);
 }finally{await new Promise(r=>server.close(r));}
});
