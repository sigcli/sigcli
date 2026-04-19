import base64
from .types import Credential

def format_headers(credential: Credential) -> dict[str, str]:
    if credential.type == "cookie":
        headers = dict(credential.xHeaders)
        headers["Cookie"] = "; ".join(f"{c.name}={c.value}" for c in credential.cookies)
        return headers
    elif credential.type == "bearer":
        headers = dict(credential.xHeaders)
        headers["Authorization"] = f"Bearer {credential.accessToken}"
        return headers
    elif credential.type == "api-key":
        value = f"{credential.headerPrefix} {credential.key}" if credential.headerPrefix else credential.key
        return {credential.headerName: value}
    elif credential.type == "basic":
        encoded = base64.b64encode(f"{credential.username}:{credential.password}".encode()).decode()
        return {"Authorization": f"Basic {encoded}"}
    return {}

def extract_local_storage(credential: Credential) -> dict[str, str]:
    if credential.type == "cookie" or credential.type == "bearer":
        return dict(credential.localStorage)
    return {}
