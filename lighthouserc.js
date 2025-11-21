const testUrls = require('./test-urls.json');

module.exports = {
ci: {
  collect: {
    url: testUrls.urls,
    numberOfRuns: 1,
  },
  upload: {
    target: 'lhci',
    serverBaseUrl: 'http://localhost:9001',
    token: 'de50f1c9-439a-476d-8a24-0c97fb44e0e5',
  },
  assert: {
    preset: 'lighthouse:recommended',
  }
}
};