var assert = require('assert');

const convert = require('../index').convert;
describe('Estimate', function() {
      it( `Convert function generate expected output`, function( done ) {
          
            const data = [ [ { section: 'eps_estimation_actual',
            calendaryear: '2016',
            calendarquarter: '3',
            value: '0.730000000' },
            { section: 'eps_estimation_actual',
            calendaryear: '2016',
            calendarquarter: '4',
            value: '0.500000000' },
            { section: 'eps_estimation_actual',
            calendaryear: '2017',
            calendarquarter: '1',
            value: '0.680000000' },
            { section: 'eps_estimation_actual',
            calendaryear: '2017',
            calendarquarter: '2',
            value: '0.600000000' },
            { section: 'eps_estimation_actual',
            calendaryear: '2017',
            calendarquarter: '3',
            value: '0.570000000' },
            { section: 'eps_estimation_actual',
            calendaryear: '2017',
            calendarquarter: '4',
            value: '0.460000000' },
            { section: 'eps_estimation_actual',
            calendaryear: '2018',
            calendarquarter: '1',
            value: '0.680000000' },
            { section: 'eps_estimation_actual',
            calendaryear: '2018',
            calendarquarter: '2',
            value: '0.690000000' },
            { section: 'eps_estimation_actual',
            calendaryear: '2018',
            calendarquarter: '3',
            value: '0.670000000' } ],
            [ { section: 'eps_estimation_estimated',
            calendaryear: '2017',
            calendarquarter: '3',
            value: '0.479540000' },
            { section: 'eps_estimation_estimated',
            calendaryear: '2017',
            calendarquarter: '4',
            value: '0.404660000' },
            { section: 'eps_estimation_estimated',
            calendaryear: '2018',
            calendarquarter: '1',
            value: '0.528050000' },
            { section: 'eps_estimation_estimated',
            calendaryear: '2018',
            calendarquarter: '2',
            value: '0.638470000' },
            { section: 'eps_estimation_estimated',
            calendaryear: '2018',
            calendarquarter: '3',
            value: '0.630460000' } ] ];

            const res = convert(data);

            const mockData = {"coordinates":[{"actual":{"x":"2017 Q3","y":"0.570000000"},"estimate":{"x":"2017 Q3","y":"0.479540000"}},{"actual":{"x":"2017 Q4","y":"0.460000000"},"estimate":{"x":"2017 Q4","y":"0.404660000"}},{"actual":{"x":"2018 Q1","y":"0.680000000"},"estimate":{"x":"2018 Q1","y":"0.528050000"}},{"actual":{"x":"2018 Q2","y":"0.690000000"},"estimate":{"x":"2018 Q2","y":"0.638470000"}},{"actual":{"x":"2018 Q3","y":"0.670000000"},"estimate":{"x":"2018 Q3","y":"0.630460000"}}]}

            assert(JSON.stringify(res) === JSON.stringify(mockData));
            done();
        });
    
});

