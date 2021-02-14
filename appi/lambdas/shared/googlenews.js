'use strict';

exports = module.exports = {};

const fetch = require("node-fetch");
const apiKey = process.env.googleNewsAPIKey;

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
        const url = `https://newsapi.org/v2/everything?` +
                    `q=${filters}&` +
                    `from=${endDate}&` +
                    `sortBy=date&` +
                    `language=en&` +
                    `apiKey=${apiKey}`;

        fetch(url)
        .then(function(response) {
            response.json()
            .then(json => {
                const results = json.articles.map((article) => {
                    return {
                        title : article.title,
                        source : article.source.name,
                        since : article.publishedAt,
                        excerpt : article.description,
                        article_url : article.url,
                        image_url : article.urlToImage
                    };
                });
                resolve(results);
            }).catch((err) => {
                reject(err);
            });   
        }).catch((error) => {
            reject(error);
        });  
    });
};