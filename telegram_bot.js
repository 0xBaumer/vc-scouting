#!/usr/bin/env bun

import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const NOTIFICATION_CHAT_ID = -4848723807; // ID du groupe pour les notifications automatiques

// Bot ouvert à tous les utilisateurs

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
  process.exit(1);
}

let offset = 0;
let isRunning = false;
let scheduledScraping = null;
let scrapingStartTime = null;
let currentScrapingProcess = null;

// Function to extract VC name from URL
function getVCNameFromURL(url) {
  const vcMappings = {
    'haun.co': 'Haun Ventures',
    'hashkey.capital': 'HashKey Capital',
    'greenfield.xyz': 'Greenfield One',
    'fabric.vc': 'Fabric Ventures',
    'dewhales.com': 'DeWhales Capital',
    'mhventures.io': 'MH Ventures',
    'multicoin.capital': 'Multicoin Capital',
    'wintermute.com': 'Wintermute Ventures',
    'alliance.xyz': 'Alliance',
    'gmcapital.xyz': 'GM Capital',
    'nativecrypto.xyz': 'Native Crypto',
    'stake.capital': 'Stake Capital',
    'shima.capital': 'Shima Capital',
    'nlh.xyz': 'NLH',
    'framework.ventures': 'Framework Ventures',
    'delphiventures.io': 'Delphi Ventures',
    'fomo.ventures': 'FOMO Ventures',
    'panteracapital.com': 'Pantera Capital',
    'polychain.capital': 'Polychain Capital',
    'paradigm.xyz': 'Paradigm',
    'sequoiacap.com': 'Sequoia Capital',
    'moonrockcapital.io': 'Moonrock Capital',
    '6thman.ventures': '6th Man Ventures',
    'bankless.ventures': 'Bankless Ventures',
    'a16zcrypto.com': 'a16z crypto'
  };
  
  for (const [domain, name] of Object.entries(vcMappings)) {
    if (url.includes(domain)) {
      return name;
    }
  }
  
  // Fallback: extract domain name
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '').split('.')[0];
  } catch {
    return 'Unknown VC';
  }
}

// Function pour scraping automatique
async function runScheduledScraping() {
  console.log('⏰ Running scheduled scraping...');
  if (!isRunning) {
    isRunning = true;
    scrapingStartTime = new Date();
    
    // Lancer le scraper de manière détachée
    const { spawn } = await import('child_process');
    const scraperProcess = spawn('bun', ['run', 'vc-portfolio-scraper.ts'], {
      stdio: 'pipe',
      detached: false
    });
    
    currentScrapingProcess = scraperProcess;
    let output = '';
    
    scraperProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    scraperProcess.on('close', async (code) => {
      currentScrapingProcess = null;
      isRunning = false;
      scrapingStartTime = null;
      
      if (code === 0) {
        const lines = output.split('\n');
        const newProjects = lines.filter(line => line.includes('+ ') || line.includes('new projects:'));
        const stats = lines.find(line => line.includes('Statistics:'));
        
        if (newProjects.length > 0) {
          console.log(`Scheduled scraping found ${newProjects.length} new projects`);
          
          // Parser la sortie pour extraire les projets avec leurs sources
          const projectsWithSources = [];
          const lines = output.split('\n');
          
          // Chercher les lignes qui contiennent des projets avec leur contexte
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('+ ')) {
              const projectName = line.replace('+ ', '').trim();
              // Chercher l'URL du VC dans les lignes précédentes
              for (let j = i - 1; j >= 0; j--) {
                const prevLine = lines[j];
                if (prevLine.includes('http') && prevLine.includes('] ')) {
                  // Extraire l'URL et déterminer le nom du VC
                  const urlMatch = prevLine.match(/\[([^\]]+)\]/);
                  if (urlMatch) {
                    const url = urlMatch[1];
                    const vcName = getVCNameFromURL(url);
                    projectsWithSources.push(`${projectName} (${vcName})`);
                    break;
                  }
                }
              }
            }
          }
          
          // Si on n'a pas pu parser les sources, utiliser les lignes brutes
          const projectsList = projectsWithSources.length > 0 
            ? projectsWithSources.slice(0, 10).join('\n')
            : newProjects.slice(0, 10).join('\n');
            
          await sendMessage(
            `🔥 *LEGENDARY Auto-Scraping - Nouveaux Deals!*\n\n📈 *${newProjects.length} nouveaux projets trouvés:*\n${projectsList}\n\n📊 ${stats || 'Scraping automatique terminé avec succès'}\n\n⏰ _Scraping automatique toutes les 6h_`,
            NOTIFICATION_CHAT_ID
          );
        } else {
          console.log('No new projects found in scheduled scraping');
          // Optionnel: envoyer une notification même sans nouveaux projets
          // await sendMessage(`✅ *LEGENDARY Auto-Scraping Complete*\n\n📊 Aucun nouveau projet cette fois.\n\n${stats || 'Tous les sites vérifiés avec succès'}\n\n⏰ _Prochaine vérification dans 6h_`, NOTIFICATION_CHAT_ID);
        }
      } else {
        console.error('Scheduled scraping failed with code:', code);
        // Envoyer notification d'erreur dans le groupe
        await sendMessage(
          `❌ *LEGENDARY Auto-Scraping Failed*\n\nErreur durant le scraping automatique (code: ${code})\n\n⏰ _Nouvelle tentative dans 6h_`,
          NOTIFICATION_CHAT_ID
        );
      }
    });
    
    scraperProcess.on('error', (error) => {
      currentScrapingProcess = null;
      isRunning = false;
      scrapingStartTime = null;
      console.error('Error in scheduled scraping:', error);
    });
  }
}

