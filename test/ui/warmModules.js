// Loaded before each `app` test file (jest.config.js). React Native builds `Modal` lazily, so the
// first test to render a sheet used to pay for compiling it. On CI, whose transform cache starts
// cold, that pushed a NumberSheet test past the 5 s test timeout. Requiring it here moves the
// cost outside every test's timer.
const { Modal } = require('react-native');

module.exports = { Modal };
