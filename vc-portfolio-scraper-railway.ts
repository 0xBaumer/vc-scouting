#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Telegram configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables are required');
  process.exit(1);
}

// Types
interface ScrapedData {
  url: string;
  projects: string[];
}

interface StoredData {
  [url: string]: string[];
}

// Configuration des sites - SEULEMENT STATIQUES pour Railway
const SITES_CONFIG = {
  // Sites statiques (utilisant axios + cheerio)
  static: [
    'https://www.haun.co/portfolio',
    'https://hashkey.capital/portfolio/index.html',
    'https://greenfield.xyz/portfolio/',
    'https://www.fabric.vc/portfolio',
    'https://www.dewhales.com/portfolio',
    'https://www.mhventures.io/portfolio',
    'https://multicoin.capital/portfolio/',
    'https://www.wintermute.com/ventures/portfolio',
    'https://alliance.xyz/companies',
    'https://gmcapital.xyz/',
    'https://shima.capital/investments',
  ]
};

const DATA_FILE = 'vc_portfolio_data.txt';

// Fonction pour nettoyer et filtrer les noms de projets
function cleanProjectName(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  
  // Nettoyer le texte
  let cleaned = text
    .trim()
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-\.]/g, ' ')
    .trim();
  
  // Filtres pour éliminer les éléments indésirables
  const filters = [
    // Trop court ou trop long
    (text: string) => text.length < 2 || text.length > 50,
    // Trop de mots (> 4)
    (text: string) => text.split(' ').length > 4,
    // Mots génériques à éviter
    (text: string) => /^(the|and|or|of|in|on|at|to|for|with|by|from|about|into|through|during|before|after|above|below|up|down|out|off|over|under|again|further|then|once|here|there|when|where|why|how|all|any|both|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|can|will|just|should|now|portfolio|company|companies|investment|investments|project|projects|team|teams|startup|startups|jobs|press|contact|disclosures|privacy|twitter|home|about|blog|news|careers|login|search|menu|close|open|view|show|load|more|filter|apply|clear|category|stage|partner|featured|writing|insights|x|subscribe|newsletter|get|read|explore|discover|learn|find|see|terms|conditions|service|cookies|policy|rights|reserved|copyright|legal|disclaimer|faq|help|support)$/i.test(text),
    // Phrases spécifiques de navigation
    (text: string) => /\b(x twitter|follow us|subscribe|newsletter|get in touch|learn more|read more|view all|show all|load more|see more|explore|discover|find out|click here|sign up|log in|register|submit|contact us|about us|our team|privacy policy|terms of service|all rights reserved)\b/i.test(text),
    // URLs ou liens
    (text: string) => /^https?:\/\/|\.com|\.io|\.xyz|www\.|@/.test(text),
    // Numéros purs
    (text: string) => /^\d+$/.test(text),
    // Texte descriptif long
    (text: string) => /\b(description|overview|summary|details|information|technology|platform|protocol|solution|service|application|ecosystem|network|infrastructure|blockchain|crypto|defi|nft|web3|decentralized|distributed)\b/i.test(text),
  ];
  
  if (filters.some(filter => filter(cleaned))) {
    return null;
  }
  
  return cleaned;
}

// Fonction pour extraire les projets du HTML
function extractProjectsFromHTML(html: string, url: string): string[] {
  const $ = cheerio.load(html);
  const projects = new Set<string>();
  
  // Sélecteurs communs pour les noms de projets
  const selectors = [
    // Titres et liens principaux
    'h1, h2, h3, h4, h5, h6',
    'a[href*="/portfolio"], a[href*="/companies"], a[href*="/investments"]',
    '.portfolio-item, .company-item, .investment-item',
    '.project-name, .company-name, .startup-name',
    // Listes
    'li',
    // Textes en gras
    'strong, b',
    // Divs avec classes spécifiques
    '[class*="portfolio"], [class*="company"], [class*="project"], [class*="investment"]',
    // Spans avec du contenu
    'span',
  ];
  
  selectors.forEach(selector => {
    $(selector).each((_, element) => {
      const text = $(element).text().trim();
      const cleaned = cleanProjectName(text);
      if (cleaned) {
        projects.add(cleaned);
      }
    });
  });
  
  // Filtrage supplémentaire spécifique par URL
  const filtered = Array.from(projects).filter(project => {
    // Filtre général
    return project.length >= 3 && project.split(' ').length <= 3;
  });
  
  return filtered.slice(0, 100); // Limiter à 100 projets max par site
}

