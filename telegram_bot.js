#!/usr/bin/env bun

import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Bot ouvert à tous les utilisateurs

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are required');
  process.exit(1);
}

let offset = 0;
let isRunning = false;
let scheduledScraping = null;
let scrapingStartTime = null;
let currentScrapingProcess = null;

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
        
        if (newProjects.length > 0) {
          const projectsList = newProjects.slice(0, 10).join('\n');
          await sendMessage(`🚀 *Scheduled Scraping Results*\n\n📈 *New projects found:*\n${projectsList}`);
        } else {
          console.log('No new projects found in scheduled scraping');
        }
      } else {
        console.error('Scheduled scraping failed with code:', code);
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

// Démarrer le scraping automatique toutes les 2h
function startScheduledScraping() {
  // Scraping toutes les 2 heures (7200000 ms)
  scheduledScraping = setInterval(runScheduledScraping, 2 * 60 * 60 * 1000);
  console.log('🔄 Scheduled scraping started (every 2 hours)');
}

async function sendMessage(text, chatId = TELEGRAM_CHAT_ID) {
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
    await sendMessage('🔄 Scraper is already running...', chatId);
    return;
  }

  isRunning = true;
  scrapingStartTime = new Date();
  await sendMessage('🚀 Starting VC portfolio scraper...', chatId);
  
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
        await sendMessage(`✅ *Scraping completed!*\n\n📈 *New projects found:*\n${projectsList}\n\n📊 ${stats || 'Scraping finished successfully'}`, chatId);
      } else {
        await sendMessage(`✅ *Scraping completed!*\n\n📊 No new projects found this time.\n\n${stats || 'All sites checked successfully'}`, chatId);
      }
    } else {
      await sendMessage(`❌ *Scraper failed with exit code ${code}*`, chatId);
    }
  });
  
  scraperProcess.on('error', async (error) => {
    currentScrapingProcess = null;
    isRunning = false;
    scrapingStartTime = null;
    console.error('Error running scraper:', error);
    await sendMessage(`❌ *Error running scraper:*\n\`${error.message}\``, chatId);
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
      
      const command = message.text.toLowerCase().trim();
      
      switch (command) {
        case '/source':
        case '/start_scraping':
          await runSourceLoop(message.chat.id, message.message_id);
          break;
        case '/status':
          if (isRunning) {
            await sendMessage(`🔄 *Scraper is currently running*\n\n⏱️ Started at: ${scrapingStartTime ? scrapingStartTime.toLocaleTimeString() : 'Unknown'}\n🔧 Status: Processing VC portfolios...\n\n💡 _The scraper usually takes 2-5 minutes to complete._`, chatId);
          } else {
            await sendMessage(`⏸️ *Scraper is idle*\n\n🎯 Use /source to start manual scraping\n⏰ Automatic scraping every 2 hours`, chatId);
          }
          break;
        case '/help':
        case '/start':
          await sendMessage(`🤖 *VC Portfolio Scraper Bot*\n\nCommands:\n/source - Start scraping VC portfolios\n/status - Check bot status\n/help - Show this help message`, chatId);
          break;
        default:
          if (message.text.startsWith('/')) {
            await sendMessage('❓ Unknown command. Use /help to see available commands.', chatId);
          }
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
