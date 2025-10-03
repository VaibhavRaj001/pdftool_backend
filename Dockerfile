# Use official Node.js 20 image (Debian Linux)
FROM node:20-bullseye

# Install Linux Ghostscript and Poppler utils
RUN apt-get update && \
    apt-get install -y ghostscript poppler-utils && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
