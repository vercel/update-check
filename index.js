const {get} = require('https');

const compareVersions = (a, b) => a.localeCompare(b, 'en-US', { numeric: true });
const encode = value => encodeURIComponent(value).replace(/^%40/, '@');

const getMostRecent = async (name, distTag) => {
    const url = `https://registry.npmjs.org/${encode(name)}/${encode(distTag)}`;

    return new Promise((resolve, reject) => get(url, response => {
        const {statusCode, headers} = response;
        const contentType = headers['content-type'];

        let error = null;

        if (statusCode !== 200) {
            error = new Error(`Request failed with code ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
            error = new Error(`Expected application/json but received ${contentType}`);
        }

        if (error) {
            reject(error.message);

            // Consume response data to free up RAM
            response.resume();
            return;
        }

        let rawData = '';

        response.setEncoding('utf8');
        response.on('data', chunk => { rawData += chunk; });

        response.on('end', () => {
            try {
              const parsedData = JSON.parse(rawData);
              resolve(parsedData);
            } catch (e) {
              reject(e.message);
            }
        });
    }).on('error', reject));
}

module.exports = async (pkg, distTag = 'latest') => {
    const mostRecent = await getMostRecent(pkg.name, distTag);
    const comparision = compareVersions(pkg.version, mostRecent.version);

    if (comparision === -1) {
        return mostRecent;
    }

    return null;
}
