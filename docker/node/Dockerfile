FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY app/package*.json ./

# Install production dependencies
RUN npm install

# Copy application source code
COPY app/ ./

# Create telemetry log directory
RUN mkdir -p /opt/admin/logs

ENV PORT=8080
ENV HOST=0.0.0.0
ENV LOG_DIR=/opt/admin/logs

EXPOSE 8080

CMD ["node", "src/server.js"]
