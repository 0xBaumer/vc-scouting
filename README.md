# 🚀 VC Portfolio Scraper

Scraper automatique des portfolios des fonds de Venture Capital avec notifications Telegram.

## 📊 Fonctionnalités

- **21 sites VC scrapés** automatiquement
- **853+ projets** surveillés en continu
- **Notifications Telegram** en temps réel
- **GitHub Actions** pour automatisation (tous les jours à 11h Paris)
- **Détection intelligente** des nouveaux deals

## 🎯 Sites surveillés

### Sites statiques :
- Haun Ventures, HashKey Capital, Greenfield, Fabric VC
- Dewhales, MH Ventures, Multicoin Capital, Wintermute
- Alliance DAO, GM Capital, Shima Capital, etc.

### Sites dynamiques :
- Framework Ventures, Delphi Digital, Pantera Capital
- Paradigm, Sequoia Capital, a16z Crypto
- 6thMan Ventures, Bankless Ventures, etc.

## ⚙️ Configuration

### Variables d'environnement requises :
```
TELEGRAM_BOT_TOKEN=votre_token_bot
TELEGRAM_CHAT_ID=votre_chat_id
```

### Installation locale :
```bash
bun install
bun run vc-portfolio-scraper.ts
```

## 🤖 Utilisation avec bot Telegram

Commandes disponibles :
- `/source` - Lance le scraping VC
- `/status` - Vérifie le statut du scraper
- `/help` - Affiche l'aide

## 📈 Automatisation GitHub Actions

Le scraper s'exécute automatiquement :
- **Tous les jours à 9h UTC (11h Paris)**
- **Déclenchement manuel** possible via l'interface GitHub

## 📁 Structure du projet

```
├── vc-portfolio-scraper.ts    # Script principal de scraping
├── telegram_bot.js            # Bot Telegram
├── package.json              # Dépendances
├── vc_portfolio_data.txt     # Base de données des projets
└── .github/workflows/        # Automatisation GitHub Actions
```

## 🔧 Technologies utilisées

- **Runtime** : Bun
- **Scraping** : Axios + Cheerio (statique) + Playwright (dynamique)
- **Notifications** : Telegram Bot API
- **Automatisation** : GitHub Actions

## 📱 Notifications

Recevez des notifications Telegram pour :
- ✅ Nouveaux deals détectés
- 📊 Résumé quotidien du scraping
- ⚠️ Erreurs et alertes

---

**Développé pour un sourcing efficace des deals VC** 🎯
