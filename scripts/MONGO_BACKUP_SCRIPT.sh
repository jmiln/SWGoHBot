#!/bin/bash
set -eou pipefail

##########################################
#
#   Update the USER_HOME variable
#   Set up the ~/.mongo_creds file with user, pass, and authDb
#   Optionally add BACKUP_WEBHOOK_URL to that same file to be told when a backup fails.
#   It stays in the creds file so no URL ends up in this script or in git.
#   Set up the crontab as such, full paths all around, naming the databases to back up:
#   "00 02 * * * /bin/bash /home/USER/swgohbot/scripts/MONGO_BACKUP_SCRIPT.sh swgohbot otherDb >> /home/USER/backups/backup-$(date +\%F).log 2>&1"
#
##########################################

# Configuration
USER_HOME="USER_HOME_HERE"
MONGO_HOST="localhost"
TIMESTAMP=$(date +%F_%H-%M-%S)
BACKUPS_BASE="$USER_HOME/backups"
BACKUP_ROOT="$BACKUPS_BASE/mongo"
CREDS_FILE="$USER_HOME/.mongo_creds"
LOG_FILE="$USER_HOME/mongo_backup.log"

# Just backing up the configs part of the db, so it'll be small
RETENTION_DAYS=28

# Databases to back up: pass as arguments, or fall back to the default.
if [ $# -gt 0 ]; then
    DATABASES=("$@")
else
    DATABASES=("swgohbot")
fi

# Load Credentials
if [ -f "$CREDS_FILE" ]; then
    source "$CREDS_FILE"
else
    echo "[$(date)] Error: Credentials file not found!"
    exit 1
fi

log() {
    echo "[$(date)] $1" | tee -a "$LOG_FILE"
}

# Only called for the end-of-run summary, so a bad night is one message rather than one per database.
notify() {
    log "$1"
    if [ -n "${BACKUP_WEBHOOK_URL:-}" ]; then
        curl -sS -m 15 -H "Content-Type: application/json" \
            -d "$(jq -nc --arg c "$1" '{content: $c}')" \
            "$BACKUP_WEBHOOK_URL" > /dev/null || log "Webhook post failed"
    fi
}

FAILED=()

for DB_NAME in "${DATABASES[@]}"; do
    BACKUP_DIR="$BACKUP_ROOT/$DB_NAME"
    DEST_DIR="$BACKUP_DIR/$TIMESTAMP"
    ARCHIVE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.tar.gz"

    mkdir -p "$DEST_DIR"

    echo "Starting backup of $DB_NAME at $TIMESTAMP..."
    # mongodump goes in the `if` condition on purpose: under `set -e` a bare failing command aborts
    # the script, so the else branch below would be unreachable and one bad database would skip the rest.
    if mongodump \
      --host "$MONGO_HOST" \
      --username "$MONGO_USER" \
      --password "$MONGO_PASS" \
      --authenticationDatabase "$MONGO_AUTH_DB" \
      --db "$DB_NAME" \
      --out "$DEST_DIR"; then

        tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$TIMESTAMP"

        # Read the archive back before trusting it. A truncated or corrupt archive found at restore
        # time is worse than a failure found now, and pruning older ones on the strength of a bad
        # archive is how a backup history quietly becomes worthless.
        if tar -tzf "$ARCHIVE" > /dev/null 2>&1; then
            rm -rf "$DEST_DIR"

            # --- Future SCP Step ---
            # scp "$ARCHIVE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

            # Delete backups older than $RETENTION_DAYS
            find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +"$RETENTION_DAYS" -delete

            echo "Backup complete: $ARCHIVE"
        else
            # Keep the raw dump: the data is still good even though the archive is not.
            log "Archive verification failed for $DB_NAME! Raw dump kept at $DEST_DIR"
            FAILED+=("$DB_NAME")
        fi
    else
        log "Mongodump failed for $DB_NAME!"
        FAILED+=("$DB_NAME")
    fi
done

# Prune the dated cron logs on the same schedule as the archives.
find "$BACKUPS_BASE" -maxdepth 1 -type f -name "backup-*.log" -mtime +"$RETENTION_DAYS" -delete

if [ ${#FAILED[@]} -gt 0 ]; then
    notify "MongoDB backup failed for: ${FAILED[*]}"
    exit 1
fi
