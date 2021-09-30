###############################################################

# enedis_sensor.py
# Données mensuelles des kwh de chez Enedis/Linky
# https://github.com/KaoruKanon
# version : v1.1
###############################################################

from requests import get
from datetime import datetime
import os
import yaml #pip install for the user used for running the script trought ssh command


abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

d = datetime.now()

#get secrets with the secrets.yaml
with open('../secrets.yaml') as f:
    secrets = yaml.safe_load(f)

# restful HASS
url = secrets['enedis_api_sensor_url']
headers = {
    "Authorization": secrets['enedis_ha_api_token'],
    "content-type": "application/json",
}

response = get(url, headers=headers).json()

# get kwh value from json dict restful HASS
kwh_current_month = round(float(response['attributes']['current_month']))
kwh_last_month = round(float(response['attributes']['last_month']))

#open data
with open('data.kwh') as f:
    data = f.readline()

# split data with comma sepator
data = data.split(",")

# get date and months
date = d.strftime("%F")
current_month = int(d.strftime("%m"))
last_month = int(d.strftime("%m")) - 1

if current_month != 1:
	date_last_month = data[last_month - 1 ].split(' ')[1]
else:
	date_last_month = data[11].split(' ')[1]

# write kwh to data
data[current_month - 1] = str(current_month) + ' ' +  date + ' ' + str(kwh_current_month)
data[last_month - 1] = "{0:0=2d}".format(last_month) + ' ' +  date_last_month + ' ' + str(kwh_last_month)

#recalculate total and create data_string for output
total = 0
data_string = ''
for element in data[:-1]:
	if int(element.split(' ')[1].split('-')[0]) == int(d.strftime("%Y")):
		total = total + int(element.split(' ')[2])

data[12]= ' total=' + str(total) + '\n'

# output data
with open('data.kwh', 'w') as f:
    f.write(','.join(data))
