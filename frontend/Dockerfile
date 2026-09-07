# Multi-stage: build Vite → servir con nginx (proxy /api → api:3001)
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY index.html ./
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY src ./src

# Mismo origen vía nginx: el browser llama /api sin host externo
ENV VITE_API_URL=

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
