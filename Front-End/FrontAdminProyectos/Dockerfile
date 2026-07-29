# ETAPA 1: Construcción
FROM node:22-alpine as build
WORKDIR /app

# 1. Evitar que Angular haga preguntas interactivas en la terminal
ENV NG_CLI_ANALYTICS=false
# 2. Darle hasta 4GB de memoria a Node para evitar que se asfixie al compilar
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm install

COPY . .

# 3. Compilar en silencio (sin barra de progreso que a veces rompe los logs de Alpine)
RUN npx ng build --configuration production --progress=false

# ETAPA 2: Servidor
FROM nginx:alpine
COPY --from=build /app/dist/FrontAdminProyectos/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]