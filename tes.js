const mqtt = require('mqtt');
//const ohmni = require('https://api.ohmnilabs.com/ohmni-api/Ohmni-standalone.js');
const mysql = require('mysql2');

var PI = 3.141592653589793238;

var task = false;
var task1 = false;
// var house_id = '10001';
// var user = 'user';

var sendTime = 2; //in Seconds

var count = 0;

var woke = [];

var sensorArr = [];

var totalSensor = [];

const sum = [];
const val = [];
const avg = [];
const sumTrend = [];
const valTrend = [];
const avgTrend = [];

let db_houseID = [];
const userData = [];
const sensorData = [];
const buttonData = [];
const elderData = [];

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
    let sql = `SELECT * FROM client_table ORDER BY house_id ASC`;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
        for(i = 0; i < result.length; i++){
            userData.push({'username': result[i]['username'], 'house_id': result[i]['house_id'], 'robot_id': result[i]['robot_id']});
            db_houseID.push(result[i]['house_id']);
            client.subscribe(`${result[i]['username']}/#`, function (err) {
                if(err) {
                    console.log('Failed to subscribe! Check Server!')
                }
            })
        }
        
        for(i = 0; i < db_houseID.length; i++) {
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
        db_houseID = removeDuplicates(db_houseID);
        for(i = 0; i < db_houseID.length; i++) {
            let sql = `CREATE TABLE IF NOT EXISTS ${db_houseID[i]}_house_trend (
                room VARCHAR(50),
                type VARCHAR(50),
                date DATETIME,
                value INT
              );`;
              let query = conn.query(sql, (err,result)=>{
                if (err) throw err;
            });
        }
    });
})


//--------------------------------------------------< MAIN >----------------------------------------------------------//
//-------------------< MQTT Subscribe Topic on Connect >-------------------//
client.on('message', function(topic, message) {

    //-------------------< UPDATE DATABASE >-------------------//
    sensorList();
    buttonList();
    elderList();

    //-------------------< SPLIT TOPIC FOR CALCULATING >-------------------//
    var split = splitTopic('/'+topic+'/', message);
    checkDb(split);

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

    if(buttonData !== null) {
        for(i = 0; i < buttonData.length; i++) {
            if(split[3] == "control_button" && split[4] == buttonData[i]['button_type']) {
                console.log("TAMBAHI CEK HOUSE ID")
            }
        }
    }
    
    //-------------------< Send to Apps >-------------------//
    if (task == false){
        printVal(sendTime);
        task = true;
    }

    if (task1 == false){
        printVal2(10);
        task1 = true;
    }

});

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
                        'trend': result[j]['trend']
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
                        'trend': result[x]['trend']
                    });
                }
            }
        } else {
            for(i = 0; i < sensorData.length; i++) {
                if(sensorData[i]['house_id'] != result[i]['house_id'] 
                || sensorData[i]['room'] != result[i]['room'] 
                || sensorData[i]['sensor_type'] != result[i]['sensor_type'] 
                || sensorData[i]['trend'] != result[i]['trend']) {

                    sensorData[i]['house_id'] = result[i]['house_id'];
                    sensorData[i]['room'] = result[i]['room'];
                    sensorData[i]['sensor_type'] = result[i]['sensor_type'];
                    sensorData[i]['trend'] = result[i]['trend'];
                }
            }
        }

        // for(i = 0; i < result.length; i++){
        //     sensorData.push({
        //         'house_id': result[i]['house_id'], 
        //         'room': result[i]['room'], 
        //         'sensor_type': result[i]['sensor_type'],
        //         'trend': result[i]['trend']
        //     });
        // }
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
    let sql = `SELECT * FROM elder_list ORDER BY elder_id ASC`;
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
                }
            }
        }
    });
}

function splitTopic(topic, value) {
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

function checkDb(data) {
    if(data[1] == 'receive_sensor') {
        let sql = `SELECT COUNT(house_id) AS n FROM db_sensor WHERE house_id='${data[0]}' AND room='${data[2]}' AND sensor_type='${data[3]}'`;
        let query = conn.query(sql, (err,result)=>{
            if (err) throw err;
            if (result[0]['n'] == 0) {
                addSensorDb(data);
            }
        });
        varCheck(data[0]);
    }
}

function addSensorDb(data) {
    let sql = `INSERT INTO db_sensor (house_id, room, sensor_type) VALUES ('${data[0]}', '${data[2]}', '${data[3]}') `;
    let query = conn.query(sql, (err,result)=>{
        if (err) throw err;
    });
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
            }
        } else if(totalSensor[id] < result.length) {
            var x = result.length - 1;
            sum.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
            val.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
            avg.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});

            sumTrend.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
            valTrend.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
            avgTrend.push({'house_id': id, 'room': result[x]['room'], 'type': result[x]['sensor_type'], 'val': 0});
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
    for (i = 0; i < sum.length; i ++) {
        avg[i]['val'] = sum[i]['val'] / val[i]['val'];
    }

    for(x = 0; x < sum.length; x++) {
        if(avg[x]['type'] == 'temp') {
            if(Math.round(avg[x]['val']) > 40) {
                alarmSend(date1, date2, "Smart Home", `Suhu ${avg[x]['room']} terlalu tinggi!`, avg[x]['house_id']);
            } 
            else if (Math.round(avg[x]['val']) < 20) {
                alarmSend(date1, date2, "Smart Home", `Suhu ${avg[x]['room']} terlalu rendah!`, avg[x]['house_id']);
            }
        }
        if(avg[x]['type'] == 'gas') {
            if(Math.round(avg[x]['val']) > 800) {
                alarmSend(date1, date2, "Smart Home", `Terjadi kebocoran gas! Segera cek gas ${avg[x]['room']}!`, avg[x]['house_id']);
            }
        }

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
        avgTrend[i]['val'] = sumTrend[i]['val'] / valTrend[i]['val'];
    }

    for(i = 0; i < sensorData.length; i++) {
        for(j = 0; j < avgTrend.length; j++) {
            if(avgTrend[j]['house_id'] == sensorData[i]['house_id'] && avgTrend[j]['room'] == sensorData[i]['room'] && avgTrend[j]['type'] == sensorData[i]['sensor_type'] ) {
                if(sensorData[i]['trend'] == "yes") {
                    trendVal(`${avgTrend[j]['house_id']}_house_trend`, avgTrend[j]['room'], avgTrend[j]['type'], dateFix, avgTrend[j]['val'], avgTrend[j]['house_id']);
                    // console.log(`${avgTrend[j]['house_id']} == ${avgTrend[j]['room']} == ${avgTrend[j]['type']} == ${avgTrend[j]['val']}`);
                }
            }
        }
    }

    for(i = 0; i < sumTrend.length; i++) {
        sumTrend[i]['val'] = 0;
        valTrend[i]['val'] = 0;
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
        if (err) {
            console.log('ERROR' + err['sql'])
        } else {
            let sql = `SELECT * FROM ${nowType} WHERE room='${room}' AND type='${sensor_type}' ORDER BY DATE DESC;`;
            let query = conn.query(sql, (err,result)=>{
                if (err) throw err;
                var string = JSON.stringify(result);
                var count = JSON.parse(string);
                trendSend = '['
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
                        "value": ${getVal},
                        "date": "${myDate.toLocaleDateString('en-GB')}",
                        "time": "${myDate.toLocaleTimeString('en-GB')}"
                    }`
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

function alarmSend(date, time, type, message, houseid) {
    for(i = 0; i < elderData.length; i++){
        if(elderData[i]['house_id'] == houseid) {
            client.publish(`${elderData[i]['elder_id']}/apps/alarm`, `
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