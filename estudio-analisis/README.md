# Modo práctica: análisis y diseño

La entrada pública sigue siendo `../guia-interactiva-analisis-diseno.html`. La guía anterior se conserva íntegra en `apunte-original.html`, con su clave de progreso anterior sin modificar. No se modifican las demás páginas del repositorio.

## Qué incluye

- 12 misiones abiertas, con idea breve, ejemplo y esquema visual.
- Ejercicios de selección, clasificación y ordenación, con corrección preparada y explicación.
- Una respuesta abierta por misión: borrador automático, criterios de autoevaluación y respuesta posible. No se califica por palabras clave.
- Práctica rápida de 8 ejercicios, priorizando los no resueltos; simulacro equilibrado de 12 ejercicios, uno por misión, con devolución al final.
- Repaso de errores del último intento. Un acierto posterior retira el ejercicio de esa lista.
- Progreso por desafíos cerrados únicos resueltos, 10 puntos por cada uno. Repetir no duplica puntos. Una pista queda indicada en el resultado. El avance indica práctica completada, no certifica dominio académico.
- Guardado local, reanudación de sesión, exportación/importación validada y borrado con confirmación. El progreso es local al navegador; no hay cuentas ni sincronización automática.
- Teclado, foco visible, etiquetas de controles, mensajes con texto y reducción de movimiento.

## Probar

Se requiere Node 22 o posterior; no hay dependencias de aplicación.

```sh
node estudio-analisis/tutor/server.mjs
```

Abrir `http://localhost:8787`. Los módulos requieren HTTP: no abrir el HTML directamente con `file://`.

```sh
cd estudio-analisis
npm install
npm test
```

## Tutor opcional: Gemini u OpenAI

El juego funciona sin API. El servidor agrega corrección de respuestas abiertas y explicaciones personalizadas por ejercicio. Admite OpenAI Responses y Gemini mediante la API de compatibilidad de Google; no usa dependencias adicionales ni cambia el contrato de la guía. No puede activarse en GitHub Pages porque necesita ejecutar código en el servidor.

1. Desplegar `estudio-analisis/tutor/server.mjs` en un servicio con Node 22+ y HTTPS. También se puede construir un contenedor desde la raíz del repositorio:

   ```sh
   docker build -f estudio-analisis/tutor/Dockerfile -t tutor-analisis .
   ```

2. Configurar secretos en el proveedor del servidor, nunca en HTML, archivos públicos, commits o conversaciones:

   | Variable | Uso |
   | --- | --- |
   | `AI_PROVIDER` | `gemini` para Google o `openai` para OpenAI; predeterminado `openai` |
   | `GEMINI_API_KEY` | Credencial de Google AI Studio, solo en servidor y solo para Gemini |
   | `GEMINI_MODEL` | Opcional; predeterminado `gemini-3.1-flash-lite` |
   | `OPENAI_API_KEY` | Credencial de OpenAI, solo en servidor y solo para OpenAI |
   | `TUTOR_ACCESS_TOKEN` | Código privado y aleatorio del tutor, mínimo 20 caracteres |
   | `OPENAI_MODEL` | Opcional; por defecto `gpt-4.1-mini`, configurable según disponibilidad |
   | `ALLOWED_ORIGINS` | Orígenes exactos separados por coma; predeterminado `https://d4vdxh1.github.io` |
   | `MAX_DAILY_REQUESTS` | Límite de solicitudes por proceso y día UTC; predeterminado 100 |
   | `PORT` | Puerto del servicio; predeterminado 8787 |

3. En ⚙ de la guía, ingresar la dirección `https://tu-servidor/api/tutor` y el **código del tutor**, nunca la clave de Gemini ni de OpenAI. El código se mantiene solo en sessionStorage. Para uso local, agregar `http://localhost:8787` a `ALLOWED_ORIGINS`.
4. Abrir una misión y probar una explicación escrita. `/health` informa el proveedor y modelo seleccionados y si están configurados la clave y un código de acceso válido, sin revelar secretos; no valida saldo ni acceso al modelo. Si cambiás proveedor, tu dirección `/api/tutor` y el código `TUTOR_ACCESS_TOKEN` se conservan.

