"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger = require("heroku-logger");
const express = require("express");
const ua = require("universal-analytics");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const path = require("path");
const favicon = require("serve-favicon");
const redisNormal_1 = require("./lib/redisNormal");
const redisSub = require("./lib/redisSubscribe");
const msgBuilder = require("./lib/deployMsgBuilder");
const utilities = require("./lib/utilities");
const org62LeadCapture = require("./lib/trialLeadCreate");
const app = express();
const port = process.env.PORT || 8443;
const server = app.listen(port, () => {
    logger.info(`Example app listening on port ${port}!`);
});
const wss = new WebSocket.Server({ server, clientTracking: true });
app.use(favicon(path.join(__dirname, 'assets/favicons', 'favicon.ico')));
app.use(express.static('built/assets'));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.post('/trial', (req, res, next) => {
    try {
        const message = msgBuilder(req);
        logger.debug('trial request', message);
        if (process.env.sfdcLeadCaptureServlet) {
            org62LeadCapture(req.body);
        }
        if (message.visitor) {
            message.visitor.pageview('/trial').send();
            message.visitor.event('Repo', message.template).send();
        }
        utilities.runHerokuBuilder();
        redisNormal_1.putDeployRequest(message).then(() => {
            res.redirect(`/deploying/trial/${message.deployId.trim()}`);
        });
    }
    catch (e) {
        logger.error(`An error occurred in the trial page: ${req.body}`);
        logger.error(e);
        next(e);
    }
});
app.post('/delete', async (req, res, next) => {
    try {
        await redisNormal_1.deleteOrg(req.body.username);
        utilities.runHerokuBuilder();
        res.status(302).send('/deleteConfirm');
    }
    catch (e) {
        logger.error(`An error occurred in the redis rpush to the delete queue: ${req.body}`);
        logger.error(e);
        next(e);
    }
    ;
});
app.get('/deleteConfirm', (req, res, next) => res.render('pages/deleteConfirm'));
app.get('/launch', async (req, res, next) => {
    if (req.query.email === 'required') {
        return res.render('pages/userinfo', {
            template: req.query.template
        });
    }
    try {
        const message = msgBuilder(req);
        if (message.visitor) {
            message.visitor.pageview('/launch').send();
            message.visitor.event('Repo', message.template).send();
        }
        utilities.runHerokuBuilder();
        await redisNormal_1.putDeployRequest(message);
        return res.redirect(`/deploying/deployer/${message.deployId.trim()}`);
    }
    catch (e) {
        logger.error(`launch msg error`, e);
        next(e);
    }
});
app.get('/deploying/:format/:deployId', (req, res, next) => {
    if (req.params.format === 'deployer') {
        res.render('pages/messages', {
            deployId: req.params.deployId.trim()
        });
    }
    else if (req.params.format === 'trial') {
        res.render('pages/trialLoading', {
            deployId: req.params.deployId.trim()
        });
    }
});
app.get('/userinfo', (req, res, next) => {
    res.render('pages/userinfo', {
        template: req.query.template
    });
});
app.get('/pools', async (req, res, next) => {
    const keys = await redisNormal_1.getKeys();
    res.send(keys);
});
app.get('/testform', (req, res, next) => {
    res.render('pages/testForm');
});
app.get('/', (req, res, next) => {
    res.json({
        message: 'There is nothing at /.  See the docs for valid paths.'
    });
});
app.get('*', (req, res, next) => {
    setImmediate(() => {
        next(new Error('Route not found'));
    });
});
app.use((error, req, res, next) => {
    if (process.env.UA_ID) {
        const visitor = ua(process.env.UA_ID);
        visitor.event('Error', req.query.template).send();
    }
    logger.error(`request failed: ${req.url}`);
    return res.render('pages/error', {
        customError: error
    });
});
wss.on('connection', (ws, req) => {
    logger.debug(`connection on url ${req.url}`);
    ws.url = req.url;
});
redisSub.subscribe(redisNormal_1.cdsExchange).then(() => {
    logger.info(`subscribed to Redis channel ${redisNormal_1.cdsExchange}`);
});
redisSub.on('message', (channel, message) => {
    const msgJSON = JSON.parse(message);
    wss.clients.forEach((client) => {
        if (client.url.includes(msgJSON.deployId.trim())) {
            client.send(JSON.stringify(msgJSON));
            if (msgJSON.complete) {
                client.close();
            }
        }
    });
});
