// Native
const {get} = require('https');
const {URL} = require('url');
const {join} = require('path');
const fs = require('fs');
const {promisify} = require('util');
const {tmpdir} = require('os');

// Packages
const registryUrl = require('registry-url');

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);
const compareVersions = (a, b) => a.localeCompare(b, 'en-US', {numeric: true});
const encode = value => encodeURIComponent(value).replace(/^%40/, '@');

const shouldCheck = async (name, interval) => {
	const rootDir = tmpdir();
	const subDir = join(rootDir, `update-check`);

	if (!fs.existsSync(subDir)) {
		mkdir(subDir);
	}

	const file = join(subDir, `${name}.json`);
	const time = Date.now();

	if (fs.existsSync(file)) {
		const content = await readFile(file, 'utf8');
		const {lastCheck} = JSON.parse(content);
		const nextCheck = lastCheck + interval;

		// As long as the time of the next check is in
		// the future, we don't need to run it yet.
		if (nextCheck > time) {
			return false;
		}
	}

	const content = JSON.stringify({
		lastCheck: time
	});

	await writeFile(file, content, 'utf8');
	return true;
};

const loadPackage = (url, authInfo) => new Promise((resolve, reject) => {
	const options = {
		method: 'GET',
		protocol: url.protocol,
		host: url.hostname,
		path: url.pathname
	};

	if (authInfo) {
		options.headers = {
			authorization: `${authInfo.type} ${authInfo.token}`
		};
	}

	get(options, response => {
		const {statusCode, headers} = response;
		const contentType = headers['content-type'];

		let error = null;

		if (statusCode !== 200) {
			error = new Error(`Request failed with code ${statusCode}`);
			error.code = statusCode;
		} else if (!/^application\/json/.test(contentType)) {
			error = new Error(`Expected application/json but received ${contentType}`);
		}

		if (error) {
			reject(error);

			// Consume response data to free up RAM
			response.resume();
			return;
		}

		let rawData = '';
		response.setEncoding('utf8');

		response.on('data', chunk => {
			rawData += chunk;
		});

		response.on('end', () => {
			try {
				const parsedData = JSON.parse(rawData);
				resolve(parsedData);
			} catch (e) {
				reject(e);
			}
		});
	}).on('error', reject);
});

const getMostRecent = async (details, distTag) => {
	const regURL = registryUrl(details.scope);

	try {
		// It's important to `await` here
		const url = new URL(`${details.full}/${encode(distTag)}`, regURL);
		return await loadPackage(url);
	} catch (err) {
		// We need to cover:
		// 401 or 403 for when we don't have access
		// 404 when the package is hidden
		if (err.code && String(err.code).startsWith(4)) {
			// We only want to load this package for when we
			// really need to use the token
			const registryAuthToken = require('registry-auth-token');
			const authInfo = registryAuthToken(regURL, {recursive: true});

			// For scoped packages, getting a certain dist tag is not supported
			const url = new URL(details.full, regURL);

			return loadPackage(url, authInfo);
		}

		throw err;
	}
};

const defaultConfig = {
	interval: 3600000,
	distTag: 'latest'
};

const getDetails = name => {
	const spec = {
		full: encode(name)
	};

	if (name.includes('/')) {
		const parts = name.split('/');

		spec.scope = parts[0];
		spec.name = parts[1];
	} else {
		spec.scope = null;
		spec.name = name;
	}

	return spec;
};

module.exports = async (pkg, config) => {
	if (typeof pkg !== 'object') {
		throw new Error('The first parameter should be your package.json file content');
	}

	const details = getDetails(pkg.name);

	if (details.scope && config.distTag) {
		throw new Error('For scoped packages, the npm registry does not support getting a certain tag');
	}

	const {distTag, interval} = Object.assign({}, defaultConfig, config);
	const check = await shouldCheck(details.full, interval);

	if (check === false) {
		return null;
	}

	const mostRecent = await getMostRecent(details, distTag);
	const comparision = compareVersions(pkg.version, mostRecent.version);

	if (comparision === -1) {
		return mostRecent.version;
	}

	return null;
};
