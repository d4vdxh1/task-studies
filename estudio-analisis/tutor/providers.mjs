// Adaptadores de servidor. Las credenciales nunca se incluyen en respuestas o logs.
export class ProviderError extends Error {
 constructor(message,code,status=502){super(message);this.name='ProviderError';this.code=code;this.status=status;}
}
function providerFailure(name,status,payload){
 const label=name==='gemini'?'Gemini':'OpenAI';
 const code=payload?.error?.code;
 if(status===429){
  if(name==='openai'){
   if(code==='credit_balance_exhausted')return new ProviderError('OpenAI no tiene créditos disponibles. Revisá Billing en la cuenta de la API.','provider_credit_balance',429);
   if(['organization_spend_limit_exceeded','project_spend_limit_exceeded'].includes(code))return new ProviderError('Se alcanzó el límite de gasto de OpenAI. Revisá los límites de tu organización o proyecto.','provider_spend_limit',429);
   if(code==='organization_usage_limit_exceeded')return new ProviderError('Se alcanzó la cuota de uso de tu organización de OpenAI. Revisá sus límites.','provider_usage_limit',429);
   if(code==='insufficient_quota'||(!code&&payload?.error?.type==='insufficient_quota'))return new ProviderError('OpenAI informa cuota insuficiente. Revisá los créditos y límites de la cuenta de la API; esperar no resuelve una cuota agotada.','provider_insufficient_quota',429);
  }
  return new ProviderError(name==='gemini'?'Gemini alcanzó una cuota o límite de solicitudes. Revisá el modelo y sus límites en Google AI Studio. Si es un límite temporal, esperá antes de volver a intentar.':'OpenAI alcanzó un límite de solicitudes o cuota. Revisá sus límites y esperá antes de reintentar si es temporal.','provider_limit',429);
 }
 if(status===401||status===403)return new ProviderError(`${label} rechazó la credencial o los permisos. Revisá ${name==='gemini'?'GEMINI_API_KEY y las restricciones de su proyecto':'OPENAI_API_KEY y sus permisos'} en Render.`,'provider_access');
 if(status===404)return new ProviderError(`El modelo configurado de ${label} no está disponible. Revisá ${name==='gemini'?'GEMINI_MODEL':'OPENAI_MODEL'} y el acceso de tu proyecto.`,'provider_model');
 if(status===400)return new ProviderError(`${label} rechazó la configuración de la solicitud. Revisá el modelo y su compatibilidad en el servidor.`,'provider_configuration');
 return new ProviderError(`No se pudo obtener la devolución de ${label}. Intentá de nuevo más tarde.`,'provider_unavailable');
}
export function createProvider(config={}){
 const env=config.env??process.env;
 const name=String(config.provider??env.AI_PROVIDER??'openai').trim().toLowerCase();
 const valid=['openai','gemini'].includes(name);
 const apiKey=name==='gemini'?(config.geminiApiKey??env.GEMINI_API_KEY):(config.apiKey??env.OPENAI_API_KEY);
 const model=name==='gemini'?(config.geminiModel??env.GEMINI_MODEL??'gemini-3.1-flash-lite'):(config.model??env.OPENAI_MODEL??'gpt-4.1-mini');
 const fetchImpl=config.fetchImpl??fetch;
 const configured=valid&&typeof apiKey==='string'&&apiKey.trim().length>0&&typeof model==='string'&&model.trim().length>0;
 return {
  name:valid?name:'invalid',model,configured,
  configurationError:valid?`Falta configurar ${name==='gemini'?'GEMINI_API_KEY':'OPENAI_API_KEY'} o el modelo en el servidor.`:'AI_PROVIDER debe ser openai o gemini.',
  async complete({instructions,input,schema,maxOutputTokens=700,validate}){
   if(!configured)throw new ProviderError('El proveedor no está configurado.','provider_not_configured',503);
   const gemini=name==='gemini';
   const url=gemini?'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions':'https://api.openai.com/v1/responses';
   const body=gemini?{
    model,messages:[{role:'system',content:instructions},{role:'user',content:input}],
    max_tokens:2048,reasoning_effort:'minimal',
    response_format:{type:'json_schema',json_schema:{name:'tutor_feedback',strict:true,schema}}
   }:{model,store:false,instructions,input,max_output_tokens:maxOutputTokens,text:{format:{type:'json_schema',name:'tutor_feedback',strict:true,schema}}};
   let response;try{
    response=await fetchImpl(url,{method:'POST',headers:{Authorization:`Bearer ${apiKey.trim()}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
   }catch{throw new ProviderError(`No se pudo comunicar con ${gemini?'Gemini':'OpenAI'} a tiempo. Podés volver a intentar; la práctica sin IA sigue disponible.`,'provider_connection');}
   let result;try{result=await response.json();}catch{if(!response.ok)throw providerFailure(name,response.status,null);throw new ProviderError('El proveedor devolvió una respuesta inválida. Volvé a intentar.','provider_invalid_response');}
   if(!response.ok)throw providerFailure(name,response.status,result);
   let text;
   if(gemini){
    const choice=result?.choices?.[0];
    if(choice?.finish_reason==='length')throw new ProviderError('Gemini alcanzó el límite de salida sin completar la devolución. Probá una respuesta más breve.','provider_incomplete');
    if(choice?.message?.refusal||choice?.finish_reason==='content_filter')throw new ProviderError('Gemini no pudo responder a ese contenido. Reformulá tu explicación sobre el tema de estudio.','provider_refusal');
    text=choice?.message?.content;
   }else{
    if(result?.status==='incomplete')throw new ProviderError('OpenAI no completó la devolución. Probá una respuesta más breve.','provider_incomplete');
    text=(Array.isArray(result?.output)?result.output:[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
   }
   let feedback;try{feedback=JSON.parse(text);}catch{throw new ProviderError('El tutor no pudo generar una devolución válida. Volvé a intentar.','provider_invalid_response');}
   if(validate)return validate(feedback);
   if(!feedback||!['correct','partial','incorrect'].includes(feedback.verdict)||typeof feedback.explanation!=='string'||!Array.isArray(feedback.missing)||!feedback.missing.every(x=>typeof x==='string')||typeof feedback.nextQuestion!=='string')throw new ProviderError('La devolución del tutor está incompleta.','provider_invalid_response');
   return {verdict:feedback.verdict,explanation:feedback.explanation,missing:feedback.missing,nextQuestion:feedback.nextQuestion};
  }
 };
}
