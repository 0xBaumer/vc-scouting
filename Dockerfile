# Utiliser l'image officielle Bun
FROM oven/bun:1

# Définir le répertoire de travail
WORKDIR /app

# Copier package.json et bun.lock
COPY package.json bun.lock* ./

# Installer les dépendances
RUN bun install --frozen-lockfile

# Copier le reste des fichiers
COPY . .

# Pas de Playwright nécessaire pour sites statiques

# Exposer le port (Railway l'assigne automatiquement)
EXPOSE $PORT

# Commande de démarrage Railway (Bot + Auto Scraper)
CMD ["bun", "run", "railway-full.js"]
