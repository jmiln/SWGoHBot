#!/bin/bash
set -eou pipefail

##########################################
#
#   Update the USER_HOME variable
#   Set up the ~/.mongo_creds file with user, pass, and authDb
#   Set up the crontab as such, full paths all around:
#   "00 02 * * * /bin/bash /home/USER/swgohbot/scripts/MONGO_BACKUP_SCRIPT.sh >> /home/$USER_HOME/backups/backup.log 2>&1"
#
##########################################

# Configuration
USER_HOME="USER_HOME_HERE"
DB_NAME="swgohbot"
TIMESTAMP=$(date +%F_%H-%M-%S)
BACKUP_DIR="$USER_HOME/backups/mongo/$DB_NAME"
DEST_DIR="$BACKUP_DIR/$TIMESTAMP"
CREDS_FILE="$USER_HOME/.mongo_creds"

# Load Credentials
if [ -f "$CREDS_FILE" ]; then
    source "$CREDS_FILE"
else
    echo "[$(date)] Error: Credentials file not found!"
    exit 1
fi

# Just backing up the configs part of the db, so it'll be small
RETENTION_DAYS=28

# Create backup directory
mkdir -p "$DEST_DIR"

echo "Starting backup of $DB_NAME at $TIMESTAMP..."
mongodump \
  --host "localhost" \
  --username "$MONGO_USER" \
  --password "$MONGO_PASS" \
  --authenticationDatabase "$MONGO_AUTH_DB" \
  --db "$DB_NAME" \
  --out "$DEST_DIR"

# Make sure the backup was successful
if [ $? -eq 0 ]; then
    tar -czf "$DEST_DIR.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"
    rm -rf "$DEST_DIR"

    # --- Future SCP Step ---
    # scp "$DEST_DIR.tar.gz" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"

    # Delete backups older than $RETENTION_DAYS
    find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

    echo "Backup complete: $DEST_DIR.tar.gz"
else
    echo "[$(date)] Mongodump failed!" >> "$USER_HOME/mongo_backup.log"
    exit 1
fi
