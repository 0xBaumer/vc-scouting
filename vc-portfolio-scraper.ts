#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import DatabaseStorage from './db-config.js';

// Telegram configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-4848723807'; // ID du groupe par défaut

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN environment variable is required');
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

// Configuration des sites
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
    'https://nativecrypto.xyz/',
    'https://nativecrypto.xyz/cc/',
    'https://www.stake.capital/',
    'https://shima.capital/investments',
  ],
  
  // Sites dynamiques (utilisant Playwright)
  dynamic: [
    'https://nlh.xyz/#portfolio',
    'https://www.framework.ventures/portfolio',
    'https://delphiventures.io/portfolio',
    'https://www.fomo.ventures/portfolio',
    'https://panteracapital.com/portfolio/',
    'https://jobs.polychain.capital/companies',
    'https://www.paradigm.xyz/portfolio',
    'https://www.sequoiacap.com/our-companies/',
    'https://www.moonrockcapital.io/portfolio',
    'https://6thman.ventures/#portfolio',
    'https://www.bankless.ventures/#Portfolio',
    'https://a16zcrypto.com/portfolio/',
  ],
};

const DATA_FILE = 'vc_portfolio_data.txt';

// Function to extract VC name from URL
function getVCNameFromURL(url: string): string {
  const vcMappings: { [key: string]: string } = {
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
    // Filtres spécifiques par domaine
    if (url.includes('sequoiacap.com')) {
      // Pour Sequoia, garder les noms de marques connues
      return project.length >= 3 && !/\b(close|filter|clear|apply|category|stage|partner)\b/i.test(project);
    }
    
    if (url.includes('paradigm.xyz')) {
      // Pour Paradigm, éviter les termes techniques
      return !/\b(portfolio|featured|investments|protocol|exchange|wallet|platform)\b/i.test(project) && project.length >= 3;
    }
    
    if (url.includes('a16zcrypto.com')) {
      // Pour a16zcrypto, éviter les métadonnées et termes génériques
      return !/\b(acquired|companies|undergone|initial|public|offering|shares|certain|publicly|traded|held|funds|available|excluded|investments|issuer|provided|permission|disclose|unannounced|digital|assets|updated|monthly)\b/i.test(project) && project.length >= 3;
    }
    
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

// Scraper pour sites dynamiques avec Playwright
async function scrapeDynamicSite(url: string): Promise<string[]> {
  let browser = null;
  
  try {
    console.log(`🔍 Scraping dynamic site: ${url}`);
    
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Attendre un peu pour que le contenu se charge
    await page.waitForTimeout(2000);
    
    // Gérer les boutons "Load More" ou scroll infini
    await handleDynamicLoading(page, url);
    
    const html = await page.content();
    
    return extractProjectsFromHTML(html, url);
    
  } catch (error) {
    console.error(`❌ Error with dynamic scraping of ${url}:`, error instanceof Error ? error.message : error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to handle dynamic loading
async function handleDynamicLoading(page: any, url: string): Promise<void> {
  try {
    // Handle different types of dynamic loading per site
    if (url.includes('framework.ventures') || url.includes('delphiventures.io')) {
      // Sites with "Load More" buttons
      const loadMoreSelectors = [
        'button:has-text("Load More")',
        'button:has-text("Show More")',
        '.load-more',
        '[class*="load-more"]',
        'button:has-text("View All")',
      ];
      
      for (const selector of loadMoreSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            await page.waitForTimeout(2000);
            console.log(`✅ Clicked "Load More" button for ${url}`);
            break;
          }
        } catch (e) {
          // Continue with next selector
        }
      }
    }
    
    // Scroll for sites with infinite scroll
    if (url.includes('6thman.ventures') || url.includes('bankless.ventures')) {
      let previousHeight = 0;
      let currentHeight = await page.evaluate(() => document.body.scrollHeight);
      
      while (previousHeight !== currentHeight) {
        previousHeight = currentHeight;
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        currentHeight = await page.evaluate(() => document.body.scrollHeight);
      }
      
      console.log(`✅ Infinite scroll completed for ${url}`);
    }
    
  } catch (error) {
    console.log(`⚠️ Error during dynamic loading for ${url}:`, error instanceof Error ? error.message : error);
  }
}

// Charger les données existantes depuis PostgreSQL ou fichier de fallback
async function loadExistingData(dbStorage: DatabaseStorage): Promise<StoredData> {
  // Essayer d'abord PostgreSQL
  try {
    const dbData = await dbStorage.getAllVCData();
    if (dbData && Object.keys(dbData).length > 0) {
      console.log('📊 Data loaded from PostgreSQL database');
      return dbData;
    }
  } catch (error) {
    console.log('⚠️ Could not load from database, trying file fallback');
  }
  
  // Fallback sur fichier local
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
    
    console.log('📊 Data loaded from local file');
    return data;
  } catch (error) {
    console.error('❌ Error loading existing data:', error);
    return {};
  }
}

// Sauvegarder les données dans PostgreSQL et fichier de backup
async function saveData(data: StoredData, dbStorage: DatabaseStorage): Promise<void> {
  // Sauvegarder d'abord dans PostgreSQL
  let dbSaveSuccess = false;
  if (dbStorage.isConnected) {
    try {
      for (const [url, projects] of Object.entries(data)) {
        await dbStorage.saveVCProjects(url, projects);
      }
      console.log('✅ Data saved to PostgreSQL database');
      dbSaveSuccess = true;
    } catch (error) {
      console.error('❌ Error saving to database:', error);
    }
  }
  
  // Toujours sauvegarder dans le fichier comme backup
  try {
    let content = '';
    for (const [url, projects] of Object.entries(data)) {
      content += `${url}\n`;
      for (const project of projects.sort()) {
        content += `${project}\n`;
      }
      content += '\n';
    }
    writeFileSync(DATA_FILE, content, 'utf-8');
    console.log(dbSaveSuccess ? '✅ Data also backed up to local file' : '✅ Data saved to local file only');
  } catch (error) {
    console.error('❌ Error saving to file:', error);
  }
}

// Fonction principale
async function main(): void {
  console.log('🚀 VC Portfolio Scraper started...\n');
  
  // Initialiser la base de données PostgreSQL
  const dbStorage = new DatabaseStorage();
  const dbConnected = await dbStorage.connect();
  console.log(dbConnected ? '✅ PostgreSQL connected' : '⚠️ PostgreSQL not available, using file fallback');
  
  const existingData = await loadExistingData(dbStorage);
  const newData: StoredData = { ...existingData };
  const totalNewDeals: { project: string, source: string }[] = [];
  
  // Combiner tous les sites
  const allSites = [...SITES_CONFIG.static, ...SITES_CONFIG.dynamic];
  
  for (const url of allSites) {
    try {
      let projects: string[];
      
      // Choisir la méthode de scraping
      if (SITES_CONFIG.static.includes(url)) {
        projects = await scrapeStaticSite(url);
      } else {
        projects = await scrapeDynamicSite(url);
      }
      
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
        const vcName = getVCNameFromURL(url);
        newProjects.forEach(project => {
          console.log(`+ ${project}`);
          totalNewDeals.push({ project, source: vcName });
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
  await saveData(newData, dbStorage);
  
  console.log(`✅ Scraping completed. Data saved ${dbConnected ? 'to PostgreSQL' : 'to file'}`);
  
  // Final statistics
  const totalSites = Object.keys(newData).length;
  const totalProjects = Object.values(newData).reduce((sum, projects) => sum + projects.length, 0);
  console.log(`📊 Statistics: ${totalSites} sites, ${totalProjects} total projects`);
  
  // Send Telegram notification with summary
  const notificationMessage = totalNewDeals.length > 0 
    ? `🚀 Railway: ${totalNewDeals.length} new deals found:\n${totalNewDeals.slice(0, 10).map(deal => `${deal.project} (${deal.source})`).join('\n')}${totalNewDeals.length > 10 ? '\n...and more' : ''}`
    : '📊 No new deals, go source on X!';
    
  await sendTelegramNotification(notificationMessage);
  
  // Fermer la connexion à la base de données
  await dbStorage.close();
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

export { main, scrapeStaticSite, scrapeDynamicSite };