// Démarrer le scraping automatique toutes les 6h
function startScheduledScraping() {
  // Scraping toutes les 6 heures (21600000 ms)
  scheduledScraping = setInterval(runScheduledScraping, 6 * 60 * 60 * 1000);
  console.log('🔄 Scheduled scraping started (every 6 hours)');
}

async function sendMessage(text, chatId) {
  try {
    await axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

async function runSourceLoop(chatId, messageId) {
  if (isRunning) {
    await sendMessage('🔄 LEGENDARY Scraper is already running...', chatId);
    return;
  }

  isRunning = true;
  scrapingStartTime = new Date();
  await sendMessage('🚀 Starting LEGENDARY VC portfolio scraper...', chatId);
  
  // Lancer le scraper de manière complètement détachée
  const { spawn } = await import('child_process');
  const scraperProcess = spawn('bun', ['run', 'vc-portfolio-scraper.ts'], {
    stdio: 'pipe',
    detached: false
  });
  
  currentScrapingProcess = scraperProcess;
  let output = '';
  
  scraperProcess.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  // Ne pas attendre - lancer en arrière-plan
  scraperProcess.on('close', async (code) => {
    currentScrapingProcess = null;
    isRunning = false;
    scrapingStartTime = null;
    
    if (code === 0) {
      // Parse output for new projects
      const lines = output.split('\n');
      const newProjects = lines.filter(line => line.includes('+ ') || line.includes('new projects:'));
      const stats = lines.find(line => line.includes('Statistics:'));
      
      if (newProjects.length > 0) {
        const projectsList = newProjects.slice(0, 10).join('\n');
        // Parser la sortie pour extraire les projets avec leurs sources
        const projectsWithSources = [];
        const lines = output.split('\n');
        
        // Chercher les lignes qui contiennent des projets avec leur contexte
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('+ ')) {
            const projectName = line.replace('+ ', '').trim();
            // Chercher l'URL du VC dans les lignes précédentes
            for (let j = i - 1; j >= 0; j--) {
              const prevLine = lines[j];
              if (prevLine.includes('http') && prevLine.includes('] ')) {
                // Extraire l'URL et déterminer le nom du VC
                const urlMatch = prevLine.match(/\[([^\]]+)\]/);
                if (urlMatch) {
                  const url = urlMatch[1];
                  const vcName = getVCNameFromURL(url);
                  projectsWithSources.push(`${projectName} (${vcName})`);
                  break;
                }
              }
            }
          }
        }
        
        // Construire la liste des projets avec sources
        const projectsList = projectsWithSources.length > 0 
          ? projectsWithSources.slice(0, 10).join('\n')
          : newProjects.slice(0, 10).join('\n');

        await sendMessage(`✅ *LEGENDARY Scraping completed!*\n\n📈 *New projects found:*\n${projectsList}\n\n📊 ${stats || 'Scraping finished successfully'}`, chatId);
      } else {
        await sendMessage(`✅ *LEGENDARY Scraping completed!*\n\n📊 No new projects found this time.\n\n${stats || 'All sites checked successfully'}`, chatId);
      }
    } else {
      await sendMessage(`❌ *LEGENDARY Scraper failed with exit code ${code}*`, chatId);
    }
  });
  
  scraperProcess.on('error', async (error) => {
    currentScrapingProcess = null;
    isRunning = false;
    scrapingStartTime = null;
    console.error('Error running scraper:', error);
    await sendMessage(`❌ *Error running LEGENDARY scraper:*\n\`${error.message}\``, chatId);
  });
  
  // Retourner immédiatement sans attendre
  console.log('Scraper started in background');
}

