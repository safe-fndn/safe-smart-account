module.exports = {
    skipFiles: ["test/**/*.sol"],
    mocha: {
        grep: "@skip-on-coverage",
        invert: true,
    },
};