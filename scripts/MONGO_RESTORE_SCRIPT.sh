#!/bin/bash
set -eou pipefail

##########################################
#
#   Companion to MONGO_BACKUP_SCRIPT.sh. Restores one archive produced by it.
#
#   Run as the user who owns the backups; credentials come from that user's
#   ~/.mongo_creds (user, pass, and authDb).
#
#   Usage:
#     ./MONGO_RESTORE_SCRIPT.sh /path/to/dbname_TIMESTAMP.tar.gz [--dry-run]
#
#   The database to restore into is read from the archive, so this works for any
#   database the backup script produced, not just one.
#
##########################################

MONGO_HOST="localhost"
TIMESTAMP=$(date +%F_%H-%M-%S)
CREDS_FILE="$HOME/.mongo_creds"

# Load Credentials
if [ -f "$CREDS_FILE" ]; then
    source "$CREDS_FILE"
else
    echo "[$(date)] Error: Credentials file not found!"
    exit 1
fi

# Check for input
if [ -z "${1:-}" ]; then
    echo "Usage: $0 /path/to/backup_file.tar.gz [--dry-run]"
    exit 1
fi

BACKUP_TO_RESTORE="$1"
# The safety snapshot lands beside the archive being restored, which is that database's backup dir.
BACKUP_DIR="$(dirname "$BACKUP_TO_RESTORE")"

DRY_RUN=false
if [[ "${2:-}" == "--dry-run" ]]; then
    echo "--- DRY RUN MODE: No changes will be made ---"
    DRY_RUN=true
fi

# Validate backup archive
echo "Checking backup integrity..."
if ! tar -tzf "$BACKUP_TO_RESTORE" > /dev/null; then
    echo "ERROR: Backup file is corrupt or invalid!"
    exit 1
fi
echo "Integrity OK."

# -------------------------------------------------------------------
# EXTRACT BACKUP
# -------------------------------------------------------------------

# Removed on exit, including on failure. A half-extracted directory left behind is how a failed
# restore gets mistaken for a successful one.
TEMP_RESTORE_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_RESTORE_DIR"' EXIT

echo "Extracting backup archive..."
tar -xzf "$BACKUP_TO_RESTORE" -C "$TEMP_RESTORE_DIR"

# The archive root is the backup's timestamp, with the database directory inside it:
#   <TIMESTAMP>/<db_name>/*.bson
# Discover that path rather than assuming a name, so any database's archive restores.
mapfile -t FOUND < <(find "$TEMP_RESTORE_DIR" -mindepth 2 -maxdepth 2 -type d)

if [ ${#FOUND[@]} -eq 0 ]; then
    echo "ERROR: No database directory found inside the archive."
    echo "       Expected <timestamp>/<db_name>/ - is this a backup from MONGO_BACKUP_SCRIPT.sh?"
    exit 1
fi
if [ ${#FOUND[@]} -gt 1 ]; then
    echo "ERROR: Archive holds more than one database directory; refusing to guess:"
    printf '  %s\n' "${FOUND[@]}"
    exit 1
fi

DB_DIR="${FOUND[0]}"
DB_NAME="$(basename "$DB_DIR")"
# mongorestore wants the dump root (<root>/<db>/*.bson), not the database directory. Handed the
# database directory it treats each .bson as an unknown top-level entry, skips them all, and reports
# success having restored nothing.
DUMP_ROOT="$(dirname "$DB_DIR")"

echo "Archive contains database: $DB_NAME"
echo "Restoring from: $DB_DIR"

# -------------------------------------------------------------------
# SAFETY BACKUP
# -------------------------------------------------------------------

# Skipped on a dry run, which changes nothing and so has nothing to protect.
if [ "$DRY_RUN" = false ]; then
    echo "--- SAFETY STEP: Backing up current state of $DB_NAME before restore ---"

    PRE_RESTORE_NAME="PRE_RESTORE_SNAPSHOT_$TIMESTAMP"
    PRE_RESTORE_PATH="$BACKUP_DIR/$PRE_RESTORE_NAME"
    ARCHIVE="$BACKUP_DIR/$PRE_RESTORE_NAME.tar.gz"

    mkdir -p "$PRE_RESTORE_PATH"

    mongodump \
        --host "$MONGO_HOST" \
        --username "$MONGO_USER" \
        --password "$MONGO_PASS" \
        --authenticationDatabase "$MONGO_AUTH_DB" \
        --db "$DB_NAME" \
        --out "$PRE_RESTORE_PATH"

    tar -czf "$ARCHIVE" -C "$BACKUP_DIR" "$PRE_RESTORE_NAME"
    rm -rf "$PRE_RESTORE_PATH"

    echo "Safety backup created:"
    echo "  $ARCHIVE"
fi

# -------------------------------------------------------------------
# RESTORE DATABASE
# -------------------------------------------------------------------

# --drop clears each collection present in the archive before restoring it. Collections that exist
# in the live database but not in the archive are left alone, so this is not a full replacement.
RESTORE_ARGS=(
    --host "$MONGO_HOST"
    --username "$MONGO_USER"
    --password "$MONGO_PASS"
    --authenticationDatabase "$MONGO_AUTH_DB"
    --nsInclude="${DB_NAME}.*"
    --drop
)
if [ "$DRY_RUN" = true ]; then
    RESTORE_ARGS+=(--dryRun)
fi

mongorestore "${RESTORE_ARGS[@]}" "$DUMP_ROOT"

echo "Restore process complete."
