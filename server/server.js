'use strict';

const loopback = require('loopback');
const boot = require('loopback-boot');
const path = require('path');
const session = require('express-session');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
require('dotenv').config()
const app = module.exports = loopback();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const loopbackPassport = require('loopback-component-passport');
const PassportConfigurator = loopbackPassport.PassportConfigurator;
const passportConfigurator = new PassportConfigurator(app);

const flash = require('express-flash');

let config = {};
try {
  config = require('../providers.js');
} catch (err) {
  console.trace(err);
  process.exit(1);
}

boot(app, __dirname, function(err) {
  if (err) throw err;
});

app.middleware('auth', loopback.token({
  model: app.models.accessToken,
}));

app.middleware('session', session({
  secret: 'kitty',
  saveUninitialized: true,
  resave: true,
}));
passportConfigurator.init();

app.use(flash());

passportConfigurator.setupModels({
  userModel: app.models.user,
  userIdentityModel: app.models.userIdentity,
  userCredentialModel: app.models.userCredential,
});

for (let s in config) {
  let c = config[s];
  c.session = c.session !== false;
  passportConfigurator.configureProvider(s, c);
}

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/login.html'));
});

app.get('/auth', (req, res) => {
  const token = req.headers.cookie.match(/\access_token=(.*?)(;|$)/)[1];
  ensureAuthorized(token)
    .then(response => {
      if (response === 'AUTHORIZED') {
        res.redirect(`/dashboard`);
      } else {
        res.redirect('/login');
      }
    })
    .catch(err => {
      console.log(err);
      res.redirect('/login');
    });
});

app.get('/dashboard', (req, res) => {
  const token = req.query.auth_token;
  console.log(token);
  ensureAuthorized(token)
    .then(response => {
      if (response === 'AUTHORIZED') {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      } else {
        res.redirect('/login');
      }
    })
    .catch(err => {
      console.log(err);
      res.redirect('/login');
    });
});

app.post('/dashboard', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  app.models.User.login({
    email: email,
    password: password,
  }, 'user', function(err, token) {
    if (err) {
      return res.status(401).redirect('/login');
    }
    // console.log(token);
    token = token.toJSON();
    res.redirect(`/dashboard?auth_token=${token.id}`);
  });
});

app.get('/student-summary/:id', (req, res) => {
  const token = req.query.auth_token;
  ensureAuthorized(token)
    .then(response => {
      if (response === 'AUTHORIZED') {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      } else {
        res.redirect('/login');
      }
    })
    .catch(err => {
      console.log(err);
      res.redirect('/login');
    });
});

app.get('/inactive', (req, res) => {
  const token = req.query.auth_token;
  ensureAuthorized(token)
    .then(response => {
      if (response === 'AUTHORIZED') {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
      } else {
        res.redirect('/login');
      }
    })
    .catch(err => {
      console.log(err);
      res.redirect('/login');
    });
});



app.get('/logout', (req, res, next) => {
  if (req.query.auth_token) {
    app.models.accessToken.destroyAll({
      id: req.query.auth_token,
    });
  };
  req.logout();
  res.redirect('/');
});

app.start = function() {
  return app.listen(function() {
    app.emit('started');
    const baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      const explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};

if (require.main === module) {
  app.start();
}

function ensureAuthorized(authToken) {
  return app.models.accessToken.find({'where': {id: authToken}})
    .then(tokens => {
      if (tokens.length > 0) {
        return app.models.user.find({'where': {id: tokens[0].userId}})
          .then(users => {
            if (users.length > 0) {
              return app.models.RoleMapping.find(
                {'where': {principalId: users[0].id}})
                .then(roleMaps => {
                  if (roleMaps.length > 0) {
                    return 'AUTHORIZED';
                  } else {
                    // role map does not exist for user. User is unauthorized
                    return 'UNAUTHORIZED';
                  }
                });
            } else {
              // there is no user associated with this access token
              return 'UNAUTHORIZED';
            }
          });
      } else {
        // no access token exists with this id.
        return 'UNAUTHORIZED';
      }
    });
}
