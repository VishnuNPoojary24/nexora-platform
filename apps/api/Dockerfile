FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY packages packages
RUN npm ci
COPY apps/api apps/api
COPY database database
RUN npm run build --workspace=apps/api

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY apps/api/package*.json apps/api/
RUN npm ci --omit=dev --workspace=apps/api
COPY --from=build /app/apps/api/dist apps/api/dist
COPY database database
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/api"]
