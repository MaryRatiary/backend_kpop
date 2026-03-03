FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY src ./src

# Exposition du port
EXPOSE 5000

# Commande de démarrage
CMD ["npm", "start"]
