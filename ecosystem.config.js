module.exports = {
  apps : [{
    name   : "main",
    script: "main.js",
    watch: true,
    ignore_watch : ["data/*", "sessions/*", "users/*"],
    watch_options: {
      followSymlinks: false
    }
  }]
}
