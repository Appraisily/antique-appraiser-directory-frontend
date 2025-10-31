# --- Build stage -----------------------------------------------------------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install dependencies first to leverage cached layers
COPY package*.json ./
RUN npm install

# Copy source and build the static site
COPY . .
RUN npm run build && npm run fix:asset-paths

# --- Runtime stage ---------------------------------------------------------
FROM nginx:stable-alpine AS runner

ENV PORT=8080

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
