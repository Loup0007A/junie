# ── Build stage: React frontend ───────────────────────────
FROM node:18-alpine AS client-build

WORKDIR /build/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps --silent

COPY client/ ./
# Production API/socket URL = same origin (server serves the built client)
ENV REACT_APP_API_URL=""
ENV REACT_APP_SOCKET_URL=""
RUN npm run build

# ── Production stage ───────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Server dependencies
COPY server/package*.json ./server/
RUN cd server && npm install --production --silent

# Copy server source
COPY server/ ./server/

# Copy built React app into server's static folder
COPY --from=client-build /build/client/build ./client/build

# Data directories (mounted as volumes in production)
RUN mkdir -p server/data server/uploads

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

CMD ["node", "server/index.js"]
