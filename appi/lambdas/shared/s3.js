'use strict';

//aws
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    region: process.env.AWS_REGION,
    signatureVersion: 'v4'
});

/** 
 * Get a worksheet object, upload its notes to a specified S3 bucket.
 *
 * @method exports.serializeNotes
 * @param {String} worksheet - object containing the worksheet notes
 * @param {String} bucket - name of the S3 bucket
 * @returns {Promise} A promise that returns the given object where the notes object is replaced with an S3 key if resolved
 * and an error if rejected.
 */
const serializeNotes = (worksheet, bucket) => {
    return new Promise((resolve, reject) => {
        let objectKey = `${worksheet.cik}/${worksheet.worksheet_id}/${worksheet.user_id}/${worksheet.worksheet_id}.json`;
        for(const note of worksheet.notes) {
            note.updated_at = new Date().toISOString();
        }
        let object = {
            "notes": worksheet.notes
        };

        putObject(JSON.stringify(object), bucket, objectKey)
        .then((res) => {
            let original_notes = worksheet.notes;
            worksheet.notes = res;
            resolve(worksheet, original_notes);
        })
        .catch((err) => {
            reject(err);
        });
    });
};

/** 
 * Get a worksheet's notes object from a specified S3 bucket.
 *
 * @method exports.serializeNotes
 * @param {String} worksheet - object containing the worksheet notes as an S3 key
 * @param {String} bucket - name of the S3 bucket
 * @returns {Promise} A promise that returns the given object where the notes object is replaced with a notes object if resolved
 * and an error if rejected.
 */
const deserializeNotes = (worksheet, bucket) => {
    return new Promise((resolve, reject) => {
        let objectKey = worksheet.notes;

        getObject(bucket, objectKey)
        .then((res) => {
            let notesObject = JSON.parse(res);
            worksheet.notes = notesObject.notes;
            resolve(worksheet);
        })
        .catch((err) => {
            reject(err);
        });
    });
};

/** 
 * Put a given object in a specified S3 bucket with a specified key.
 *
 * @method putObject
 * @param {Object} object - object to be created/updated
 * @param {String} bucket - name of the S3 bucket
 * @param {String} objectKey - name of the object key (a.k.a. S3 path)
 * @returns {Promise} A promise that returns the object key if resolved
 * and an error if rejected.
 */
const putObject = (object, bucket, objectKey, metadata = undefined, contentType = undefined) => {
    return new Promise((resolve, reject) => {
        let params = {
            Body: object,
            Bucket: bucket,
            Key: objectKey,
            Metadata: metadata || undefined,
            ContentType: contentType || undefined
        };

        s3.putObject(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(objectKey);
            }
        });
    });
};

/** 
 * Get an object from a specified S3 bucket using a specified key.
 *
 * @method getObject
 * @param {String} bucket - name of the S3 bucket
 * @param {String} objectKey - name of the object key (a.k.a. S3 path)
 * @returns {Promise} A promise that returns the object content if resolved
 * and an error if rejected.
 */
const getObject = (bucket, objectKey) => {
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: bucket,
            Key: objectKey
        };

        s3.getObject(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.Body);
            }
        });
    });
};

/** 
 * Get an object's metadata from a specified S3 bucket using a specified key.
 *
 * @method getObjectMetadata
 * @param {String} bucket - name of the S3 bucket
 * @param {String} objectKey - name of the object key (a.k.a. S3 path)
 * @returns {Promise} A promise that returns the object metadata if resolved
 * and an error if rejected.
 */
const getObjectMetadata = (bucket, objectKey) => {
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: bucket,
            Key: objectKey
        };

        s3.headObject(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.Metadata);
            }
        });
    });
};

/** 
 * Get an object's versions from a specified S3 bucket using a specified key.
 *
 * @method getObjectVersions
 * @param {String} bucket - name of the S3 bucket
 * @param {String} objectKey - name of the object key (a.k.a. S3 path)
 * @returns {Promise} A promise that returns the object versions if resolved
 * and an error if rejected.
 */
const getObjectVersions = (bucket, objectKey) => {
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: bucket,
            Prefix: objectKey
        };

        s3.listObjectVersions(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.Versions);
            }
        });
    });
};

/** 
 * Get an object's presigned url
 *
 * @method getObjectVersions
 * @param {String} bucket - name of the S3 bucket
 * @param {String} objectKey - name of the object key (a.k.a. S3 path)
 * @returns {Promise} A promise that returns the object url if resolved
 * and an error if rejected.
 */
const getPresignedUrl = (bucket, objectKey) => {
    return new Promise((resolve, reject) => {
        let params = {
            Bucket: bucket,
            Key: objectKey
        };

        s3.getSignedUrl('getObject', params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
};

exports = module.exports = {
   serializeNotes,
   deserializeNotes,
   putObject,
   getObject,
   getObjectMetadata,
   getObjectVersions,
   getPresignedUrl
};