'use strict';

const setup = require('./starter-kit/setup');
const lambda = require('./lambda');
const s3 = require('./shared/s3.js');
const dynamo = require('./shared/dynamo.js');

const domain = process.env.pdfWebBucketUrl || 'http://localhost:8080';
const worksheetsPdfBucket = process.env.pdfBucket;
const dynamoTable = process.env.worksheetsTable;
const keyName = 'worksheet_id';

const logEventTime = (message, time) => {
  console.log('Time:', new Date().getTime() - time, message);
};

exports.run = async (browser, event) => {
    console.log('event:', JSON.stringify(event));
    const start = new Date().getTime();
    let page = await browser.newPage();

    logEventTime('start', start);

    await page.goto(`${domain}/images/lock.svg`, {
        waitUntil: ['domcontentloaded'],
    });

    logEventTime('before setting accessToken', start);

    await page.evaluate((event) => {
      console.log('time:ent', event);
      localStorage.setItem('accessToken', `"${event.accessToken}"`);
      localStorage.setItem('userProfile', `{"sub":"${event.user.userId}"}`);
      localStorage.setItem('worksheetId', event.worksheet_id);
      localStorage.setItem('companyId', event.company_id);
      localStorage.setItem('companyName', event.company_name);
      localStorage.setItem('email', event.user.email);
      localStorage.setItem('datetime', event.date);

      return localStorage.getItem('accessToken');
    }, event);

    logEventTime('after setting accessToken', start);

    await page.goto(`${domain}`, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
    });

    logEventTime('data loaded', start);

    const html = await page.content();
    console.log(html);
    await page.setContent(html);

    logEventTime('set html', start);

    const createdPdf = await page.pdf({
        format: 'A4',
        path: event.local === true ? 'test.pdf' : undefined,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: '<div style="font-size:10px;width:100%;text-align:center;"><span class="pageNumber"></span></div>',
    });

    logEventTime('PDF created', start);

    if (event.local === true) {
      await page.close();
      return 'Done';
    }

    page.close();

    const prefix = event.policy_id ? event.policy_id : event.submission_id;
    const documentType = event.renewal === true ? 'RENR' : 'REVL';
    const objectKey = `${prefix}/${event.worksheet_id}-${documentType}.pdf`;

    // upload pdf to S3
    const metadata = {
      user_id: event.user.userId,
      user_email: event.user.email,
      company_name: event.company_name,
      cik: event.company_id,
      submission_id: event.submission_id,
      policy_id: event.policy_id,
      document_type: documentType,
      coverage_type: event.coverage_type,
      effective_date: event.effective_date,
      worksheet_id: event.worksheet_id,
    };
    Object.keys(metadata).forEach( (k) => {
      if (metadata[k] === undefined) {
        delete metadata[k];
      }
    });
    console.log(metadata);
    await s3.putObject(createdPdf, worksheetsPdfBucket, objectKey, metadata, 'application/pdf');

    // update worksheet in DynamoDB
    const item = {
      worksheet_id: event.worksheet_id,
      [`archived_${documentType.toLowerCase()}_s3loc`]: objectKey,
    };
    await dynamo.updateItem(item, dynamoTable, keyName);

    // return presigned url of pdf to client
    const presignedUrl = await s3.getPresignedUrl(worksheetsPdfBucket, objectKey);

    return {
      url: presignedUrl,
    };
};

const handler = async (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false; // for keeping the browser launch

    try {
        const browser = await setup.getBrowser();
        const result = await exports.run(browser, event);
        return result;
    } catch (e) {
        console.log(e);
        throw e;
    }
};

exports.handler = async (event, context, callback) => {
  if (event.stayWarm) {
      console.log('Warmup Event');
      return callback(null, {});
  }
  return await lambda.handler(event, context, handler);
};
