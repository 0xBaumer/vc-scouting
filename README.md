# TopG Alpha Bot 🔥

Un bot Telegram qui génère des citations motivationnelles aléatoires de personnalités inspirantes.

## 🚀 Fonctionnalités

Le bot répond aux commandes suivantes :

- `/start` - Affiche le message de bienvenue et la liste des commandes
- `/goggins` - Citations motivationnelles de David Goggins 💪
- `/trump` - Sagesse business de Donald Trump 🇺🇸  
- `/hormozi` - Insights business d'Alex Hormozi 💰
- `/tate` - Mentalité alpha d'Andrew Tate 👑
- `/musk` - Citations d'innovation d'Elon Musk 🚀

## 📋 Installation

1. Assurez-vous d'avoir Python 3.7+ installé
2. Installez les dépendances :
   ```bash
   pip3 install -r requirements.txt
   ```

## 🎯 Utilisation

### Lancer le bot
```bash
python3 telegram_bot.py
```

### Ou utiliser le script de démarrage
```bash
./start_bot.sh
```

### Arrêter le bot
Appuyez sur `Ctrl+C` dans le terminal

## 🤖 Bot Information

- **Nom du bot :** @TopGAlphaBot
- **Token :** 7836750010:AAE9iW2qLXLNxivMH3Yh_K2UbrxghW9cyBc
- **Chat ID de test :** 662447606

## 🔧 Configuration

Le bot est configuré pour :
- ✅ Permettre à tout le monde d'utiliser les commandes (pas seulement l'admin)
- ✅ Répondre avec des citations aléatoires à chaque utilisation
- ✅ Gérer les erreurs de connexion automatiquement
- ✅ Fonctionner en continu (polling)

## 📝 Structure du Code

- `telegram_bot.py` - Script principal du bot
- `requirements.txt` - Dépendances Python
- `start_bot.sh` - Script de démarrage
- `README.md` - Cette documentation

## 🎲 Citations Disponibles

- **David Goggins :** 25 citations motivationnelles sur la discipline et la persévérance
- **Donald Trump :** 25 citations sur le business et le succès
- **Alex Hormozi :** 25 insights sur l'entrepreneuriat et la productivité
- **Andrew Tate :** 50 citations sur la mentalité alpha et le succès
- **Elon Musk :** 25 citations sur l'innovation et la vision

## 💡 Exemple d'utilisation

1. Ouvrez Telegram
2. Recherchez `@TopGAlphaBot`
3. Tapez `/start` pour commencer
4. Utilisez `/goggins` pour une citation motivationnelle
5. Le bot répondra avec une citation aléatoire !

## 🚀 Déploiement sur Railway (24/7)

Pour faire fonctionner le bot 24/7 même quand votre ordinateur est éteint :

### 1. Créer un compte Railway
1. Allez sur [railway.app](https://railway.app)
2. Connectez-vous avec GitHub

### 2. Déployer depuis GitHub
1. Poussez ce code sur GitHub
2. Sur Railway : **New Project** → **Deploy from GitHub repo**
3. Sélectionnez ce repository

### 3. Configurer les variables d'environnement
Dans Railway, ajoutez :
- `BOT_TOKEN` = `7836750010:AAE9iW2qLXLNxivMH3Yh_K2UbrxghW9cyBc`

### 4. Le bot se déploie automatiquement ! 🎉

## 🔧 Alternatives de déploiement

- **Railway** (Recommandé) - Gratuit jusqu'à 500h/mois
- **Heroku** - Plan gratuit disponible 
- **Render** - Alternative gratuite
- **VPS** (DigitalOcean, Linode) - Plus technique mais plus de contrôle

## ⚡ Conseils

- Le bot fonctionne 24/7 tant que le script est en cours d'exécution
- Chaque commande retourne une citation différente aléatoirement
- Le bot peut gérer plusieurs utilisateurs simultanément
- Les logs s'affichent dans le terminal pour le débogage

---

**Stay hard! 💪**
