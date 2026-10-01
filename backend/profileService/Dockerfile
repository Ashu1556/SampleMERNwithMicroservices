FROM node:24-alpine
ENV NODE_ENV=production PORT=3002
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY index.js ./
USER node
EXPOSE 3002
CMD ["node", "index.js"]
