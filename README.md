# update-check 

This package makes it very easy to implement update notifications like this
one:

<img width="900" alt="screen shot 2018-01-12 at 15 01 33" src="https://user-images.githubusercontent.com/6170607/34878177-8b2aa826-f7a9-11e7-90df-2c3c7f02a774.png">

## Usage

Firstly, install the package with [yarn](https://yarnpkg.com/en/)...

```bash
yarn add update-check
```

...or [npm](https://www.npmjs.com/):

```bash
npm install update-check
```

Next, initialize it:

```js
const pkg = require('./package')
const updateCheck = require('update-check')

updateCheck(pkg)
```

That's it! You're done.

If you want, you can pass options for configuring the update notifications:

```js
const {bgCyan} = require('chalk')

updateCheck(pkg, {
    name: 'Now CLI',        // The name of your package (empty by default)
    interval: 3600000,      // For how long the latest version should be cached (default: 1 day)
    distTag: 'canary',      // A npm distribution tag to compare the version to (default: 'latest')
    color: bgCyan           // A `chalk` function for the message prefix (default: `bgCyan`)
})
```

## Contributing

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository to your own GitHub account and then [clone](https://help.github.com/articles/cloning-a-repository/) it to your local device
2. Link the package to the global module directory: `npm link`
3. Within the module you want to test your local development instance of the package, just link it: `npm link update-check`. Instead of the default one from npm, node will now use your clone.

## Author

Leo Lamprecht ([@notquiteleo](https://twitter.com/notquiteleo)) - [ZEIT](https://zeit.co)

