# Build context: raíz del monorepo (ver docker-compose.yml)
# Motivo: workspaces npm + dependencia futura/actual de @lol-viewer/shared
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install --workspace=@lol-viewer/backend --workspace=@lol-viewer/shared

COPY shared ./shared
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

RUN npm run build --workspace=@lol-viewer/backend

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install --omit=dev --workspace=@lol-viewer/backend && npm cache clean --force

COPY --from=build /app/backend/dist ./backend/dist

WORKDIR /app/backend
EXPOSE 3001
USER node
CMD ["node", "dist/index.js"]
