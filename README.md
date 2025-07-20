# LegendaryBot - VC Portfolio Scraper (Railway)

Ce dossier contient tous les fichiers nécessaires pour le bot Telegram LEGENDARY qui tourne sur Railway et scrape automatiquement les portfolios de VCs.

## Fichiers inclus

- `telegram_bot.js` - Le bot Telegram LEGENDARY (pour Railway)
- `vc-portfolio-scraper.ts` - Le scraper de portfolios VC
- `.env` - Variables d'environnement
- `package.json` - Dépendances du projet

## Commandes disponibles

- `/start` - Message de bienvenue
- `/help` - Afficher l'aide
- `/legendary_source` - Lancer le scraping LEGENDARY
- `/legendary_status` - Vérifier le statut du bot LEGENDARY

## Fonctionnalités

- ✅ Scraping automatique toutes les 2 heures
- ✅ Scraping manuel à la demande
- ✅ Notifications Telegram des nouveaux projets trouvés
- ✅ Support de deux méthodes de scraping : statique (Axios + Cheerio) et dynamique (Playwright)

## Déploiement sur Railway

1. Créer un nouveau projet Railway
2. Connecter ce repository
3. Définir les variables d'environnement :
   - `TELEGRAM_BOT_TOKEN` - Token du bot Telegram
   - `TELEGRAM_CHAT_ID` - ID du chat pour les notifications
4. Railway déploiera automatiquement le bot

## Variables d'environnement requises

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Installation locale (pour tests)

```bash
cd LegendaryBot
bun install
bun run telegram_bot.js
```
