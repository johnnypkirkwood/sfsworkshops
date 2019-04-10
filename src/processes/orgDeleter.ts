import * as logger from 'heroku-logger';

import { execProm } from '../lib/execProm';
import { getDeleteQueueSize, getDeleteRequest } from '../lib/redisNormal';
import { auth, getKeypath } from './../lib/hubAuth';


(async () => {
    const delQueueInitialSize = await getDeleteQueueSize();
    
    if (delQueueInitialSize > 0) {
        logger.debug(`deleting ${delQueueInitialSize} orgs`);
        // auth to the hub
        const keypath = await getKeypath();
        await auth();
        
        // keep deleting until the queue is empty
        try {
            while (await getDeleteQueueSize() > 0) { 

                // pull from the delete Request Queue
                const deleteReq = await getDeleteRequest();
                logger.debug(`deleting org with username ${deleteReq.username}`);
    
                // auth to the org
                await execProm(
                    `sfdx force:auth:jwt:grant --json --clientid ${
                    process.env.CONSUMERKEY
                    } --username ${
                        deleteReq.username
                    } --jwtkeyfile ${keypath} --instanceurl https://test.salesforce.com -s`
                );
    
                //delete it
                await execProm(`sfdx force:org:delete -p -u ${deleteReq.username}`);
            }
        } catch (e) {
            logger.error(e);
        }
        

    } else {
        logger.debug('no orgs to delete');
    }
    process.exit(0);

})();