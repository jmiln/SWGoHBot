// Launched on its own schedule by the system crontab, independent of dataUpdater. GAC events are
// ~weeks apart, so run it often (e.g. hourly); the cheap info.json check exits early until a new
// event's data is posted:
//   0 * * * * cd /path/to/SWGoHBot && pm2 start counterUpdater.config.cjs >/dev/null 2>&1
module.exports = {
    apps: [
        {
            name: "counterUpdater",
            node_args: ["--env-file=.env"],
            interpreter: "node",
            script: "./services/counterUpdater.ts",
            // Runs one cycle then exits so the OS reclaims memory; PM2 must not loop it.
            autorestart: false,
            env: {
                APP_NAME: "CounterUpdater",
            },
        },
    ],
};
