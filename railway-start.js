#!/usr/bin/env bun

// Script de démarrage Railway pour VC Portfolio Scraper
// Exécute le scraper toutes les 12 heures (comme votre cron actuel)

import { spawn } from 'child_process';

console.log('🚀 Railway VC Scraper started...');
console.log('⏰ Running every 12 hours (same as your local cron)');

// Fonction pour exécuter le scraper
function runScraper() {
  console.log(`\n📅 [${new Date().toLocaleString()}] Starting VC scraping...`);
  
  const scraper = spawn('bun', ['run', 'vc-portfolio-scraper.ts'], {
    stdio: 'inherit'
  });
  
  scraper.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Scraping completed successfully');
    } else {
      console.error(`❌ Scraping failed with code ${code}`);
    }
    
    // Programmer la prochaine exécution dans 12 heures
    console.log('⏱️ Next scraping in 12 hours...\n');
  });
  
  scraper.on('error', (error) => {
    console.error('❌ Error starting scraper:', error);
  });
}

// Première exécution immédiate
runScraper();

// Puis toutes les 12 heures (comme votre configuration locale)
setInterval(runScraper, 12 * 60 * 60 * 1000); // 12 heures en millisecondes

// Garder le processus en vie
process.on('SIGTERM', () => {
  console.log('🛑 Railway shutdown signal received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Manual shutdown');
  process.exit(0);
});
