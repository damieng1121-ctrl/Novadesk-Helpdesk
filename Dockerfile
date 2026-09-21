# Single-stage-ish build: optimizes for a reliable `docker compose up` and a
# straightforward Cloud Run deploy over the smallest possible image. Once the
# app is stable, this can be split into a multi-stage build using Next's
# `output: "standalone"` trace to shrink the final image.

FROM node:22-alpine AS app
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
# No ENV PORT here on purpose — Cloud Run injects its own PORT at container
# start (8080 by default) and the "start" script (package.json) now honors
# it via `next start -p ${PORT:-3000}`. Baking a fixed PORT into the image
# previously masked the fact that `next start` was silently ignoring it.

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
