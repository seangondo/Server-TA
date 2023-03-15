const mqtt = require('mqtt');
//const ohmni = require('https://api.ohmnilabs.com/ohmni-api/Ohmni-standalone.js');
const mysql = require('mysql2');

var PI = 3.141592653589793238;

var task = false;
var task1 = false;
// var house_id = '10001';
// var user = 'user';

var sendTime = 2; //in Seconds

const sum = [];
const val = [];
const hslAvg = [];

const trendType = [];
const trendSum = [];
const trend = [];
const trendAvg = [];

const db_username = [];
const db_houseID = [];
const userData = [];
const robot_ID = [];

var trendSend = '';

var options={
    retain:true, 
    qos:0
};

const conn = mysql.createConnection({
    host: 'private-server.uk.to',
    user: 'admin',
    password : 'randpwsocool',
    database : 'elderly_care',
    multipleStatements : true,
});

//-------------------< Connection MQTT and MySQL >-------------------//
const client  = mqtt.connect('mqtt://private-server.uk.to:1883/', {
    username: 'sensor',
    password: 'sensor',
})

conn.connect((err)=>{
    if (err) throw err;
    console.log('Mysql connected...');
});

//-------------------< MQTT Subscribe Topic on Connect >-------------------//
client.on('connect', () => {
    let sql = `SELECT * FROM client_table`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        for(i = 0; i < result.length; i++){
            db_username[i] = result[i]['username'];
            userData[`${db_username[i]}`] = result[i]['house_id'];
            robot_ID[`${db_username[i]}`] = result[i]['robot_id'];
            if(db_houseID[i+1] != db_houseID[i] | db_houseID[0] == null) {
                db_houseID[i] = result[i]['house_id'];

                sum[db_houseID[i]] = [0, 0, 0, 0];
                val[db_houseID[i]] = [0, 0, 0, 0];
                hslAvg[db_houseID[i]] = [0, 0, 0, 0];

                trendType[db_houseID[i]] = ['trend_living_temp', 'trend_kitchen_gas'];
                trendSum[db_houseID[i]] = [0, 0];
                trend[db_houseID[i]] = [0, 0];
                trendAvg[db_houseID[i]] = [0, 0];
            }
            client.subscribe(`${result[i]['house_id']}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
            client.subscribe(`${result[i]['username']}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
        }
    });
})

