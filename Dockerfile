# Composite Dockerfile for Sunoh Radio Scraper & API
FROM node:20-bookworm-slim

# Install system dependencies: Python, FFmpeg, and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy Python requirements if any (currently mostly standard lib)
# COPY requirements.txt .
# RUN pip3 install -r requirements.txt --break-system-packages

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN npx tsc

# Default environment variables
ENV NODE_ENV=production
ENV PATH="/usr/bin/python3:${PATH}"

# The container can be used for both scraping and the upcoming API
# Use an entrypoint script or pass commands via compose
CMD ["node", "dist/api/server.js"]
