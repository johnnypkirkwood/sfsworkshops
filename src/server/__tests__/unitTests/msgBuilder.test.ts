import { deployMsgBuilder } from '../../lib/deployMsgBuilder';

describe('urlTestsMaster', () => {
    test('handles master repos', () => {
        const req = {
            query: {
                template: 'https://github.com/mshanemc/cg4Integrate'
            }
        };

        const message = deployMsgBuilder(req);
        expect(message.repo).toBe('cg4Integrate');
        expect(message.username).toBe('mshanemc');
        expect(message.branch).toBeUndefined();

        // multi
        expect(message.repos).toHaveLength(1);
        expect(message.repos[0].repo).toBe('cg4Integrate');
        expect(message.repos[0].username).toBe('mshanemc');
        expect(message.repos[0].branch).toBeUndefined();

        expect(message.deployId).toBeTruthy();
        // username-repo-timestamp
        expect(message.deployId.split('-').length).toBe(3);
        expect(message.deployId.split('-')[0]).toBe(message.username);
        expect(message.deployId.split('-')[1]).toBe(message.repo);
    });
});

describe('urlTestsBranch', () => {
    test('handles branch repos', () => {
        const req = {
            query: {
                template: 'https://github.com/mshanemc/cg4Integrate/tree/passwordSet'
            }
        };

        const message = deployMsgBuilder(req);
        expect(message.username).toBe('mshanemc');
        expect(message.repo).toBe('cg4Integrate');
        expect(message.branch).toBe('passwordSet');
        expect(message.firstname).toBeUndefined();
        expect(message.lastname).toBeUndefined();
        expect(message.email).toBeUndefined();

        // multi
        expect(message.repos).toHaveLength(1);

        expect(message.repos[0].username).toBe('mshanemc');
        expect(message.repos[0].repo).toBe('cg4Integrate');
        expect(message.repos[0].branch).toBe('passwordSet');

        expect(message.deployId).toBeTruthy();
        // username-repo-timestamp
        expect(message.deployId.split('-').length).toBe(3);
        expect(message.deployId.split('-')[0]).toBe(message.username);
        expect(message.deployId.split('-')[1]).toBe(message.repo);
    });

    test('prevents bad urls', () => {
        const req = {
            query: {
                template: 'https://github.com/mshanemc/df17IntegrationWorkshops/tree/master; wget http://'
            }
        };

        expect(() => deployMsgBuilder(req)).toThrow();
    });
});

describe('userinfo', () => {
    test('handles email, firstname, lastname', () => {
        const req = {
            query: {
                template: 'https://github.com/mshanemc/cg4Integrate/tree/passwordSet',
                firstname: 'shane',
                lastname: 'mclaughlin',
                email: 'shane.mclaughlin@salesforce.com'
            }
        };

        const message = deployMsgBuilder(req);

        expect(message.username).toBe('mshanemc');
        expect(message.repo).toBe('cg4Integrate');
        expect(message.branch).toBe('passwordSet');
        expect(message.firstname).toBe('shane');
        expect(message.lastname).toBe('mclaughlin');
        expect(message.email).toBe('shane.mclaughlin@salesforce.com');

        expect(message.deployId).toBeTruthy();
        // username-repo-timestamp
        expect(message.deployId.split('-').length).toBe(3);
        expect(message.deployId.split('-')[0]).toBe(message.username);
        expect(message.deployId.split('-')[1]).toBe(message.repo);
    });
});

describe('multi-template', () => {
    test('handles array of tempalte', () => {
        const req = {
            query: {
                template: ['https://github.com/mshanemc/cg4Integrate', 'https://github.com/mshanemc/df17IntegrationWorkshops']
            }
        };

        const message = deployMsgBuilder(req);

        // multi
        expect(message.repos).toHaveLength(2);
        expect(message.repos[0].repo).toBe('cg4Integrate');
        expect(message.repos[0].username).toBe('mshanemc');
        expect(message.repos[0].branch).toBeUndefined();

        expect(message.repos[1].repo).toBe('df17IntegrationWorkshops');
        expect(message.repos[1].username).toBe('mshanemc');
        expect(message.repos[1].branch).toBeUndefined();

        expect(message.deployId).toBeTruthy();
        // username-repo-timestamp
        expect(message.deployId.split('-').length).toBe(3);
        expect(message.deployId.split('-')[0]).toBe(message.username);
        expect(message.deployId.split('-')[1]).toBe(message.repo);
    });

    test('handles breanch in array of tempalte', () => {
        const req = {
            query: {
                template: ['https://github.com/mshanemc/cg4Integrate/tree/passwordSet', 'https://github.com/mshanemc/df17IntegrationWorkshops']
            }
        };

        const message = deployMsgBuilder(req);

        // multi
        expect(message.repos).toHaveLength(2);
        expect(message.repos[0].repo).toBe('cg4Integrate');
        expect(message.repos[0].username).toBe('mshanemc');
        expect(message.repos[0].branch).toBe('passwordSet');

        expect(message.repos[1].repo).toBe('df17IntegrationWorkshops');
        expect(message.repos[1].username).toBe('mshanemc');
        expect(message.repos[1].branch).toBeUndefined();

        expect(message.deployId).toBeTruthy();
        // username-repo-timestamp
        expect(message.deployId.split('-').length).toBe(3);
        expect(message.deployId.split('-')[0]).toBe(message.username);
        expect(message.deployId.split('-')[1]).toBe(message.repo);
    });
});
