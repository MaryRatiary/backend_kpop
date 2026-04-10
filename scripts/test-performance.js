// ✅ SCRIPT DE TEST DE PERFORMANCE
// Mesure les temps de réponse des endpoints critiques

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5000/api';

// ✅ Helper pour mesurer le temps
const measureRequest = async (method, endpoint, body = null) => {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : null,
    });

    const duration = Date.now() - startTime;
    const status = response.status;
    const data = await response.json();

    return { duration, status, success: response.ok };
  } catch (err) {
    const duration = Date.now() - startTime;
    return { duration, status: 0, success: false, error: err.message };
  }
};

// ✅ Tests
const runTests = async () => {
  console.log('\n🚀 TESTS DE PERFORMANCE\n');
  console.log('='.repeat(60));

  // Test 1: GET /products
  console.log('\n�� Test 1: GET /products (liste des 50 produits)');
  const productTests = [];
  for (let i = 0; i < 5; i++) {
    const result = await measureRequest('GET', '/products?limit=50');
    productTests.push(result.duration);
    console.log(`  Requête ${i + 1}: ${result.duration}ms ${result.success ? '✅' : '❌'}`);
  }
  const avgProducts = Math.round(productTests.reduce((a, b) => a + b) / productTests.length);
  console.log(`  ⏱️  Moyenne: ${avgProducts}ms`);

  // Test 2: GET /products/:id
  console.log('\n📊 Test 2: GET /products/1 (détail d\'un produit)');
  const productDetailTests = [];
  for (let i = 0; i < 5; i++) {
    const result = await measureRequest('GET', '/products/1');
    productDetailTests.push(result.duration);
    console.log(`  Requête ${i + 1}: ${result.duration}ms ${result.success ? '✅' : '❌'}`);
  }
  const avgProductDetail = Math.round(productDetailTests.reduce((a, b) => a + b) / productDetailTests.length);
  console.log(`  ⏱️  Moyenne: ${avgProductDetail}ms`);

  // Test 3: GET /dashboard
  console.log('\n📊 Test 3: GET /dashboard (statistiques admin)');
  const dashboardTests = [];
  for (let i = 0; i < 5; i++) {
    const result = await measureRequest('GET', '/dashboard');
    dashboardTests.push(result.duration);
    console.log(`  Requête ${i + 1}: ${result.duration}ms ${result.success ? '✅' : '❌'}`);
  }
  const avgDashboard = Math.round(dashboardTests.reduce((a, b) => a + b) / dashboardTests.length);
  console.log(`  ⏱️  Moyenne: ${avgDashboard}ms`);

  // Test 4: GET /categories
  console.log('\n�� Test 4: GET /categories (liste des catégories)');
  const categoriesTests = [];
  for (let i = 0; i < 5; i++) {
    const result = await measureRequest('GET', '/categories');
    categoriesTests.push(result.duration);
    console.log(`  Requête ${i + 1}: ${result.duration}ms ${result.success ? '✅' : '❌'}`);
  }
  const avgCategories = Math.round(categoriesTests.reduce((a, b) => a + b) / categoriesTests.length);
  console.log(`  ⏱️  Moyenne: ${avgCategories}ms`);

  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('\n📈 RÉSUMÉ DES PERFORMANCES\n');
  console.log(`GET /products         : ${avgProducts}ms  ${avgProducts < 500 ? '✅ EXCELLENT' : avgProducts < 1000 ? '⚠️  BON' : '❌ À OPTIMISER'}`);
  console.log(`GET /products/:id     : ${avgProductDetail}ms  ${avgProductDetail < 200 ? '✅ EXCELLENT' : avgProductDetail < 500 ? '⚠️  BON' : '❌ À OPTIMISER'}`);
  console.log(`GET /dashboard        : ${avgDashboard}ms  ${avgDashboard < 300 ? '✅ EXCELLENT' : avgDashboard < 1000 ? '⚠️  BON' : '❌ À OPTIMISER'}`);
  console.log(`GET /categories       : ${avgCategories}ms  ${avgCategories < 200 ? '✅ EXCELLENT' : avgCategories < 500 ? '⚠️  BON' : '❌ À OPTIMISER'}`);

  const totalAvg = avgProducts + avgProductDetail + avgDashboard + avgCategories;
  console.log(`\n⏱️  Temps total moyen  : ${totalAvg}ms`);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Tests terminés!\n');
};

runTests().catch(err => {
  console.error('❌ Erreur lors des tests:', err);
  process.exit(1);
});
