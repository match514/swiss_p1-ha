FROM node:20-alpine

RUN apk add --no-cache bash jq git

WORKDIR /app

RUN git clone --depth 1 https://github.com/athombv/node-dsmr-parser.git /tmp/dsmr-parser \
    && cd /tmp/dsmr-parser \
    && npm install \
    && npm run build \
    && mkdir -p /app/vendor/dsmr-parser \
    && cp -r /tmp/dsmr-parser/dist /app/vendor/dsmr-parser/dist \
    && cp /tmp/dsmr-parser/package.json /app/vendor/dsmr-parser/package.json \
    && rm -rf /tmp/dsmr-parser

COPY package.json .
RUN npm install --omit=dev

COPY homey-energy-dongle-mqtt.js .
COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
