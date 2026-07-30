# ETAPA 1: Construcción (Usando Node 22)
FROM node:22-alpine as build
WORKDIR /app

ENV NG_CLI_ANALYTICS=false
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm install

COPY . .

RUN npx ng build --configuration production --progress=false

# ETAPA 2: Servidor
FROM nginx:alpine

# 1. Copiamos los archivos de Angular
COPY --from=build /app/dist/FrontAdminProyectos/browser /usr/share/nginx/html

# 2. Copiamos tu nueva configuración de Nginx para arreglar el error 404
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]