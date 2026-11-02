# NEXT STEPS — groundwork

The ordered list of what is left. Start at the top. When an item is done, delete it and write the
story in `HANDOVER.md` §5; when one is found, add it where it ranks.

1. The deploy template is rehearsed in Docker (`test/box.sh`) but has not met a real box: on the first real project, check what the rehearsal cannot — the workflow's `${{ }}` conditions in Actions, the `production` environment, certbot and TLS, Cloudflare in front, and `pm2 startup` across a reboot.
2. Cursor keeps its global rules in the app's settings, not a file, so the sync cannot reach it; paste `global/rules/our-stack.md` into Cursor → Settings → Rules by hand.
