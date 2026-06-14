// Launched on a schedule by the system crontab, e.g. daily at 04:00:
//   0 4 * * * cd /path/to/SWGoHBot && pm2 start dataUpdater.config.cjs >/dev/null 2>&1
module.exports = {
    apps: [
        {
            name: "dataUpdater",
            node_args: ["--env-file=.env"],
            interpreter: "node",
            script: "./services/dataUpdater.ts",
            // Runs a single update cycle then exits, so the OS reclaims the cycle's memory.
            // autorestart:false keeps PM2 from looping it on that clean exit. Launched on a
            // schedule by the system crontab (`pm2 start dataUpdater.config.cjs`), kept out of
            // ecosystem.config.cjs so reloading the always-on stack never triggers a run.
            autorestart: false,
            env: {
                APP_NAME: "DataUpdater",
            },
        },
    ],
};
