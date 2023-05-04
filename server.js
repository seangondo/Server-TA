// const first = require('ee-first');
// const { or } = require('ip');
const mqtt = require('mqtt');
//const ohmni = require('https://api.ohmnilabs.com/ohmni-api/Ohmni-standalone.js');
const mysql = require('mysql2');

var PI = 3.141592653589793238;

var task = false;
var task1 = false;
var task2 = false;
var task3 = false;

var sendTime = 2; //in Seconds

var totalSensor = [];

const sum = [];
const val = [];
const avg = [];
const sumTrend = [];
const valTrend = [];
const avgTrend = [];

var db_houseID = [];
var db_robotID = [];
var db_watchID = [];

const robotData = [];

// const userData = [];
const sensorData = [];
const buttonData = [];
const elderData = [];

const wearTrend = [];

const coord_robot = [];
const coord_map = [];

var trendSend = '';
var wearTrendSend = '';

var sendAlarmTemp = false;
var sendAlarmGas = false;

const sendAlarm = [];
const sendWearAlarm = [];

var options={
    retain:true, 
    qos:0
};
var options2={
    retain:false, 
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

function removeDuplicates(arr) {
    if(arr.length == 0 || arr.length == 1) {
        return arr;
    }
    var n = arr.length;
    var temp = [];
    var x = 0;

    for(i = 0 ; i < n - 1; i++){
        if (arr[i] !== arr[i+1] ) {
            temp[x] = arr[i];
            x++;
        }
    }
    temp[x++] = arr[n-1];
    return temp;
}

//-------------------< MQTT Subscribe Topic on Connect >-------------------//
client.on('connect', () => {
    let sql = `SELECT * FROM elder_list LEFT JOIN smarthome_table ON elder_list.house_id = smarthome_table.house_id ORDER BY elder_id ASC;`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        for(var i = 0; i < result.length; i++){
            //elderData.push({'username': result[i]['username'], 'house_id': result[i]['house_id'], 'robot_id': result[i]['robot_id']});
            elderData.push({
                'elder_id': result[i]['elder_id'], 
                'name': result[i]['name'], 
                'address': result[i]['address'], 
                'house_id': result[i]['house_id'], 
                'robot_id': result[i]['robot_id'], 
                'watch_id': result[i]['watch_id']});

            db_houseID.push(result[i]['house_id']);
            db_robotID.push(result[i]['robot_id']);
            db_watchID.push(result[i]['watch_id']);
            client.subscribe(`${result[i]['elder_id']}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
            client.subscribe(`${result[i]['watch_id']}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
        }

        // ROBOT ID
        for(var i = 0; i < db_robotID.length; i++) {
            client.subscribe(`${db_robotID[i]}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
        }
        db_robotID.sort();
        db_robotID = removeDuplicates(db_robotID);
        for(var i = 0; i < db_robotID.length; i++) {
            robotData.push({
                'robot_id': db_robotID[i],
                'x': 0,
                'y': 0
            })
        }

        // HOUSE ID
        for(var i = 0; i < db_houseID.length; i++) {
            client.subscribe(`${db_houseID[i]}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
            totalSensor[db_houseID[i]] = 0;
        }
        sensorList();
        buttonList();
        elderList();
        db_houseID.sort();
        db_houseID = removeDuplicates(db_houseID);
        for(var i = 0; i < db_houseID.length; i++) {
            let sql = `CREATE TABLE IF NOT EXISTS ${db_houseID[i]}_house_trend (
                room VARCHAR(50),
                type VARCHAR(50),
                date DATETIME,
                value INT
              );`;
              let query = conn.query(sql, (err,result)=>{
                if (err) throw err;
            });
            map_reg(db_houseID[i]);
        }   

        // WATCH ID
        for(var i = 0; i < db_watchID.length; i++) {
            client.subscribe(`${db_watchID[i]}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
        }
        db_watchID.sort();
        db_watchID = removeDuplicates(db_watchID);
        for(var i = 0; i < db_watchID.length; i++) {
            createWearTrend(db_watchID[i]);
        }

        for(var i = 0; i < elderData.length; i++) {
            for(var j = 0; j < db_watchID.length; j++) {
                if(db_watchID[j] == elderData[i]['watch_id']) {
                    sendWearAlarm.push({
                        'watch_id': db_watchID[j],
                        'elder_id': elderData[i]['elder_id'], 
                        'elder_name': elderData[i]['name'],
                        'address': elderData[i]['address'], 
                        'val': false});
                }
            }
        }
    });
})

function createWearTrend(watch_id) {
    let sql = `SELECT * FROM wearable_table WHERE watch_id = '${watch_id}'`
    let query = conn.query(sql, (err,result)=>{
        if(!err){
            for(var i = 0; i < result.length; i++){
                if(result[i]['sensor'].includes(',')){
                    var sensor = result[i]['sensor'].split(',');
                    for(var x = 0; x < sensor.length; x++) {
                        wearTrend.push({
                            'watch_id': result[i]['watch_id'],
                            'type': sensor[x],
                            'sum': 0,
                            'val': 0,
                            'avg': 0
                        });
                    }
                } else {
                    wearTrend.push({
                        'watch_id': result[i]['watch_id'],
                        'type': result[i]['sensor'],
                        'sum': 0,
                        'val': 0,
                        'avg': 0
                    });
                }
            }
        }
    });
}

function updateDatabase() {
    
    //-------------------< UPDATE DATABASE >-------------------//
    sensorList();
    buttonList();
    elderList();
}

setInterval(updateDatabase, 1000);

//===============================================================< MAIN >===============================================================//
//-------------------< MQTT Subscribe Topic on Connect >-------------------//
client.on('message', function(topic, message) {

    //-------------------< UPDATE DATABASE >-------------------//
    // sensorList();
    // buttonList();
    // elderList();

    //-------------------< SPLIT TOPIC FOR CALCULATING >-------------------//
    var split = splitTopic('/'+topic+'/', message);
    varCheck(split[0]);
    //checkDb(split);

    //-------------------< ADD VALUE FOR AVERAGE >-------------------//
    if((sum !== null && val !== null && avg !== null) && (sumTrend !== null && valTrend !== null && avgTrend !== null)) {
        for(i = 0; i < sum.length; i++) {
            if(split[0] == sum[i]['house_id'] && split[2] == sum[i]['room'].replace(' ', '') && split[3] == sum[i]['type']) {
                sum[i]['val'] += parseInt(message);
                val[i]['val'] += 1;
                
                sumTrend[i]['val'] += parseInt(message);
                valTrend[i]['val'] += 1;
            }
        }
    }

    //-------------------< BUTTON FROM APPS >-------------------//
    if(buttonData !== null) {
        if(split[2] == 'control_button') {
            var msg = JSON.parse(message)
            //--------------------------------- < AUTOMATIC MODE > -----------------------------------//
            if(split[3] == 'automatic_mode') {
                for(var i = 0; i < elderData.length; i++) {
                    if(split[0] == elderData[i]['elder_id']) {
                        if(msg['var'] == 1) {
                            broadcastButton(elderData[i]['house_id'], 'user', split[3], 'automatic_mode', msg['value']);
                        }
                    }
                }
                for(var i = 0; i < db_houseID.length; i++) {
                    if(split[0] == db_houseID[i]) {
                        if(msg['var'] == 1) {
                            broadcastButton(db_houseID[i], 'user', split[3], 'automatic_mode', msg['value']);
                        }
                    }
                }
            } 
            //--------------------------------- < BUTTON MODE > -----------------------------------//
            else {
                for(var i = 0; i < elderData.length; i++) {
                    if(split[0] == elderData[i]['elder_id']) {
                        if(msg['var'] == 1) {
                            broadcastButton(elderData[i]['house_id'], 'user', split[3], split[4], msg['value']);
                        }
                    }
                }
                for(var i = 0; i < db_houseID.length; i++) {
                    if(split[0] == db_houseID[i]) {
                        if(msg['var'] == 1) {
                            broadcastButton(db_houseID[i], 'user', split[3], split[4], msg['value']);
                        }
                    }
                }
            }
        }

        // for(var i = 0; i < buttonData.length; i++) {
        //     if(split[2] == 'control_button' && split[3] == buttonData[i]['room'] && split[4] == buttonData[i]['button_type']) {
        //         var msg = JSON.parse(message)
        //         if(msg['var'] == 1) {
        //             if(split[0] == buttonData[i]['house_id']) {
        //                 broadcastButton(buttonData[i]['house_id'], 'house', buttonData[i]['room'], buttonData[i]['button_type'], msg['value']);
        //             } else {
        //                 broadcastButton(buttonData[i]['house_id'], 'user', buttonData[i]['room'], buttonData[i]['button_type'], msg['value']);
        //             }
        //         }
        //     }
        // }
        // if (split[2] == 'control_button' && split[3] == 'automatic_mode') {
        //     var msg = JSON.parse(message)
        //     for(var i = 0; i < elderData.length; i++) {
        //         if(split[0] == elderData[i]['elder_id']) {
        //             if(msg['var'] == 1) {
        //                 broadcastButton(elderData[i]['house_id'], 'user', split[3], 'automatic_mode', msg['value']);
        //             }
        //         }
        //     }
        //     for(var i = 0; i < db_houseID.length; i++) {
        //         if(split[0] == db_houseID[i]) {
        //             if(msg['var'] == 1) {
        //                 broadcastButton(db_houseID[i], 'user', split[3], 'automatic_mode', msg['value']);
        //             }
        //         }
        //     }
        // }
    }
    
    //-------------------< Send to Apps >-------------------//
    if (task == false) {
        printVal(sendTime);
        task = true;
    }

    if (task1 == false) {
        printVal2(10);
        task1 = true;
    }
    if (task2 == false) {
        dbCleanup(10, 180);
        task2 = true;
    }

    if(task3 == false) {
        printVal3(10);
        task3 = true;
    }


    //-------------------< Receive Value ROBOT >-------------------//
    if (topic.includes('robot')) {
        if(topic.includes('controller')) {
            for(var i = 0; i < elderData.length; i++) {
                if(split[0] == elderData[i]['elder_id']) {
                    
                    // TOPIC CONTROL MOVE ROBOT
                    if(topic.includes('move')) {
                        const myObj = JSON.parse(message);
                        var angle = myObj["angle"];
                        var power = myObj["strength"];
                        var angleRad = angle * PI / 180;
        
                        var xMax = 1;
                        var yMax = 0.22;
        
                        var Angular = (power / 100) * xMax * Math.cos(angleRad) * -1;
                        var Linear = (power / 100) * yMax * Math.sin(angleRad);
                        
                        client.publish(`${elderData[i]['house_id']}/${elderData[i]['robot_id']}/controller/move`, `[{
                            "linear": ${Linear},
                            "angular": ${Angular}
                        }]`);
                    }

                    // TOPIC CONTROL NECK ROBOT
                    if(topic.includes('neck')) {
                
                        const myObj = JSON.parse(message);
                        var cmd = myObj["angle"];
        
                        client.publish(`${elderData[i]['house_id']}/${elderData[i]['robot_id']}/controller/neck`, `[{
                            "cmd": "${cmd}"
                        }]`);

                        // if(cmd == 'up') {
                        //     // client.publish(`${elderData[i]['house_id']}/${elderData[i]['robot_id']}/controller/neck`, `[{
                        //     client.publish(`10001/26765/controller/neck`, `[{
                        //         "cmd": "${cmd}"
                        //     }]`);
                        // } else if (cmd == 'down') {
                        //     // client.publish(`${elderData[i]['house_id']}/${elderData[i]['robot_id']}/controller/neck`, `[{
                        //     client.publish(`10001/26765/controller/neck`, `[{
                        //         "cmd": "down"
                        //     }]`);
                        // }
                    }

                    // TOPIC CONTROL ROBOT MOVE COORDINATE
                    if(topic.includes('map_coord')) {
                        const myObj = JSON.parse(message);
                        var x_cmd = myObj['x'];
                        var y_cmd = myObj['y'];

                        for(var j = 0; j < robotData.length; j++) {
                            if(robotData[j]['robot_id'] == elderData[i]['robot_id']) {
                                const hasil = calculateLength(elderData[i]['house_id'], x_cmd, y_cmd, robotData[j]['x'], robotData[j]['y']);
                                
                                client.publish(`${elderData[i]['house_id']}/${elderData[i]['robot_id']}/map/coord`, 
                                `{
                                    "coord_name": "${hasil[0]['coord_name']}",
                                    "angle": ${hasil[0]['angle']},
                                    "x": ${hasil[0]['x']},
                                    "y": ${hasil[0]['y']}
                                }`, options2);
                            }
                        }
                    }
                    
                    if(topic.includes('cancel')) {
                        const myObj = JSON.parse(message);
                        var cmd = myObj['command'];
                        
                        for(var j = 0; j < robotData.length; j++) {
                            if(robotData[j]['robot_id'] == elderData[i]['robot_id']) {
                                
                                client.publish(`${elderData[i]['house_id']}/${elderData[i]['robot_id']}/map/cancel`, 
                                `{
                                    "command": "${cmd}"
                                }`, options2);
                            }
                        }
                    }
                }
            }
        }
    }

    if(robotData.length != 0) {
        for(var i = 0; i < robotData.length; i++) {
            if(split[0] == robotData[i]['robot_id']) {
                const myObj = JSON.parse(message);
                robotData[i]['x'] = myObj['position']['x'];
                robotData[i]['y'] = myObj['position']['y'];
            }
        }
    }

    //-------------------< Bagian Wearable Device >-------------------//
    if (split[1] == 'wearable') {
        for(var i = 0; i < elderData.length; i++) {
            if(split[0] == elderData[i]['watch_id']) {
                if(split[3] == 'heart_rate') {
                    client.publish(`${elderData[i]['elder_id']}/apps/wearable/heart_rate`, 
                    `{
                        "watch_id": "${elderData[i]['watch_id']}",
                        "hr": ${message}
                    }`, options);
                    if(JSON.parse(message) >= 180 || JSON.parse(message) <= 60) {
                        //-------------------< Date and Time >-------------------//
                        var dateNow = new Date();
                        var date1 = dateNow.toLocaleDateString('ko-KR', 'Asia/Jakarta').replaceAll('. ', '-').replace('.','');
                        var date2 = dateNow.toLocaleTimeString('en-GB', 'Asia/Jakarta');
                        for(var i = 0; i < sendWearAlarm.length; i ++) {
                            if(split[0] == sendWearAlarm[i]['watch_id']) {
                                if(sendWearAlarm[i]['val'] == false) {
                                    alarmWearSend(date1, date2, 'Heart Rate', `${sendWearAlarm[i]['elder_name']} Heart rate abnormal! HR : ${JSON.parse(message)}`, sendWearAlarm[i]['watch_id'], i, 5);
                                    sendWearAlarm[i]['val'] = true;
                                }
                            }
                        }
                    }
                }
                if(split[3] == 'onbody') {
                    if(JSON.parse(message) == 1) {
                        client.publish(`${elderData[i]['elder_id']}/apps/wearable/onbody`, 
                        `{
                            "watch_id": "${elderData[i]['watch_id']}",
                            "onbody": "true"
                        }`, options);
                    } else if(JSON.parse(message) == 0) {
                        client.publish(`${elderData[i]['elder_id']}/apps/wearable/onbody`, 
                        `{
                            "watch_id": "${elderData[i]['watch_id']}",
                            "onbody": "false"
                        }`, options);
                    }
                }
                if(split[2] == 'sos') {
                    //-------------------< Date and Time >-------------------//
                    var dateNow = new Date();
                    var date1 = dateNow.toLocaleDateString('ko-KR', 'Asia/Jakarta').replaceAll('. ', '-').replace('.','');
                    var date2 = dateNow.toLocaleTimeString('en-GB', 'Asia/Jakarta');
                    for(var i = 0; i < sendWearAlarm.length; i ++) {
                        if(split[0] == sendWearAlarm[i]['watch_id']) {
                            // if(sendWearAlarm[i]['val'] == false) {
                            alarmWearSend(date1, date2, 'SOS', `${sendWearAlarm[i]['elder_name']} init SOS message!`, sendWearAlarm[i]['watch_id'], i, 0);
                            sendWearAlarm[i]['val'] = true;
                            // }
                        }
                    }
                }
            }
        }
        for(var i = 0; i < wearTrend.length; i++) {
            if(wearTrend[i]['watch_id'] == split[0]) {
                if(split[3].replace('_', ' ') == wearTrend[i]['type']){
                    wearTrend[i]['sum'] += parseInt(message);
                    wearTrend[i]['val'] += 1;
                }
            }
        }
    }
    // calculateLength('10001',0, 0);
});
//===============================================================< END MAIN >===============================================================//

function sensorList(){
    let sql = `SELECT * FROM db_sensor ORDER BY house_id ASC`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;

        if(sensorData.length != result.length) {
            if(sensorData.length == 0) {
                for(j = 0; j < result.length; j++){
                    sensorData.push({
                        'house_id': result[j]['house_id'], 
                        'room': result[j]['room'], 
                        'sensor_type': result[j]['sensor_type'],
                        'trend': result[j]['trend'],
                        'alarm': result[j]['alarm'],
                        'upper_limit': result[j]['upper_limit'],
                        'lower_limit': result[j]['lower_limit']
                    });
                }
            }
            else {
                if(sensorData.length < result.length) {
                    var x = result.length - 1;
                    sensorData.push({
                        'house_id': result[x]['house_id'], 
                        'room': result[x]['room'], 
                        'sensor_type': result[x]['sensor_type'],
                        'trend': result[x]['trend'],
                        'alarm': result[j]['alarm'],
                        'upper_limit': result[j]['upper_limit'],
                        'lower_limit': result[j]['lower_limit']
                    });
                } else if(sensorData.length > result.length) {
                    var c = 0;
                    var y = [];
                    for(i = 0; i < sensorData.length; i++) {
                        for(j = 0; j < result.length; j++) {
                            if(result[j] == sensorData[i]) {
                                c += 1;
                            } 
                        }
                        y.push(c);
                    }
                    for(i = 0; i< y.length; i++) {
                        if(y[i] == 0) {
                            sensorData.splice(i, 1);
                        }
                    }
                }
            }
        } else {
            for(i = 0; i < sensorData.length; i++) {
                if(sensorData[i]['house_id'] != result[i]['house_id'] 
                || sensorData[i]['room'] != result[i]['room'] 
                || sensorData[i]['sensor_type'] != result[i]['sensor_type'] 
                || sensorData[i]['trend'] != result[i]['trend']
                || sensorData[i]['alarm'] != result[i]['alarm']
                || sensorData[i]['upper_limit'] != result[i]['upper_limit']
                || sensorData[i]['lower_limit'] != result[i]['lower_limit']) {

                    sensorData[i]['house_id'] = result[i]['house_id'];
                    sensorData[i]['room'] = result[i]['room'];
                    sensorData[i]['sensor_type'] = result[i]['sensor_type'];
                    sensorData[i]['trend'] = result[i]['trend'];
                    sensorData[i]['alarm'] = result[i]['alarm'];
                    sensorData[i]['upper_limit'] = result[i]['upper_limit'];
                    sensorData[i]['lower_limit'] = result[i]['lower_limit'];
                }
            }
        }
    });
}


