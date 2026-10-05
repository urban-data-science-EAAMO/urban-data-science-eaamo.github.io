FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM nginx:mainline-alpine-slim
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
