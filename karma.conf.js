module.exports = function (config) {
  config.set({
    browsers: ['Chrome'],
    frameworks: ['mocha'],
    files: ['./test/**/*.spec.js']
  })
}
