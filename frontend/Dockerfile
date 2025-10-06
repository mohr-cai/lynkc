FROM node:20-alpine AS deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY frontend .
RUN npm run build

FROM nginx:1.25-alpine AS runner
WORKDIR /usr/share/nginx/html
ENV FRONTEND_INTERNAL_PORT=3000
COPY --from=builder /app/dist ./
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 3000
CMD ["/bin/sh", "-c", "envsubst '$$FRONTEND_INTERNAL_PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
