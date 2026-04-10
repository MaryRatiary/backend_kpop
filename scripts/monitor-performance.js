#!/usr/bin/env node

// ✅ SCRIPT DE MONITORING DE PERFORMANCE EN TEMPS RÉEL
// Usage: node scripts/monitor-performance.js

import fetch from 'node-fetch';
import os from 'os';

const API_BASE = process.env.API_URL || 'http://localhost:5000/api';
const INTERVAL = 5000; // 5 secondes

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      totalTime: 0,
      errors: 0,
      slowRequests: 0,
      startTime: Date.now(),
    };
  }

  async testEndpoint(method, endpoint, data = null) {
    const startTime = Date.now();
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      
      if (data) options.body = JSON.stringify(data);
      
      const response = await fetch(`${API_BASE}${endpoint}`, options);
      const duration = Date.now() - startTime;
      
      this.metrics.totalRequests++;
      this.metrics.totalTime += duration;
      
      if (duration > 1000) {
        this.metrics.slowRequests++;
        console.warn(`⚠️  SLOW: ${method} ${endpoint} (${duration}ms)`);
      }
      
      if (!response.ok) {
        this.metrics.errors++;
        console.error(`❌ ERROR: ${method} ${endpoint} (${response.status})`);
      }
      
      return { success: true, duration, status: response.status };
    } catch (err) {
      this.metrics.errors++;
      console.error(`❌ FAILED: ${method} ${endpoint} (${err.message})`);
      return { success: false, duration: Date.now() - startTime, error: err.message };
    }
  }

  async runTests() {
    console.clear();
    console.log('🚀 MONITORING DE PERFORMANCE - SINOA KPOP');
    console.log('='.repeat(50));
    
    const tests = [
      { method: 'GET', endpoint: '/health' },
      { method: 'GET', endpoint: '/products?limit=20' },
      { method: 'GET', endpoint: '/categories' },
      { method: 'GET', endpoint: '/db-test' },
    ];

    const results = [];
    for (const test of tests) {
      const result = await this.testEndpoint(test.method, test.endpoint);
      results.push({ ...test, ...result });
    }

    this.printReport(results);
  }

  printReport(results) {
    console.log('\n📊 RÉSULTATS DES TESTS:');
    console.log('-'.repeat(50));
    
    const table = results.map(r => ({
      'Méthode': r.method,
      'Endpoint': r.endpoint,
      'Temps (ms)': r.duration || 'N/A',
      'Statut': r.success ? '✅' : '❌',
    }));
    
    console.table(table);

    // Statistiques globales
    const avgTime = this.metrics.totalRequests > 0 
      ? Math.round(this.metrics.totalTime / this.metrics.totalRequests)
      : 0;
    
    const uptime = Math.round((Date.now() - this.metrics.startTime) / 1000);
    
    console.log('\n📈 STATISTIQUES GLOBALES:');
    console.log('-'.repeat(50));
    console.log(`Total requêtes: ${this.metrics.totalRequests}`);
    console.log(`Temps moyen: ${avgTime}ms`);
    console.log(`Requêtes lentes (>1s): ${this.metrics.slowRequests}`);
    console.log(`Erreurs: ${this.metrics.errors}`);
    console.log(`Uptime: ${uptime}s`);
    
    // Système
    console.log('\n�� RESSOURCES SYSTÈME:');
    console.log('-'.repeat(50));
    const cpuUsage = os.loadavg();
    const freeMemory = Math.round(os.freemem() / 1024 / 1024);
    const totalMemory = Math.round(os.totalmem() / 1024 / 1024);
    
    console.log(`CPU Load: ${cpuUsage[0].toFixed(2)}`);
    console.log(`Mémoire libre: ${freeMemory}MB / ${totalMemory}MB`);
    console.log(`Utilisé: ${((totalMemory - freeMemory) / totalMemory * 100).toFixed(1)}%`);
    
    console.log('\n' + '='.repeat(50));
    console.log(`Prochain test dans 5 secondes...`);
  }

  start() {
    this.runTests();
    setInterval(() => this.runTests(), INTERVAL);
  }
}

const monitor = new PerformanceMonitor();
monitor.start();
