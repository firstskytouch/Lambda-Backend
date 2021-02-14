const assert = require('assert');

const convert = require('../index').convert;
describe('Finance balance', () => {
      it( `Convert function generate expected output`, ( done ) => {
            let mock = require('./mock.json');
            mock[0] = mock[0].map(x => {
                  x.periodenddate = new Date(x.periodenddate);
                  return x;
            })
            const res = convert(mock);
            const output = require('./output.json');

            console.log(JSON.stringify(res));

            assert(JSON.stringify(res) === JSON.stringify(output));
            done();
        });
    
});

