# Base Node.js image optimized for production
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package installation files
COPY package.json package-lock.json ./

# Install dependencies cleanly
RUN npm ci

# Copy the rest of the frontend source code
COPY . .

# Build the Next.js production bundle
RUN npm run build

# Expose port 3000 to the container network
EXPOSE 3000

# Set the command to run Next.js in production mode
CMD ["npm", "start"]
