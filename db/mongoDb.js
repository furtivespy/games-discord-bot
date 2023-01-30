const { MongoClient } = require('mongodb');

class MongoDb {
  constructor(options) {
    this.uri = options.uri;
    this.logger = options.logger;
    console.log(`db connect ${this.uri}`);
  }

  async testConnection() {
    const client = new MongoClient(this.uri);
    try {
      this.logger.debug('MongoDB connection started');
      await client.connect();
      this.logger.debug('MongoDB connection successful');
    } catch (err) {
      this.logger.error(err);
    } finally {
      await client.close();
      this.logger.debug('MongoDB connection closed');
    }
  }
}

module.exports = MongoDb;