function buttonList(){
    let sql = `SELECT * FROM db_button ORDER BY house_id ASC`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;

        if(buttonData.length != result.length) {
            if(buttonData.length == 0) {
                for(j = 0; j < result.length; j++){
                    buttonData.push({
                        'house_id': result[j]['house_id'], 
                        'room': result[j]['room'], 
                        'button_type': result[j]['button_type'],
                        'var': 0
                    });
                }
            }
            else {
                if(buttonData.length < result.length) {
                    var x = result.length - 1;
                    buttonData.push({
                        'house_id': result[x]['house_id'], 
                        'room': result[x]['room'], 
                        'button_type': result[x]['button_type'],
                        'var': 0
                    });
                } else if(buttonData.length > result.length) {
                    var c = 0;
                    var y = [];
                    for(i = 0; i < buttonData.length; i++) {
                        for(j = 0; j < result.length; j++) {
                            if(result[j] == buttonData[i]) {
                                c += 1;
                            } 
                        }
                        y.push(c);
                    }
                    for(i = 0; i< y.length; i++) {
                        if(y[i] == 0) {
                            buttonData.splice(i, 1);
                        }
                    }
                }
            }
        } else {
            for(i = 0; i < buttonData.length; i++) {
                if(buttonData[i]['house_id'] != result[i]['house_id'] 
                || buttonData[i]['room'] != result[i]['room'] 
                || buttonData[i]['button_type'] != result[i]['button_type']) {

                    buttonData[i]['house_id'] = result[i]['house_id'];
                    buttonData[i]['room'] = result[i]['room'];
                    buttonData[i]['button_type'] = result[i]['button_type'];
                    buttonData[i]['var'] = 0;
                }
            }
        }
    });
}