// Scraper pour sites statiques
async function scrapeStaticSite(url: string): Promise<string[]> {
  try {
    console.log(`🔍 Scraping static site: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
      }
    });
    
    return extractProjectsFromHTML(response.data, url);
    
  } catch (error) {
    console.error(`❌ Error scraping ${url}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

// Charger les données existantes
function loadExistingData(): StoredData {
  if (!existsSync(DATA_FILE)) {
    return {};
  }
  
  try {
    const content = readFileSync(DATA_FILE, 'utf-8');
    const data: StoredData = {};
    
    let currentUrl = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.startsWith('http')) {
        currentUrl = trimmed;
        data[currentUrl] = [];
      } else if (currentUrl) {
        data[currentUrl].push(trimmed);
      }
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error loading existing data:', error);
    return {};
  }
}

// Sauvegarder les données
function saveData(data: StoredData): void {
  let content = '';
  
  for (const [url, projects] of Object.entries(data)) {
    content += `${url}\n`;
    for (const project of projects.sort()) {
      content += `${project}\n`;
    }
    content += '\n';
  }
  
  writeFileSync(DATA_FILE, content, 'utf-8');
}

// Fonction principale
async function main(): void {
  console.log('🚀 VC Portfolio Scraper (Railway - Static Sites Only) started...\n');
  
  const existingData = loadExistingData();
  const newData: StoredData = { ...existingData };
  const totalNewDeals: string[] = [];
  
  // Seulement les sites statiques pour Railway
  const allSites = SITES_CONFIG.static;
  
  for (const url of allSites) {
    try {
      const projects = await scrapeStaticSite(url);
      
      if (projects.length === 0) {
        console.log(`⚠️ No data found on ${url}`);
        continue;
      }
      
      // Dédupliquer et trier
      const uniqueProjects = Array.from(new Set(projects)).sort();
      const existingProjects = existingData[url] || [];
      
      // Trouver les nouveaux projets
      const newProjects = uniqueProjects.filter(project => !existingProjects.includes(project));
      
      if (newProjects.length > 0) {
        console.log(`[${url}] ${newProjects.length} new projects:`);
        newProjects.forEach(project => {
          console.log(`+ ${project}`);
          totalNewDeals.push(project);
        });
      } else {
        console.log(`[${url}] No new projects`);
      }
      
      // Mettre à jour les données
      newData[url] = uniqueProjects;
      
      console.log(`✅ Total: ${uniqueProjects.length} projects for ${url}\n`);
      
      // Pause entre les requêtes pour éviter la limitation de taux
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ General error for ${url}:`, error instanceof Error ? error.message : error);
      continue;
    }
  }
  
  // Sauvegarder les données
  saveData(newData);
  
  console.log(`✅ Scraping completed. Data saved to ${DATA_FILE}`);
  
  // Final statistics
  const totalSites = Object.keys(newData).length;
  const totalProjects = Object.values(newData).reduce((sum, projects) => sum + projects.length, 0);
  console.log(`📊 Statistics: ${totalSites} sites, ${totalProjects} total projects (Static sites only on Railway)`);
  
  // Send Telegram notification with summary
  const notificationMessage = totalNewDeals.length > 0 
    ? `🚀 Railway: ${totalNewDeals.length} new deals found:\n${totalNewDeals.slice(0, 10).join('\n')}${totalNewDeals.length > 10 ? '\n...and more' : ''}`
    : '📊 Railway: No new deals, go source on X!';
    
  await sendTelegramNotification(notificationMessage);
}

// Exécuter le script
if (import.meta.main) {
  main().catch(console.error);
}

async function sendTelegramNotification(message: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    });
    console.log(`📤 Telegram notification sent: ${message}`);
  } catch (error) {
    console.error('❌ Error sending Telegram notification:', error);
  }
}

export { main, scrapeStaticSite };
