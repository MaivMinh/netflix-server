const db = require("./utils/db");

class userModels {
  async addUser(user) {
    return await db.addUser(user);
  }
  async getUser(username) {
    return await db.getUser(username);
  }
}

module.exports = new userModels;
