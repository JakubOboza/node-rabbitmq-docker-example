FROM node:12.4-alpine

WORKDIR /app

COPY ./package.json ./
RUN npm install

COPY ./ ./

CMD ["node", "app.js"]
