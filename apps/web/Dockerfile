FROM node:24-alpine AS build
WORKDIR /app
COPY packages packages
COPY apps/web/package*.json apps/web/
WORKDIR /app/apps/web
RUN npm ci --include=optional
COPY apps/web .
RUN npm run build

FROM nginx:1.29-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/ >/dev/null || exit 1
