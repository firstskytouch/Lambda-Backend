const assert = require('assert');

const run = require('../index').run;

describe('User Worksheet PUT', () => {
    it(`400 expected`, async () => {

        const event = {
            user: {
                userId: '23232'
            },
            // cik: '0000825953',
            company_name: 'Fidelity Bancshares (N.C.), Inc.',
            ticker: 'FDBN',
            state: 'wip',
            submission: {
                submission_id: 'sfad',
                policy_id: 'fdsadfsa',
                agency_id: 'dfsafsda',
                state: '',
                effective_date: '2019-06-21',
                type: 'xs',
                renewal: false,
                location: 'asdffds',
                submitted: true
            },
            notes: [{
                    note_id: '1',
                    note_text: '',
                    note_page: 'overview'
                },
                {
                    note_id: '2',
                    note_text: '',
                    note_page: 'trading'
                },
                {
                    note_id: '3',
                    note_text: '',
                    note_page: 'financial'
                },
                {
                    note_id: '4',
                    note_text: '',
                    note_page: 'risk'
                },
                {
                    note_id: '5',
                    note_text: '',
                    note_page: 'news'
                }
            ]
        };

        return await run(event).catch(e => {
            assert(e.statusCode === 400);
        });
    });
});