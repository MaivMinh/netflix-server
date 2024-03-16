const pgp = require("pg-promise")({
  capSQL: false,
});
require("dotenv").config();
const option = {
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
};

const db = pgp(option);

module.exports = {
  addUser: async (user) => {
    let dbConnect = null;
    try {
      dbConnect = await db.connect();
      const queryString = pgp.helpers.insert(user, null, "users");
      await dbConnect.query(queryString);
      return true;
    } catch (error) {
      console.log(error.message + " db_addUser()");
      return false;
    } finally {
      if (dbConnect) dbConnect.done();
    }
  },

  getUser: async (username) => {
    let dbConnect = null;
    try {
      dbConnect = await db.connect();
      const result = await dbConnect.one(`
        SELECT *
        FROM "users"
        WHERE "username" = '${username}'
      `);
      return result;
    } catch (error) {
      console.log(error.message + " db_getUser()");
      return false;
    } finally {
      if (dbConnect) dbConnect.done();
    }
  },

  addSavedMovie: async (username, movie) => {
    // Hàm lưu phim yêu thích ứng với từng username.
    let dbConnect = null;
    const data = {
      username: username,
      backdrop_path: movie.backdrop_path,
      id_film: movie.id_film,
      title: movie.title,
    };

    try {
      dbConnect = await db.connect();
      // Kiểm tra xem row này có tồn tại hay chưa.
      await dbConnect.none(`
       SELECT *
       FROM "favourite"
       WHERE "username" = '${username}' AND "id_film" = ${movie.id_film}
     `);
    } catch (error) {
      console.log(error.message + " db_addSavedMovie()_1");
      return true;
    } finally {
      if (dbConnect) dbConnect.done();
    }

    try {
      dbConnect = await db.connect();
      const insertQuery = pgp.helpers.insert(data, null, "favourite");
      await dbConnect.query(insertQuery);
      return true;
    } catch (error) {
      console.log(error.message + " db_addSavedMovie()_2");
      return false;
    } finally {
      if (dbConnect) dbConnect.done();
    }
  },

  getSavedMovie: async (username) => {
    let dbConnect = null;
    try {
      dbConnect = await db.connect();
      const result = await dbConnect.query(`
        SELECT *
        FROM "favourite"
        WHERE "username" = '${username}'
      `);
      return result;
    } catch (error) {
      console.log(error.message + " db_getSavedMovie()");
      return false;
    } finally {
      if (dbConnect) dbConnect.done();
    }
  },

  deleteSavedMovie: async (username, movie) => {
    let dbConnect = null;
    try {
      dbConnect = await db.connect();
      await dbConnect.query(`
        DELETE FROM "favourite"
        WHERE "username" = '${username}' AND "id_film" = ${movie.id_film}
      `);
      return true;
    } catch (error) {
      console.log(error.message + " db_deleteSavedMovie()");
      return false;
    } finally {
      if (dbConnect) dbConnect.done();
    }
  },
};
