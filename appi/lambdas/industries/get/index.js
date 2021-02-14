'use strict';

const redshift = require('./shared/redshift.js');
const lambda = require('./shared/lambda');
const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
    log: 'info'
});

const stage = process.env.stage;

const risks = [{
        value: "main_a_side",
        label: "A Side"
    },
    {
        value: "international",
        label: "International"
    },
    {
        value: "investment",
        label: "Investment"
    },
    {
        value: "investment_banking",
        label: "Investment Banking"
    },
    {
        value: "main_sca",
        label: "SCA"
    },
    {
        value: "sec_complaint",
        label: "SEC Investigation"
    }
]

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {
    const categories = [];
    const oldestYear = 2002;

    let numOfYears =  (new Date()).getFullYear() - oldestYear + 1;
    if (numOfYears > 20) {
        numOfYears = 20;
    }
    
    const starYear = new Date().getFullYear() - numOfYears + 1;
    const startDate = new Date(starYear, 0, 1);

    let query = {
        "queries": [],
        "query_predicate_name": "",
        "metadata": {}
    };
    
    const cikQuery = `NO_PREDICATE
        select pg.symbolvalue::integer, pg.companyid, pg.industry_group, pg.year, pg.qtr 
        from sp_spectrum.Companies_Peer_Groups pg 
        JOIN api_schema.companies_overhead s on lower(s.industry_group) = lower(pg.industry_group)
        WHERE s.symbolvalue ='${event.companyId}'
    `;
    
	const chartQuery = `NO_PREDICATE 
                        select s.* from peergroupcasehistory s join (
                            select industry_group from api_schema.companies_overhead where symbolvalue = '${event.companyId}' limit 1) pg 
                            on 
                            lower(pg.industry_group) = lower(s.ind_level_value)
                            and ind_level = 'industry_group' and size_level is null
                            where s.year >= ${starYear}
                            order by year
                            `;
                            
    if (event.type === 'chart') {
        query.queries = [chartQuery];
    } else {
        query.queries = [chartQuery, cikQuery];
    }

    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const r_res = await redshift.query(event, query, creds);

    const chartData = r_res[0].map((x) => {
        Object.keys(x).forEach((key) => {
            if (typeof x[key] === 'string' && isNaN(x[key]) === false) {
                x[key] = Number(x[key]);
            } else if (x[key] === null) {
                x[key] = 0;
            }
        });
        return x;
    });

        const dt = new Date();

        for (let i = (numOfYears - 1); i >= 0; i--) {
            categories.push({
                label: dt.getFullYear() - i
            });
        }

        if (event.type === 'chart') {
            let response = {
                chart: chartData,
                py_axis_name: "Case Count",
                sy_axis_name: "Frequency",
                categories: categories
            };

            return response;
        }

        if (!r_res || r_res.length < 1) {
            return null;
        }

        const stats = {};
        const gics = {};
        const convertGics = (str) => {
            if (str.indexOf('-') !== -1) {
                const pieces = str.split('-');
                return pieces[1].trim();
            }
            return str;
        }

        const ciks = r_res[1].map(x => {

            gics[x.symbolvalue] = convertGics(x.industry_group);

            if (stats[x.year] === undefined) {
                stats[x.year] = [];
            }
            if (stats[x.year].indexOf(x.symbolvalue) === -1) {
                stats[x.year].push(x.symbolvalue);
            }

            return x.symbolvalue.toString();
        });


        const esType = 'Complaint';
        const esIndex = `${stage}.sca`;
        const date = 'filing_date';

        startDate.setHours(0, 0, 0, 0);

        const esMatch = {
            bool: {
                must: [{
                        "constant_score": {
                            "filter": {
                                "terms": {
                                    "cik": Array.from(new Set(ciks))
                                }
                            }
                        }
                    },
                    {
                        "range": {
                            "filing_date": {
                                "gte": startDate.getTime(),
                                "format": "epoch_millis"
                            }
                        }
                    }
                ]
            }
        }

        const data = await esClient.search({
            index: esIndex,
            type: esType,
            body: {
                _source: ['cik', 'attachment_name', 'international', 'mscad_id', 'investment', 'investment_banking',
                    'main_sca', 'main_a_side', 'sec_complaint', 'total_amount', 'casestatus', 'filing_date',
                    'case_description', '_id', 'company_name', 'undocumented'
                ],
                size: 10000,
                query: esMatch,
                sort: [{
                    [date]: {
                        order: "desc"
                    }
                }]
            }}
        );

        let results = [];
            
        const isSettled = (casestatus) => {
            return ['Settled', 'Tentative Settlement', 'Proposed Settlement', 'Stayed', 'Award', 'Estimate'].indexOf(casestatus) !== -1;
        };

        data.hits.hits.map(h => {
            let tempFillingDate = null;
            if (esType === 'Complaint') {
                let skip = false;
                if (!h._source.filing_date) {
                    skip = true;
                } else {
                    tempFillingDate = new Date(h._source.filing_date);
                    if (stats[tempFillingDate.getFullYear()] && stats[tempFillingDate.getFullYear()].indexOf(parseInt(h._source.cik)) === -1) {
                        skip = true;
                    }
                }

                if (skip === false) {
                    let total_amount;
                    if (h._source.total_amount) {
                        if (typeof h._source.total_amount === 'string' && isNaN(h._source.total_amount) === false) {
                            total_amount = parseInt(h._source.total_amount);
                        } else {
                            total_amount = h._source.total_amount;
                        }
                    }

                    if(total_amount === undefined || isSettled(h._source.casestatus) === false) {
                        total_amount = null
                    }

                    results.push({
                        cik: h._source.cik,
                        title: `${h._source.mscad_id} | ${h._source.company_name}`, //h._source.company_name,
                        undocumented: h._source.undocumented ? true : false,
                        // subtitle: h._source.undocumented ? h._source.mscad_id + " (Undocumented)" : h._source.mscad_id,
                        subtitle: h._source.undocumented || !h._source.attachment_name ? "(Undocumented)" : (
                            h._source.attachment_name.length > 66 ?
                            h._source.attachment_name.substr(0, 50) + '...' + h._source.attachment_name.substr(h._source.attachment_name.length - 3) :
                            h._source.attachment_name
                        ),
                        type: esType,
                        risks: [{
                                riskName: "International",
                                riskFlag: h._source.international ? true : false
                            },
                            {
                                riskName: "Investment",
                                riskFlag: h._source.investment ? true : false
                            },
                            {
                                riskName: "Investment Banking",
                                riskFlag: h._source.investment_banking ? true : false
                            },
                            {
                                riskName: "SCA",
                                riskFlag: h._source.main_sca ? true : false
                            },
                            {
                                riskName: "A Side",
                                riskFlag: h._source.main_a_side ? true : false
                            },
                            {
                                riskName: "SEC Investigation",
                                riskFlag: h._source.sec_complaint ? true : false
                            }
                        ],
                        gics: gics[h._source.cik] ? gics[h._source.cik] : null,
                        amount: total_amount === null ? null : `$${total_amount}`,
                        status: h._source.casestatus ? h._source.casestatus : "N/A",
                        filingDate: h._source.filing_date ? h._source.filing_date.substr(0, 10) : "N/A",
                        short_description: h._source.case_description ? h._source.case_description : "No case description found.",
                        document_id: h._id
                    });
                }
            }
        });

        results = results = results.filter((obj, index, self) =>
            self.findIndex(o => o.subtitle === obj.subtitle && o.title === obj.title) === index
        );

        results = results.sort((a, b) => {
            var x = new Date(a['filingDate']);
            var y = new Date(b['filingDate']);
            return ((x > y) ? -1 : ((x < y) ? 1 : 0));
        });

        
        let response = {
            caseStatus: risks,
            chart: chartData,
            documents: results,
            py_axis_name: "Case Count",
            sy_axis_name: "Frequency",
            categories: categories
        };

        return response;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};