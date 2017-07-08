var express = require('express');
var session = require('express-session');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
var db = require('./db');

var FirebaseStore = require('connect-session-firebase')(session);
var admin = require('firebase-admin');
var firebase = require("firebase");

var config = {
  apiKey: "<FIREBASE_API_KEY>",
  authDomain: "<FIREBASE_AUTH_DOMAIN>",
  databaseURL: "<FIREBASE_DATABASE_URL>"
};
firebase.initializeApp(config);

// Where firebase-admin.json is a json config file from firebase
var serviceAccount = require("./private/firebase/firebase-admin.json");
var ref = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tnt-cloud-5d440.firebaseio.com"
});

// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(new Strategy(
  function(email, password, cb) {
    console.log('passport: ', email);
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(function(user) {
        console.log("user: ", user.toJSON());
        cb(null, user);
      })
      .catch(function(error) {
        console.log("error: ", error);
        return cb(null, false);
      });

  }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, cb) {
  cb(null, user.uid);
});

passport.deserializeUser(function(uid, cb) {
  admin.auth().getUser(uid)
    .then(function(user) {
      // See the UserRecord reference doc for the contents of userRecord.
      console.log("Successfully fetched user data:", user.toJSON());
      cb(null, user);
    })
    .catch(function(error) {
      console.log("Error fetching user data:", error);
      return cb(error);
    });
});




// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(session({
    store: new FirebaseStore({
      database: ref.database()
    }),
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true
  }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// Define routes.
app.get('/',
  function(req, res) {
    res.render('home', { user: req.user });
  });

app.get('/login',
  function(req, res){
    res.render('login');
  });
  
app.post('/login', 
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });
  
app.get('/logout',
  function(req, res){
    firebase.auth().signOut();
    req.logout();
    res.redirect('/');
  });

app.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
    res.render('profile', { user: req.user });
  });

app.listen(3000);
