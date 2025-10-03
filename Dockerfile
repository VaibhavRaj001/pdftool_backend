# Use Node.js 20 base image
FROM node:20

# Install Ghostscript and Poppler (required for compress & convert)
RUN apt-get update && \
    apt-get install -y ghostscript poppler-utils && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy all backend files
COPY . .

# Expose port Railway uses (default 5000)
EXPOSE 5000

# Start the backend
CMD ["node", "server.js"]
