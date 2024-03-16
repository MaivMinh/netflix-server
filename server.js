const express = require("express");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 4000;
const db = require("./utils/db");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

app.use(express.static("./public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ['GET, POST, PUT, PATCH, DELETE'],
    allowedHeaders: ['Content-Type', "Authorization"]
  })
);
app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views", "views");

const authorization = (req, res, next) => {
  const accessToken = req.cookies.access_token;
  if (!accessToken) return res.sendStatus(401);

  // Xác thực jwt token.
  jwt.verify(
    accessToken,
    process.env.APP_ACCESS_TOKEN,
    function (err, payload) {
      if (err) {
        // Token không đúng.
        console.log(err.message);
        return res.sendStatus(498);
      }
      req.user = {
        username: payload.username,
        role: payload.role,
      };
      return next();
    }
  );
};

app.post("/api/v1/insert-movie", authorization, async (req, res) => {
  // API thêm phim vào table favourite.
  const { username, movie } = req.body;
  const _data = {
    backdrop_path: movie.backdrop_path,
    id_film: movie.id_film,
    title: movie.title,
  };

  return new Promise(async (resolve, reject) => {
    const result = await db.addSavedMovie(username, _data);
    if (result) resolve(_data);
    else reject(Error("Add favourite movie has errored!"));
  })
    .then((data) => {
      return res.status(201).json((data));
    })
    .catch((error) => {
      console.log(error.message);
      return res.status(400).json(error);
    });
});

app.post("/api/v1/delete-movie", authorization, async (req, res) => {
  // API xoá phim từ table favourite.
  return new Promise(async (resolve, reject) => {
    const { username, movie } = req.body;
    const result = await db.deleteSavedMovie(username, movie);
    if (result) resolve(movie);
    else reject(Error("Delete favourite movie has errored!"));
  })
    .then((data) => {
      return res.status(200).json((data));
    })
    .catch((error) => {
      console.log(error.message);
      return res.status(400).json(error);
    });
});

app.post("/api/v1/get-movie", authorization,async (req, res) => {
  // API lấy ds phim yêu thích.
  return new Promise(async (resolve, reject) => {
    const { username } = req.body;
    const result = await db.getSavedMovie(username);
    if (result) resolve((result));
    else reject(Error("Get favourite movie has errored!"));
  })
    .then((data) => {
      res.status(200)
      .json(data);
    })
    .catch((error) => {
      console.log(error.message);
      res.status(400).json(error);
    });

});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
