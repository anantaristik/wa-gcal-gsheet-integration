FROM node:18

# Install Chromium and necessary dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxrandr2 \
    libgbm-dev \
    libasound2 \
    libatk1.0-0 \
    libgtk-3-0 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use Chromium path
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Set working directory
WORKDIR /usr/src/app

# Copy application files
COPY . .

# Install application dependencies
RUN npm install

# Expose port (if needed)
EXPOSE 3000

# Run the application
CMD ["node", "src/lib/whatsapp.js"]

