FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Définir NODE_ENV
ENV NODE_ENV=production

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances de production uniquement
RUN npm ci --only=production && \
    npm cache clean --force

# Copier le code source
COPY src ./src
COPY migrations ./migrations

# Port d'exposition
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Commande de démarrage
CMD ["npm", "start"]
