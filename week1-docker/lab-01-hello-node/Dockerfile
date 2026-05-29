# Start from the official Node.js 20 LTS image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json first (for layer caching benefit)
COPY package.json ./

# We have no dependencies yet, but this is where npm install would go
# RUN npm install

# Copy the rest of the source code
COPY server.js ./

# Document that the container listens on port 3000
EXPOSE 3000

# Command to run when the container starts
CMD ["node", "server.js"]