//-------------------< MQTT Subscribe Topic on Connect >-------------------//
client.on('message', function(topic, message) {

    //-------------------< Send to Apps >-------------------//
    if (task == false){
        printVal(sendTime);
        task = true;
    }
    if (task1 == false){
        printVal2(10);
        task1 = true;
    }

    //-------------------< Receive Value SMARTHOME >-------------------//
    if (topic.includes('receive_sensor')) {
        //console.log('Topic : '+topic+' \t; Msg : '+message);
        if (topic.includes('livingroom')) {
            if (topic.includes('temp')) {
                //console.log(topic.substring(0,5));
                sum[topic.substring(0,5)][0] += 1;
                val[topic.substring(0,5)][0] += Number(message);

                trendSum[topic.substring(0,5)][0] += 1;
                trend[topic.substring(0,5)][0] += Number(message);
            }
            if (topic.includes('light')) {
                sum[topic.substring(0,5)][1] += 1;
                val[topic.substring(0,5)][1] += Number(message);
            }
        }
        if (topic.includes('kitchen')) {
            if (topic.includes('light')) {
                sum[topic.substring(0,5)][2] += 1;
                val[topic.substring(0,5)][2] += Number(message);
            }
            if (topic.includes('gas')) {
                sum[topic.substring(0,5)][3] += 1;
                val[topic.substring(0,5)][3] += Number(message);

                trendSum[topic.substring(0,5)][1] += 1;
                trend[topic.substring(0,5)][1] += Number(message);
            }
        }
    }
    if(topic.includes('control_button') & topic.includes('apps')) {
        if (topic.includes('livingroom')) {
            if (topic.includes('light')) {
                var topicRec = topic.replace('apps','').replace('control_button','').replace('livingroom','').replace('light','').replaceAll('/', '');
                const myObj = JSON.parse(message);
                if(myObj["var"] == 1){
                    broadcastButton("livingroom", topicRec, "light", myObj["value"]);
                }

            }
            if (topic.includes('fan')) {
                var topicRec = topic.replace('apps','').replace('control_button','').replace('livingroom','').replace('fan','').replaceAll('/', ''); 
                const myObj = JSON.parse(message);
                if(myObj["var"] == 1){
                    broadcastButton("livingroom", topicRec, "fan", myObj["value"]);
                }
            }
        }
        if (topic.includes('kitchen')) {
            if (topic.includes('light')) {
                // console.log(JSON.parse(String(message))["value"]);
                var topicRec = topic.replace('apps','').replace('control_button','').replace('kitchen','').replace('light','').replaceAll('/', '');
                const myObj = JSON.parse(message);
                if(myObj["var"] == 1){
                    broadcastButton("kitchen", topicRec, "light", myObj["value"]);
                }
            }
        }
        if (topic.includes('automatic_mode')) {
            var topicRec = topic.replace('apps','').replace('control_button','').replace('automatic_mode','').replaceAll('/', '');
            const myObj = JSON.parse(message);
                if(myObj["var"] == 1){
                    broadcastButton(null, topicRec, "automatic_mode", myObj["value"]);
                }
        }
    }

    //-------------------< Receive Value ROBOT >-------------------//
    if (topic.includes('robot')) {
        if(topic.includes('controller')) {
            if(topic.includes('move')) {
                var topicRec = topic.replace('apps','').replace('robot','').replace('controller','').replace('move','').replaceAll('/', '');
                
                const myObj = JSON.parse(message);
                var angle = myObj["angle"];
                var power = myObj["strength"];
                var angleRad = angle * PI / 180;

                var xMax = 1;
                var yMax = 0.22;

                var Angular = (power / 100) * xMax * Math.cos(angleRad) * -1;
                var Linear = (power / 100) * yMax * Math.sin(angleRad);
                
                client.publish(`${userData[topicRec]}/${robot_ID[topicRec]}/controller/move`, `[{
                    "linear": ${Linear},
                    "angular": ${Angular}
                }]`);

            }
            if(topic.includes('neck')) {
                var topicRec = topic.replace('apps','').replace('robot','').replace('controller','').replace('neck','').replaceAll('/', '');
                const myObj = JSON.parse(message);
                var cmd = myObj["angle"];

                if(cmd == 'up') {
                    client.publish(`${userData[topicRec]}/${robot_ID[topicRec]}/controller/neck`, `[{
                        "cmd": "up"
                    }]`);
                } else if (cmd == 'down') {
                    client.publish(`${userData[topicRec]}/${robot_ID[topicRec]}/controller/neck`, `[{
                        "cmd": "down"
                    }]`);
                }
            }
        }
        if(topic.includes('map_coord')) {
            const myObj = JSON.parse(message);

        }
    }

});

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time*1000));
}

async function printVal(time){

    await delay(time);
    //-------------------< Date and Time >-------------------//
    var dateNow = new Date();
    var date1 = dateNow.toLocaleDateString('ko-KR', 'Asia/Jakarta').replaceAll('. ', '-').replace('.','');
    var date2 = dateNow.toLocaleTimeString('en-GB', 'Asia/Jakarta');

    //-------------------< Calculate Average >-------------------//
    for(x = 0; x < db_houseID.length; x++) {
        for (i = 0; i < val[db_houseID[x]].length; i ++) {
            hslAvg[db_houseID[x]][i] = val[db_houseID[x]][i] / sum[db_houseID[x]][i];
        }
    }

    for(x = 0; x < db_houseID.length; x++) {
        if(Math.round(hslAvg[db_houseID[x]][0]) > 40) {
            alarmSend(date1, date2, "Smart Home", "Suhu Living room terlalu tinggi!", db_houseID[x]);
        } 
        else if (Math.round(hslAvg[db_houseID[x]][0]) < 20) {
            alarmSend(date1, date2, "Smart Home", "Suhu Living room terlalu rendah!", db_houseID[x]);
        }
    
        if(Math.round(hslAvg[db_houseID[x]][3]) > 800) {
            alarmSend(date1, date2, "Smart Home", "Terjadi kebocoran gas! Segera cek gas di dapur!", db_houseID[x]);
        }

        for(i = 0; i < db_username.length; i++){
            if(userData[db_username[i]] == db_houseID[x]) {
                client.publish(`${db_username[i]}/apps/data`, `
                [{
                    "living_temp":"${Math.round(hslAvg[db_houseID[x]][0])}",
                    "living_light":"${Math.round(hslAvg[db_houseID[x]][1])}",
                    "kitchen_light":"${Math.round(hslAvg[db_houseID[x]][2])}",
                    "kitchen_gas":"${Math.round(hslAvg[db_houseID[x]][3])}"
                }]
                `,options);

            }
        }
        
        for (i = 0; i < sum[db_houseID[x]].length; i ++) {
            sum[db_houseID[x]][i] = 0;
            val[db_houseID[x]][i] = 0;
        }
    }

    //-------------------< Reset Value to >-------------------//
    task = false;
}

