'use strict';

const es = require('elasticsearch');
const esClient = new es.Client({
    host: `https://${process.env.elasticSearchEndpoint}`,
    log: 'trace'
});
const lambda = require('./shared/lambda');
const stage = process.env.stage;

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async (event, context, callback) => {

    if (!event.companyId) {
        console.log('Request does not have a companyId.');
        throw {
            statusCode: 400,
            errorMessage: 'Request does not have a companyId.'
        };
    }

    if (!event.documentType) {
        console.log('Request does not have a search type.');
        throw {
            statusCode: 400,
            errorMessage: 'Request does not have a search type.'
        };
    }

    const docType = event.documentType; //todo add document match
    const esIndex = docType === 'Complaint' ? `${stage}.sca` : `${stage}.sec`;
    const esMatch = docType === 'Complaint' ? { cik: Number(event.companyId).toString() } : { central_index_key: event.companyId };
    const date = docType === 'Complaint' ? 'filing_date' : 'filed_as_of_date';
    
    const body = {
        query: {
            bool: {
                must: [
                    {
                        match: esMatch
                    }
                ]
            }
        },
        size: 10000
    };

    let options;

    const notificationOptions = [
        "Change in Accounting Principles",
        "Change in Revenue Recognition",
        "Debt Covenant Violations",
        "Environmental Remediation Liabilities",
        "FDIC Orders (Cease & Desist, Memorandum of Understanding, etc.)",
        "Financial Restatements",
        "Going Concern Warning",
        "Goodwill Impairment",
        "Level 3 Assets",
        "Pending Litigation",
        "Material Weaknesses",
        "Underfunded Pensions Plans",
        "Related Party Transactions",
        "Restructuring Activities",
        "Securitization & Factoring",
        "Write-Offs",
    ];

    let sort = [
        {
            [date]: { order: 'desc' }
        }
    ];

    if (docType === 'Complaint') {
        sort.push({
            'batchdate': { order: 'desc' }
        });
    } else {
        body.query.bool.must.push({
            term: {
                'conformed_submission_type.keyword': docType === 'Proxy' ? 'DEF 14A' : docType
            }
        });
    }

    body.sort = sort;

    const result = await esClient.search({ 
        index: esIndex, 
        body: body 
    });

    let results = result.hits.hits.map((h) => {
        if (docType === 'Complaint') {
            return {
                title: `${h._source.mscad_id} | ${h._source.company_name}`,
                attachment_name: h._source.attachment_name,
                undocumented: h._source.undocumented ? true : false,
                subtitle: h._source.undocumented ? "(Undocumented)" : 
                          (   
                            h._source.attachment_name.length > 66 ? 
                            h._source.attachment_name.substr(0,60) + '...' + h._source.attachment_name.substr(h._source.attachment_name.length - 3) :
                            h._source.attachment_name
                          ),
                type: docType,
                risks: [
                    {
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
                amount: h._source.total_amount ? `$${h._source.total_amount}` : "$0",
                status: h._source.casestatus ? h._source.casestatus : "N/A",
                filingDate: h._source.filing_date ? h._source.filing_date.substr(0,10) : "N/A",
                short_description: h._source.case_description ? h._source.case_description : "No case description found.",
                document_id: h._id
            };
        } else if (docType === '8-K' || docType === 'Proxy') {
            return {
                name: h._source.company_conformed_name,
                type: h._source.conformed_submission_type === 'DEF 14A' ? 'Proxy' : h._source.conformed_submission_type,
                notifications: h._source.item_information,
                filingDate: h._source.filed_as_of_date,
                document_id: h._id
            };
        } else {
            options = notificationOptions;

            return {
                name: h._source.company_conformed_name,
                type: h._source.conformed_submission_type,
                notifications: {
                    "ITEM_INFORMATION_1": h._source.ri_chg_acctg_principle ? notificationOptions[0] : undefined,
                    "ITEM_INFORMATION_2": h._source.ri_chg_rev_recognition ? notificationOptions[1] : undefined,
                    "ITEM_INFORMATION_3": h._source.ri_debt_covenant ? notificationOptions[2] : undefined,
                    "ITEM_INFORMATION_4": h._source.ri_env_liabilities ? notificationOptions[3] : undefined,
                    "ITEM_INFORMATION_5": h._source.ri_fdic_orders ? notificationOptions[4] : undefined,
                    "ITEM_INFORMATION_6": h._source.ri_fin_restatements ? notificationOptions[5] : undefined,
                    "ITEM_INFORMATION_7": h._source.ri_going_concern ? notificationOptions[6] : undefined,
                    "ITEM_INFORMATION_8": h._source.ri_goodwill_impairment ? notificationOptions[7] : undefined,
                    "ITEM_INFORMATION_9": h._source.ri_level3_assets ? notificationOptions[8] : undefined,
                    "ITEM_INFORMATION_10": h._source.ri_litigation && h._source.ri_litigation != 'False' ? notificationOptions[9] : undefined,
                    "ITEM_INFORMATION_11": h._source.ri_material_weakness ? notificationOptions[10] : undefined,
                    "ITEM_INFORMATION_12": h._source.ri_pensions ? notificationOptions[11] : undefined,
                    "ITEM_INFORMATION_13": h._source.ri_related_parties ? notificationOptions[12] : undefined,
                    "ITEM_INFORMATION_14": h._source.ri_restructuring ? notificationOptions[13] : undefined,
                    "ITEM_INFORMATION_15": h._source.ri_securitization_factoring ? notificationOptions[14] : undefined,
                    "ITEM_INFORMATION_16": h._source.ri_write_offs ? notificationOptions[15] : undefined,
                },
                filingDate: h._source.filed_as_of_date,
                document_id: h._id
            };
        }
    });

    if (docType === 'Complaint') {
        results = results.filter((obj, index, self) => 
            self.findIndex(o => o.subtitle === obj.subtitle && o.title === obj.title) === index
        );
    } else {
        results = results.filter((obj, index, self) => 
            self.findIndex(o => o.name === obj.name && o.type === obj.type && o.filingDate === obj.filingDate) === index
        );
    }

    results = results.sort((a, b) => {
        var x = new Date(a['filingDate']); var y = new Date(b['filingDate']);
        return ((x > y) ? -1 : ((x < y) ? 1 : 0));
    });

    switch(docType) {
        case '8-K':
            options = [
                `Entry into a Material Definitive Agreement`,
                `Termination of a Material Definitive Agreement`,
                `Bankruptcy or Receivership`,
                `Mine Safety - Reporting of Shutdowns and Patterns of Violations`,
                `Completion of Acquisition or Disposition of Assets`,
                `Results of Operations and Financial Condition`,
                `Creation of a Direct Financial Obligation or an Obligation under an Off-Balance Sheet Arrangement of a Registrant`,
                `Triggering Events That Accelerate or Increase a Direct Financial Obligation or an Obligation under an Off-Balance Sheet Arrangement`,
                `Costs Associated with Exit or Disposal Activities`,
                `Material Impairments`,
                `Notice of Delisting or Failure to Satisfy a Continued Listing Rule or Standard; Transfer of Listing`,
                `Unregistered Sales of Equity Securities`,
                `Material Modification to Rights of Security Holders`,
                `Changes in Registrant's Certifying Accountant`,
                `Non-Reliance on Previously Issued Financial Statements or a Related Audit Report or Completed Interim Review`,
                `Changes in Control of Registrant`,
                `Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers: Compensatory Arrangements of Certain Officers`,
                `Amendments to Articles of Incorporation or Bylaws; Change in Fiscal Year`,
                `Temporary Suspension of Trading Under Registrant's Employee Benefit Plans`,
                `Amendment to Registrant's Code of Ethics, or Waiver of a Provision of the Code of Ethics`,
                `Change in Shell Company Status`,
                `Submission of Matters to a Vote of Security Holders`,
                `Shareholder Director Nominations`,
                `ABS Informational and Computational Material`,
                `Change of Servicer or Trustee`,
                `Change in Credit Enhancement or Other External Support`,
                `Failure to Make a Required Distribution`,
                `Securities Act Updating Disclosure`,
                `Regulation FD Disclosure`,
                `Other Events (The registrant can use this Item to report events that are not specifically called for by Form 8-K, that the registrant considers to be of importance to security holders.)`,
                `Financial Statements and Exhibits`
            ].sort();
        break;
      default:
        options = notificationOptions.sort();
        break;
    }

    return { 
        documents: results,
        options: options
    };
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};