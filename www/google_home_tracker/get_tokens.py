# Get tokens for Google Home Foyer API
# https://gist.github.com/rithvikvibhu/952f83ea656c6782fbd0f1645059055d


from gpsoauth import perform_master_login, perform_oauth
from uuid import getnode as getmac
import yaml

# Creds to use when logging in
USERNAME = None
PASSWORD = None

# Optional Overrides (Set to None to ignore)
with open('/usr/share/hassio/homeassistant/secrets.yaml') as f:
    secrets = yaml.safe_load(f)
device_id = None
master_token = secrets['master_token_google']
access_token = None #"secrets['access_token_google']

# Flags
DEBUG = False


def get_master_token(username, password, android_id):
    res = perform_master_login(username, password, android_id)
    if DEBUG:
        print(res)
    if 'Token' not in res:
        print('[!] Could not get master token.')
        return None
    return res['Token']


def get_access_token(username, master_token, android_id):
    res = perform_oauth(
        username, master_token, android_id,
        app='com.google.android.apps.chromecast.app',
        service='oauth2:https://www.google.com/accounts/OAuthLogin',
        client_sig='24bb24c05e47e0aefa68a58a766179d9b613a600'
    )
    if DEBUG:
        print(res)
    if 'Auth' not in res:
        print('[!] Could not get access token.')
        return None
    return res['Auth']


def _get_android_id():
    mac_int = getmac()
    if (mac_int >> 40) % 2:
        raise OSError("a valid MAC could not be determined."
                      " Provide an android_id (and be"
                      " sure to provide the same one on future runs).")

    android_id = _create_mac_string(mac_int)
    android_id = android_id.replace(':', '')
    return android_id


def _create_mac_string(num, splitter=':'):
    mac = hex(num)[2:]
    if mac[-1] == 'L':
        mac = mac[:-1]
    pad = max(12 - len(mac), 0)
    mac = '0' * pad + mac
    mac = splitter.join([mac[x:x + 2] for x in range(0, 12, 2)])
    mac = mac.upper()
    return mac


if not device_id:
    device_id = _get_android_id()


print('''
This script generates tokens that can be used when making requests to the Google Home Foyer API.
There are 2 kinds of tokens used here:

1. Master token - Is in the form `aas_et/***` and is long lived. Needs Google username and password.
2. Access token - Is in the form `ya29.***` and lasts for an hour. Needs Master token to generate.

If you do not want to store the Google account password in plaintext,
get the master token once, and set it as an override value.

It's safer/easier to generate an app password and use it instead of the actual password.
It still has the same access as the regular password, but still better than using the real password while scripting.
(https://myaccount.google.com/apppasswords)
''')

print('\n[*] Getting master token...')
if not master_token:
    master_token = get_master_token(USERNAME, PASSWORD, device_id)
print('[*] Master token:', master_token)

print('\n[*] Getting access token...')
if not access_token:
    access_token = get_access_token(USERNAME, master_token, device_id)
print('[*] Access token:', access_token)

print('\n[*] Done.')
