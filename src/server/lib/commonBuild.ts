// serves as a shared build path for pool and non-pool orgs
import fs from 'fs-extra';
import logger from 'heroku-logger';

import { deployRequest } from './types';
import { cdsPublish, putHerokuCDS } from './redisNormal';
import { lineParse } from './lineParse';
import { lineRunner } from './lines';
import { timesToGA } from './timeTracking';
import { execProm } from './execProm';
import { utilities } from './utilities';
import { poolParse } from './poolParse';
import { CDS } from './CDS';

const build = async (msgJSON: deployRequest) => {
    fs.ensureDirSync('tmp');

    let clientResult = new CDS({
        deployId: msgJSON.deployId,
        browserStartTime: msgJSON.createdTimestamp,
        isPool: msgJSON.pool,
        isByoo: msgJSON.byoo && typeof msgJSON.byoo.accessToken === 'string'
    });

    // get something to redis as soon as possible
    await cdsPublish(clientResult);

    const gitCloneCmd = utilities.getCloneCommand(msgJSON);

    try {
        const gitCloneResult = await execProm(gitCloneCmd, { cwd: 'tmp' });
        logger.debug(`deployQueueCheck: ${gitCloneResult.stderr}`);
        clientResult.commandResults.push({
            command: gitCloneCmd,
            raw: gitCloneResult.stderr
        });
        await cdsPublish(clientResult);
    } catch (err) {
        logger.warn(`deployQueueCheck: bad repo--https://github.com/${msgJSON.username}/${msgJSON.repo}.git`);
        clientResult.errors.push({
            command: gitCloneCmd,
            error: err.stderr,
            raw: err
        });
        clientResult.complete = true;
        await cdsPublish(clientResult);
        return clientResult;
    }

    // if you passed in a custom email address, we need to edit the config file and add the adminEmail property
    if (msgJSON.email) {
        logger.debug('deployQueueCheck: write a file for custom email address', msgJSON);
        const location = `tmp/${msgJSON.deployId}/config/project-scratch-def.json`;
        const configFileJSON = await fs.readJSON(location);
        configFileJSON.adminEmail = msgJSON.email;
        await fs.writeJSON(location, configFileJSON);
    }

    const orgInitPath = `tmp/${msgJSON.deployId}/orgInit.sh`;

    // grab the deploy script from the repo
    logger.debug(`deployQueueCheck: going to look in the directory ${orgInitPath}`);

    // use the default file if there's not one
    if (!fs.existsSync(orgInitPath)) {
        logger.debug('deployQueueCheck: no orgInit.sh.  Will use default');
        fs.writeFileSync(
            orgInitPath,
            `sfdx force:org:create -f config/project-scratch-def.json -s -d 1
        sfdx force:source:push
        sfdx force:org:open`
        );
    }

    // reads the lines and removes and stores the org open line(s)
    if (msgJSON.pool) {
        clientResult.poolLines = await poolParse(orgInitPath);
    }

    let parsedLines: string[];
    try {
        parsedLines = await lineParse(msgJSON);
        clientResult.lineCount = parsedLines.length + 1; //1 extra to account for the git clone command
        await cdsPublish(clientResult);
    } catch (e) {
        clientResult.errors.push({
            command: 'line parsing',
            error: e,
            raw: e
        });
        clientResult.complete = true;
        await cdsPublish(clientResult);
        return clientResult;
    }

    const localLineRunner = new lineRunner(msgJSON, parsedLines, clientResult);

    try {
        clientResult = <CDS>await localLineRunner.runLines();
        timesToGA(msgJSON, clientResult);
    } catch (e) {
        logger.error('deployQueueCheck: Deployment error', msgJSON);
        logger.error('deployQueueCheck: Deployment error', e);
    }

    await fs.remove(`tmp/${msgJSON.deployId}`);

    // store in herokuCDS queue for synchronized deletion
    if (clientResult.herokuResults.length > 0) {
        await putHerokuCDS(clientResult);
    }
    return clientResult;
};

export { build };