"use strict";

// TODO: Add API's documentation in the README.md

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const firebase = require("firebase");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const config = require("./firebase.config.js");
const {
  passwordSalt: salt,
  tokenSecret: secret,
  databaseCredentials: credentials
} = require("./secrets.js");

// Only lower case letters, numbers and a minimum of 4 characters
const usernameRegEx = /^[a-z0-9]{4,}$/;
// At least one lower case letter, one upper case letter, one digit, one special character and a minimum of 6 characters
const passwordRegEx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[$@$!%*?&+\-_])[A-Za-z\d$@$!%*?&+\-_]{6,}$/;

const server = express();

// TODO: Handle firebase errors
const firebaseApp = firebase.initializeApp(config);

// TODO: Handle firebase errors
const db = firebaseApp.database();

// TODO: To test once the front-end is ready
const whitelist = ["localhost"];
const corsOptions = {
  origin: whitelist,
  optionsSuccessStatus: 200
};

// TODO: Handle firebase errors
firebaseApp
  .auth()
  .signInWithEmailAndPassword(credentials.email, credentials.password);

server.use(bodyParser.json(), cors(corsOptions));

server.get("/search/:query", search);
server.post("/auth", authenticate);
server.post("/register", register);
server.get("/profile/:username", getProfile);
server.get("/check/:token", checkToken);
server.post("/profile", setProfile);
server.all("*", badRequest);

server.listen(process.env.PORT || 3000, () =>
  console.log("Running on port", process.env.PORT || 3000)
);

async function search(req, res) {
  console.log("/search", req.params, req.query);
  const { query } = req.params;

  if (!query) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Missing search query"
    });
  }

  const searchInputs = query
    .toLowerCase()
    .split(" ")
    .map(value => optimizeForSearch(value));

  let profiles = {};
  for (const input of searchInputs) {
    // TODO: Handle firebase errors
    await db
      .ref("profiles")
      .orderByChild("searchOptimized/firstName")
      .equalTo(input)
      .on("child_added", child => {
        profiles[child.key] = child.val();
      });
    // TODO: Handle firebase errors
    await db
      .ref("profiles")
      .orderByChild("searchOptimized/lastName")
      .equalTo(input)
      .on("child_added", child => {
        profiles[child.key] = child.val();
      });
  }

  return res.json({ success: true, profiles });
}

async function authenticate(req, res) {
  console.log("/auth", req.body);
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Missing parameter(s)"
    });
  }

  const sha = crypto.createHash("sha1");
  const hashedPassword = sha.update(password + salt).digest("hex");
  // TODO: Handle firebase errors
  const user = (await db.ref(`users/${username}`).once("value")).val();

  if (!user || username !== user.username || hashedPassword !== user.password) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Wrong username and/or password"
    });
  }

  const token = jwt.sign({ username }, secret);
  return res.json({ success: true, token });
}

// TODO: Enhance by adding email and email verification
async function register(req, res) {
  console.log("/register", req.body);
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Missing parameter(s)"
    });
  }

  const userExists = await isUsernameTaken(username);
  if (userExists) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Username already exists"
    });
  }

  if (!isUsernameValid(username) || !isPasswordValid(password)) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Username and/or password do not match the rules"
    });
  }

  const sha = crypto.createHash("sha1");
  // TODO: Handle firebase errors
  await db
    .ref(`users/${username}`)
    .set({ username, password: sha.update(password + salt).digest("hex") });

  const token = jwt.sign({ username }, secret);
  return res.json({ success: true, token });
}

async function getProfile(req, res) {
  console.log("/profile", req.params, req.query);
  const { token } = req.query;
  const { username } = req.params;

  if (!token || !isTokenValid(token)) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Missing or invalid token"
    });
  }

  if (!username) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Missing username"
    });
  }

  // TODO: Handle firebase errors
  const profile = (await db.ref(`profiles/${username}`).once("value")).val();

  if (!profile) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "This user does not exist or does not have a profile yet"
    });
  }

  return res.json({ success: true, profile, username });
}

async function setProfile(req, res) {
  console.log("/profile", req.body);
  const {
    firstName = "",
    lastName = "",
    email = "",
    image = "",
    about = "",
    phone = "",
    birthDate = "",
    token
  } = req.body;

  if (!token || !isTokenValid(token)) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Missing or invalid token"
    });
  }

  const profile = {
    firstName,
    lastName,
    email,
    image,
    about,
    phone,
    birthDate,
    searchOptimized: {
      firstName: optimizeForSearch(firstName),
      lastName: optimizeForSearch(lastName)
    }
  };

  const decoded = jwt.decode(token, secret);
  const { username } = decoded;
  // TODO: Handle firebase errors
  await db.ref(`profiles/${username}`).set(profile);

  return res.json({
    success: true,
    message: "Profile created/updated successfully"
  });
}

function checkToken(req, res) {
  console.log("/check", req.params);
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({
      success: false,
      status: 400,
      error: "Missing token"
    });
  }

  if (isTokenValid(token)) {
    return res.json({ success: true, message: "Token is valid" });
  } else {
    return res.json({ success: false, message: "Wrong token" });
  }
}

function badRequest(req, res) {
  return res.status(400).json({
    success: false,
    status: 400,
    error: `${req.protocol}://${req.get("host")}${
      req.originalUrl
    } is not a correct request`
  });
}

function isTokenValid(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (e) {
    decoded = undefined;
  }
  return !!decoded;
}

async function isUsernameTaken(username) {
  return !!(await db.ref(`users/${username}`).once("value")).val();
}

function isUsernameValid(username) {
  return usernameRegEx.test(username);
}

function isPasswordValid(password) {
  return passwordRegEx.test(password);
}

function optimizeForSearch(input) {
  return input
    .toLowerCase()
    .replace(/\s/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
