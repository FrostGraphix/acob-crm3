FROM node:22-alpine AS build

WORKDIR /app

COPY backend/package*.json ./backend/
COPY common ./common
COPY backend ./backend

WORKDIR /app/backend
RUN npm ci
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=build /app/backend/package*.json ./backend/
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist

WORKDIR /app/backend
EXPOSE 3000

CMD ["node", "dist/backend/src/index.js"]
