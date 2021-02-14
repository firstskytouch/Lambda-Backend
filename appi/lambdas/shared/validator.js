'use strict';

exports.models = {};

//validation lib
const Ajv = require('ajv');
const ajv = new Ajv({ 
    removeAdditional: true,
    useDefaults: "shared",
    verbose: true
});

/** 
 * Clean a given object while erasing all empty elements
 *
 * @method cleanObject
 * @param {Object} object - object to be cleaned
 * @returns {Object} the clean version of the given object
 */
const cleanObject = (object) => {
    Object.keys(object).forEach(key => {
        if (object[key] && typeof object[key] === 'object') {
            cleanObject(object[key]);
        } else if (typeof object[key] === undefined || object[key] === null || object[key] === '') {
            delete object[key];
        }
    });
    
    return object;
};


/** 
 * Loads a model from disk given its name
 *
 * @method exports.loadModel
 * @param {String} model - name of the file containing the model on disk
 * @exports {Object} A model object according to its name on disk
 */
exports.loadModel = (model) => {
    try {
        exports.models[model] = require(`./models/${model}.json`);
    } catch (e) {
        console.log(e);
    }
};

/** 
 * Validate a given object against a given model and a list of its required keys
 *
 * @method exports.validate
 * @param {Object} object - object to be validated
 * @param {Object} model - model for the object to be validated against
 * @param {Array} reqKeys - list of required keys for the object
 * @returns {Boolean} True if the given object is valid and false otherwise.
 */
exports.validate = (object, model, reqKeys) => {
    if (!object || !exports.models[model]) return false;

    let objectModel = exports.models[model];
    objectModel.required = reqKeys ? reqKeys : objectModel.required;

    try {
        cleanObject(object);
        let valid = ajv.validate(objectModel, object);
        if (valid === false) {
            console.log("AJV Validation Issues: ", ajv.errors);
            return ajv.errors;
        }
        
        return valid;
    } catch (error) {
        console.log('Validation failed', error);
        return ajv.errors;
    }
};

exports.generateErrorMsg = (ajvObjs) => {
    let msgs = [];
    for (let obj of ajvObjs) {
        msgs.push( (`${obj.dataPath.substring(1)} ${obj.message}`).trim());
    }

    return msgs.join('\n');
};