const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const config = require('./config.js');
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const logger = require('./log.js');
const bcrypt = require('bcrypt');
const api = require('./api');
const path = require('path');
const jwt = require('jsonwebtoken');
const http = require('http');
const Raven = require('raven');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const webpack = require('webpack');
const webpackConfig = require('../webpack.config.js');
const pug = require('pug');

const UserService = require('./repositories/UserService.js');
const version = require('../version.js');

const defaultWindows = {
    plot: false,
    draw: false,
    challengeBegin: false,
    attackersDeclared: true,
    defendersDeclared: true,
    dominance: false,
    standing: false
};

class Server {
    constructor(isDeveloping) {
        this.userService = new UserService({ dbPath: config.dbPath });
        this.isDeveloping = isDeveloping;
        this.server = http.Server(app);
    }

    init() {
        if(!this.isDeveloping) {
            Raven.config(config.sentryDsn, { release: version }).install();

            app.use(Raven.requestHandler());
            app.use(Raven.errorHandler());
        }

        app.use(session({
            store: new MongoStore({ url: config.dbPath }),
            saveUninitialized: false,
            resave: false,
            secret: config.secret,
            cookie: { maxAge: config.cookieLifetime }
        }));

        app.use(passport.initialize());
        app.use(passport.session());

        passport.use(new localStrategy(this.verifyUser.bind(this)));
        passport.serializeUser(this.serializeUser.bind(this));
        passport.deserializeUser(this.deserializeUser.bind(this));

        app.use(cookieParser());
        app.use(bodyParser.json());
        app.use(bodyParser.urlencoded({ extended: false }));

        api.init(app);

        app.use(express.static(__dirname + '/../public'));
        app.set('view engine', 'pug');
        app.set('views', path.join(__dirname, '..', 'views'));

        if(this.isDeveloping) {
            const compiler = webpack(webpackConfig);
            const middleware = webpackDevMiddleware(compiler, {
                hot: true,
                contentBase: 'client',
                publicPath: webpackConfig.output.publicPath,
                stats: {
                    colors: true,
                    hash: false,
                    timings: true,
                    chunks: false,
                    chunkModules: false,
                    modules: false
                },
                historyApiFallback: true
            });

            app.use(middleware);
            app.use(webpackHotMiddleware(compiler, {
                log: false,
                path: '/__webpack_hmr',
                heartbeat: 2000
            }));

            app.get('*', function response(req, res) {
                var token = undefined;

                if(req.user) {
                    token = jwt.sign(req.user, config.secret);
                }

                var html = pug.renderFile('views/index.pug', { basedir: path.join(__dirname, '..', 'views'), user: req.user, token: token });
                middleware.fileSystem.writeFileSync(path.join(__dirname, '..', 'public/index.html'), html);
                res.write(middleware.fileSystem.readFileSync(path.join(__dirname, '..', 'public/index.html')));
                res.end();
            });
        } else {
            app.get('*', (req, res) => {
                var token = undefined;

                if(req.user) {
                    token = jwt.sign(req.user, config.secret);
                }

                res.render('index', { basedir: path.join(__dirname, '..', 'views'), user: req.user, token: token, production: !this.isDeveloping });
            });
        }

        return this.server;
    }

    run() {
        var port = this.isDeveloping ? 4000 : process.env.PORT;

        this.server.listen(port, '0.0.0.0', function onStart(err) {
            if(err) {
                logger.error(err);
            }

            logger.info('==> 🌎 Listening on port %s. Open up http://0.0.0.0:%s/ in your browser.', port, port);
        });
    }

    verifyUser(username, password, done) {
        this.userService.getUserByUsername(username)
            .then(user => {
                if(!user) {
                    done(null, false, { message: 'Invalid username/password' });

                    return Promise.reject('Failed auth');
                }

                bcrypt.compare(password, user.password, function(err, valid) {
                    if(err) {
                        logger.info(err.message);

                        return done(err);
                    }

                    if(!valid) {
                        return done(null, false, { message: 'Invalid username/password' });
                    }

                    return done(null, {
                        username: user.username,
                        email: user.email,
                        emailHash: user.emailHash,
                        _id: user._id,
                        admin: user.admin,
                        settings: user.settings || {},
                        promptedActionWindows: user.promptedActionWindows || defaultWindows,
                        permissions: user.permissions || {}
                    });
                });
            })
            .catch(err => {
                done(err);

                logger.info(err);
            });
    }

    serializeUser(user, done) {
        if(user) {
            done(null, user._id);
        }
    }

    deserializeUser(id, done) {
        this.userService.getUserById(id)
            .then(user => {
                if(!user) {
                    return done(new Error('user not found'));
                }

                done(null, {
                    username: user.username,
                    email: user.email,
                    emailHash: user.emailHash,
                    _id: user._id,
                    admin: user.admin,
                    settings: user.settings || {},
                    promptedActionWindows: user.promptedActionWindows || defaultWindows,
                    permissions: user.permissions || {}
                });
            });
    }
}

module.exports = Server;
