'use strict';

exports = module.exports = {};

const AWS = require('aws-sdk');
const pg = require('pg');
const ssm = new AWS.SSM({region: process.env.AWS_REGION});

/** 
 * Gets a list of values for the specified SSM parameter names
 *
 * @method getCredentials
 * @param {Array<String> | String} names - an array of parameter names or a parameter name
 * @returns {Promise} A promise that returns the parameters as strings if resolved
 * and an error if rejected.
 */
const getParameters = (names) => {
    return new Promise((resolve, reject) => {
        const params = {
            Names: Array.isArray(names) ? names : [names],
            WithDecryption: true
        };

        ssm.getParameters(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                let res = {};
                data.Parameters.forEach((param) => {
                  res[param.Name] = param.Value;
                });
                resolve(res);
            }
        });
    });
};

/** 
 * Gets the Redshift credentials from SSM
 *
 * @method getRedshiftCredentials
 * @returns {Promise} A promise that returns the parameters as an object if resolved
 * and an error if rejected.
 */
const getRedshiftCredentials = (env) => {
    const params = [
        `/appi/data/redshift/host`,
        `/appi/data/redshift/${env}/db-name`,
        `/appi/data/redshift/user`,
        `/appi/data/redshift/pass`
    ];

    return new Promise((resolve, reject) => {
        getParameters(params)
        .then(creds => {
            resolve({
                host:   creds[`/appi/data/redshift/host`],
                dbname: creds[`/appi/data/redshift/${env}/db-name`],
                user:   creds[`/appi/data/redshift/user`],
                pass:   creds[`/appi/data/redshift/pass`]
            });
        })
        .catch(err => {
            reject(err);
        });
    });
};

const addSqlWherePredicates = (sqlStatement, predicateKey, predicateValue) => {
  var noPredicatePos = sqlStatement.indexOf('NO_PREDICATE');
  if (noPredicatePos > -1) {
    return sqlStatement.substr(noPredicatePos + 13);
  }

  var wherePos = sqlStatement.indexOf('where');
  var semicolonPos = sqlStatement.indexOf(';');

  if(wherePos > -1) {
    return sqlStatement.substr(0, wherePos + 5) + ` ${predicateKey} = '${escape(predicateValue)}' AND` + sqlStatement.substr(wherePos + 5);
  } else if (semicolonPos > -1) {
    return sqlStatement.substr(0, semicolonPos) + ` WHERE ${predicateKey} = '${escape(predicateValue)}';`;
  }

  return sqlStatement;
};

const query = (event, queryObj, credentials) => {
  return new Promise((resolve, reject) => {
    let client = {
      user: credentials.user,
      database: credentials.dbname,
      password: credentials.pass,
      port: 5439,
      host: credentials.host,
      ssl: 'true'
    };

    let pgClient = new pg.Client(client);
    let queries =  queryObj.queries;

    //add where predicates
    Object.keys(queries).forEach((q) => {
      queries[q] = addSqlWherePredicates(queries[q], queryObj.query_predicate_name, event.companyId);
      console.log(queries[q]);
    });

    console.log('connecting');
    pgClient.connect(err => {
        if (err) {
          reject(err);
        }

        //run all queries
        const promises = queries.map(query => {
          console.log(query);
          return new Promise((resolveLocal, rejectLocal) => {
            pgClient.query(`${query}`, (err, result) => {
              if (err) {
                console.log(err);
                rejectLocal(err, err.stack);
              }

              if (!result || !result.rows) {
                resolveLocal({});
              }

              resolveLocal(result.rows);
            });
          });
        });

        //end the connection and return the result
        Promise.all(promises).then(resultObjects => {
          pgClient.end(err => {
            if (err) { console.log(err); reject(err, err.stack); }
            console.log('Connection closed.');
          });
          resolve(resultObjects);
        }).catch(err => {
          reject(err, err.stack);
        });
    });
  });
};

exports = module.exports = {
  getRedshiftCredentials,
  query
};