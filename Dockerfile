FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy source
COPY server ./server

# Runtime data volume (mounted by docker-compose)
VOLUME ["/app/server/data"]

EXPOSE 3000

CMD ["node", "server/index.js"]
