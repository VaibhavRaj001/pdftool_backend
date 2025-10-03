# Use official Node.js 20 image as base
FROM node:20

# Install Ghostscript and Poppler (required for compress & convert)
RUN apt-get update && \
    apt-get install -y ghostscript poppler-utils && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy all backend source files
COPY . .

# Expose port 5000 (must match your Express server)
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
