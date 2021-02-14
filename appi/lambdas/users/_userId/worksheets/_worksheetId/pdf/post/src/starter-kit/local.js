const index = require('../index');
const config = require('./config');
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        slowMo: process.env.SLOWMO_MS,
        dumpio: !!config.DEBUG,
        // use chrome installed by puppeteer
    });

    const event = {};
    event.local = true;
    await index.run(browser, event)
    .then((result) => console.log(result))
    .catch((err) => console.error(err));
    await browser.close();
})();
