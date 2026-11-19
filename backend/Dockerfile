# --- Build ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx nest build

# --- Runtime ---
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# prisma (CLI) est une devDependency : on l'installe à part pour `migrate deploy` au démarrage.
COPY prisma ./prisma
RUN npm i --no-save prisma@6 && npx prisma generate
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# Applique les migrations puis démarre l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && node --import ./dist/instrument.js dist/main.js"]