async function processTelegramUpdates() {
  try {
    const response = await axios.get(`${TELEGRAM_API_URL}/getUpdates`, {
      params: {
        offset: offset,
        timeout: 10
      }
    });
    
    const updates = response.data.result;

    for (const update of updates) {
      offset = update.update_id + 1;
      
      const message = update.message;
      if (!message || !message.text) continue;
      
      // Informations de l'utilisateur et du chat
      const userId = message.from.id;
      const chatId = message.chat.id;
      const userName = message.from.first_name || message.from.username || 'Unknown';
      
      console.log(`Command from user: ${userName} (ID: ${userId}) in chat: ${chatId}`);
      console.log(`📊 CHAT INFO - Type: ${message.chat.type}, Title: ${message.chat.title || 'N/A'}, ID: ${chatId}`);
      
      const command = message.text.toLowerCase().trim();
      
      switch (command) {
        case '/start':
          await sendMessage(`🔥 *VC Portfolio Scraper Bot - LEGENDARY*\n\nBienvenue ! Ce bot scrape les portfolios de VCs sur Railway avec scraping automatique toutes les 6h.\n\nUtilise /help pour voir les commandes disponibles.`, chatId);
          break;
        case '/help':
          await sendMessage(`🔥 *VC Portfolio Scraper Bot - LEGENDARY*\n\nCommandes disponibles:\n\n/start - Message de bienvenue\n/help - Afficher cette aide\n/legendary_source - Lancer le scraping LEGENDARY\n/legendary_status - Vérifier le statut du bot LEGENDARY\n\n⏰ Scraping automatique toutes les 6 heures`, chatId);
          break;
        case '/legendary_source':
        case '/legendarysource':
        case '/source':
          await runSourceLoop(message.chat.id, message.message_id);
          break;
        case '/legendary_status':
        case '/legendarystatus':
          if (isRunning) {
            await sendMessage(`🔄 *Scraper LEGENDARY en cours d'exécution*\n\n⏱️ Démarré à: ${scrapingStartTime ? scrapingStartTime.toLocaleTimeString() : 'Inconnu'}\n🔧 Statut: Traitement des portfolios VC...\n\n💡 _Le scraper prend généralement 2-5 minutes à compléter._`, chatId);
          } else {
            await sendMessage(`⏸️ *Scraper LEGENDARY inactif*\n\n🎯 Utilise /legendary_source pour démarrer le scraping manuel\n⏰ Scraping automatique toutes les 6 heures`, chatId);
          }
          break;
        default:
          // Ignore unknown commands
          break;
      }
    }
  } catch (error) {
    console.error('Error processing updates:', error);
    // Don't exit, just continue
  }
}

async function startBot() {
  console.log('🤖 Telegram bot started. Listening for commands...');
  
  // Démarrer le scraping automatique
  startScheduledScraping();
  
  // Start polling loop
  while (true) {
    await processTelegramUpdates();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between polls
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Bot shutting down...');
  // Ne pas envoyer de message d'arrêt automatique
  process.exit(0);
});

// Start the bot
startBot().catch(console.error);
