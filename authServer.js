const express = require("express");
const app = express();

require("dotenv").config();
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const cors = require("cors");
const userModels = require("./userModels");
const bcrypt = require("bcrypt");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const port = process.env.PORT_AUTH_SERVER || 8080;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET, POST, PUT, PATCH, DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
); // alow register http headers
app.use(helmet());
app.use(cookieParser());

const authorization = (req, res, next) => {
  const [content, accessToken] = req.headers.authorization.split(" ");
  if (!accessToken || content != "Bearer") return res.sendStatus(403);

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

const generateToken = (user, token, time) => {
  return jwt.sign(user, token, {
    expiresIn: time,
  });
};

// POST request dùng để cung cấp credentials cho server.
let user = {
  email: "",
  username: "",
  password: "",
};

app.post("/auth/verify", async (req, res) => {
  return new Promise((resolve, reject) => {
    const { email, username, password } = req.body;
    user.email = email;
    user.username = username;
    user.password = password;

    hashCode = crypto.randomBytes(3).toString("hex");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "maivanminh.se@gmail.com",
        pass: "alwm vmnw fycr vlta",
      },
    });

    const message = {
      from: "maivanminh.se@gmail.com",
      to: email,
      subject: "[NETFLIX] - [MÃ XÁC NHẬN TÀI KHOẢN CỦA BẠN]",
      html: `
    <html>
      <head>
        <style>
            h1  { 
              color: blue;
            }
            p {
              color: red;
              font-size: 30px;
              font-weight: 500;
              text-align: center;
            }
        </style>
      </head>
      <body>
        <h1>Nhận mã xác thực của bạn tại đây!</h1>
        <p>${hashCode}</p>
      </body>
    </html>
    `,
    };

    transporter.sendMail(message, function (error, info) {
      if (error) {
        console.log("Error in sending email  " + error);
        reject(Error("Sending email is errored!"));
      } else {
        resolve();
      }
    });
  })
    .then((data) => {
      res.status(201).json(data);
    })
    .catch((error) => {
      res.status(501).json({ error: error.message });
    });
});

// Xác thực email sau khi user nhập mã code xác thực đã gửi vào email user.
app.post("/auth/verify-email", (req, res) => {
  const { code } = req.body;
  if (code === hashCode) {
    // Nếu đúng, tạo tài khoản mới.
    bcrypt.hash(user.password, 10, async function (err, hash) {
      // Store hash in your password DB.
      if (err) console.log(err.message);
      else {
        user.password = hash;
        try {
          await userModels.addUser(user);
          return res.json({
            result: true,
          });
        } catch (error) {
          console.log(error.message + " authServer_verify-email");
          return res.json({
            result: false,
          });
        }
      }
    });
  } else {
    //Ngược lại, load lại trang. Chỗ này có thể sử dụng axios để tránh việc load lại hoàn toàn trang.
    console.log("Hash code incorrect!");
    return res.json({
      result: false,
    });
  }
});

app.post("/auth/login", async (req, res) => {
  // Không thể gửi thông tin của access token vào trong biến user được.
  /* 
    Vì lý do ứng dụng của ta chạy qua port 3000 của React nên mỗi khi refresh lại trang thì biến user sẽ được set lại về undefined. Nên do đó  khi ta lưu token hoặc thông tin người dùng vào biến này thì sẽ bị mất hết mỗi lần refresh. Điều này không xảy ra với firebase.
    Nên chúng ta sẽ sử dụng phương pháp sau:
    + Cả access và refresh đều lưu trên cookie.
    + access thì không set httpOnly nhưng refresh thì có.
    + Hàm authorization vẫn giữ nguyên.
    + access token chỉ lưu username và permission của user.
    + access token thì set là 1h nhưng cookie để chứa thì nên để lâu hơn nhằm hạn chế thời gian truy cập của người dùng.
    + refresh token thì để đồng loạt là 365 days.
  */

  const { user } = req.body;
  let refreshToken = req.cookies.refresh_token;
  try {
    const _result = await userModels.getUser(user.username);
    bcrypt.compare(user.password, _result.password, function (err, result) {
      return new Promise((resolve, reject) => {
        if (err || !result) {
          // Nếu có lỗi hoặc không có kết quả.
          reject("Username or Password incorrect!");
        } else {
          // Tạo access token rồi đính kèm vào cookie.
          resolve({
            username: _result.username,
            permission: _result.permission,
          });
        }
      })
        .then((data) => {
          const accessToken = generateToken(
            {
              username: _result.username,
              permission: _result.permission,
            },
            process.env.APP_ACCESS_TOKEN,
            "24h"
          );
          if (!refreshToken) {
            // Tạo refresh token rồi gửi vào cookie.
            refreshToken = generateToken(
              data,
              process.env.APP_REFRESH_TOKEN,
              "365 days"
            );
            res
              .status(200)
              .cookie("refresh_token", refreshToken, {
                maxAge: 365 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: true,
              })
              .cookie("access_token", accessToken, {
                maxAge: 15 * 24 * 60 * 60 * 1000,
              })
              .json(data);
          } else {
            // Nếu có refresh token rồi thì chỉ gửi data về cho client.
            res
              .status(200)
              .cookie("access_token", accessToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
              })
              .json(data);
          }
        })
        .catch((error) => {
          res.status(401).json({ error: error.message });
        });
    });
  } catch (error) {
    console.log(error.message + " authServer_login");
    return res.sendStatus(401);
  }
});

/* Làm mới access-token */
app.get("/auth/access-token", async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  let access_token = null;
  return new Promise((resolve, reject) => {
    if(!refreshToken)
      return reject(Error("Refresh token is expired"));
    
    // Xác thực refresh token.
    jwt.verify(
      refreshToken,
      process.env.APP_REFRESH_TOKEN,
      function (err, payload) {
        if (err) {
          reject(err.name);
        } else {
          access_token = generateToken(
            {
              username: payload.username,
              permission: payload.permission,
            },
            process.env.APP_ACCESS_TOKEN,
            "24h"
          );
          resolve(access_token);
        }
      }
    );
  })
    .then((data) => {
      return res
        .status(204)
        .cookie("access_token", access_token, {
          maxAge: 15 * 24 * 60 * 60 * 1000,
        })
        .json(data);
    })
    .catch((error) => {
      return res.status(403).json({ error: error.message });
    });
});

app.post("/auth/logout", authorization, (req, res) => {
  res.clearCookie("access_token").clearCookie("refresh_token").sendStatus(204);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
