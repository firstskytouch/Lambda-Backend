const assert = require('assert');

const run = require('../index').run;

describe('Programs PUT', () => {
    it(`400 expected`, async () => {

        const event = {
        };

        return await run(event).catch(e => {
              console.log(e);
            assert(e.statusCode === 400);
        });
    });
});