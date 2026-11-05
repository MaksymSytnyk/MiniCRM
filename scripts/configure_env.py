"""Create private local configuration without overwriting an existing .env."""
import os
from pathlib import Path
import secrets

root = Path(__file__).resolve().parent.parent
target = root / '.env'
if target.exists():
    print('Using existing .env configuration.')
else:
    password = secrets.token_urlsafe(24)
    content = (root / '.env.example').read_text()
    content = content.replace('minicrm-local-change-me', password)
    content = content.replace(
        'replace-this-with-a-random-secret-at-least-32-characters',
        secrets.token_urlsafe(48),
    )
    try:
        descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        print('Using existing .env configuration.')
    else:
        with os.fdopen(descriptor, 'w') as output:
            output.write(content)
        print('Created private .env with generated database and JWT secrets.')