El endpoint verifica autorización, origen, tamaño, ejercicio y modo; limita solicitudes, llamadas simultáneas y salida. Envía solo la referencia de la misión y el texto ingresado al proveedor seleccionado. OpenAI usa Responses API con `store:false`; Gemini usa Chat Completions de compatibilidad de Google con esquema JSON y razonamiento mínimo. Ambos adaptadores validan el mismo resultado. No hay fallback automático: un error de Gemini nunca dispara una llamada facturable a OpenAI. No envía el historial de progreso ni usa el material del cliente como instrucciones confiables. El resultado de IA es orientativo y no altera los puntos de los ejercicios cerrados.

Los límites en memoria se reinician con el proceso y no se comparten entre réplicas. Para uso público multiusuario, usar autenticación por usuario y un contador persistente; el código compartido es apropiado para uso personal. No publicar el código de acceso en el sitio. Mantener una sola instancia para el límite local previsto. CORS por sí solo no es autenticación. La cuota de solicitudes no es un presupuesto monetario del proveedor: revisar el uso de la cuenta por separado.

La integración está preparada, pero requiere un servidor, clave válida y acceso al modelo para funcionar. Las pruebas del repositorio usan un proveedor simulado; no demuestran una llamada real facturable.

### Activar Gemini en el Render existente

En Environment de tu Web Service `task-studies`, agregá:

```text
AI_PROVIDER=gemini
GEMINI_MODEL=gemini-3.1-flash-lite
```

Agregá `GEMINI_API_KEY` como secreto con tu propia clave de Google AI Studio: https://aistudio.google.com/apikey . Conservá `TUTOR_ACCESS_TOKEN` y `ALLOWED_ORIGINS=https://d4vdxh1.github.io`. `OPENAI_API_KEY` puede quedar configurada: no se usa cuando elegís Gemini. Guardá los cambios y esperá el nuevo despliegue. El Start Command sigue siendo `node estudio-analisis/tutor/server.mjs`.

En `https://task-studies.onrender.com/health` deben aparecer `provider: "gemini"`, `model: "gemini-3.1-flash-lite"` y `tutorConfigured: true`. Después probá un ejercicio escrito desde la guía, con el mismo endpoint `https://task-studies.onrender.com/api/tutor` y tu código privado del tutor. Esa devolución confirma el acceso real al modelo; salud solo valida configuración local.

Gemini 3.1 Flash-Lite figura con capa gratuita limitada en la documentación consultada; la cuota efectiva depende del proyecto y se consulta en Google AI Studio. El uso gratuito puede utilizarse para mejorar los productos de Google: no ingreses datos privados que no quieras enviar al proveedor. Ante 429 se explica que hay que revisar cuota/modelo/límites; no se asume falta de saldo. OpenAI distingue créditos agotados, cuota insuficiente, límite de gasto y límite de solicitudes cuando su código de error lo permite. Las respuestas crudas de los proveedores no se devuelven ni se registran.

Las pruebas automatizadas usan respuestas simuladas para ambos proveedores. Hace falta una clave propia para comprobar una consulta real a Gemini; no se usó una clave de Google para esta modificación.

Documentación oficial consultada:
- https://ai.google.dev/gemini-api/docs/openai
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/pricing

- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/guides/api-keys
- https://developers.openai.com/api/docs/models/gpt-4.1-mini

## Cobertura y fuentes

`curriculum.mjs` deriva los ejercicios del apunte original, que cita Bruegge y Dutoit, capítulos 5, 6 y 7. Incluye vistas del análisis; entidad/frontera/control; asociaciones, multiplicidad, calificadores y generalización; secuencia y estados; administración del análisis; subsistemas, acoplamiento y coherencia; capas, particiones, estilos y despliegue; persistencia, claves y concurrencia; actividades, acceso y fronteras del diseño del sistema; objetos de aplicación/solución; firmas, tipos, visibilidad y rutas de acceso; contratos, OCL, simplificación, reutilización y caché; GUI y conexión conceptual con entregables TPF.

GUI sigue siendo una síntesis pendiente de contraste con Libro 4 y diapositivas. Los ejemplos de tickets no afirman requisitos vigentes de SITRA. Los PDFs originales no se volvieron a verificar para esta versión. La copia del apunte original permite consultar las explicaciones extensas y los detalles que cada ejercicio resume.

## Decisiones

- Se conserva la guía extensa; la entrada principal cambia a práctica.
- Sin dependencias de ejecución ni una base de datos para empezar a estudiar.
- No hay bloqueo de misiones, pérdida de vidas ni penalización por equivocarse.
- Respuestas cerradas deterministas; autoevaluación abierta explícita; IA opcional, con criterios de referencia.
- Simulacro sin pistas ni corrección inmediata hasta el resultado, separado de la práctica guiada.
