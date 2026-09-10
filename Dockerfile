FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src
COPY --chown=node:node knexfile.cjs ./
COPY --chown=node:node migrations ./migrations

USER node

EXPOSE 3000

CMD ["npm", "start"]