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

  async upsertGameData(server, game, channel, data) {
    const client = new MongoClient(this.uri);
    try {
      //await client.connect();
      const db = client.db(server);
      const collection = db.collection(game);
      const query = { id: channel };
      const update = { $set: data };
      const options = { upsert: true };
      const result = await collection.updateOne(query, update, options);
      this.logger.debug(
        `${result.matchedCount} document(s) matched the filter, updated ${result.modifiedCount} document(s)`,
      );
    } catch (err) { 
      console.log(err);
    } finally {
      await client.close();
    }
  }

  async getSpecificGameData(server, game, channel) {
    const client = new MongoClient(this.uri);
    try {
      const db = client.db(server);
      const collection = db.collection(game);
      const query = { id: channel };
      const result = await collection.findOne(query);
      if (result) {
        return result;
      } else {
        return {};
      }
    } catch (err) {
      console.log(err);
    } finally { 
      await client.close();
    }
  }

  async queryGameData(server, game, query) {
    const client = new MongoClient(this.uri);
    try {
      const db = client.db(server);
      const collection = db.collection(game);
      const result = await collection.find(query);
      if (result) {
        return await result.toArray();
      } else {
        return [];
      }
    } catch (err) {
      console.log(err);
    } finally { 
      await client.close();
    }
  }
}

module.exports = MongoDb;