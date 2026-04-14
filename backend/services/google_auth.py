import os
from pathlib import Path

import google.auth
from google.auth.exceptions import DefaultCredentialsError

GOOGLE_AUTH_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]
GOOGLE_AUTH_SETUP_MESSAGE = (
    "Google Cloud credentials are not configured. "
    "Run `gcloud auth application-default login` for local development "
    "or set `GOOGLE_APPLICATION_CREDENTIALS` to a service account JSON file."
)


class GoogleAuthConfigurationError(RuntimeError):
    """Raised when local Google Cloud auth is missing or misconfigured."""


def load_google_auth() -> tuple[object, str | None]:
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    try:
        credentials, project_id = google.auth.default(scopes=GOOGLE_AUTH_SCOPES)
        return credentials, project_id
    except DefaultCredentialsError as exc:
        detail = "No Application Default Credentials were found."

        if credentials_path:
            resolved_path = Path(credentials_path).expanduser()
            detail = (
                f"GOOGLE_APPLICATION_CREDENTIALS is set but the file was not usable: {resolved_path}."
                if not resolved_path.is_file()
                else "The configured Google credentials could not be loaded."
            )

        raise GoogleAuthConfigurationError(f"{GOOGLE_AUTH_SETUP_MESSAGE} {detail}") from exc


def get_google_auth_warning() -> str | None:
    try:
        load_google_auth()
        return None
    except GoogleAuthConfigurationError as exc:
        return str(exc)
