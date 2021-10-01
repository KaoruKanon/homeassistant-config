###############################################################

# bbox_sensor.py
# Bbox sensor à from the custom pybbox module
# https://github.com/KaoruKanon
# version : v1.0
###############################################################

from pybbox_custom import Bbox
import requests
import os
import yaml

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

def bytes_conversion_human(bytes):
    if bytes < 10**3:
        return str(bytes) + ' MB'
    elif bytes >= 10**3 and bytes < 10**6:
        return str(round(bytes/10**3, 2)) + ' GB'
    elif bytes >= 10**6 and bytes < 10**9:
        return str(round(bytes/10**6, 2)) + ' TB'


with open('../secrets.yaml') as f:
    secrets = yaml.safe_load(f)

headers = {
    "Authorization": secrets['enedis_ha_api_token'],
    "content-type": "application/json",
}
ha_url = secrets['external_url'] + '/api/states/'

# bbox login
bbox = Bbox(ip="mabbox.bytel.fr")
bbox.login(password=secrets['bbox_password'])

# bbox get value from api
bbox_cpu_json = bbox.get_bbox_cpu()
bbox_cpu_usage = round(bbox_cpu_json['total'] / bbox_cpu_json['idle'] * 100 - 100, 1)

bbox_mem_json = bbox.get_bbox_mem()
bbox_mem_usage = round(bbox_mem_json['free'] / bbox_mem_json['total'] * 100, 1)


# sensors dict list
list_sensor = [
    {
        "name": 'bbox_cpu',
        "config": {
            "state": bbox_cpu_usage,
            "attributes": {
                "unit_of_measurement": "%",
                "friendly_name": "bbox_cpu"
            }
        },
    },
    {
        "name": 'bbox_mem',
        "config": {
            "state": bbox_mem_usage,
            "attributes": {
                "unit_of_measurement": "%",
                "friendly_name": "bbox_memory"
            }
        },
    },
    {
        "name": 'bbox_uptime',
        "config": {
            "state": bbox.get_bbox_info()['device']['uptime'],
            "attributes": {
                "friendly_name": "bbox_uptime"
            }
        },
    },
    {
        "name": 'bbox_internet',
        "config": {
            "state": bbox.is_bbox_internet(),
            "attributes": {
                "friendly_name": "bbox_internet"
            }
        },
    },
    {
        "name": "bbox_wan_ip_addr",
        "config": {
            "state": bbox.get_wan_ip()['ip']['address'],
            "attributes": {
                "friendly_name": "bbox_wan_ip_addr"
            }
        }
    },
    {
        "name": "bbox_up_packet",
        "config": {
            "state": bbox.get_up_packets(),
            "attributes": {
                "friendly_name": "bbox_up_packets"
            }
        }
    },
    {
        "name": "bbox_down_packet",
        "config": {
            "state": bbox.get_down_packets(),
            "attributes": {
                "friendly_name": "bbox_down_packets"
            }
        }
    },
    {
        "name": "bbox_up_bytes",
        "config": {
            "state": "",
            "attributes": {
                "friendly_name": bytes_conversion_human(bbox.get_up_bytes())
            }
        }
    },
    {
        "name": "bbox_down_bytes",
        "config": {
            "state": "",
            "attributes": {
                "friendly_name": bytes_conversion_human(bbox.get_down_bytes())
            }
        }
    },
    {
        "name": "bbox_hosts_active_number",
        "config": {
            "state": bbox.get_active_hosts_number(),
            "attributes": {
                "friendly_name": "bbox_hosts_active_number"
            }
        }
    },
    {
        "name": 'bbox_wifi',
        "config": {
            "state": bbox.is_wifi_activated(),
            "attributes": {
                "friendly_name": "bbox_wifi"
            }
        },
    },
]

# requests post to ha
for sensor in list_sensor:
    requests.post(ha_url + '/sensor.' + sensor['name'], json=sensor['config'], headers=headers)
