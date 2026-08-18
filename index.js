const React = require('react');
const VisualPatch = require('./examples/react/VisualPatchDev.jsx');

module.exports = VisualPatch.default || VisualPatch;
module.exports.VisualPatch = VisualPatch.default || VisualPatch;
module.exports.default = VisualPatch.default || VisualPatch;
