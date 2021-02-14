'use strict';

const redshift = require('./shared/redshift.js');
const q = require('./query.json'); //performs a deep copy of the object
const moment = require('moment');
const millify = require('millify');
const lambda = require('./shared/lambda');

/** 
 * AWS Lambda invokes this method when the service executes your code.
 *
 * @method index.handler
 * @param {Object} event - AWS Lambda uses this parameter to pass in event data to the handler.
 * @param {Object} context - AWS Lambda uses this parameter to provide your handler the runtime information of the Lambda function that is executing.
 * @param {requestCallback} callback - You can use the optional callback to return information to the caller, otherwise return value is null.
 */
const handler = async(event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (!event.range) {
        console.log('Request does not have a range.');

        throw {
            statusCode: 400,
            errorMessage: 'Request does not have a range.'
        }
    }

    let query = JSON.parse(JSON.stringify( q ));
    
    const creds = await redshift.getRedshiftCredentials(process.env.stage);
    const data = await redshift.query(event, query, creds);

    if(!data || data.length < 1 || data[0].length < 1 || data[0][0].length < 1) {
        throw {
            statusCode: 404,
            errorMessage: 'Not Found'
        }
    }

    const stockChart = {
        x_axis_name: "Date",
        y_axis_name: "Stock Price ($)",
        currency: "",
        exchange: "",
        "52w_volume": "",
        "52w_price": "",
        company_index: {
            coordinates: []
        },
        sp500_index: {
            coordinates: []
        },
        nasdaq_index: {
            coordinates: []
        },
        dowj_index: {
            coordinates: []
        }
    };
    
    var min_date = "";

    Object.keys(data).map(queryResult => {
        Object.keys(data[queryResult]).map(row => {
            let coordinate = {
                point_metrics: {
                    "trading_volume": "",
                    "stock_price": "",
                    "stock_percent_change": "",
                    "trading_percent_change": ""
                },
                x_stock_value: "",
                y_stock_date: ""
            };

            let dowj_coordinate = {
                x_stock_value: "",
                y_stock_date: ""
            };

            let nasdaq_coordinate = {
                x_stock_value: "",
                y_stock_date: ""
            };

            let sp500_coordinate = {
                x_stock_value: "",
                y_stock_date: ""
            };

            Object.keys(data[queryResult][row]).map(columnName => {
                let dataPoint = data[queryResult][row][columnName];
                switch(columnName) {
                    case 'trading_volume':
                        coordinate.point_metrics.trading_volume = dataPoint;
                        break;
                    case 'x_stock_value':
                        var value = Number(dataPoint).toFixed(2);
                        coordinate.point_metrics.stock_price = value;
                        coordinate.x_stock_value = value;
                        break;
                    case 'y_stock_date':
                        coordinate.y_stock_date = dataPoint.toISOString().substr(0, 10);
                        break;
                    case 'pricingdate_dowj':
                        dowj_coordinate.y_stock_date = moment(dataPoint.toISOString().substr(0, 10)).format('MM/DD/YYYY');
                        break;
                    case 'priceclose_dowj':
                        dowj_coordinate.x_stock_value = Number(dataPoint).toFixed(2);
                        break;
                    case 'pricingdate_nasdaq':
                        nasdaq_coordinate.y_stock_date = moment(dataPoint.toISOString().substr(0, 10)).format('MM/DD/YYYY');
                        break;
                    case 'priceclose_nasdaq':
                        nasdaq_coordinate.x_stock_value = Number(dataPoint).toFixed(2);
                        break;
                    case 'pricingdate_sp500':
                        sp500_coordinate.y_stock_date = moment(dataPoint.toISOString().substr(0, 10)).format('MM/DD/YYYY');
                        break;
                    case 'priceclose_sp500':
                        sp500_coordinate.x_stock_value = Number(dataPoint).toFixed(2);
                        break;
                    default:
                        if (columnName === 'min_date') {
                            min_date = moment(dataPoint);
                        } else if (columnName === 'currencyname' && !stockChart.currency) {
                            stockChart.currency = dataPoint;
                        } else if (columnName === 'exchangesymbol' && !stockChart.exchange) {
                            stockChart.exchange = dataPoint;
                        }
                        break
                }
            });

            if (coordinate.x_stock_value && coordinate.y_stock_date) {
                stockChart.company_index.coordinates.push(coordinate);
            }
            if (nasdaq_coordinate.x_stock_value && nasdaq_coordinate.y_stock_date) {
                stockChart.nasdaq_index.coordinates.push(nasdaq_coordinate);
            }
            if (sp500_coordinate.x_stock_value && sp500_coordinate.y_stock_date) {
                stockChart.sp500_index.coordinates.push(sp500_coordinate);
            }
            if (dowj_coordinate.x_stock_value && dowj_coordinate.y_stock_date) {
                stockChart.dowj_index.coordinates.push(dowj_coordinate);
            }
        });
    });

    let hl_52week = {
        price_h: Math.max(...stockChart.company_index.coordinates.map(item => {
                    return moment(item.y_stock_date).isAfter(min_date) ? item.x_stock_value : null
                })),
        price_l: Math.min.apply(Math, stockChart.company_index.coordinates.map(item => {
                    return moment(item.y_stock_date).isAfter(min_date) ? item.x_stock_value : Number.POSITIVE_INFINITY
                })),
        vol_h: Math.max.apply(Math, stockChart.company_index.coordinates.map(item => {
                    return moment(item.y_stock_date).isAfter(min_date) ? item.point_metrics.trading_volume : null
                })),
        vol_l: Math.min.apply(Math, stockChart.company_index.coordinates.map(item => {
                    return moment(item.y_stock_date).isAfter(min_date) ? item.point_metrics.trading_volume : Number.POSITIVE_INFINITY
                }))
    };

    stockChart["52w_volume"] = `${millify(hl_52week.vol_l * 1, 3)}-${millify(hl_52week.vol_h * 1, 3)}`;
    stockChart["52w_price"] = `${hl_52week.price_l}-${hl_52week.price_h}`;

    for (var i = 0; i < stockChart.company_index.coordinates.length; i++) {
        if (i == 0) {
            stockChart.company_index.coordinates[i].point_metrics.stock_percent_change = '0';
            stockChart.company_index.coordinates[i].point_metrics.trading_percent_change = '0';
            continue;
        } else {
            let aPrice = Number(stockChart.company_index.coordinates[i - 1].x_stock_value); //old price
            let bPrice = Number(stockChart.company_index.coordinates[i].x_stock_value); //new price
            stockChart.company_index.coordinates[i].point_metrics.stock_percent_change = Number(((bPrice - aPrice) / aPrice ) * 100).toFixed(2);

            let aTradingVol = Number(stockChart.company_index.coordinates[i - 1].point_metrics.trading_volume); //old trading volume
            let bTradingVol = Number(stockChart.company_index.coordinates[i].point_metrics.trading_volume); //new trading volume
            stockChart.company_index.coordinates[i].point_metrics.trading_percent_change = Number(((bTradingVol - aTradingVol) / aTradingVol ) * 100).toFixed(2);
        }
    }

    stockChart.company_index.coordinates.forEach(coordinate => {
        coordinate.y_stock_date = moment(coordinate.y_stock_date).format('MM/DD/YYYY');
        coordinate.point_metrics.trading_volume = millify(coordinate.point_metrics.trading_volume * 1, 3);
    });

    return stockChart;
};

exports.handler = async (event, context, callback) => {
    console.log('event:', JSON.stringify(event));

    if (event.stayWarm) {
        console.log('Warmup Event');
        return callback(null, {});
    }
    return await lambda.handler(event, context, handler);
};