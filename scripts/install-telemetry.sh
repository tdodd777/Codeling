#!/usr/bin/env bash
#
# Set / unset / inspect the OTEL env vars Claude Code needs to feed Codeling's
# local receiver. Interim shim until `npx codeling install` lands.
#
# Modes:
#   install     Add a marked block to the shell rc (default).
#   uninstall   Remove the marked block.
#   status      Show whether the block is present + current process env.
#
# Endpoint defaults to http://127.0.0.1:4318. Override with `ENDPOINT=...`:
#   ENDPOINT=http://192.168.1.5:4318 ./scripts/install-telemetry.sh install
#
# Detects zsh vs bash and writes to ~/.zshrc or ~/.bashrc respectively. Block
# is delimited with markers (`# >>> codeling-telemetry >>>` / `# <<< ... <<<`)
# so uninstall is a clean targeted removal — no clobbering existing edits.

set -euo pipefail

MODE="${1:-install}"
ENDPOINT="${ENDPOINT:-http://127.0.0.1:4318}"

# Pick the rc file matching the user's login shell. Prefer $SHELL since we want
# the file Claude Code's launcher will source, not the shell running this script.
case "$(basename "${SHELL:-}")" in
  zsh) RC="${ZDOTDIR:-$HOME}/.zshrc" ;;
  *)   RC="$HOME/.bashrc" ;;
esac

MARK_BEGIN='# >>> codeling-telemetry >>>'
MARK_END='# <<< codeling-telemetry <<<'

# Build the block fresh on every install so an updated ENDPOINT propagates.
emit_block() {
  cat <<EOF
$MARK_BEGIN
# Managed by Codeling — scripts/install-telemetry.sh. Edit via the script
# (install/uninstall/status modes) rather than by hand.
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT="$ENDPOINT"
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_METRIC_EXPORT_INTERVAL=10000
$MARK_END
EOF
}

# `sed -i.bak` works on both BSD (macOS) and GNU (Linux) — explicit backup
# extension dodges the macOS gotcha where `-i` alone takes the next arg as the
# extension. We delete the backup immediately after.
remove_block() {
  if [ -f "$RC" ]; then
    sed -i.codeling.bak "/^# >>> codeling-telemetry >>>$/,/^# <<< codeling-telemetry <<<$/d" "$RC"
    rm -f "$RC.codeling.bak"
  fi
}

block_present() {
  [ -f "$RC" ] && grep -q "^# >>> codeling-telemetry >>>$" "$RC"
}

case "$MODE" in
  install)
    if block_present; then
      remove_block
    fi
    emit_block >> "$RC"
    echo "Codeling telemetry block written to $RC"
    echo "Restart your shell (or 'source $RC') for the env vars to take effect."
    echo "VS Code / other apps need to be relaunched too."
    ;;
  uninstall)
    if block_present; then
      remove_block
      echo "Codeling telemetry block removed from $RC"
    else
      echo "No Codeling telemetry block found in $RC — nothing to remove."
    fi
    ;;
  status)
    if block_present; then
      echo "Block present in $RC:"
      sed -n "/^# >>> codeling-telemetry >>>$/,/^# <<< codeling-telemetry <<<$/p" "$RC"
    else
      echo "No Codeling telemetry block in $RC"
    fi
    echo
    echo "Current process env (only reflects what's exported in *this* shell):"
    for v in CLAUDE_CODE_ENABLE_TELEMETRY \
             OTEL_EXPORTER_OTLP_ENDPOINT \
             OTEL_EXPORTER_OTLP_PROTOCOL \
             OTEL_METRICS_EXPORTER \
             OTEL_LOGS_EXPORTER \
             OTEL_METRIC_EXPORT_INTERVAL; do
      printf '  %s=%s\n' "$v" "${!v:-(unset)}"
    done
    ;;
  *)
    echo "Usage: $0 [install|uninstall|status]" >&2
    echo "  ENDPOINT=http://host:port $0 install   # custom endpoint" >&2
    exit 1
    ;;
esac
