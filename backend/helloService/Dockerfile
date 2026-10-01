FROM node:24-alpine
ENV NODE_ENV=production PORT=3001
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY index.js ./
USER node
EXPOSE 3001
CMD ["node", "index.js"]
