const fetch = require('node-fetch'); console.log(typeof fetch); fetch('https://example.com').then(res => console.log(res.status));
