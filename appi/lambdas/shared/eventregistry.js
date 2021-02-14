'use strict';

exports = module.exports = {};

const eventRegistry = require('eventregistry');
const er = new eventRegistry.EventRegistry({
    apiKey: process.env.eventRegistryAPIKey
});

/** 
 * Returns an array of Article objects related to a company name
 *
 * @method exports.getNews
 * @param {String} companyName - name of the company for which to search articles about
 * @param {Array} filters - list of keywords as Strings
 * @param {String} startDate - start date for the article search
 * @param {String} endDate - end date for the article search
 * @returns {Promise} A promise that returns the list of Article objects if resolved
 * and an error if rejected.
 */
exports.getNews = function(companyName, filters, startDate, endDate) {
    return new Promise((resolve, reject) => {
        er.getConceptUri(companyName).then((conceptUri) => {
            const q = new eventRegistry.QueryArticlesIter(er, {
                conceptUri: conceptUri,
                maxItems: 10,
                articleBatchSize: 10,
                sortBy: "date",
                keywords: new eventRegistry.QueryItems.AND(filters),
                lang: "eng",
                dateStart: startDate,
                dateEnd: endDate
            });
            q.execQuery((articles) => {
                const results = articles.map((article) => {
                    return {
                        id : article.id,
                        title : article.title,
                        source : article.source.title,
                        since : article.date,
                        excerpt : article.body,
                        article_url : article.url,
                        image_url : article.image
                    };
                });

                resolve(results);
            });
        })
        .catch((error) => {
            reject(error);
        });        
    });
};