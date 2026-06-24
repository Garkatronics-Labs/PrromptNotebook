const path = require('path');
const constants = require('../constants');

module.exports = {
    context: constants.ExtensionRootDir,
    entry: {},
    output: {
        path: path.join(constants.ExtensionRootDir, 'out', 'views'),
        filename: '[name].js'
    },
    mode: 'production'
};