async function printVal2(time){

    await delay(time);

    var dateNow = new Date();
    var date1 = dateNow.toLocaleDateString('ko-KR', 'Asia/Jakarta').replaceAll('. ', '-').replace('.','');
    var date2 = dateNow.toLocaleTimeString('en-GB', 'Asia/Jakarta');
    var dateFix = date1+' '+date2;
    
    //-------------------< Calculate Average >-------------------//
    for(x = 0; x < db_houseID.length; x++) {
        for (i = 0; i < trend[db_houseID[x]].length; i ++) {
            trendAvg[db_houseID[x]][i] = trend[db_houseID[x]][i] / trendSum[db_houseID[x]][i];
        }
    }

    for(x = 0; x < db_houseID.length; x++) {
        for (var i = 0; i < trendType[db_houseID[x]].length; i++) {
            trendVal(trendType[db_houseID[x]][i], dateFix, i, db_houseID[x], trendAvg[db_houseID[x]][i]);
        }
    
        for (i = 0; i < trendSum.length; i ++) {
            trendSum[db_houseID[x]][i] = 0;
            trend[db_houseID[x]][i] = 0;
        }
    }
    task1 = false;
}

function trendVal(nowType, dateFix, i, houseid, value) {
    let sql = `INSERT INTO ${nowType} (value, date) VALUES (${value}, '${dateFix}');`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        let sql = `SELECT * FROM ${nowType} ORDER BY DATE DESC;`;
        let query = conn.query(sql, (err,result)=>{
            if (err) throw err;
            var string = JSON.stringify(result);
            var count = JSON.parse(string);
            trendSend = '['
            for (var i = 0; i < 10; i ++) {
                if (i != 0) trendSend += ',';
                let getDate = result[i]['date'];
                let getVal = result[i]['value'];
                const myDate = new Date(getDate);
                trendSend += `{
                    "dataNo": ${i},
                    "value": ${getVal},
                    "date": "${myDate.toLocaleDateString('en-GB')}",
                    "time": "${myDate.toLocaleTimeString('en-GB')}"
                }`
            }
            trendSend += ']';
            for(i = 0; i < db_username.length; i++){
                if(userData[db_username[i]] == houseid) {
                    client.publish(`${db_username[i]}/apps/trend/${nowType}`, trendSend, options);
                }
            }
        });
    });
}

function alarmSend(date, time, type, message, houseid) {
    for(i = 0; i < db_username.length; i++){
        if(userData[db_username[i]] == houseid) {
            client.publish(`${db_username[i]}/apps/alarm`, `
            [{
                "date":"${date}",
                "time":"${time}",
                "type":"${type}",
                "message":"${message}"
            }]
            `,options);

        }
    }
}

function broadcastButton(room, userid, type, value) {
    for(i = 0; i < db_username.length; i++){
        if(userData[db_username[i]] == userData[userid]) {
            if(room != "null") {
                client.publish(`${db_username[i]}/apps/control_button/${room}/${type}`, `
                {
                    "value":"${value}",
                    "var": 0
                }
                `,options);
            }
            else {
                client.publish(`${db_username[i]}/apps/control_button/${type}`, `
                {
                    "value":"${value}",
                    "var": 0
                }
                `,options);
            }
        }
    }
    if(userData[userid]!=null) {
        client.publish(`${userData[userid]}/send_sensor/control_button/${room}/${type}`, `
            {
                "value":"${value}",
                "var": 0
            }
            `,options);
    }
}
