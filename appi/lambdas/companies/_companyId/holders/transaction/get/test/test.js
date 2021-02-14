const assert = require('assert');
const lambda = require('../');

describe('Holders transaction', function() {
      it( `handler exists`, function( done ) {

            assert(lambda.handler !== undefined);
            done();
        });
    
});

