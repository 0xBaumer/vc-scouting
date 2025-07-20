#!/usr/bin/env bun

// Railway Full Service - Bot Telegram + Scraping automatique 24/7
import { spawn } from 'child_process';

console.log('🚀 Railway Full VC Service starting...');
console.log('📦 Launching Telegram Bot + Auto Scraping');

// Lancer le bot Telegram
const telegramBot = spawn('bun', ['run', 'telegram-bot-railway.js'], {
  stdio: 'inherit'
});

telegramBot.on('error', (error) => {
  console.error('❌ Telegram bot error:', error);
});

telegramBot.on('close', (code) => {
  console.error(`❌ Telegram bot exited with code ${code}`);
  // Redémarrer le bot automatiquement
  setTimeout(() => {
    console.log('🔄 Restarting Telegram bot...');
    spawn('bun', ['run', 'telegram-bot-railway.js'], { stdio: 'inherit' });
  }, 5000);
});

// Fonction pour lancer le scraping automatique
function runAutoScraper() {
  console.log(`\n📅 [${new Date().toLocaleString()}] Auto-scraping started...`);
  
  const scraper = spawn('bun', ['run', 'vc-portfolio-scraper-railway.ts'], {
    stdio: 'inherit'
  });
  
  scraper.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Auto-scraping completed successfully');
    } else {
      console.error(`❌ Auto-scraping failed with code ${code}`);
    }
    console.log('⏱️ Next auto-scraping in 2 hours...\n');
  });
  
  scraper.on('error', (error) => {
    console.error('❌ Error starting auto-scraper:', error);
  });
}

// Première exécution du scraping après 30 secondes (laisser le bot démarrer)
setTimeout(() => {
  console.log('🎯 Starting initial auto-scraping...');
  runAutoScraper();
}, 30000);

// Puis toutes les 2 heures
setInterval(runAutoScraper, 2 * 60 * 60 * 1000);

console.log('✅ Railway services initialized!');
console.log('🤖 Telegram Bot: Running 24/7');
console.log('⏰ Auto Scraper: Every 2 hours');
console.log('📱 Both services active - Mac can be turned off!');

// Garder le processus principal en vie
process.on('SIGTERM', () => {
  console.log('🛑 Railway shutdown signal received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Manual shutdown');
  process.exit(0);
});