function elderList(){
    let sql = `SELECT * FROM elder_list LEFT JOIN smarthome_table ON elder_list.house_id = smarthome_table.house_id ORDER BY elder_id ASC;`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;

        if(elderData.length != result.length) {
            if(elderData.length == 0) {
                for(i = 0; i < result.length; i++){
                    elderData.push({
                        'elder_id': result[i]['elder_id'], 
                        'name': result[i]['name'], 
                        'address': result[i]['address'], 
                        'house_id': result[i]['house_id'], 
                        'robot_id': result[i]['robot_id'], 
                        'watch_id': result[i]['watch_id'] 
                    });
                }
            }
            else {
                if(elderData.length < result.length) {
                    var x = result.length - 1;
                    elderData.push({
                        'elder_id': result[x]['elder_id'], 
                        'name': result[x]['name'], 
                        'address': result[x]['address'], 
                        'house_id': result[x]['house_id'], 
                        'robot_id': result[x]['robot_id'], 
                        'watch_id': result[x]['watch_id'] 
                    });
                } else if(elderData.length > result.length) {
                    var c = 0;
                    var y = [];
                    for(i = 0; i < elderData.length; i++) {
                        for(j = 0; j < result.length; j++) {
                            if(result[j] == elderData[i]) {
                                c += 1;
                            } 
                        }
                        y.push(c);
                    }
                    for(i = 0; i< y.length; i++) {
                        if(y[i] == 0) {
                            elderData.splice(i, 1);
                        }
                    }
                }
            }
        } else {
            for(i = 0; i < elderData.length; i++) {
                if(elderData[i]['elder_id'] != result[i]['elder_id'] 
                || elderData[i]['name'] != result[i]['name'] 
                || elderData[i]['address'] != result[i]['address'] 
                || elderData[i]['house_id'] != result[i]['house_id']
                || elderData[i]['robot_id'] != result[i]['robot_id']
                || elderData[i]['watch_id'] != result[i]['watch_id']) {

                    elderData[i]['elder_id'] = result[i]['elder_id'];
                    elderData[i]['name'] = result[i]['name'];
                    elderData[i]['address'] = result[i]['address'];
                    elderData[i]['house_id'] = result[i]['house_id'];
                    elderData[i]['robot_id'] = result[i]['robot_id'];
                    elderData[i]['watch_id'] = result[i]['watch_id'];
                    
                    console.log(elderData[i]);
                }
            }
        }
    });
}

