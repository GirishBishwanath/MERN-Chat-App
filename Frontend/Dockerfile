FROM node:24.14.1-alpine3.23 AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chown -R node:node /app

FROM base AS development

ENV NODE_ENV=development
USER node
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--strictPort"]

FROM base AS build

ARG VITE_BACKEND_URL=http://localhost:4002
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

FROM nginx:1.29.8-alpine3.23 AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget --spider --quiet http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
