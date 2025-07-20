#!/usr/bin/env bun

// Bot Telegram Railway - Tourne 24/7 même si votre Mac est éteint
import { spawn } from 'child_process';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are required');
  process.exit(1);
}

console.log('🤖 Railway Telegram Bot started! Bot will run 24/7');

let isScrapingRunning = false;

// Fonction pour envoyer des messages Telegram
async function sendMessage(text, chatId = TELEGRAM_CHAT_ID) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: text
    });
    console.log(`📤 Message sent: ${text.substring(0, 50)}...`);
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
  }
}

// Fonction pour lancer le scraping
async function runScraping(chatId) {
  if (isScrapingRunning) {
    await sendMessage('⚠️ Scraping is already running! Please wait...', chatId);
    return;
  }

  isScrapingRunning = true;
  await sendMessage('🚀 Starting VC portfolio scraping (Railway version)...', chatId);

  const scraper = spawn('bun', ['run', 'vc-portfolio-scraper-railway.ts'], {
    stdio: 'pipe'
  });

  let output = '';
  
  scraper.stdout.on('data', (data) => {
    output += data.toString();
    console.log(data.toString());
  });

  scraper.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  scraper.on('close', async (code) => {
    isScrapingRunning = false;
    
    if (code === 0) {
      // Extraire les statistiques de l'output
      const lines = output.split('\n');
      const statsLine = lines.find(line => line.includes('Statistics:'));
      const newDealsLines = lines.filter(line => line.startsWith('+ '));
      
      let message = '✅ Scraping completed successfully!\n\n';
      
      if (statsLine) {
        message += `📊 ${statsLine.replace('📊 Statistics: ', '')}\n\n`;
      }
      
      if (newDealsLines.length > 0) {
        message += `🚀 New deals found:\n${newDealsLines.slice(0, 10).join('\n')}`;
        if (newDealsLines.length > 10) {
          message += `\n... and ${newDealsLines.length - 10} more!`;
        }
      } else {
        message += '📊 No new deals found. Keep sourcing!';
      }
      
      await sendMessage(message, chatId);
    } else {
      await sendMessage(`❌ Scraping failed with code ${code}`, chatId);
    }
  });

  scraper.on('error', async (error) => {
    isScrapingRunning = false;
    await sendMessage(`❌ Error starting scraper: ${error.message}`, chatId);
  });
}

// Fonction pour traiter les messages Telegram
async function processUpdate(update) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.first_name || message.from.username || 'User';
  const text = message.text.toLowerCase().trim();

  console.log(`Command from user: ${username} (ID: ${userId}) in chat: ${chatId}`);
  console.log(`Message: ${message.text}`);

  // Commandes disponibles
  switch (text) {
    case '/start':
    case '/help':
      await sendMessage(
        '🤖 Railway VC Portfolio Scraper Bot\n\n' +
        'Commands:\n' +
        '/source - Start scraping VC portfolios (Railway version)\n' +
        '/status - Check bot status\n' +
        '/help - Show this help message\n\n' +
        '🚀 This bot runs 24/7 on Railway!',
        chatId
      );
      break;

    case '/source':
    case '/start_scraping':
      await runScraping(chatId);
      break;

    case '/status':
      const status = isScrapingRunning ? 
        '🟢 Scraper is currently running...' : 
        '🟢 Bot is online and ready!\n📊 Railway auto-scraping every 2 hours';
      await sendMessage(status, chatId);
      break;

    default:
      if (text.startsWith('/')) {
        await sendMessage(
          '❓ Unknown command. Use /help to see available commands.',
          chatId
        );
      }
      break;
  }
}

// Fonction pour récupérer les updates Telegram
async function getUpdates(offset = 0) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;
  try {
    const response = await axios.get(url, {
      params: {
        offset: offset,
        timeout: 30,
        allowed_updates: ['message']
      }
    });
    return response.data.result;
  } catch (error) {
    console.error('Error getting updates:', error.message);
    return [];
  }
}

// Boucle principale pour traiter les messages
async function startPolling() {
  let offset = 0;
  
  while (true) {
    try {
      const updates = await getUpdates(offset);
      
      for (const update of updates) {
        await processUpdate(update);
        offset = update.update_id + 1;
      }
      
      // Petite pause pour éviter le spam API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Polling error:', error.message);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Attendre 5s en cas d'erreur
    }
  }
}

// Démarrer le bot
console.log('🔄 Starting Telegram bot polling...');
startPolling();

// Envoyer un message de démarrage
sendMessage('🤖 Railway VC Bot is now online! 24/7 service activated.');

// Garder le processus en vie
process.on('SIGTERM', async () => {
  console.log('🛑 Railway shutdown signal received');
  await sendMessage('⚠️ Railway bot is shutting down...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Manual shutdown');
  await sendMessage('⚠️ Railway bot is shutting down...');
  process.exit(0);
});
