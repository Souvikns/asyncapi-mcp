FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["mcp-proxy", "--", "node", "--import", "tsx/esm", "stdio.ts"]