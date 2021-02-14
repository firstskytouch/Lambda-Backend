'use strict';

exports = module.exports = {};

const AWS = require('aws-sdk');

const util = require('util');
const fetch = require('node-fetch');
const XML = require('xml2js');
const parseXml = util.promisify(XML.parseString);

exports.checkDocumentExists = async (config, params) => {
    try {
      const { endpoint_url, authorization_key } = config;
      const { drawer, file } = params;
      const req = {
          url: `${endpoint_url}/dms/queryDocument/${drawer}`,
          options: {
            method: 'GET',
            headers: {
                authorization: authorization_key,
                File: file
            }
          }
      };
      const res = await fetch(req.url, req.options);
      const xml = await res.text();
      const response = await parseXml(xml);
      if (res.status > 400) {
        throw new Error(JSON.stringify({ ...res, body: xml }));
      }

      return response.Response.token[0];
  } catch (e) {
    throw new Error(e);
  }
};

/**
 * Upload a PDF to ImageRight
 *
 * @method uploadDocument
 *
 * @config {String} endpoint_url - the API endpoint
 * @config {String} authorization_key - the key for the Authorization header
 *
 * @params {String} drawer - Name of ImageRight drawer (e.g. `UW02`)
 * @params {String} file - Full policy number or submission id
 * @params {String} folder - Name of ImageRight folder (e.g. `Worksheets`)
 * @params {String} document_type - Code indicating ImageRight document type (`REVL` or `RENR`)
 * @params {String} filename - Name of file to be uploaded (include extension)
 * @params {String} body - Base64 encoded contents of file
 */
exports.uploadDocument = async (config, params) => {
    try {
      const { endpoint_url, authorization_key } = config;
      const { drawer, file, folder, document_type, filename, body } = params;
      const req = {
          url: `${endpoint_url}/dms/uploadDocuments/${drawer}/${folder}/${document_type}`,
          options: {
            method: 'POST',
            headers: {
                authorization: authorization_key,
                file,
                filename
            },
            body
          }
      };
      const res = await fetch(req.url, req.options);
      const xml = await res.text();
      const response = await parseXml(xml);
      if (res.status > 400) {
        throw new Error(JSON.stringify({ ...res, body: xml }));
      }

      return response.Response.token[0];
  } catch (e) {
    throw new Error(e);
  }
};

/* Get status of a PDF upload.
 *
 * @method checkDocumentStatus
 *
 * @config {String} endpoint_url - the API endpoint
 * @config {String} authorization_key - the key for the Authorization header
 *
 * @params {String} token - the token used to retrieve the status
 */
exports.checkDocumentStatus = async (config, token) => {
  try {
    const { endpoint_url, authorization_key } = config;
    const req = {
      url: `${endpoint_url}/dms/status/${token}`,
      options: {
        method: 'GET',
        headers: {
          authorization: authorization_key
        }
      }
    };
    const res = await fetch(req.url, req.options);
    const xml = await res.text();
    const response = await parseXml(xml);
    if (res.status > 400) {
      throw new Error(JSON.stringify({ ...res, body: xml }));
    }
    
    console.log('response: ', JSON.stringify(response));

    if (response.Response.status[0] === 'IP') {
      return { status: 'IN_PROGGRESS', error: null };
    }

    if (response.Response.isSuccess[0] === "true") {
      return { success: true, status: 'SUCCEEDED', error: null };
    } else if (response.Response.isSuccess[0] === "false") {
      let resData = response.Response.errors[0];
      let err = resData['error'][0]['description'][0];
      return { success: false, status: 'FAILED', error: err };
    } else {
      return { success: false, status: 'FAILED', error: null };
    }
  } catch (e) {
    throw new Error(e);
  }
};