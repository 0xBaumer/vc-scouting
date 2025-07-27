#!/usr/bin/env bun

import { Client } from 'pg';

// Configuration PostgreSQL Railway
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  console.log('⚠️ No DATABASE_URL found, using file storage as fallback');
}

class DatabaseStorage {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (!DATABASE_URL) return false;
    
    try {
      this.client = new Client({
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      await this.client.connect();
      
      // Créer la table si elle n'existe pas
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS vc_portfolio_data (
          id SERIAL PRIMARY KEY,
          vc_url TEXT UNIQUE NOT NULL,
          projects JSONB NOT NULL,
          last_updated TIMESTAMP DEFAULT NOW()
        )
      `);
      
      this.isConnected = true;
      console.log('✅ Database connected successfully');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async saveVCProjects(url, projects) {
    if (!this.isConnected) return false;
    
    try {
      await this.client.query(`
        INSERT INTO vc_portfolio_data (vc_url, projects, last_updated)
        VALUES ($1, $2, NOW())
        ON CONFLICT (vc_url) 
        DO UPDATE SET projects = $2, last_updated = NOW()
      `, [url, JSON.stringify(projects)]);
      
      return true;
    } catch (error) {
      console.error(`❌ Error saving projects for ${url}:`, error.message);
      return false;
    }
  }

  async getVCProjects(url) {
    if (!this.isConnected) return null;
    
    try {
      const result = await this.client.query(
        'SELECT projects FROM vc_portfolio_data WHERE vc_url = $1',
        [url]
      );
      
      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].projects);
      }
      return [];
    } catch (error) {
      console.error(`❌ Error getting projects for ${url}:`, error.message);
      return null;
    }
  }

  async getAllVCData() {
    if (!this.isConnected) return null;
    
    try {
      const result = await this.client.query(
        'SELECT vc_url, projects FROM vc_portfolio_data ORDER BY vc_url'
      );
      
      const data = {};
      result.rows.forEach(row => {
        data[row.vc_url] = JSON.parse(row.projects);
      });
      
      return data;
    } catch (error) {
      console.error('❌ Error getting all VC data:', error.message);
      return null;
    }
  }

  async close() {
    if (this.client && this.isConnected) {
      await this.client.end();
      this.isConnected = false;
    }
  }
}

export default DatabaseStorage;
