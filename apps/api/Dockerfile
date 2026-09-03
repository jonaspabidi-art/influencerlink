# Bygg-steg: installerar allt och kompilerar TypeScript.
FROM node:22-slim AS build
WORKDIR /app

# OpenSSL krävs av Prismas frågemotor.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @influencerlink/api --workspace @influencerlink/shared --include-workspace-root

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @influencerlink/shared \
  && npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build -w @influencerlink/api

# Kör-steg: bara det som behövs för att starta servern.
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/prisma apps/api/prisma

EXPOSE 3000
# Migrationerna körs vid start så att en ny deploy alltid matchar schemat.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/server.js"]