function splitTopic(topic) {
    var arrObj = []
    var i = 0;
    var index = 0;
    while (index != -1) { 
        var start = index + 1;
        index = topic.indexOf('/', index + 1);
        if(index != -1) {
            arrObj[i] = topic.substring(start, index)
            i++;
        } else {
            break;
        }
    }
    return arrObj;
}

function varCheck(id) {
    //let sql = `SELECT COUNT(house_id) AS n FROM db_sensor WHERE house_id='${id}'`;
    let sql = `SELECT * FROM db_sensor WHERE house_id='${id}'`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        // if(totalSensor != result[0]['n']) {
        if(totalSensor[id] !== result.length && totalSensor[id] == 0) {
            totalSensor[id] = result.length;
            for(i = 0; i < totalSensor[id]; i++) {
                sum.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});
                val.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});
                avg.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});

                sumTrend.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});
                valTrend.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});
                avgTrend.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': 0});

                sendAlarm.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': false});
            }
        } else if(totalSensor[id] < result.length) {
            var x = result.length - 1;
            sum.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
            val.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
            avg.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});

            sumTrend.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
            valTrend.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
            avgTrend.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});

            sendAlarm.push({'house_id': id, 'room': result[i]['room'], 'type': result[i]['sensor_type'], 'val': false});
        }
    });
}

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
    for (var i = 0; i < sum.length; i ++) {
        if(sum[i]['val'] != 0) {
            avg[i]['val'] = sum[i]['val'] / val[i]['val'];
        }
    }

    for(var x = 0; x < sum.length; x++) {
        for(var i = 0; i < sensorData.length; i++) {
            if(avg[x]['type'] == sensorData[i]['sensor_type']) {
                if(sensorData[i]['alarm'] == 'yes') {
                    if (sendAlarm[x]['val'] == false){
                        if(Math.round(avg[x]['val']) > sensorData[i]['upper_limit']) {
                            var msg_alarm = avg[x]['type'].charAt(0).toUpperCase() + avg[x]['type'].slice(1);
                            alarmSend(date1, date2, "Smart Home", `${msg_alarm} ${avg[x]['room']} terlalu tinggi!`, avg[x]['house_id'], x);
                            sendAlarm[x]['val'] = true;
                        } 
                        else if (Math.round(avg[x]['val']) < sensorData[i]['lower_limit']) {
                            var msg_alarm = avg[x]['type'].charAt(0).toUpperCase() + avg[x]['type'].slice(1);
                            alarmSend(date1, date2, "Smart Home", `${msg_alarm} ${avg[x]['room']} terlalu rendah!`, avg[x]['house_id'], x);
                            sendAlarm[x]['val'] = true;
                        }
                    }
                }
            }
        }
        // if(avg[x]['type'] == 'temp') {
            
        //     if (sendAlarmTemp == false){
        //         console.log("Alarm suhu")
        //         if(Math.round(avg[x]['val']) > 40) {
        //             alarmSend(date1, date2, "Smart Home", `Suhu ${avg[x]['room']} terlalu tinggi!`, avg[x]['house_id'], "temp");
        //             sendAlarmTemp = true;
        //         } 
        //         else if (Math.round(avg[x]['val']) < 20 && Math.round(avg[x]['val']) > 0) {
        //             alarmSend(date1, date2, "Smart Home", `Suhu ${avg[x]['room']} terlalu rendah!`, avg[x]['house_id'], "temp");
        //             sendAlarmTemp = true;
        //         }
        //     }
            
        // }
        // if(avg[x]['type'] == 'gas') {
        //     if (sendAlarmGas == false) {
        //         if(Math.round(avg[x]['val']) > 400) {
        //             alarmSend(date1, date2, "Smart Home", `Terjadi kebocoran gas! Segera cek gas ${avg[x]['room']}!`, avg[x]['house_id'], "gas");
        //             sendAlarmGas = true;
        //         }
        //     }
        // }
        
        if(val[x]['val'] != 0) {
            var data = '';
            var topic = '';
            for(j = 0; j < elderData.length; j++) {
                for(i = 0; i < avg.length; i++){
                    if(elderData[j]['house_id'] == avg[i]['house_id']) {
                        topic = `${elderData[j]['elder_id']}/apps/data`;
                        data += `"${avg[i]['room'].replaceAll(' ','')}_${avg[i]['type']}":"${Math.round(avg[i]['val'])}"`;
                        if(i != avg.length - 1){
                            data += ',';
                        }
                    }
                }
                client.publish(`${elderData[j]['elder_id']}/apps/data`, `[{${data}}]`, options);
                data = '';
            }
            
            for (i = 0; i < sum.length; i ++) {
                sum[i]['val'] = 0;
                val[i]['val'] = 0;
            }
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
    for (i = 0; i < sumTrend.length; i ++) {
        if(sumTrend[i]['val'] != 0) {
            avgTrend[i]['val'] = sumTrend[i]['val'] / valTrend[i]['val'];
        }
    }

    for(i = 0; i < sensorData.length; i++) {
        for(j = 0; j < avgTrend.length; j++) {
            if(sumTrend[j]['val'] != 0) {
                if(avgTrend[j]['house_id'] == sensorData[i]['house_id'] && avgTrend[j]['room'] == sensorData[i]['room'] && avgTrend[j]['type'] == sensorData[i]['sensor_type'] ) {
                    if(sensorData[i]['trend'] == "yes") {
                        trendVal(`${avgTrend[j]['house_id']}_house_trend`, avgTrend[j]['room'], avgTrend[j]['type'], dateFix, avgTrend[j]['val'], avgTrend[j]['house_id']);
                        // console.log(`${avgTrend[j]['house_id']} == ${avgTrend[j]['room']} == ${avgTrend[j]['type']} == ${avgTrend[j]['val']}`);
                    }
                }
            }
        }
    }

    for(var i = 0; i < sumTrend.length; i++) {
        if(sumTrend[i]['val'] != 0) {
            sumTrend[i]['val'] = 0;
            valTrend[i]['val'] = 0;
        }
    }
    // for(x = 0; x < sensorData.length; x++) {
        

    //     for (var i = 0; i < trendType[db_houseID[x]].length; i++) {
    //         trendVal(trendType[db_houseID[x]][i], dateFix, i, db_houseID[x], trendAvg[db_houseID[x]][i]);
    //     }
    
    //     for (i = 0; i < trendSum.length; i ++) {
    //         trendSum[db_houseID[x]][i] = 0;
    //         trend[db_houseID[x]][i] = 0;
    //     }
    // }


    //-------------------< Reset Value to >-------------------//
    task1 = false;
}

function trendVal(nowType, room, sensor_type, dateFix, value, houseid) {
    let sql = `INSERT INTO ${nowType} (room, type, date, value) VALUES ('${room}', '${sensor_type}', '${dateFix}', ${value});`;
    let query = conn.query(sql, (err,result)=>{
        // if (err) throw err;
        // if (err) {
        //     // console.log('ERROR' + err['sql'])
        // } else {
        if(!err){
            let sql = `SELECT * FROM ${nowType} WHERE room='${room}' AND type='${sensor_type}' ORDER BY DATE DESC;`;
            let query = conn.query(sql, (err,result)=>{
                if (err) throw err;
                var string = JSON.stringify(result);
                var count = JSON.parse(string);
                trendSend = '[';
                if(count.length >= 10) {
                    for (var i = 0; i < 10; i ++) {
                        if (i != 0) trendSend += ',';
                        let getDate = count[i]['date'];
                        let getVal = count[i]['value'];
                        let getRoom = count[i]['room'];
                        let getType = count[i]['type'];
                        const myDate = new Date(getDate);
                        // trendSend += `{
                        //     "dataNo": ${i},
                        //     "room": "${getRoom}",
                        //     "type": "${getType}",
                        //     "value": ${getVal},
                        //     "date": "${myDate.toLocaleDateString('en-GB')}",
                        //     "time": "${myDate.toLocaleTimeString('en-GB')}"
                        // }`
                        trendSend += `{
                            "dataNo": ${i},
                            "house_id": "${houseid}",
                            "type": "${getType}",
                            "value": ${getVal},
                            "date": "${myDate.toLocaleDateString('en-GB')}",
                            "time": "${myDate.toLocaleTimeString('en-GB')}"
                        }`
                    }
                } else {
                    for (var i = 0; i < count.length; i ++) {
                        if (i != 0) trendSend += ',';
                        let getDate = count[i]['date'];
                        let getVal = count[i]['value'];
                        let getRoom = count[i]['room'];
                        let getType = count[i]['type'];
                        const myDate = new Date(getDate);
                        trendSend += `{
                            "dataNo": ${i},
                            "house_id": "${houseid}",
                            "type": "${getType}",
                            "value": ${getVal},
                            "date": "${myDate.toLocaleDateString('en-GB')}",
                            "time": "${myDate.toLocaleTimeString('en-GB')}"
                        }`
                    }
                }
                trendSend += ']';
                for(i = 0; i < elderData.length; i++){
                    if(elderData[i]['house_id'] == houseid) {
                        client.publish(`${elderData[i]['elder_id']}/apps/trend/${room}_${sensor_type}`, trendSend, options);
                    }
                }
            });
        }
    });
}

async function printVal3(time){
    await delay(time);

    var dateNow = new Date();
    var date1 = dateNow.toLocaleDateString('ko-KR', 'Asia/Jakarta').replaceAll('. ', '-').replace('.','');
    var date2 = dateNow.toLocaleTimeString('en-GB', 'Asia/Jakarta');
    var dateFix = date1+' '+date2;

    //-------------------< Calculate Average >-------------------//
    for (var i = 0; i < wearTrend.length; i ++) {
        if(wearTrend[i]['sum'] != 0) {
            wearTrend[i]['avg'] = wearTrend[i]['sum'] / wearTrend[i]['val'];
            wearDataTrend(wearTrend[i]['watch_id'], wearTrend[i]['type'], dateFix, Math.round(wearTrend[i]['avg']));
        }
    }

    for (var i = 0; i < wearTrend.length; i ++) {
        wearTrend[i]['avg'] = 0;
        wearTrend[i]['sum'] = 0;
        wearTrend[i]['val'] = 0;
    }

    task3 = false;
}

function wearDataTrend(watch_id, type, dateFix, value) {
    let sql = `INSERT INTO wearable_trend (watch_id, type, date, value) VALUES ('${watch_id}', '${type}', '${dateFix}', ${value});`;
    let query = conn.query(sql, (err,result)=>{
        if(!err){
            let sql = `SELECT * FROM wearable_trend WHERE watch_id='${watch_id}' AND type='${type}' ORDER BY DATE DESC;`; 
            let query = conn.query(sql, (err,result)=>{
                if (err) throw err;
                var string = JSON.stringify(result);
                var count = JSON.parse(string);
                trendSend = '['
                if(count.length >= 10) {
                    for (var i = 0; i < 10; i ++) {
                        if (i != 0) trendSend += ',';
                        let getVal = count[i]['value'];
                        let getType = count[i]['type'];
                        let getDate = count[i]['date'];
                        const myDate = new Date(getDate);
                        trendSend += `{
                            "dataNo": ${i},
                            "watch_id": "${watch_id}",
                            "value": ${getVal},
                            "type": "${getType}",
                            "date": "${myDate.toLocaleDateString('en-GB')}",
                            "time": "${myDate.toLocaleTimeString('en-GB')}"
                        }`
                    }
                } else {    
                    for (var i = 0; i < count.length; i ++) {
                        if (i != 0) trendSend += ',';
                        let getVal = count[i]['value'];
                        let getType = count[i]['type'];
                        let getDate = count[i]['date'];
                        const myDate = new Date(getDate);
                        trendSend += `{
                            "dataNo": ${i},
                            "value": ${getVal},
                            "watch_id": "${watch_id}",
                            "type": ${getType},
                            "date": "${myDate.toLocaleDateString('en-GB')}",
                            "time": "${myDate.toLocaleTimeString('en-GB')}"
                        }`
                    }
                }
                trendSend += ']';
                for(i = 0; i < elderData.length; i++){
                    if(elderData[i]['watch_id'] == watch_id) {
                        client.publish(`${elderData[i]['elder_id']}/apps/wearable/trend/${type}`, trendSend, options);
                    }
                }
            });
        }
    });
}

async function alarmSend(date, time, type, message, houseid, alarmType) {
    for(i = 0; i < elderData.length; i++){
        if(elderData[i]['house_id'] == houseid) {
            client.publish(`${elderData[i]['elder_id']}/apps/alarm/smart_home`, `
            [{
                "elder_name":"${elderData[i]['name']}",
                "address":"${elderData[i]['address']}",
                "house_id":"${houseid}",
                "date":"${date}",
                "time":"${time}",
                "type":"${type}",
                "message":"${message}"
            }]
            `, options2);
        }
    }
    await delay(10);

    sendAlarm[alarmType]['val'] = false;

    // if (alarmType == "gas") {
    //     sendAlarmGas = false;
    // }
    // if (alarmType == "temp") {
    //     sendAlarmTemp = false;
    // }
}


async function alarmWearSend(date, time, type, message, wearid, alarmType, time) {
    for(i = 0; i < elderData.length; i++){
        if(elderData[i]['watch_id'] == wearid) {
            client.publish(`${elderData[i]['elder_id']}/apps/alarm/wearable`, `
            [{
                "elder_name":"${elderData[i]['name']}",
                "address":"${elderData[i]['address']}",
                "watch_id":"${wearid}",
                "date":"${date}",
                "time":"${time}",
                "type":"${type}",
                "message":"${message}"
            }]
            `, options2);
        }
    }
    await delay(time);

    sendWearAlarm[alarmType]['val'] = false;
}

async function broadcastButton(room_id, type, room, sensor, value) {
    if(room !== 'automatic_mode') {
        for(i = 0; i < elderData.length; i++){
            if(elderData[i]['house_id'] == room_id) {
                client.publish(`${elderData[i]['elder_id']}/apps/control_button/${room}/${sensor}`, `
                {
                    "value":"${value}",
                    "var": 0
                }
                `,options);
            }
        }
        for(var i = 0; i < db_houseID.length; i++) {
            if(db_houseID[i] == room_id) {
                client.publish(`${db_houseID[i]}/send_sensor/control_button/${room}/${sensor}`, `
                {
                    "value": "${value}",
                    "var": 0
                }`
                ,options);
            }
        }
    } 
    else {
        for(var i = 0; i < elderData.length; i++){
            if(elderData[i]['house_id'] == room_id) {
                client.publish(`${elderData[i]['elder_id']}/apps/control_button/${room}`, `
                {
                    "value":"${value}",
                    "var": 0
                }
                `,options);
            }
        }
        for(var i = 0; i < db_houseID.length; i++) {
            if(db_houseID[i] == room_id) {
                client.publish(`${db_houseID[i]}/send_sensor/control_button/${room}`, `
                {
                    "value":"${value}",
                    "var": 0
                }
                `,options);
    
            }
        }
    }
}


//TODO CLEANUP DATABASE
//MASIH BUG KALO 2 HOUSE ID ATAU LEBIH!!!
async function dbCleanup(time, dataCount) {

    await delay(time);
    for(var i = 0; i < sensorData.length; i++) {
        if(sensorData[i]['trend'] == "yes") {
            var house_id = `${sensorData[i]['house_id']}_house_trend`;
            let sql = `SELECT * FROM ${house_id} WHERE room='${sensorData[i]['room']}' AND type='${sensorData[i]['sensor_type']}' ORDER BY DATE ASC;`;
            let query = conn.query(sql, (err, result)=>{
                if(err) throw err;
                var string = JSON.stringify(result);
                var count = JSON.parse(string);
                if(result.length > dataCount) {
                    var length = result.length-dataCount;
                    for(var j = 0; j < length; j++) {
                        var myDate = new Date(count[j]['date']);
                        var dateFix = convertDate(myDate);
                        deleteData(house_id, result[j]['room'], result[j]['type'], result[j]['value'], dateFix);
                        // let sql = `DELETE FROM ${house_id} WHERE room='${result[j]['room']}' AND type='${result[j]['type']}'AND value=${result[j]['value']} AND date='${dateFix}' LIMIT 1;`;
                        // let query = conn.query(sql, (err, result)=>{
                        //     if(err) throw err;
                        //     console.log("masuk2");
                        // });
                    }
                }
            });
        }
    }
    task2 = false;
}

function deleteData(house_id, room, type, value, date) {
    let sql = `DELETE FROM ${house_id} WHERE room='${room}' AND type='${type}'AND value=${value} AND date='${date}' LIMIT 1;`;
    let query = conn.query(sql, (err, result)=>{
        if(err) throw err;
    });
}

function convertDate(date) {
    var date1 = date.toLocaleDateString('ko-KR', 'Asia/Jakarta').replaceAll('. ', '-').replace('.','');
    var date2 = date.toLocaleTimeString('en-GB', 'Asia/Jakarta');
    var dateFix = date1+' '+date2;
    return dateFix;
}

// function mapRegister(house_id) {
//     for(var i = 0; i < db_houseID.length; i++) {
//         let sql = `SELECT * FROM ${db_houseID[i]}_coordinate;`
//         let query = conn.query(sql, (err, result)=> {
//             for(var x = 0; x < result.length; x++) {
//                 coord_robot.push({
//                     'house_id': db_houseID[i],
//                     'coord_name': result[x]['coord_name'],
//                     'x': result[x]['x'],
//                     'y': result[x]['y']
//                 })
//             }
//         })
//         let sql2 = `SELECT * FROM  ${db_houseID[i]}_map_center;`
//         let query2 = conn.query(sql2, (err, result)=> {
//             for(var x = 0; x < result.length; x++) {
//                 coord_map.push({
//                     'house_id': db_houseID[i],
//                     'coord_x': result[x]['coord_x'],
//                     'coord_y': result[x]['coord_x'],
//                     'x_center': result[x]['x_center'],
//                     'y_center': result[x]['y_center'],
//                 })
//             }
//         })
//     }
// }

function map_reg(house_id) {
    let sql = `SELECT * FROM coordinate ORDER BY house_id ASC, coord_name ASC;`
    console.log(sql)
    let query = conn.query(sql, (err, result)=> {
        for(var x = 0; x < result.length; x++) {
            coord_robot.push({
                'house_id': result[x]['house_id'],
                'coord_name': result[x]['coord_name'],
                'x': result[x]['x'],
                'y': result[x]['y']
            })
        }
    })
    // let sql2 = `SELECT * FROM  ${house_id}_map_center;`
    let sql2 = `SELECT * FROM  map_center ORDER BY house_id ASC, coord_x ASC, coord_y ASC;`
    let query2 = conn.query(sql2, (err, result)=> {
        for(var x = 0; x < result.length; x++) {
            coord_map.push({
                'house_id': result[x]['house_id'],
                'coord_x': result[x]['coord_x'],
                'coord_y': result[x]['coord_y'],
                'x_center': result[x]['x_center'],
                'y_center': result[x]['y_center']
            })
        }
    })
}

function calculateLength(house_id, x, y, robot_x, robot_y) {
    const jarak = [];
    const total = [];
    const jarakTotal = [];
    const urutan = [];

    var length1;
    var length2;
    for(var i = 0; i < coord_map.length; i++) {
        if(coord_map[i]['coord_x'] == x && coord_map[i]['coord_y'] == y && coord_map[i]['house_id'] == house_id) {
            for(var j = 0; j < coord_robot.length; j++) {
                var xVal1 = coord_map[i]['x_center'] - coord_robot[j]['x'] ;
                var yVal1 =  coord_map[i]['y_center'] - coord_robot[j]['y'];
                length1 = Math.round(Math.sqrt(Math.pow(xVal1, 2) + Math.pow(yVal1, 2)));
                var angle = Math.atan2(yVal1, xVal1);
                
                var xVal2 = coord_robot[j]['x'] - robot_x;
                var yVal2 = coord_robot[j]['y'] - robot_y;
                var length2 = Math.sqrt(Math.pow(xVal2, 2) + Math.pow(yVal2, 2));
                lengthTotal = length1+length2;

                total.push(length1);

                jarak.push({
                    'coord_name': coord_robot[j]['coord_name'],
                    'x_center': coord_map[i]['x_center'],
                    'y_center': coord_map[i]['y_center'],
                    'x_robot': robot_x,
                    'y_robot': robot_y,
                    'x': coord_robot[j]['x'],
                    'y': coord_robot[j]['y'],
                    'angle': angle,
                    'jarak_awal': length1,
                    'jarak_robot': length2,
                    'jarak_total': lengthTotal
                })
            }
        }
    }
    total.sort();
    jarakTotal.sort();

    for(var i = 0; i < jarak.length; i++) {
        if(jarak[i]['jarak_awal'] === total[0]) {
            jarakTotal.push(jarak[i]['jarak_total']);
        }
    }

    jarakTotal.sort();

    for(var i = 0; i < jarak.length; i++) {
        if(jarak[i]['jarak_total'] === jarakTotal[0] ) {
            urutan.push({
                'coord_name': jarak[i]['coord_name'],
                'angle': jarak[i]['angle'],
                'x': jarak[i]['x'],
                'y': jarak[i]['y']
            });
        }
    }
    // console.log(urutan);

    return urutan;
}

// setInterval(calculateLength('10001',0, 0), 1000);
// setInterval(console.log(coord_map), 1000);