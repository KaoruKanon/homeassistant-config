###############################################################

# enedis_sensor.py
# Données mensuelles des kwh de chez Enedis/Linky
# https://github.com/KaoruKanon
# version : v1.2
###############################################################

from datetime import datetime
import os
import sqlite3

abspath = os.path.abspath(__file__)
dname = os.path.dirname(abspath)
os.chdir(dname)

# get date and months
d = datetime.now()
date = d.strftime("%F")
current_year = int(d.strftime("%Y"))
current_month = int(d.strftime("%m"))
current_day = int(d.strftime("%d"))
last_month = int(d.strftime("%m")) - 1

if current_month == 1:
    before_current_year = current_year = int(d.strftime("%Y")) - 1
else :
    before_current_year = current_year = int(d.strftime("%Y"))

# get kwh value from MyElectricalData DB
con = sqlite3.connect("file:../enedisgateway2mqtt/cache.db?mode=ro", uri=True)
cur = con.cursor()

slq_request_current_month = "select * from consumption_daily where date>'" + str(current_year) + "-"+ str(current_month) +  "-01' and date<'" + date + "' ORDER by date"
slq_request_current_month_res = cur.execute(slq_request_current_month).fetchall()
kwh_current_month = sum([ x[3] for x in slq_request_current_month_res]) // 1000

slq_request_last_month = "select * from consumption_daily where date>'" + str(before_current_year) + "-"+ str(last_month) +  "-01' and date<'" + str(current_year) + "-"+ str(current_month) + "' ORDER by date"
slq_request_last_month_res = cur.execute(slq_request_last_month).fetchall()
kwh_last_month = sum([ x[3] for x in slq_request_last_month_res]) // 1000

#open data
with open('data.kwh') as f:
    data = f.readline()

# split data with comma sepator
data = data.split(",")

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
