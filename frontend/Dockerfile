# Build context: raíz del monorepo (ver docker-compose.yml)
# Motivo: @lol-viewer/frontend depende de @lol-viewer/shared (workspace)
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN npm install --workspace=@lol-viewer/frontend --workspace=@lol-viewer/shared

COPY shared ./shared
COPY frontend/index.html ./frontend/
COPY frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts ./frontend/
COPY frontend/src ./frontend/src

# Mismo origen vía nginx: el browser llama /api sin host externo
ENV VITE_API_URL=

RUN npm run build --workspace=@lol-viewer/frontend

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
