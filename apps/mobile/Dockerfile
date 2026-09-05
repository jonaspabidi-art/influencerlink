# Bygger webbversionen av appen och serverar den som statiska filer.
# Körs som en egen tjänst bredvid API:et.

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --workspace @pacta/mobile --workspace @pacta/shared --include-workspace-root

COPY packages/shared packages/shared
COPY apps/mobile apps/mobile

# API-adressen bakas in i bundlen vid bygget, inte vid start. Därför ARG –
# utan den kör appen i demoläge mot sin inbyggda backend.
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

RUN npm run build -w @pacta/shared \
  && npm run export:web -w @pacta/mobile

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve@14

COPY --from=build /app/apps/mobile/dist ./dist

EXPOSE 3000
# -s serverar allt som index.html, vilket expo-router kräver för sina vägar.
CMD ["sh", "-c", "serve dist -s -l ${PORT:-3000}"]
