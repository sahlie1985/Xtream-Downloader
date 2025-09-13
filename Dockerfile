# Simple production image for Xtream Viewer
FROM node:20-alpine AS base

WORKDIR /app

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy app source
COPY server ./server
COPY public ./public

# Environment
ENV NODE_ENV=production
ENV PORT=5173

EXPOSE 5173

# Run the server
CMD ["node", "server/index.js"]

