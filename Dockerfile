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

# Installer Playwright browsers
RUN bun install playwright
RUN bunx playwright install chromium

# Exposer le port (Railway l'assigne automatiquement)
EXPOSE $PORT

# Commande de démarrage Railway
CMD ["bun", "run", "railway-start.js"]
