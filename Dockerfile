# Build
FROM node:20.11.0-alpine3.19 AS base
ENV NODE_ENV production
WORKDIR /opt/app
COPY package*.json ./
RUN npm i --omit=dev
COPY . ./
RUN npm run build

# Run
FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /opt/app
COPY --from=base /dist ./
USER nonroot
ENTRYPOINT ["npm"]
CMD ["start"]
