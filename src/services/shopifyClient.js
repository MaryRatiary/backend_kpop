import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Client Shopify pour communiquer avec l'API Shopify REST
 * Documentation: https://shopify.dev/api/admin-rest
 */
class ShopifyClient {
  constructor() {
    this.shopUrl = process.env.SHOPIFY_SHOP_URL;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = '2024-01';

    // Debug logging
    console.log('🔍 Initialisation ShopifyClient:');
    console.log(`   SHOPIFY_SHOP_URL: ${this.shopUrl ? '✅' : '❌'}`);
    console.log(`   SHOPIFY_ACCESS_TOKEN: ${this.accessToken ? '✅' : '❌'}`);

    if (!this.shopUrl || !this.accessToken) {
      throw new Error('❌ Credentials Shopify manquantes (SHOPIFY_SHOP_URL, SHOPIFY_ACCESS_TOKEN)');
    }

    this.baseURL = `https://${this.shopUrl}/admin/api/${this.apiVersion}`;
    this.headers = {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    };

    console.log(`   Base URL: ${this.baseURL}`);
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/shop.json`, {
        headers: this.headers,
      });
      return response.data.shop;
    } catch (error) {
      console.error('❌ Erreur connexion Shopify:', error.response?.data || error.message);
      throw error;
    }
  }

  async createProduct(productData) {
    try {
      const response = await axios.post(`${this.baseURL}/products.json`, 
        { product: productData },
        { headers: this.headers }
      );
      return response.data.product;
    } catch (error) {
      console.error('❌ Erreur création produit:', error.response?.data || error.message);
      throw error;
    }
  }

  async updateProduct(productId, productData) {
    try {
      const response = await axios.put(`${this.baseURL}/products/${productId}.json`,
        { product: productData },
        { headers: this.headers }
      );
      return response.data.product;
    } catch (error) {
      console.error('❌ Erreur mise à jour produit:', error.response?.data || error.message);
      throw error;
    }
  }

  async getOrders(limit = 250, status = 'any') {
    try {
      const response = await axios.get(`${this.baseURL}/orders.json`, {
        headers: this.headers,
        params: {
          limit,
          status,
          fields: 'id,email,financial_status,fulfillment_status,total_price,currency,created_at,customer,line_items'
        }
      });
      return response.data.orders;
    } catch (error) {
      console.error('❌ Erreur récupération commandes:', error.response?.data || error.message);
      throw error;
    }
  }

  async getOrder(orderId) {
    try {
      const response = await axios.get(`${this.baseURL}/orders/${orderId}.json`, {
        headers: this.headers,
      });
      return response.data.order;
    } catch (error) {
      console.error('❌ Erreur récupération commande:', error.response?.data || error.message);
      throw error;
    }
  }

  async getCustomers(limit = 250) {
    try {
      const response = await axios.get(`${this.baseURL}/customers.json`, {
        headers: this.headers,
        params: { limit }
      });
      return response.data.customers;
    } catch (error) {
      console.error('❌ Erreur récupération clients:', error.response?.data || error.message);
      throw error;
    }
  }

  async getProducts(limit = 250) {
    try {
      const response = await axios.get(`${this.baseURL}/products.json`, {
        headers: this.headers,
        params: { limit }
      });
      return response.data.products;
    } catch (error) {
      console.error('❌ Erreur récupération produits:', error.response?.data || error.message);
      throw error;
    }
  }

  async createWebhook(topic, address) {
    try {
      const response = await axios.post(`${this.baseURL}/webhooks.json`,
        {
          webhook: {
            topic,
            address,
            format: 'json'
          }
        },
        { headers: this.headers }
      );
      return response.data.webhook;
    } catch (error) {
      console.error('❌ Erreur création webhook:', error.response?.data || error.message);
      throw error;
    }
  }

  async getWebhooks() {
    try {
      const response = await axios.get(`${this.baseURL}/webhooks.json`, {
        headers: this.headers,
      });
      return response.data.webhooks;
    } catch (error) {
      console.error('❌ Erreur récupération webhooks:', error.response?.data || error.message);
      throw error;
    }
  }

  async deleteWebhook(webhookId) {
    try {
      await axios.delete(`${this.baseURL}/webhooks/${webhookId}.json`, {
        headers: this.headers,
      });
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression webhook:', error.response?.data || error.message);
      throw error;
    }
  }

  async getFulfillments(orderId) {
    try {
      const response = await axios.get(`${this.baseURL}/orders/${orderId}/fulfillments.json`, {
        headers: this.headers,
      });
      return response.data.fulfillments;
    } catch (error) {
      console.error('❌ Erreur récupération fulfillments:', error.response?.data || error.message);
      throw error;
    }
  }

  async createFulfillment(orderId, fulfillmentData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/orders/${orderId}/fulfillments.json`,
        { fulfillment: fulfillmentData },
        { headers: this.headers }
      );
      return response.data.fulfillment;
    } catch (error) {
      console.error('❌ Erreur création fulfillment:', error.response?.data || error.message);
      throw error;
    }
  }
}

export default new ShopifyClient();
