FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PGLITE_DATA_DIR=/data/pglite
VOLUME ["/data/pglite"]
EXPOSE 3000
CMD ["npm", "start"]
