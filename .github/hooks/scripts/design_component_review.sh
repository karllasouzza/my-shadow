#!/usr/bin/env bash
set -euo pipefail

echo "Design/Component review hook running..."

# Collect changed files: prefer staged files when present
staged=$(git diff --name-only --cached 2>/dev/null || true)
if [ -n "$staged" ]; then
  changed_files="$staged"
else
  modified=$(git ls-files -m 2>/dev/null || true)
  untracked=$(git ls-files --others --exclude-standard 2>/dev/null || true)
  changed_files="$modified
$untracked"
fi

if [ -z "$changed_files" ]; then
  echo "No changed files detected to review.";
  exit 0
fi

critical_count=0
warn_count=0

crit() { printf "CRITICAL: %s\n" "$1" >&2; critical_count=$((critical_count+1)); }
warn() { printf "WARNING: %s\n" "$1"; warn_count=$((warn_count+1)); }
info() { printf "INFO: %s\n" "$1"; }

while IFS= read -r f; do
  if [ -z "$f" ]; then
    continue
  fi
  if [ ! -f "$f" ]; then
    continue
  fi

  case "$f" in
    components/ui/*.tsx)
      echo "Reviewing component: $f"
      if grep -qE "export default" "$f" 2>/dev/null; then
        crit "$f contains a default export (use named exports)."
      fi
      if grep -qE "<div|</div>|<main|</main>|<aside|</aside>|<html|</html>" "$f" 2>/dev/null || grep -qE "from ['\"]next/|from ['\"]react-dom" "$f" 2>/dev/null; then
        crit "$f contains web-only HTML elements or Next/ReactDOM imports."
      fi
      if ! grep -q "className=" "$f" 2>/dev/null; then
        warn "$f does not use className; prefer NativeWind utility classes."
      fi
      if grep -q "style=" "$f" 2>/dev/null; then
        warn "$f uses inline style; prefer className unless dynamic styles are required."
      fi
      if ! grep -qE "cva\(|from ['\"]class-variance-authority['\"]" "$f" 2>/dev/null; then
        info "Consider using cva for variant definitions in $f."
      fi
      if ! grep -qE 'bg-|text-|border-' "$f" 2>/dev/null; then
        warn "$f does not appear to use semantic Tailwind token classes (bg-, text-, border-)."
      fi
      ;;

    global.css)
      echo "Reviewing CSS tokens: $f"
      if awk '/:root[[:space:]]*{/{flag=1;next} /}/{if(flag){exit}} flag{print}' "$f" 2>/dev/null | grep -q "hsl\(" 2>/dev/null; then
        crit "$f contains CSS variables that use hsl(...) inside the variable values (forbidden)."
      fi
      if ! grep -q -- '--primary' "$f" 2>/dev/null; then
        warn "$f does not define --primary token (consider adding it)."
      fi
      ;;

    context/themes/*)
      echo "Reviewing theme config: $f"
      if ! grep -q 'rawColors' "$f" 2>/dev/null; then
        warn "$f does not define 'rawColors' — ensure JS runtime tokens mirror CSS variables."
      fi
      ;;

    app/_layout.tsx)
      echo "Reviewing layout: $f"
      if grep -q "useFonts" "$f" 2>/dev/null || grep -q "expo-font" "$f" 2>/dev/null; then
        if ! grep -q "SplashScreen" "$f" 2>/dev/null; then
          warn "$f loads fonts but doesn't use SplashScreen hide/prevent patterns (check splash handling)."
        fi
      fi
      ;;

    components/*|features/*|app/*)
      if grep -qE "<div|</div>|from ['\"]next/|from ['\"]react-dom" "$f" 2>/dev/null; then
        crit "$f contains web-only APIs or HTML elements."
      fi
      ;;

    *)
      ;;
  esac
done < <(printf '%s\n' "$changed_files" | sed '/^$/d')

echo
echo "Review Summary:"
echo "  Critical issues: $critical_count"
echo "  Warnings: $warn_count"

if [ "$critical_count" -gt 0 ]; then
  echo "One or more critical issues were found. Fix them before applying changes." >&2
  exit 1
fi

echo "No blocking issues found. Warnings may still require attention."
exit 0
