#!/bin/bash
set -eou pipefail

##########################################
#
#   Update the USER_HOME variable
#   Set up the ~/.mongo_creds file with user, pass, and authDb
#   Set up the crontab as such, full paths all around, naming the databases to back up:
#   "00 02 * * * /bin/bash /home/USER/swgohbot/scripts/MONGO_BACKUP_SCRIPT.sh swgohbot otherDb >> /home/$USER_HOME/backups/backup.log 2>&1"
#
##########################################

# Configuration
USER_HOME="USER_HOME_HERE"
TIMESTAMP=$(date +%F_%H-%M-%S)
CREDS_FILE="$USER_HOME/.mongo_creds"

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

FAILED=()

for DB_NAME in "${DATABASES[@]}"; do
    BACKUP_DIR="$USER_HOME/backups/mongo/$DB_NAME"
    DEST_DIR="$BACKUP_DIR/$TIMESTAMP"
    ARCHIVE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.tar.gz"

    mkdir -p "$DEST_DIR"

    echo "Starting backup of $DB_NAME at $TIMESTAMP..."
    # mongodump goes in the `if` condition on purpose: under `set -e` a bare failing command aborts
    # the script, so the else branch below would be unreachable and one bad database would skip the rest.
    if mongodump \
      --host "localhost" \
      --username "$MONGO_USER" \
      --password "$MONGO_PASS" \
      --authenticationDatabase "$MONGO_AUTH_DB" \
      --db "$DB_NAME" \
      --out "$DEST_DIR"; then

        tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$TIMESTAMP"
        rm -rf "$DEST_DIR"

        # --- Future SCP Step ---
        # scp "$ARCHIVE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

        # Delete backups older than $RETENTION_DAYS
        find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +"$RETENTION_DAYS" -delete

        echo "Backup complete: $ARCHIVE"
    else
        echo "[$(date)] Mongodump failed for $DB_NAME!" >> "$USER_HOME/mongo_backup.log"
        FAILED+=("$DB_NAME")
    fi
done

if [ ${#FAILED[@]} -gt 0 ]; then
    echo "The following databases failed to back up: ${FAILED[*]}"
    exit 1
fi
