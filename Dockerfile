FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:ui
# App đọc process.env.PORT (Cloud Run cấp PORT=8080; docker-compose đặt 3007)
EXPOSE 3007
CMD ["node", "server/index.js"]
