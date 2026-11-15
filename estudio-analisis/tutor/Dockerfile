FROM node:24-alpine
WORKDIR /app
COPY guia-interactiva-analisis-diseno.html ./
COPY estudio-analisis ./estudio-analisis
ENV PORT=8787
EXPOSE 8787
USER node
CMD ["node", "estudio-analisis/tutor/server.mjs"]
