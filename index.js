const {get} = require('https');
const {join} = require('path');
const fs = require('fs');
const {promisify} = require('util');
const {tmpdir} = require('os');

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

const getMostRecent = async (name, distTag) => {
	const url = `https://registry.npmjs.org/${name}/${encode(distTag)}`;

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
		response.on('data', chunk => {
			rawData += chunk;
		});

		response.on('end', () => {
			try {
				const parsedData = JSON.parse(rawData);
				resolve(parsedData);
			} catch (e) {
				reject(e.message);
			}
		});
	}).on('error', reject));
};

const defaultConfig = {
	interval: 3600000,
	distTag: 'latest'
};

module.exports = async (pkg, config) => {
	if (typeof pkg !== 'object') {
		throw new Error('The first parameter should be your package.json file content');
	}

	const name = encode(pkg.name);
	const {distTag, interval} = Object.assign({}, defaultConfig, config);
	const check = await shouldCheck(name, interval);

	if (check === false) {
		return null;
	}

	const mostRecent = await getMostRecent(name, distTag);
	const comparision = compareVersions(pkg.version, mostRecent.version);

	if (comparision === -1) {
		return mostRecent;
	}

	return null;
};
